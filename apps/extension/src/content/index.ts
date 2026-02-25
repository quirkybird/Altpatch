import { registerAltClick } from './alt-click-listener';
import { showTooltip } from './tooltip-host';
import { connectWs } from './ws-client';

const httpBase = 'http://127.0.0.1:7331';
const wsUrl = 'ws://127.0.0.1:7331/ws';

connectWs(wsUrl);

registerAltClick((location) => {
  if (!location) {
    showTooltip('未定位到源码位置信息');
    return;
  }
  showTooltip(`定位成功: ${location.filePath}:${location.line}:${location.column}`);
  void fetch(`${httpBase}/api/read-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath: location.filePath })
  });
});
