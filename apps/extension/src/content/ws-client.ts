export function connectWs(url: string): WebSocket {
  const socket = new WebSocket(url);
  socket.onmessage = (event) => {
    console.log('AltPatch WS event:', event.data);
  };
  return socket;
}
