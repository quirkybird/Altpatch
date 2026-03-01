import { buildDiff } from '../diff';
import type { ModifyRequest, ModifyResponse, MultiFilePlanItem } from '../types';
import { buildModifyMessages, buildMultiFilePlanMessages, buildSyntaxRepairMessages, sanitizeMultiFilePlanItems } from './prompt';
import {
  structuredModifyOutputJsonSchema,
  structuredModifyOutputSchema,
  multiFilePlanOutputJsonSchema,
  multiFilePlanOutputSchema
} from './schema';
import { LlmEngineError, type LlmProviderConfig } from './types';
import { validateSyntax } from './syntax-guard';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_SOURCE_CHARS = 120_000;
const RAW_PREVIEW_LIMIT = 4000;
const DEFAULT_LOCAL_BEFORE_LINES = 80;
const DEFAULT_LOCAL_AFTER_LINES = 80;

type PromptScope = { mode: 'full' } | { mode: 'local'; startLine: number; endLine: number };
type ScopePlan = {
  mode: 'full' | 'local';
  sourceForModel: string;
  promptScope: PromptScope;
  mergeAfter: (modelAfter: string) => string;
  windowLineCount: number;
};

function normalizeBaseUrl(input: string): string {
  const parsed = new URL(input);
  return parsed.href.replace(/\/+$/, '');
}

function parseTimeoutMs(input: string | undefined): number {
  if (!input) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new LlmEngineError('CONFIG_ERROR', 'ALTPATCH_LLM_TIMEOUT_MS must be a positive number.');
  }
  return Math.floor(parsed);
}

function parseMaxTokens(input: string | undefined): number | undefined {
  if (!input) return undefined;
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new LlmEngineError('CONFIG_ERROR', 'ALTPATCH_LLM_MAX_TOKENS must be a positive number.');
  }
  return Math.floor(parsed);
}

function clampPositiveInt(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || (value as number) <= 0) return fallback;
  return Math.floor(value as number);
}

function looksLikeNeedsWiderScope(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  return /(not enough context|insufficient context|need more context|cannot determine|缺少上下文|上下文不足)/i.test(trimmed);
}

function buildScopePlan(source: string, request: ModifyRequest): ScopePlan {
  const lineCount = source.split('\n').length;
  const explicitMode = request.scopeMode;
  const hasAnchor = Boolean(request.anchor?.line || request.location?.line);
  const mode: 'full-file' | 'local-preferred' | 'strict-local' =
    explicitMode ?? (hasAnchor ? 'local-preferred' : 'full-file');

  if (mode === 'full-file') {
    return {
      mode: 'full',
      sourceForModel: source,
      promptScope: { mode: 'full' },
      mergeAfter: (modelAfter) => modelAfter,
      windowLineCount: lineCount
    };
  }

  const anchorLine = request.anchor?.line ?? request.location?.line;
  if (!anchorLine || anchorLine < 1) {
    if (mode === 'strict-local') {
      throw new LlmEngineError('SCOPE_ERROR', 'Strict local mode requires a valid anchor/location line.');
    }
    return {
      mode: 'full',
      sourceForModel: source,
      promptScope: { mode: 'full' },
      mergeAfter: (modelAfter) => modelAfter,
      windowLineCount: lineCount
    };
  }

  const before = clampPositiveInt(request.contextWindow?.beforeLines, DEFAULT_LOCAL_BEFORE_LINES);
  const after = clampPositiveInt(request.contextWindow?.afterLines, DEFAULT_LOCAL_AFTER_LINES);

  const lines = source.split('\n');
  const center = Math.min(Math.max(1, Math.floor(anchorLine)), lines.length);
  const startLine = Math.max(1, center - before);
  const endLine = Math.min(lines.length, center + after);
  const startIndex = startLine - 1;
  const endIndexExclusive = endLine;

  const prefix = lines.slice(0, startIndex).join('\n');
  const windowSource = lines.slice(startIndex, endIndexExclusive).join('\n');
  const suffix = lines.slice(endIndexExclusive).join('\n');

  return {
    mode: 'local',
    sourceForModel: windowSource,
    promptScope: { mode: 'local', startLine, endLine },
    mergeAfter: (modelAfter) => {
      const out: string[] = [];
      if (prefix.length > 0) out.push(prefix);
      out.push(modelAfter);
      if (suffix.length > 0) out.push(suffix);
      return out.join('\n');
    },
    windowLineCount: endLine - startLine + 1
  };
}

