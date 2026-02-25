import type { WebSocketServer } from 'ws';

export function broadcast(wss: WebSocketServer, event: unknown): void {
  const payload = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}
