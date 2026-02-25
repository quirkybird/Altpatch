import { Router } from 'express';
import { z } from 'zod';
import { buildDiff } from '../services/diff-service';

const schema = z.object({
  filePath: z.string(),
  before: z.string(),
  after: z.string()
});

export function diffRoute(): Router {
  const router = Router();
  router.post('/api/diff', (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    return res.json(buildDiff(parsed.data.filePath, parsed.data.before, parsed.data.after));
  });
  return router;
}
