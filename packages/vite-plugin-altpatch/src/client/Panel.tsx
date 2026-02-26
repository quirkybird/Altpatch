import React from 'react';

export type DockMode = 'float' | 'bottom' | 'left' | 'right';
export type Mode = 'quick' | 'ai';

export type PanelProps = {
  dock: DockMode;
  mode: Mode;
  status: string;
  meta: string;
  codeHtml: string;
  diffHtml: string;
  inputValue: string;
  applyDisabled: boolean;
  visible: boolean;
  panelStyle: React.CSSProperties;
  panelRef: React.Ref<HTMLDivElement>;
  onDragStart: (event: React.PointerEvent) => void;
  onClose: () => void;
  onSetDock: (dock: DockMode) => void;
  onSwitchMode: (mode: Mode) => void;
  onInputChange: (value: string) => void;
  onGenerate: () => void;
  onApply: () => void;
  onDiscard: () => void;
};

export const panelStyles = `
  :host { all: initial; }
  .panel { position: fixed; top: 16px; right: 16px; width: 500px; height: 560px; max-height: 84vh; overflow: auto; resize: both; scrollbar-width: none; background: #0b1220; color: #e5e7eb; border: 1px solid #334155; border-radius: 12px; box-shadow: 0 16px 36px rgba(0,0,0,0.4); z-index: 2147483647; font-family: ui-sans-serif, system-ui; min-width: 360px; min-height: 320px; }
  .panel[data-dock="bottom"] { border-radius: 12px 12px 0 0; resize: vertical; max-height: 70vh; }
  .panel[data-dock="left"], .panel[data-dock="right"] { border-radius: 0; resize: horizontal; min-height: 100vh; max-height: 100vh; }
  .panel[data-dock="left"] { border-right: 1px solid #334155; }
  .panel[data-dock="right"] { border-left: 1px solid #334155; }
  .panel[data-dock="bottom"], .panel[data-dock="left"], .panel[data-dock="right"] { box-shadow: 0 10px 30px rgba(0,0,0,0.35); }
  .panel::-webkit-scrollbar { width: 0; height: 0; }
  .header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-bottom: 1px solid #334155; cursor: move; user-select: none; touch-action: none; }
  .title { font-size: 12px; color: #93c5fd; font-weight: 600; }
  .header-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .icon-btn { border: 1px solid #334155; background: #111827; color: #cbd5e1; border-radius: 8px; padding: 4px 8px; font-size: 11px; cursor: pointer; }
  .icon-btn:hover { background: #1f2937; }
  .icon-btn.active { background: #1d4ed8; border-color: #3b82f6; color: #eff6ff; }
  .body { padding: 10px 12px 12px; display: grid; gap: 8px; }
  .status { font-size: 12px; color: #93c5fd; }
  .meta { font-size: 12px; color: #94a3b8; word-break: break-all; }
  .mode-switch { display: flex; gap: 8px; }
  .mode-btn { border: 1px solid #334155; background: #111827; color: #cbd5e1; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
  .mode-btn.active { background: #1d4ed8; color: #eff6ff; border-color: #3b82f6; }
  .label { font-size: 12px; color: #cbd5e1; }
  .hljs { color: #dbe4ee; background: transparent; }
  .hljs-keyword, .hljs-selector-tag, .hljs-built_in { color: #93c5fd; }
  .hljs-string, .hljs-attr { color: #86efac; }
  .hljs-number, .hljs-literal { color: #fca5a5; }
  .hljs-comment, .hljs-quote { color: #64748b; }
  .hljs-function .hljs-title, .hljs-title.function_ { color: #fcd34d; }
  .hljs-addition { color: #86efac; background: rgba(34, 197, 94, 0.1); }
  .hljs-deletion { color: #fca5a5; background: rgba(239, 68, 68, 0.12); }
  pre { margin: 0; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 8px; max-height: 180px; overflow: auto; scrollbar-width: thin; scrollbar-color: #334155 #0f172a; font-size: 12px; line-height: 1.45; white-space: pre; }
  pre::-webkit-scrollbar { width: 8px; height: 8px; }
  pre::-webkit-scrollbar-track { background: #0f172a; border-radius: 8px; }
  pre::-webkit-scrollbar-thumb { background: #334155; border-radius: 8px; border: 2px solid #0f172a; }
  pre::-webkit-scrollbar-thumb:hover { background: #475569; }
  textarea { width: 100%; min-height: 64px; background: #0f172a; color: #e5e7eb; border: 1px solid #334155; border-radius: 8px; padding: 8px; box-sizing: border-box; resize: vertical; overflow: auto; scrollbar-width: thin; scrollbar-color: #334155 #0f172a; font-size: 12px; }
  textarea::-webkit-scrollbar { width: 8px; }
  textarea::-webkit-scrollbar-track { background: #0f172a; border-radius: 8px; }
  textarea::-webkit-scrollbar-thumb { background: #334155; border-radius: 8px; border: 2px solid #0f172a; }
  textarea::-webkit-scrollbar-thumb:hover { background: #475569; }
  .actions { display: flex; gap: 8px; }
  button.action { border: 1px solid #334155; background: #1e293b; color: #e2e8f0; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
  button.action:disabled { opacity: .55; cursor: not-allowed; }
`;

