import { spawn } from 'node:child_process';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { FsGuard, buildDiff, isLlmEngineError, modifyWithOpenAICompatibleLLM, modifyWithOpenAICompatibleLLMStream, planMultiFileWithOpenAICompatibleLLM, readLlmConfigFromEnv } from '@packages/server-core';
const readFileSchema = z.object({ filePath: z.string().min(1) });
const relatedFileSchema = z.object({
    filePath: z.string().min(1),
    content: z.string()
});
const modifySchema = z.object({
    filePath: z.string().min(1),
    instruction: z.string().min(1),
    relatedFiles: z.array(relatedFileSchema).max(12).optional(),
    scopeMode: z.enum(['local-preferred', 'strict-local', 'full-file']).optional(),
    location: z.object({ line: z.number(), column: z.number(), framework: z.string().optional() }).optional(),
    anchor: z.object({ line: z.number(), column: z.number() }).optional(),
    contextWindow: z.object({ beforeLines: z.number(), afterLines: z.number() }).optional()
});
const modifyMultiSchema = z.object({
    entryFilePath: z.string().min(1),
    instruction: z.string().min(1),
    maxFiles: z.number().int().min(1).max(8).optional(),
    targetFilePaths: z.array(z.string().min(1)).max(8).optional(),
    includeImportedFiles: z.boolean().optional(),
    relatedFiles: z.array(relatedFileSchema).max(12).optional(),
    scopeMode: z.enum(['local-preferred', 'strict-local', 'full-file']).optional(),
    location: z.object({ line: z.number(), column: z.number(), framework: z.string().optional() }).optional(),
    anchor: z.object({ line: z.number(), column: z.number() }).optional(),
    contextWindow: z.object({ beforeLines: z.number(), afterLines: z.number() }).optional()
});
const diffSchema = z.object({ filePath: z.string().min(1), before: z.string(), after: z.string() });
const writeFileSchema = z.object({ filePath: z.string().min(1), content: z.string() });
const writeFilesSchema = z.object({
    files: z.array(writeFileSchema).min(1).max(20)
});
const openInEditorSchema = z.object({
    filePath: z.string().min(1),
    line: z.number().int().min(1).optional(),
    column: z.number().int().min(1).optional()
});
const VSCODE_CLI_CANDIDATES = process.platform === 'win32'
    ? ['code.cmd', 'code-insiders.cmd', 'code', 'code-insiders']
    : ['code', 'code-insiders'];
