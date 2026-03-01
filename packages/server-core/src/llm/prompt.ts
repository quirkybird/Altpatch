import type { ModifyRequest, MultiFilePlanItem } from '../types';

type PromptScope =
  | { mode: 'full' }
  | { mode: 'local'; startLine: number; endLine: number };

export function buildModifyMessages(
  source: string,
  request: ModifyRequest,
  scope: PromptScope = { mode: 'full' }
): Array<{ role: 'system' | 'user'; content: string }> {
  const locationText = request.location
    ? `line=${request.location.line}, column=${request.location.column}, framework=${request.location.framework ?? 'unknown'}`
    : 'unknown';
  const scopeText =
    scope.mode === 'local'
      ? `local-window lines ${scope.startLine}-${scope.endLine} (ONLY edit within this window)`
      : 'full-file';
  const relatedFilesText = (request.relatedFiles ?? [])
    .slice(0, 8)
    .map((item, index) => {
      const trimmed = item.content.length > 8000 ? `${item.content.slice(0, 8000)}\n...<trimmed>` : item.content;
      return [`[related#${index + 1}] ${item.filePath}`, trimmed].join('\n');
    })
    .join('\n\n');

  return [
    {
      role: 'system',
      content: [
        'You are a precise code modification engine.',
        'Return a JSON object only. No markdown, no code fences, no extra text.',
        'Modify the provided source file according to instruction with minimal safe changes.',
        scope.mode === 'local'
          ? 'The "after" field must be the full updated LOCAL WINDOW content only. Do not include text outside window.'
          : 'The "after" field must be the full updated file content.'
      ].join(' ')
    },
    {
      role: 'user',
      content: [
        `filePath: ${request.filePath}`,
        `location: ${locationText}`,
        `scope: ${scopeText}`,
        `instruction: ${request.instruction}`,
        relatedFilesText
          ? ['relatedFiles (read-only context, do not output these files):', relatedFilesText].join('\n')
          : '',
        'source:',
        source
      ].join('\n')
    }
  ];
}

export function buildMultiFilePlanMessages(input: {
  entryFilePath: string;
  instruction: string;
  source: string;
  importedFilePaths: string[];
  maxFiles: number;
}): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    {
      role: 'system',
      content: [
        'You are a code-edit planning agent.',
        'Return JSON only.',
        'Plan minimal file-level edits for one request.',
        'Each plan item must include filePath and instruction.',
        'Prefer editing as few files as possible.',
        'Do not include files that do not need edits.'
      ].join(' ')
    },
    {
      role: 'user',
      content: [
        `entryFilePath: ${input.entryFilePath}`,
        `maxFiles: ${input.maxFiles}`,
        `instruction: ${input.instruction}`,
        `candidateImportedFiles: ${input.importedFilePaths.join(', ') || '(none)'}`,
        'entrySource:',
        input.source
      ].join('\n')
    }
  ];
}

export function sanitizeMultiFilePlanItems(items: MultiFilePlanItem[], maxFiles: number): MultiFilePlanItem[] {
  const seen = new Set<string>();
  const out: MultiFilePlanItem[] = [];
  for (const item of items) {
    const filePath = String(item.filePath ?? '').trim();
    const instruction = String(item.instruction ?? '').trim();
    if (!filePath || !instruction) continue;
    if (seen.has(filePath)) continue;
    seen.add(filePath);
    out.push({ filePath, instruction, reason: item.reason?.trim() || undefined });
    if (out.length >= maxFiles) break;
  }
  return out;
}

export function buildSyntaxRepairMessages(input: {
  filePath: string;
  scope: PromptScope;
  instruction: string;
  brokenAfter: string;
  syntaxReason: string;
}): Array<{ role: 'system' | 'user'; content: string }> {
  const scopeText =
    input.scope.mode === 'local'
      ? `local-window lines ${input.scope.startLine}-${input.scope.endLine}`
      : 'full-file';

  return [
    {
      role: 'system',
      content: [
        'You are a syntax repair engine.',
        'Return JSON object only.',
        'Only fix syntax/parsing issues in the provided code.',
        'Do not change business logic, identifiers, behavior, comments, or formatting style unless required for parsing.',
        input.scope.mode === 'local'
          ? 'The "after" field must be full repaired LOCAL WINDOW content only.'
          : 'The "after" field must be full repaired file content.'
      ].join(' ')
    },
    {
      role: 'user',
      content: [
        `filePath: ${input.filePath}`,
        `scope: ${scopeText}`,
        `originalInstruction: ${input.instruction}`,
        `syntaxError: ${input.syntaxReason}`,
        'brokenAfter:',
        input.brokenAfter
      ].join('\n')
    }
  ];
}