export function readLlmConfigFromEnv(env: NodeJS.ProcessEnv): LlmProviderConfig {
  const apiKey = env.ALTPATCH_LLM_API_KEY?.trim();
  if (!apiKey) {
    throw new LlmEngineError('CONFIG_ERROR', 'Missing ALTPATCH_LLM_API_KEY.');
  }

  const rawBaseUrl = (env.ALTPATCH_LLM_BASE_URL ?? DEFAULT_BASE_URL).trim();
  let baseUrl = DEFAULT_BASE_URL;
  try {
    baseUrl = normalizeBaseUrl(rawBaseUrl);
  } catch {
    throw new LlmEngineError('CONFIG_ERROR', `Invalid ALTPATCH_LLM_BASE_URL: ${rawBaseUrl}`);
  }

  const model = (env.ALTPATCH_LLM_MODEL ?? DEFAULT_MODEL).trim();
  if (!model) {
    throw new LlmEngineError('CONFIG_ERROR', 'ALTPATCH_LLM_MODEL cannot be empty.');
  }

  return {
    apiKey,
    baseUrl,
    model,
    timeoutMs: parseTimeoutMs(env.ALTPATCH_LLM_TIMEOUT_MS),
    maxTokens: parseMaxTokens(env.ALTPATCH_LLM_MAX_TOKENS)
  };
}

function extractContentString(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof (part as { text?: unknown }).text === 'string') {
          return (part as { text: string }).text;
        }
        return '';
      })
      .join('');
    return text;
  }
  return '';
}

function stripMarkdownCodeFence(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function extractSingleCodeFence(input: string): string | null {
  const matches = [...input.matchAll(/```[^\n]*\n([\s\S]*?)```/g)];
  if (matches.length !== 1) return null;
  const body = matches[0]?.[1]?.trim();
  return body && body.length > 0 ? body : null;
}

function extractFirstJsonLikeBlock(input: string): string | null {
  const start = input.search(/[\[{]/);
  if (start < 0) return null;

  const opening = input[start];
  const closing = opening === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === opening) depth += 1;
    if (ch === closing) depth -= 1;

    if (depth === 0) {
      return input.slice(start, i + 1);
    }
  }

  return null;
}

function parseLlmJsonContent(content: string): unknown {
  const normalized = content.replace(/^\uFEFF/, '').trim();
  const afterFragment =
    normalized.startsWith('"after"') || normalized.startsWith("'after'")
      ? `{${normalized}}`
      : normalized;
  const candidates = [
    afterFragment,
    stripMarkdownCodeFence(afterFragment),
    extractFirstJsonLikeBlock(afterFragment)
  ].filter((item): item is string => Boolean(item && item.trim().length > 0));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next candidate.
    }
  }

  throw new Error('invalid-json-content');
}

