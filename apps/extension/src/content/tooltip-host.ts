import { renderTooltipShell } from '@packages/ui';

type TooltipState = {
  pinned: boolean;
  width: number;
  height: number;
  x: number | null;
  y: number | null;
};

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 120;

let tooltipState: TooltipState = {
  pinned: false,
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  x: null,
  y: null
};

let resizeObserver: ResizeObserver | null = null;

export function showTooltip(message: string): void {
  const hostId = 'altpatch-tooltip-host';
  let host = document.getElementById(hostId);
  if (!host) {
    host = document.createElement('div');
    host.id = hostId;
    document.documentElement.appendChild(host);
  }

  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  if (!tooltipState.pinned) {
    tooltipState = {
      pinned: false,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      x: null,
      y: null
    };
  }

  shadowRoot.innerHTML = renderTooltipShell(message, {
    pinned: tooltipState.pinned,
    width: tooltipState.width,
    height: tooltipState.height,
    top: tooltipState.y ?? 12,
    left: tooltipState.x ?? undefined
  });

  const panel = shadowRoot.getElementById('altpatch-tooltip') as HTMLDivElement | null;
  const pinButton = shadowRoot.querySelector<HTMLButtonElement>('button[data-action="pin"]');
  const closeButton = shadowRoot.querySelector<HTMLButtonElement>('button[data-action="close"]');
  const dragHandle = shadowRoot.querySelector<HTMLElement>('[data-drag-handle="true"]');

  if (!panel) {
    return;
  }

  const syncPinUI = () => {
    panel.dataset.pinned = tooltipState.pinned ? 'true' : 'false';
    if (pinButton) {
      pinButton.classList.toggle('active', tooltipState.pinned);
      pinButton.setAttribute('aria-pressed', tooltipState.pinned ? 'true' : 'false');
      pinButton.textContent = tooltipState.pinned ? 'Pinned' : 'Pin';
    }
  };

  const persistSize = () => {
    const rect = panel.getBoundingClientRect();
    tooltipState.width = Math.round(rect.width);
    tooltipState.height = Math.round(rect.height);
  };

  const persistPosition = () => {
    const rect = panel.getBoundingClientRect();
    tooltipState.x = Math.round(rect.left);
    tooltipState.y = Math.round(rect.top);
  };

  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  resizeObserver = new ResizeObserver(() => {
    persistSize();
  });
  resizeObserver.observe(panel);

  pinButton?.addEventListener('click', () => {
    tooltipState.pinned = !tooltipState.pinned;
    persistSize();
    persistPosition();
    syncPinUI();
  });

  closeButton?.addEventListener('click', () => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    host?.remove();
  });

  if (dragHandle) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let pointerId: number | null = null;

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const nextX = originX + (event.clientX - startX);
      const nextY = originY + (event.clientY - startY);
      panel.style.left = `${nextX}px`;
      panel.style.top = `${nextY}px`;
      panel.style.right = 'auto';
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      if (pointerId !== null) {
        panel.releasePointerCapture?.(pointerId);
      }
      pointerId = null;
      persistPosition();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    dragHandle.addEventListener('pointerdown', (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('button')) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      startX = event.clientX;
      startY = event.clientY;
      originX = rect.left;
      originY = rect.top;
      pointerId = event.pointerId;
      panel.setPointerCapture?.(event.pointerId);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  syncPinUI();
}
