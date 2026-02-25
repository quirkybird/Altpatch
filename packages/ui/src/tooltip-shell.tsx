export function renderTooltipShell(message: string): string {
  return `
    <style>
      :host { all: initial; }
      .altpatch { font-family: ui-sans-serif, system-ui; background: #111827; color: #f9fafb; border: 1px solid #374151; border-radius: 10px; padding: 10px 12px; position: fixed; top: 12px; right: 12px; z-index: 2147483647; min-width: 280px; box-shadow: 0 8px 24px rgba(0,0,0,0.28); }
      .title { font-size: 12px; color: #93c5fd; margin-bottom: 6px; }
      .body { font-size: 12px; line-height: 1.5; white-space: pre-wrap; }
    </style>
    <div class="altpatch">
      <div class="title">AltPatch</div>
      <div class="body">${message}</div>
    </div>
  `;
}
