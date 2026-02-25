import { Router } from 'express';
import { z } from 'zod';
import type { FsGuard } from '../services/fs-guard';
import type { WebSocketServer } from 'ws';
import { broadcast } from '../services/hmr-bus';

const schema = z.object({ filePath: z.string().min(1), content: z.string() });

export function writeFileRoute(fsGuard: FsGuard, wss: WebSocketServer): Router {
  const router = Router();
  router.post('/api/write-file', async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    await fsGuard.write(parsed.data.filePath, parsed.data.content);
    broadcast(wss, { type: 'file-written', filePath: parsed.data.filePath });
    broadcast(wss, { type: 'reload-hint', filePath: parsed.data.filePath });
    return res.json({ ok: true });
  });
  return router;
}
