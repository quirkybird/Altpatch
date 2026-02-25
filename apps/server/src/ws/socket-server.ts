import { WebSocketServer } from 'ws';

export function createSocketServer(): WebSocketServer {
  return new WebSocketServer({ noServer: true });
}
