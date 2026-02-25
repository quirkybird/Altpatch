import { Router } from 'express';
import { z } from 'zod';
import { modifyWithMockLLM } from '../services/code-mod-engine';
import type { FsGuard } from '../services/fs-guard';

const schema = z.object({
  filePath: z.string().min(1),
  instruction: z.string().min(1),
  location: z.object({ line: z.number(), column: z.number(), framework: z.string().optional() }).optional()
});

export function modifyRoute(fsGuard: FsGuard): Router {
  const router = Router();
  router.post('/api/modify', async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const source = await fsGuard.read(parsed.data.filePath);
    const result = modifyWithMockLLM(source, parsed.data);
    return res.json(result);
  });
  return router;
}
