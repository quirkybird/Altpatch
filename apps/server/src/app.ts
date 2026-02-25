import express from 'express';
import cors from 'cors';
import type { WebSocketServer } from 'ws';
import { FsGuard } from './services/fs-guard';
import { readFileRoute } from './routes/read-file';
import { modifyRoute } from './routes/modify';
import { diffRoute } from './routes/diff';
import { writeFileRoute } from './routes/write-file';

export function createApp(projectRoot: string, wss: WebSocketServer) {
  const app = express();
  const fsGuard = new FsGuard(projectRoot);

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.get('/health', (_req, res) => res.json({ ok: true, service: 'altpatch-server' }));
  app.use(readFileRoute(fsGuard));
  app.use(modifyRoute(fsGuard));
  app.use(diffRoute());
  app.use(writeFileRoute(fsGuard, wss));

  return app;
}
