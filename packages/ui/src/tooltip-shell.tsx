type TooltipShellOptions = {
  pinned?: boolean;
  width?: number;
  height?: number;
  top?: number;
  left?: number;
};

export function renderTooltipShell(message: string, options: TooltipShellOptions = {}): string {
  const {
    pinned = false,
    width = 320,
    height = 120,
    top = 12,
    left
  } = options;
  const leftCss = typeof left === 'number' ? `${left}px` : 'auto';
  const rightCss = typeof left === 'number' ? 'auto' : '12px';

  return `
    <style>
      :host { all: initial; }
      .altpatch {
        font-family: ui-sans-serif, system-ui;
        background: #0b1220;
        color: #f9fafb;
        border: 1px solid #334155;
        border-radius: 12px;
        position: fixed;
        top: ${top}px;
        left: ${leftCss};
        right: ${rightCss};
        z-index: 2147483647;
        width: ${Math.max(width, 240)}px;
        height: ${Math.max(height, 80)}px;
        min-width: 240px;
        min-height: 80px;
        resize: both;
        overflow: auto;
        box-shadow: 0 16px 36px rgba(0,0,0,0.38);
      }
      .altpatch[data-pinned="true"] {
        border-color: #3b82f6;
        box-shadow: 0 16px 36px rgba(59, 130, 246, 0.25);
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
        border-bottom: 1px solid #1f2937;
        cursor: move;
        user-select: none;
        touch-action: none;
      }
      .title { font-size: 12px; color: #93c5fd; font-weight: 600; }
      .actions { display: flex; gap: 6px; }
      .icon-btn {
        border: 1px solid #334155;
        background: #111827;
        color: #cbd5e1;
        border-radius: 8px;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
      }
      .icon-btn:hover { background: #1f2937; }
      .icon-btn.pin.active {
        background: #1d4ed8;
        border-color: #3b82f6;
        color: #eff6ff;
      }
      .body { padding: 8px 10px 10px; font-size: 12px; line-height: 1.5; white-space: pre-wrap; }
      .resize-corner {
        position: absolute;
        right: 6px;
        bottom: 6px;
        width: 10px;
        height: 10px;
        border-right: 2px solid #475569;
        border-bottom: 2px solid #475569;
        pointer-events: none;
      }
    </style>
    <div class="altpatch" data-pinned="${pinned ? 'true' : 'false'}" id="altpatch-tooltip">
      <div class="header" data-drag-handle="true">
        <div class="title">AltPatch</div>
        <div class="actions">
          <button class="icon-btn pin ${pinned ? 'active' : ''}" data-action="pin" aria-pressed="${pinned ? 'true' : 'false'}">
            ${pinned ? 'Pinned' : 'Pin'}
          </button>
          <button class="icon-btn close" data-action="close" aria-label="Close tooltip">Close</button>
        </div>
      </div>
      <div class="body">${message}</div>
      <div class="resize-corner" aria-hidden="true"></div>
    </div>
  `;
}
