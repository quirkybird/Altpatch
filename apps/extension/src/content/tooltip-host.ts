import { renderTooltipShell } from '@packages/ui';

export function showTooltip(message: string): void {
  const hostId = 'altpatch-tooltip-host';
  let host = document.getElementById(hostId);
  if (!host) {
    host = document.createElement('div');
    host.id = hostId;
    document.documentElement.appendChild(host);
  }

  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  shadowRoot.innerHTML = renderTooltipShell(message);
}