function decodeLlmOutputToStructured(content: string): unknown {
  try {
    return parseLlmJsonContent(content);
  } catch {
    // Some OpenAI-compatible providers return raw updated code instead of JSON.
    const fencedCode = extractSingleCodeFence(content);
    if (fencedCode) {
      return { after: fencedCode };
    }

    const plain = content.trim();
    if (plain.length > 0 && !/^\s*[\[{]/.test(plain)) {
      return { after: plain };
    }

    throw new Error('invalid-structured-output');
  }
}

async function repairSyntaxOnceWithOpenAICompatibleLLM(
  request: ModifyRequest,
  scopePlan: ScopePlan,
  brokenAfter: string,
  syntaxReason: string,
  config: LlmProviderConfig
): Promise<string> {
  const requestMethod = 'POST';
  const requestUrl = `${config.baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: requestMethod,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        messages: buildSyntaxRepairMessages({
          filePath: request.filePath,
          scope: scopePlan.promptScope,
          instruction: request.instruction,
          brokenAfter,
          syntaxReason
        }),
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'altpatch_syntax_repair_output',
            strict: true,
            schema: structuredModifyOutputJsonSchema
          }
        },
        ...(typeof config.maxTokens === 'number' ? { max_tokens: config.maxTokens } : {})
      }),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LlmEngineError('UPSTREAM_ERROR', `LLM syntax-repair request timed out after ${config.timeoutMs}ms.`, {
        requestMethod,
        requestUrl,
        timeoutMs: config.timeoutMs
      });
    }
    throw new LlmEngineError('UPSTREAM_ERROR', `LLM syntax-repair request failed: ${String(error)}`, {
      requestMethod,
      requestUrl
    });
  }
  clearTimeout(timer);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new LlmEngineError('UPSTREAM_ERROR', `LLM syntax-repair HTTP ${response.status}: ${body.slice(0, 500)}`, {
      requestMethod,
      requestUrl,
      status: response.status,
      responseBodyPreview: body.slice(0, 1000)
    });
  }

  const payloadText = await response.text().catch(() => '');
  const payload = (() => {
    try {
      return JSON.parse(payloadText) as unknown;
    } catch {
      throw new LlmEngineError('PARSE_ERROR', 'LLM syntax-repair response is not valid JSON.', {
        requestMethod,
        requestUrl,
        status: response.status,
        responseBodyPreview: payloadText.slice(0, 1000)
      });
    }
  })();

  const choice = (payload as {
    choices?: Array<{ message?: { content?: unknown; refusal?: unknown }; finish_reason?: unknown }>;
  })?.choices?.[0];
  if (!choice?.message) {
    throw new LlmEngineError('PARSE_ERROR', 'LLM syntax-repair response missing choices[0].message.');
  }
  if (typeof choice.message.refusal === 'string' && choice.message.refusal.length > 0) {
    throw new LlmEngineError('PARSE_ERROR', `LLM syntax-repair refusal: ${choice.message.refusal}`);
  }

  const content = extractContentString(choice.message.content);
  if (!content.trim()) {
    throw new LlmEngineError('PARSE_ERROR', 'LLM syntax-repair content is empty.');
  }

  let decoded: unknown;
  try {
    decoded = decodeLlmOutputToStructured(content);
  } catch {
    throw new LlmEngineError('PARSE_ERROR', 'LLM syntax-repair content is not valid JSON text.', {
      responseBodyPreview: content.slice(0, 1000)
    });
  }
  const parsed = structuredModifyOutputSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new LlmEngineError('PARSE_ERROR', `LLM syntax-repair schema mismatch: ${parsed.error.message}`);
  }

  return parsed.data.after;
}

async function finalizeModifyResult(
  originalSource: string,
  request: ModifyRequest,
  scopePlan: ScopePlan,
  decoded: unknown,
  config: LlmProviderConfig,
  modelTraceId?: string
): Promise<ModifyResponse> {
  const parsed = structuredModifyOutputSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new LlmEngineError('PARSE_ERROR', `LLM JSON schema mismatch: ${parsed.error.message}`);
  }

  const modelAfter = parsed.data.after;
  if (scopePlan.mode === 'local' && looksLikeNeedsWiderScope(modelAfter)) {
    throw new LlmEngineError('SCOPE_ERROR', 'Need wider scope to complete this change.', {
      responseBodyPreview: modelAfter.slice(0, 1000)
    });
  }

  let mergedAfter = scopePlan.mergeAfter(modelAfter);
  const syntaxCheck = validateSyntax(request.filePath, mergedAfter);
  if (!syntaxCheck.ok) {
    console.error(
      `[altpatch][syntax] check=fail parser=${syntaxCheck.parser} filePath=${request.filePath} reason=${syntaxCheck.reason.slice(0, 500)}`
    );
    const repairedModelAfter = await repairSyntaxOnceWithOpenAICompatibleLLM(
      request,
      scopePlan,
      modelAfter,
      syntaxCheck.reason,
      config
    );
    mergedAfter = scopePlan.mergeAfter(repairedModelAfter);
    const repairedCheck = validateSyntax(request.filePath, mergedAfter);
    if (!repairedCheck.ok) {
      console.error(
        `[altpatch][syntax] repair=fail parser=${repairedCheck.parser} filePath=${request.filePath} reason=${repairedCheck.reason.slice(0, 500)}`
      );
      throw new LlmEngineError('PARSE_ERROR', 'Generated code has syntax errors after repair attempt.', {
        responseBodyPreview: repairedCheck.reason.slice(0, 1000)
      });
    }
    console.error(`[altpatch][syntax] repair=success parser=${repairedCheck.parser} filePath=${request.filePath}`);
  } else {
    console.error(`[altpatch][syntax] check=pass parser=${syntaxCheck.parser} filePath=${request.filePath}`);
  }
  const diffResult = buildDiff(request.filePath, originalSource, mergedAfter);

  if (scopePlan.mode === 'local') {
    const changedLines = diffResult.diff.filter((line) => line.type !== 'ctx').length;
    const maxAllowedChangedLines = Math.max(24, Math.ceil(scopePlan.windowLineCount * 3));
    if (changedLines > maxAllowedChangedLines) {
      throw new LlmEngineError('SCOPE_ERROR', 'Unexpected scope expansion detected. Please widen scope and retry.', {
        responseBodyPreview: `changedLines=${changedLines}, maxAllowedChangedLines=${maxAllowedChangedLines}`
      });
    }
  }

  return {
    patch: diffResult.patch,
    before: originalSource,
    after: mergedAfter,
    diff: diffResult.diff,
    explanation: parsed.data.explanation,
    confidence: parsed.data.confidence,
    modelTraceId
  };
}

export async function planMultiFileWithOpenAICompatibleLLM(
  input: {
    entryFilePath: string;
    instruction: string;
    source: string;
    importedFilePaths: string[];
    maxFiles: number;
  },
  config: LlmProviderConfig
): Promise<MultiFilePlanItem[]> {
  const requestMethod = 'POST';
  const requestUrl = `${config.baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: requestMethod,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        messages: buildMultiFilePlanMessages(input),
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'altpatch_multi_file_plan',
            strict: true,
            schema: multiFilePlanOutputJsonSchema
          }
        }
      }),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LlmEngineError('UPSTREAM_ERROR', `LLM request timed out after ${config.timeoutMs}ms.`, {
        requestMethod,
        requestUrl,
        timeoutMs: config.timeoutMs
      });
    }
    throw new LlmEngineError('UPSTREAM_ERROR', `LLM request failed: ${String(error)}`, {
      requestMethod,
      requestUrl
    });
  }
  clearTimeout(timer);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new LlmEngineError('UPSTREAM_ERROR', `LLM HTTP ${response.status}: ${body.slice(0, 500)}`, {
      requestMethod,
      requestUrl,
      status: response.status,
      responseBodyPreview: body.slice(0, 1000)
    });
  }

  const payload = await response.json().catch(() => {
    throw new LlmEngineError('PARSE_ERROR', 'LLM response is not valid JSON.');
  });
  const choice = (payload as {
    choices?: Array<{ message?: { content?: unknown; refusal?: unknown } }>;
  })?.choices?.[0];
  if (!choice?.message) {
    throw new LlmEngineError('PARSE_ERROR', 'LLM response missing choices[0].message.');
  }
  if (typeof choice.message.refusal === 'string' && choice.message.refusal.length > 0) {
    throw new LlmEngineError('PARSE_ERROR', `LLM refusal: ${choice.message.refusal}`);
  }

  const content = extractContentString(choice.message.content);
  if (!content.trim()) {
    return [];
  }

  let decoded: unknown;
  try {
    decoded = parseLlmJsonContent(content);
  } catch {
    throw new LlmEngineError('PARSE_ERROR', 'LLM plan content is not valid JSON text.', {
      responseBodyPreview: content.slice(0, 1000)
    });
  }
  const parsed = multiFilePlanOutputSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new LlmEngineError('PARSE_ERROR', `LLM multi-file plan schema mismatch: ${parsed.error.message}`);
  }

  return sanitizeMultiFilePlanItems(parsed.data.files, input.maxFiles);
}

