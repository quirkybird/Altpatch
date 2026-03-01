import express from 'express';
import cors from 'cors';
import type { WebSocketServer } from 'ws';
import { registerAltpatchExpressApi } from '@packages/altpatch-api';

export function createApp(projectRoot: string, wss: WebSocketServer) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  registerAltpatchExpressApi(app, {
    projectRoot,
    apiPrefix: '/api',
    env: process.env,
    wss
  });

  return app;
}
