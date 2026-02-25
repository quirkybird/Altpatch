import { z } from 'zod';
import type { ViteDevServer } from 'vite';
import { FsGuard, buildDiff, modifyWithMockLLM } from '../../../server-core/src/index';
import { readJson, sendJson } from './utils';

const readFileSchema = z.object({ filePath: z.string().min(1) });
const modifySchema = z.object({
  filePath: z.string().min(1),
  instruction: z.string().min(1),
  location: z.object({ line: z.number(), column: z.number(), framework: z.string().optional() }).optional()
});
const diffSchema = z.object({ filePath: z.string().min(1), before: z.string(), after: z.string() });
const writeFileSchema = z.object({ filePath: z.string().min(1), content: z.string() });

export function attachAltPatchApi(server: ViteDevServer, projectRoot: string, apiPrefix: string): void {
  const fsGuard = new FsGuard(projectRoot);

  server.middlewares.use(async (req, res, next) => {
    if (!req.url || !req.method) {
      return next();
    }

    const pathname = req.url.split('?')[0];
    if (pathname === '/health' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, service: 'altpatch-vite-plugin' });
    }

    if (pathname === `${apiPrefix}/read-file` && req.method === 'POST') {
      let rawBody: unknown;
      try {
        rawBody = await readJson(req);
        const body = readFileSchema.parse(rawBody);
        const content = await fsGuard.read(body.filePath);
        return sendJson(res, 200, { filePath: body.filePath, content });
      } catch (error) {
        return sendJson(res, 400, {
          error: String(error),
          projectRoot,
          path: String(((rawBody as { filePath?: string } | undefined)?.filePath ?? ''))
        });
      }
    }

    if (pathname === `${apiPrefix}/modify` && req.method === 'POST') {
      try {
        const body = modifySchema.parse(await readJson(req));
        const source = await fsGuard.read(body.filePath);
        const result = modifyWithMockLLM(source, body);
        return sendJson(res, 200, result);
      } catch (error) {
        return sendJson(res, 400, { error: String(error) });
      }
    }

    if (pathname === `${apiPrefix}/diff` && req.method === 'POST') {
      try {
        const body = diffSchema.parse(await readJson(req));
        return sendJson(res, 200, buildDiff(body.filePath, body.before, body.after));
      } catch (error) {
        return sendJson(res, 400, { error: String(error) });
      }
    }

    if (pathname === `${apiPrefix}/write-file` && req.method === 'POST') {
      try {
        const body = writeFileSchema.parse(await readJson(req));
        await fsGuard.write(body.filePath, body.content);
        server.ws.send({ type: 'custom', event: 'altpatch:file-written', data: { filePath: body.filePath } });
        server.ws.send({ type: 'custom', event: 'altpatch:reload-hint', data: { filePath: body.filePath } });
        return sendJson(res, 200, { ok: true });
      } catch (error) {
        return sendJson(res, 400, { error: String(error) });
      }
    }

    return next();
  });
}
