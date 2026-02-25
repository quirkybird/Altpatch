import http from 'node:http';
import path from 'node:path';
import { createApp } from './app';
import { createSocketServer } from './ws/socket-server';

const port = Number(process.env.ALTPATCH_PORT ?? 7331);
const projectRoot = path.resolve(
  process.env.ALTPATCH_ROOT ?? process.env.INIT_CWD ?? process.cwd()
);

const wss = createSocketServer();
const app = createApp(projectRoot, wss);
const server = http.createServer(app);

wss.on('connection', () => {
  console.log('[ws] connected');
});

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[altpatch-server] listening on http://127.0.0.1:${port}`);
  console.log(`[altpatch-server] projectRoot=${projectRoot}`);
});