export function Panel(props: PanelProps): JSX.Element | null {
  if (!props.visible) return null;

  const generateLabel = props.mode === 'quick' ? 'Preview Text Diff' : 'Generate AI Patch';
  const inputLabel = props.mode === 'quick' ? 'New Text' : 'Prompt';
  const inputPlaceholder = props.mode === 'quick'
    ? '输入要替换成的新文本'
    : '例如：把按钮背景改成红色，加个 hover 阴影';

  return (
    <div
      className="panel"
      id="altpatch-panel"
      data-dock={props.dock}
      style={props.panelStyle}
      ref={props.panelRef}
    >
      <div className="header" id="altpatch-header" onPointerDown={props.onDragStart}>
        <div className="title">AltPatch</div>
        <div className="header-actions">
          <button className={`icon-btn ${props.dock === 'bottom' ? 'active' : ''}`} onClick={() => props.onSetDock('bottom')}>
            Bottom
          </button>
          <button className={`icon-btn ${props.dock === 'left' ? 'active' : ''}`} onClick={() => props.onSetDock('left')}>
            Left
          </button>
          <button className={`icon-btn ${props.dock === 'right' ? 'active' : ''}`} onClick={() => props.onSetDock('right')}>
            Right
          </button>
          <button className={`icon-btn ${props.dock === 'float' ? 'active' : ''}`} onClick={() => props.onSetDock('float')}>
            Float
          </button>
          <button className="icon-btn" id="altpatch-close" title="Close" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="body">
        <div className="status" id="altpatch-status">{props.status}</div>
        <div className="meta" id="altpatch-meta">{props.meta}</div>
        <div className="mode-switch">
          <button className={`mode-btn ${props.mode === 'quick' ? 'active' : ''}`} id="altpatch-mode-quick" onClick={() => props.onSwitchMode('quick')}>
            Quick Text
          </button>
          <button className={`mode-btn ${props.mode === 'ai' ? 'active' : ''}`} id="altpatch-mode-ai" onClick={() => props.onSwitchMode('ai')}>
            AI Assist
          </button>
        </div>
        <div className="label">Code Context</div>
        <pre id="altpatch-code" dangerouslySetInnerHTML={{ __html: props.codeHtml }} />
        <div className="label" id="altpatch-input-label">{inputLabel}</div>
        <textarea
          id="altpatch-input"
          placeholder={inputPlaceholder}
          value={props.inputValue}
          onChange={(event) => props.onInputChange(event.target.value)}
        />
        <div className="actions">
          <button className="action" id="altpatch-generate" onClick={props.onGenerate}>
            {generateLabel}
          </button>
          <button className="action" id="altpatch-apply" onClick={props.onApply} disabled={props.applyDisabled}>
            Apply
          </button>
          <button className="action" id="altpatch-discard" onClick={props.onDiscard}>
            Discard
          </button>
        </div>
        <div className="label">Diff</div>
        <pre id="altpatch-diff" dangerouslySetInnerHTML={{ __html: props.diffHtml }} />
      </div>
    </div>
  );
}