const DEFAULT_LOCAL_BEFORE_LINES = 80;
const DEFAULT_LOCAL_AFTER_LINES = 80;
const DEFAULT_MULTI_MAX_FILES = 4;
function parseRelativeImportSpecifiers(source) {
    const matches = source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g);
    const out = [];
    for (const match of matches) {
        const spec = (match[1] ?? match[2] ?? '').trim();
        if (!spec.startsWith('.'))
            continue;
        out.push(spec);
    }
    return [...new Set(out)];
}
function resolveRelativeImportCandidates(baseFilePath, specifier) {
    const baseDir = path.posix.dirname(baseFilePath.replace(/\\/g, '/'));
    const target = path.posix.normalize(path.posix.join(baseDir, specifier));
    const ext = path.posix.extname(target);
    if (ext)
        return [target];
    return [
        `${target}.ts`,
        `${target}.tsx`,
        `${target}.js`,
        `${target}.jsx`,
        `${target}/index.ts`,
        `${target}/index.tsx`,
        `${target}/index.js`,
        `${target}/index.jsx`
    ];
}
function resolveScopeWindow(body, source) {
    const hasAnchor = Boolean(body.anchor?.line || body.location?.line);
    const mode = body.scopeMode ?? (hasAnchor ? 'local-preferred' : 'full-file');
    if (mode === 'full-file')
        return { mode: 'full' };
    const anchorLine = body.anchor?.line ?? body.location?.line;
    if (!anchorLine || anchorLine < 1) {
        return mode === 'strict-local' ? { mode: 'local', startLine: 1, endLine: 0 } : { mode: 'full' };
    }
    const lines = source.split('\n');
    const before = Number.isFinite(body.contextWindow?.beforeLines) && (body.contextWindow?.beforeLines ?? 0) > 0
        ? Math.floor(body.contextWindow.beforeLines)
        : DEFAULT_LOCAL_BEFORE_LINES;
    const after = Number.isFinite(body.contextWindow?.afterLines) && (body.contextWindow?.afterLines ?? 0) > 0
        ? Math.floor(body.contextWindow.afterLines)
        : DEFAULT_LOCAL_AFTER_LINES;
    const center = Math.min(Math.max(1, Math.floor(anchorLine)), lines.length);
    return {
        mode: 'local',
        startLine: Math.max(1, center - before),
        endLine: Math.min(lines.length, center + after)
    };
}
function sendJson(res, statusCode, data) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
}
async function readJson(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length === 0) {
        return {};
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function buildVsCodeUri(filePath, line, column) {
    const normalized = filePath.replace(/\\/g, '/');
    const withLeadingSlash = /^[a-zA-Z]:\//.test(normalized) ? `/${normalized}` : normalized;
    return `vscode://file${encodeURI(withLeadingSlash)}:${line}:${column}`;
}
function launchCommand(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            detached: true,
            stdio: 'ignore'
        });
        child.once('error', reject);
        child.once('spawn', () => {
            child.unref();
            resolve();
        });
    });
}
function launchVsCode(binary, target) {
    return launchCommand(binary, ['-g', target]);
}
async function openViaUriProtocol(filePath, line, column) {
    const uri = buildVsCodeUri(filePath, line, column);
    if (process.platform === 'win32') {
        await launchCommand('cmd', ['/c', 'start', '', uri]);
        return;
    }
    if (process.platform === 'darwin') {
        await launchCommand('open', [uri]);
        return;
    }
    await launchCommand('xdg-open', [uri]);
}
async function openInVsCode(filePath, line = 1, column = 1) {
    const target = `${filePath}:${Math.max(1, line)}:${Math.max(1, column)}`;
    const safeLine = Math.max(1, line);
    const safeColumn = Math.max(1, column);
    let lastError = null;
    for (const binary of VSCODE_CLI_CANDIDATES) {
        try {
            await launchVsCode(binary, target);
            return;
        }
        catch (error) {
            lastError = error;
        }
    }
    try {
        await openViaUriProtocol(filePath, safeLine, safeColumn);
        return;
    }
    catch (uriError) {
        throw new Error(`Cannot launch VS Code (CLI and URI both failed). Tried CLI: ${VSCODE_CLI_CANDIDATES.join(', ')}. ` +
            `CLI error: ${String(lastError ?? '')}. URI error: ${String(uriError)}`);
    }
}
function createOps(options) {
    const apiPrefix = options.apiPrefix ?? '/api';
    const fsGuard = new FsGuard(options.projectRoot);
    const env = options.env ?? process.env;
    const llmEnvOverrides = {};
    if (options.llm?.apiKey)
        llmEnvOverrides.ALTPATCH_LLM_API_KEY = options.llm.apiKey;
    if (options.llm?.baseUrl)
        llmEnvOverrides.ALTPATCH_LLM_BASE_URL = options.llm.baseUrl;
    if (options.llm?.model)
        llmEnvOverrides.ALTPATCH_LLM_MODEL = options.llm.model;
    if (typeof options.llm?.timeoutMs === 'number')
        llmEnvOverrides.ALTPATCH_LLM_TIMEOUT_MS = String(options.llm.timeoutMs);
    if (typeof options.llm?.maxTokens === 'number')
        llmEnvOverrides.ALTPATCH_LLM_MAX_TOKENS = String(options.llm.maxTokens);
    const llmConfigEnv = { ...env, ...llmEnvOverrides };
    const llmModel = (llmConfigEnv.ALTPATCH_LLM_MODEL ?? 'gpt-4o-mini').trim() || 'gpt-4o-mini';
    const onFileWritten = options.onFileWritten ?? (() => undefined);
    const onReloadHint = options.onReloadHint ?? (() => undefined);
    async function collectImportedRelatedFiles(filePath, source, limit = 8) {
        const specs = parseRelativeImportSpecifiers(source);
        const related = [];
        const seen = new Set();
        for (const spec of specs) {
            const candidates = resolveRelativeImportCandidates(filePath, spec);
            for (const candidate of candidates) {
                if (seen.has(candidate))
                    continue;
                seen.add(candidate);
                try {
                    const content = await fsGuard.read(candidate);
                    related.push({
                        filePath: candidate,
                        content: content.length > 12_000 ? `${content.slice(0, 12_000)}\n...<trimmed>` : content
                    });
                    break;
                }
                catch {
                    // Ignore unreadable/non-existent candidates.
                }
            }
            if (related.length >= limit)
                break;
        }
        return related;
    }
    return {
        apiPrefix,
        llmInfo() {
            return { model: llmModel };
        },
        async readFile(input) {
            const body = readFileSchema.parse(input);
            const content = await fsGuard.read(body.filePath);
            return { filePath: body.filePath, content };
        },
        async modify(input) {
            const body = modifySchema.parse(input);
            const source = await fsGuard.read(body.filePath);
            const llmConfig = readLlmConfigFromEnv(llmConfigEnv);
            return modifyWithOpenAICompatibleLLM(source, body, llmConfig);
        },
        async modifyStream(input, hooks) {
            const body = modifySchema.parse(input);
            hooks.onStatus({ message: 'started' });
            const source = await fsGuard.read(body.filePath);
            const scopeWindow = resolveScopeWindow(body, source);
            if (scopeWindow.mode === 'local' && typeof scopeWindow.startLine === 'number' && typeof scopeWindow.endLine === 'number') {
                hooks.onScope({ mode: 'local', startLine: scopeWindow.startLine, endLine: scopeWindow.endLine });
            }
            else {
                hooks.onScope({ mode: 'full' });
            }
            const llmConfig = readLlmConfigFromEnv(llmConfigEnv);
            return modifyWithOpenAICompatibleLLMStream(source, body, llmConfig, {
                onDelta(chunk) {
                    hooks.onDelta(chunk);
                }
            });
        },
        async modifyMulti(input) {
            const body = modifyMultiSchema.parse(input);
            const entrySource = await fsGuard.read(body.entryFilePath);
            const importedRelated = body.includeImportedFiles === false
                ? []
                : await collectImportedRelatedFiles(body.entryFilePath, entrySource);
            const mergedRelated = [...(body.relatedFiles ?? []), ...importedRelated];
            const llmConfig = readLlmConfigFromEnv(llmConfigEnv);
            const forcedTargets = (body.targetFilePaths ?? [])
                .map((item) => item.trim())
                .filter((item) => item.length > 0 && item !== body.entryFilePath);
            const forcedPlan = forcedTargets.map((filePath) => ({
                filePath,
                instruction: body.instruction,
                reason: 'forced-target'
            }));
            const plan = forcedPlan.length > 0
                ? forcedPlan
                : await planMultiFileWithOpenAICompatibleLLM({
                    entryFilePath: body.entryFilePath,
                    instruction: body.instruction,
                    source: entrySource,
                    importedFilePaths: importedRelated.map((item) => item.filePath),
                    maxFiles: body.maxFiles ?? DEFAULT_MULTI_MAX_FILES
                }, llmConfig);
            const planWithEntry = [
                { filePath: body.entryFilePath, instruction: body.instruction, reason: 'entry-file' },
                ...plan.filter((item) => item.filePath !== body.entryFilePath)
            ];
            const results = [];
            for (const item of planWithEntry) {
                try {
                    const source = await fsGuard.read(item.filePath);
                    const result = await modifyWithOpenAICompatibleLLM(source, {
                        filePath: item.filePath,
                        instruction: item.instruction,
                        scopeMode: item.filePath === body.entryFilePath ? body.scopeMode : 'full-file',
                        location: item.filePath === body.entryFilePath ? body.location : undefined,
                        anchor: item.filePath === body.entryFilePath ? body.anchor : undefined,
                        contextWindow: item.filePath === body.entryFilePath ? body.contextWindow : undefined,
                        relatedFiles: mergedRelated
                    }, llmConfig);
                    results.push({
                        filePath: item.filePath,
                        instruction: item.instruction,
                        reason: item.reason,
                        result
                    });
                }
                catch (error) {
                    results.push({
                        filePath: item.filePath,
                        instruction: item.instruction,
                        reason: item.reason,
                        error: String(error)
                    });
                }
            }
            return {
                plan: planWithEntry,
                results
            };
        },
        diff(input) {
            const body = diffSchema.parse(input);
            return buildDiff(body.filePath, body.before, body.after);
        },
        async writeFile(input) {
            const body = writeFileSchema.parse(input);
            await fsGuard.write(body.filePath, body.content);
            onFileWritten(body.filePath);
            onReloadHint(body.filePath);
            return { ok: true };
        },
        async writeFiles(input) {
            const body = writeFilesSchema.parse(input);
            const backups = new Map();
            const written = [];
            try {
                for (const file of body.files) {
                    if (!backups.has(file.filePath)) {
                        backups.set(file.filePath, await fsGuard.read(file.filePath));
                    }
                    await fsGuard.write(file.filePath, file.content);
                    written.push(file.filePath);
                    onFileWritten(file.filePath);
                    onReloadHint(file.filePath);
                }
            }
            catch (error) {
                for (const filePath of written.reverse()) {
                    const before = backups.get(filePath);
                    if (typeof before === 'string') {
                        try {
                            await fsGuard.write(filePath, before);
                        }
                        catch {
                            // Ignore rollback failures here, caller already gets failure.
                        }
                    }
                }
                throw error;
            }
            return { ok: true, count: body.files.length };
        },
        async openInEditor(input) {
            const body = openInEditorSchema.parse(input);
            const safeFilePath = fsGuard.resolve(body.filePath);
            await openInVsCode(safeFilePath, body.line ?? 1, body.column ?? 1);
            return { ok: true };
        }
    };
}
function sendSse(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}
export function registerAltpatchViteApi(server, options) {
    const ops = createOps({
        ...options,
        onFileWritten: (filePath) => {
            options.onFileWritten?.(filePath);
            server.ws.send({ type: 'custom', event: 'altpatch:file-written', data: { filePath } });
        },
        onReloadHint: (filePath) => {
            options.onReloadHint?.(filePath);
            server.ws.send({ type: 'custom', event: 'altpatch:reload-hint', data: { filePath } });
        }
    });
    server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.method)
            return next();
        const pathname = req.url.split('?')[0];
        if (pathname === '/health' && req.method === 'GET') {
            return sendJson(res, 200, { ok: true, service: 'altpatch-vite-plugin' });
        }
        if (pathname === `${ops.apiPrefix}/llm-config` && req.method === 'GET') {
            return sendJson(res, 200, ops.llmInfo());
        }
        if (pathname === `${ops.apiPrefix}/read-file` && req.method === 'POST') {
            let rawBody;
            try {
                rawBody = await readJson(req);
                const out = await ops.readFile(rawBody);
                return sendJson(res, 200, out);
            }
            catch (error) {
                return sendJson(res, 400, {
                    error: String(error),
                    projectRoot: options.projectRoot,
                    path: String((rawBody?.filePath ?? ''))
                });
            }
        }
        if (pathname === `${ops.apiPrefix}/modify` && req.method === 'POST') {
            try {
                const out = await ops.modify(await readJson(req));
                return sendJson(res, 200, out);
            }
            catch (error) {
                if (isLlmEngineError(error)) {
                    if (error.code === 'PARSE_ERROR' && error.details?.responseBodyPreview) {
                        console.error('[altpatch] LLM raw output preview (PARSE_ERROR):\n', error.details.responseBodyPreview);
                    }
                    const status = error.code === 'CONFIG_ERROR' ? 500 : error.code === 'SCOPE_ERROR' ? 422 : 502;
                    return sendJson(res, status, { error: error.message, code: error.code, details: error.details });
                }
                return sendJson(res, 500, { error: String(error) });
            }
        }
        if (pathname === `${ops.apiPrefix}/modify-stream` && req.method === 'POST') {
            let input;
            try {
                input = await readJson(req);
            }
            catch (error) {
                return sendJson(res, 400, { error: String(error) });
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders?.();
            try {
                const out = await ops.modifyStream(input, {
                    onStatus(payload) {
                        sendSse(res, 'status', payload);
                    },
                    onScope(payload) {
                        sendSse(res, 'scope', payload);
                    },
                    onDelta(chunk) {
                        sendSse(res, 'delta', { content: chunk });
                    }
                });
                sendSse(res, 'done', out);
            }
            catch (error) {
                if (isLlmEngineError(error)) {
                    if (error.code === 'PARSE_ERROR' && error.details?.responseBodyPreview) {
                        console.error('[altpatch] LLM raw output preview (PARSE_ERROR):\n', error.details.responseBodyPreview);
                    }
                    sendSse(res, 'error', { error: error.message, code: error.code, details: error.details });
                }
                else {
                    sendSse(res, 'error', { error: String(error) });
                }
            }
            finally {
                res.end();
            }
            return;
        }
        if (pathname === `${ops.apiPrefix}/modify-multi` && req.method === 'POST') {
            try {
                const out = await ops.modifyMulti(await readJson(req));
                return sendJson(res, 200, out);
            }
            catch (error) {
                if (isLlmEngineError(error)) {
                    const status = error.code === 'CONFIG_ERROR' ? 500 : error.code === 'SCOPE_ERROR' ? 422 : 502;
                    return sendJson(res, status, { error: error.message, code: error.code, details: error.details });
                }
                return sendJson(res, 500, { error: String(error) });
            }
        }
        if (pathname === `${ops.apiPrefix}/diff` && req.method === 'POST') {
            try {
                const out = ops.diff(await readJson(req));
                return sendJson(res, 200, out);
            }
            catch (error) {
                return sendJson(res, 400, { error: String(error) });
            }
        }
        if (pathname === `${ops.apiPrefix}/write-file` && req.method === 'POST') {
            try {
                const out = await ops.writeFile(await readJson(req));
                return sendJson(res, 200, out);
            }
            catch (error) {
                return sendJson(res, 400, { error: String(error) });
            }
        }
        if (pathname === `${ops.apiPrefix}/write-files` && req.method === 'POST') {
            try {
                const out = await ops.writeFiles(await readJson(req));
                return sendJson(res, 200, out);
            }
            catch (error) {
                return sendJson(res, 400, { error: String(error) });
            }
        }
        if (pathname === `${ops.apiPrefix}/open-in-editor` && req.method === 'POST') {
            try {
                const out = await ops.openInEditor(await readJson(req));
                return sendJson(res, 200, out);
            }
            catch (error) {
                return sendJson(res, 400, { error: String(error) });
            }
        }
        return next();
    });
}
export function createAltpatchExpressRouter(options) {
    const router = Router();
    const ops = createOps({
        ...options,
        onFileWritten: (filePath) => {
            options.onFileWritten?.(filePath);
            if (!options.wss)
                return;
            const payload = JSON.stringify({ type: 'file-written', filePath });
            options.wss.clients.forEach((client) => {
                if (client.readyState === 1)
                    client.send(payload);
            });
        },
        onReloadHint: (filePath) => {
            options.onReloadHint?.(filePath);
            if (!options.wss)
                return;
            const payload = JSON.stringify({ type: 'reload-hint', filePath });
            options.wss.clients.forEach((client) => {
                if (client.readyState === 1)
                    client.send(payload);
            });
        }
    });
    router.get('/health', (_req, res) => {
        res.json({ ok: true, service: 'altpatch-server' });
    });
    router.get(`${ops.apiPrefix}/llm-config`, (_req, res) => {
        return res.json(ops.llmInfo());
    });
    router.post(`${ops.apiPrefix}/read-file`, async (req, res) => {
        try {
            const out = await ops.readFile(req.body);
            return res.json(out);
        }
        catch (error) {
            return res.status(400).json({ error: String(error) });
        }
    });
    router.post(`${ops.apiPrefix}/modify`, async (req, res) => {
        try {
            const out = await ops.modify(req.body);
            return res.json(out);
        }
        catch (error) {
            if (isLlmEngineError(error)) {
                if (error.code === 'PARSE_ERROR' && error.details?.responseBodyPreview) {
                    console.error('[altpatch] LLM raw output preview (PARSE_ERROR):\n', error.details.responseBodyPreview);
                }
                const status = error.code === 'CONFIG_ERROR' ? 500 : error.code === 'SCOPE_ERROR' ? 422 : 502;
                return res.status(status).json({ error: error.message, code: error.code, details: error.details });
            }
            return res.status(500).json({ error: String(error) });
        }
    });
    router.post(`${ops.apiPrefix}/modify-stream`, async (req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
        try {
            const out = await ops.modifyStream(req.body, {
                onStatus(payload) {
                    sendSse(res, 'status', payload);
                },
                onScope(payload) {
                    sendSse(res, 'scope', payload);
                },
                onDelta(chunk) {
                    sendSse(res, 'delta', { content: chunk });
                }
            });
            sendSse(res, 'done', out);
        }
        catch (error) {
            if (isLlmEngineError(error)) {
                if (error.code === 'PARSE_ERROR' && error.details?.responseBodyPreview) {
                    console.error('[altpatch] LLM raw output preview (PARSE_ERROR):\n', error.details.responseBodyPreview);
                }
                sendSse(res, 'error', { error: error.message, code: error.code, details: error.details });
            }
            else {
                sendSse(res, 'error', { error: String(error) });
            }
        }
        finally {
            res.end();
        }
    });
    router.post(`${ops.apiPrefix}/modify-multi`, async (req, res) => {
        try {
            const out = await ops.modifyMulti(req.body);
            return res.json(out);
        }
        catch (error) {
            if (isLlmEngineError(error)) {
                const status = error.code === 'CONFIG_ERROR' ? 500 : error.code === 'SCOPE_ERROR' ? 422 : 502;
                return res.status(status).json({ error: error.message, code: error.code, details: error.details });
            }
            return res.status(500).json({ error: String(error) });
        }
    });
    router.post(`${ops.apiPrefix}/diff`, (req, res) => {
        try {
            const out = ops.diff(req.body);
            return res.json(out);
        }
        catch (error) {
            return res.status(400).json({ error: String(error) });
        }
    });
    router.post(`${ops.apiPrefix}/write-file`, async (req, res) => {
        try {
            const out = await ops.writeFile(req.body);
            return res.json(out);
        }
        catch (error) {
            return res.status(400).json({ error: String(error) });
        }
    });
    router.post(`${ops.apiPrefix}/write-files`, async (req, res) => {
        try {
            const out = await ops.writeFiles(req.body);
            return res.json(out);
        }
        catch (error) {
            return res.status(400).json({ error: String(error) });
        }
    });
    router.post(`${ops.apiPrefix}/open-in-editor`, async (req, res) => {
        try {
            const out = await ops.openInEditor(req.body);
            return res.json(out);
        }
        catch (error) {
            return res.status(400).json({ error: String(error) });
        }
    });
    return router;
}
export function registerAltpatchExpressApi(app, options) {
    app.use(createAltpatchExpressRouter(options));
}
//# sourceMappingURL=index.js.map