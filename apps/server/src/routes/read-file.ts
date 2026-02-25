import { Router } from 'express';
import { z } from 'zod';
import type { FsGuard } from '../services/fs-guard';

const schema = z.object({ filePath: z.string().min(1) });

export function readFileRoute(fsGuard: FsGuard): Router {
  const router = Router();
  router.post('/api/read-file', async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const content = await fsGuard.read(parsed.data.filePath);
    return res.json({ filePath: parsed.data.filePath, content });
  });
  return router;
}