type StreamHooks = {
  onDelta?: (chunk: string) => void;
};

export async function modifyWithOpenAICompatibleLLM(
  source: string,
  request: ModifyRequest,
  config: LlmProviderConfig
): Promise<ModifyResponse> {
  if (source.length > MAX_SOURCE_CHARS) {
    throw new LlmEngineError(
      'UPSTREAM_ERROR',
      `Source file is too large for LLM request (${source.length} chars > ${MAX_SOURCE_CHARS}).`
    );
  }
  const scopePlan = buildScopePlan(source, request);
  const sourceForModel = scopePlan.sourceForModel;
  const promptScope = scopePlan.promptScope;

  const requestMethod = 'POST';
  const requestUrl = `${config.baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  let response: Response | null = null;
  let attempt = 0;
  let lastUpstreamStatus: number | undefined;
  let lastUpstreamBody = '';
  const responseFormats: Array<
    | {
        type: 'json_schema';
        json_schema: {
          name: string;
          strict: true;
          schema: typeof structuredModifyOutputJsonSchema;
        };
      }
    | { type: 'json_object' }
    | undefined
  > = [
    {
      type: 'json_schema',
      json_schema: {
        name: 'altpatch_modify_output',
        strict: true,
        schema: structuredModifyOutputJsonSchema
      }
    },
    { type: 'json_object' },
    undefined
  ];
  try {
    for (const responseFormat of responseFormats) {
      attempt += 1;
      const startedAt = Date.now();
      response = await fetch(requestUrl, {
        method: requestMethod,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0,
          messages: buildModifyMessages(sourceForModel, request, promptScope),
          ...(typeof config.maxTokens === 'number' ? { max_tokens: config.maxTokens } : {}),
          ...(responseFormat ? { response_format: responseFormat } : {})
        }),
        signal: controller.signal
      });
      const elapsed = Date.now() - startedAt;

      if (response.ok) {
        console.error(`[altpatch][llm] attempt=${attempt} status=${response.status} elapsedMs=${elapsed}`);
        break;
      }

      const body = await response.text().catch(() => '');
      console.error(
        `[altpatch][llm] attempt=${attempt} status=${response.status} elapsedMs=${elapsed} errorBodyPreview=${body.slice(0, RAW_PREVIEW_LIMIT)}`
      );
      lastUpstreamStatus = response.status;
      lastUpstreamBody = body;
      const schemaUnsupported =
        response.status === 400 &&
        (/response_format\.type/i.test(body) || /json_schema/i.test(body) || /not supported by this model/i.test(body));

      if (schemaUnsupported) {
        continue;
      }

      throw new LlmEngineError('UPSTREAM_ERROR', `LLM HTTP ${response.status}: ${body.slice(0, 500)}`, {
        requestMethod,
        requestUrl,
        status: response.status,
        responseBodyPreview: body.slice(0, 1000)
      });
    }
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof LlmEngineError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(
        `[altpatch][llm] timeout after ${config.timeoutMs}ms (attempt=${attempt || 1}) requestUrl=${requestUrl}`
      );
      throw new LlmEngineError('UPSTREAM_ERROR', `LLM request timed out after ${config.timeoutMs}ms.`, {
        requestMethod,
        requestUrl,
        timeoutMs: config.timeoutMs
      });
    }
    throw new LlmEngineError('UPSTREAM_ERROR', `LLM request failed: ${String(error)}`, {
      requestMethod,
      requestUrl
    });
  }
  clearTimeout(timer);

  if (!response || !response.ok) {
    const preview = lastUpstreamBody || '';
    throw new LlmEngineError(
      'UPSTREAM_ERROR',
      `LLM HTTP ${lastUpstreamStatus ?? 'unknown'}: ${preview.slice(0, 500)}`,
      {
        requestMethod,
        requestUrl,
        status: lastUpstreamStatus,
        responseBodyPreview: preview.slice(0, 1000)
      }
    );
  }

  const rawPayloadText = await response.text().catch(() => '');
  console.error(`[altpatch][llm] successBodyPreview=${rawPayloadText.slice(0, RAW_PREVIEW_LIMIT)}`);
  const payload = (() => {
    try {
      return JSON.parse(rawPayloadText) as unknown;
    } catch {
      throw new LlmEngineError('PARSE_ERROR', 'LLM response is not valid JSON.', {
        requestMethod,
        requestUrl,
        status: response.status,
        responseBodyPreview: rawPayloadText.slice(0, 1000)
      });
    }
  })();

  const choice = (payload as {
    choices?: Array<{ message?: { content?: unknown; refusal?: unknown }; finish_reason?: unknown }>;
  })?.choices?.[0];
  if (!choice?.message) {
    throw new LlmEngineError('PARSE_ERROR', 'LLM response missing choices[0].message.');
  }
  if (typeof choice.message.refusal === 'string' && choice.message.refusal.length > 0) {
    throw new LlmEngineError('PARSE_ERROR', `LLM refusal: ${choice.message.refusal}`);
  }

  const content = extractContentString(choice.message.content);
  if (!content.trim()) {
    throw new LlmEngineError('PARSE_ERROR', 'LLM content is empty.');
  }

  let decoded: unknown;
  try {
    decoded = decodeLlmOutputToStructured(content);
  } catch {
    if (choice.finish_reason === 'length') {
      throw new LlmEngineError('UPSTREAM_ERROR', 'LLM output was truncated (finish_reason=length).', {
        responseBodyPreview: content.slice(0, 1000)
      });
    }
    throw new LlmEngineError('PARSE_ERROR', 'LLM content is not valid JSON text.', {
      responseBodyPreview: content.slice(0, 1000)
    });
  }

  return await finalizeModifyResult(
    source,
    request,
    scopePlan,
    decoded,
    config,
    typeof (payload as { id?: unknown }).id === 'string' ? (payload as { id: string }).id : undefined
  );
}

export async function modifyWithOpenAICompatibleLLMStream(
  source: string,
  request: ModifyRequest,
  config: LlmProviderConfig,
  hooks: StreamHooks = {}
): Promise<ModifyResponse> {
  if (source.length > MAX_SOURCE_CHARS) {
    throw new LlmEngineError(
      'UPSTREAM_ERROR',
      `Source file is too large for LLM request (${source.length} chars > ${MAX_SOURCE_CHARS}).`
    );
  }
  const scopePlan = buildScopePlan(source, request);
  const sourceForModel = scopePlan.sourceForModel;
  const promptScope = scopePlan.promptScope;

  const requestMethod = 'POST';
  const requestUrl = `${config.baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  let response: Response;
  const startedAt = Date.now();
  try {
    response = await fetch(requestUrl, {
      method: requestMethod,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        messages: buildModifyMessages(sourceForModel, request, promptScope),
        stream: true,
        ...(typeof config.maxTokens === 'number' ? { max_tokens: config.maxTokens } : {})
      }),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LlmEngineError('UPSTREAM_ERROR', `LLM request timed out after ${config.timeoutMs}ms.`, {
        requestMethod,
        requestUrl,
        timeoutMs: config.timeoutMs
      });
    }
    throw new LlmEngineError('UPSTREAM_ERROR', `LLM request failed: ${String(error)}`, {
      requestMethod,
      requestUrl
    });
  }

  if (!response.ok) {
    clearTimeout(timer);
    const body = await response.text().catch(() => '');
    throw new LlmEngineError('UPSTREAM_ERROR', `LLM HTTP ${response.status}: ${body.slice(0, 500)}`, {
      requestMethod,
      requestUrl,
      status: response.status,
      responseBodyPreview: body.slice(0, 1000)
    });
  }

  if (!response.body) {
    clearTimeout(timer);
    throw new LlmEngineError('UPSTREAM_ERROR', 'LLM stream response has no body.', {
      requestMethod,
      requestUrl,
      status: response.status
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let done = false;
  let content = '';
  let finishReason: unknown;
  let modelTraceId: string | undefined;

  const consumeEventBlock = (block: string): void => {
    const lines = block.split('\n');
    const data = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n')
      .trim();
    if (!data) return;
    if (data === '[DONE]') {
      done = true;
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    if (typeof parsed?.id === 'string') {
      modelTraceId = parsed.id;
    }
    const choice = parsed?.choices?.[0];
    if (!choice) return;

    if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
      finishReason = choice.finish_reason;
    }

    const chunk = extractContentString(choice?.delta?.content);
    if (chunk) {
      content += chunk;
      hooks.onDelta?.(chunk);
    }
  };

  try {
    while (!done) {
      const read = await reader.read();
      if (read.done) break;
      buffer += decoder.decode(read.value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 2);
        if (block) consumeEventBlock(block);
        boundary = buffer.indexOf('\n\n');
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LlmEngineError('UPSTREAM_ERROR', `LLM request timed out after ${config.timeoutMs}ms.`, {
        requestMethod,
        requestUrl,
        timeoutMs: config.timeoutMs
      });
    }
    throw new LlmEngineError('UPSTREAM_ERROR', `LLM stream read failed: ${String(error)}`, {
      requestMethod,
      requestUrl
    });
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }

  const tail = (buffer + decoder.decode()).trim();
  if (tail.length > 0) {
    const chunks = tail.split('\n\n');
    for (const block of chunks) {
      const trimmed = block.trim();
      if (trimmed) consumeEventBlock(trimmed);
    }
  }

  console.error(`[altpatch][llm] stream elapsedMs=${Date.now() - startedAt} finishReason=${String(finishReason ?? '')}`);
  if (!content.trim()) {
    throw new LlmEngineError('PARSE_ERROR', 'LLM content is empty.');
  }

  let decoded: unknown;
  try {
    decoded = decodeLlmOutputToStructured(content);
  } catch {
    if (finishReason === 'length') {
      throw new LlmEngineError('UPSTREAM_ERROR', 'LLM output was truncated (finish_reason=length).', {
        responseBodyPreview: content.slice(0, 1000)
      });
    }
    throw new LlmEngineError('PARSE_ERROR', 'LLM content is not valid JSON text.', {
      responseBodyPreview: content.slice(0, 1000)
    });
  }

  return await finalizeModifyResult(source, request, scopePlan, decoded, config, modelTraceId);
}
