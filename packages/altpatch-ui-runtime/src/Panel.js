import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
export const panelStyles = `
  :host {
    all: initial;
    --panel-bg-1: #071722;
    --panel-bg-2: #132634;
    --panel-border: #29506b;
    --panel-border-soft: #1f3f54;
    --panel-text: #ecf5ff;
    --panel-subtle: #9cc1d8;
    --panel-accent: #4dc7d6;
    --panel-accent-soft: rgba(77, 199, 214, 0.2);
    --panel-glow: rgba(77, 199, 214, 0.2);
    --panel-header-bg-1: rgba(14, 35, 50, 0.95);
    --panel-header-bg-2: rgba(7, 23, 34, 0.8);
    --panel-chip-bg: rgba(77, 199, 214, 0.16);
    --panel-chip-border: rgba(77, 199, 214, 0.35);
    --panel-chip-text: #d8f8ff;
    --panel-icon-bg: rgba(11, 27, 40, 0.92);
    --panel-icon-hover-bg: rgba(11, 27, 40, 0.98);
    --panel-icon-active-bg: linear-gradient(160deg, rgba(39, 168, 184, 0.25), rgba(39, 168, 184, 0.1));
    --panel-card-bg-1: rgba(11, 27, 40, 0.85);
    --panel-card-bg-2: rgba(15, 34, 50, 0.8);
    --panel-mode-bg: rgba(11, 27, 40, 0.9);
    --panel-editor-bg-1: rgba(8, 20, 30, 0.95);
    --panel-editor-bg-2: rgba(8, 20, 30, 0.82);
    --panel-code-bg-1: rgba(8, 20, 30, 0.9);
    --panel-code-bg-2: rgba(8, 20, 30, 0.75);
    --panel-scroll-thumb: #29506b;
    --panel-scroll-thumb-hover: #356886;
    --panel-scroll-track: #0b1b28;
    --panel-close-text: #ffd3c8;
    --panel-close-border: rgba(255, 141, 111, 0.45);
    --panel-close-hover-bg: rgba(255, 141, 111, 0.12);
    --panel-close-hover-border: #ff8d6f;
    --panel-close-hover-text: #fff1ed;
    --panel-success-bg: linear-gradient(160deg, rgba(73, 216, 154, 0.25), rgba(73, 216, 154, 0.14));
    --panel-success-border: rgba(73, 216, 154, 0.5);
    --panel-subtle-btn-bg: rgba(255, 141, 111, 0.08);
    --panel-subtle-btn-border: rgba(255, 141, 111, 0.34);
    --panel-subtle-btn-text: #ffe5de;
    --hljs-text: #e9f1ff;
    --hljs-comment: #7f98b1;
    --hljs-keyword: #7cc7ff;
    --hljs-title: #9fe870;
    --hljs-string: #ffcb6b;
    --hljs-number: #ff9f7a;
    --hljs-variable: #d6e7ff;
    --hljs-type: #ff8fd4;
    --hljs-link: #8be9fd;
  }
  .panel {
    position: fixed;
    top: 16px;
    right: 16px;
    width: 500px;
    height: 560px;
    max-height: 100vh;
    min-width: 360px;
    min-height: 320px;
    overflow: hidden;
    scrollbar-width: none;
    color: var(--panel-text);
    background: linear-gradient(155deg, var(--panel-bg-1) 0%, var(--panel-bg-2) 100%);
    border: 1px solid var(--panel-border);
    border-radius: 14px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
    z-index: 2147483647;
    font-family: "Space Grotesk", "Avenir Next", "Segoe UI", sans-serif;
    display: flex;
    flex-direction: column;
  }
  .panel[data-theme="paper"] {
    --panel-bg-1: #fbf6eb;
    --panel-bg-2: #f1e6d4;
    --panel-border: #ceb89a;
    --panel-border-soft: #d8c7ad;
    --panel-text: #2f261f;
    --panel-subtle: #6e5f4f;
    --panel-accent: #b86f2f;
    --panel-accent-soft: rgba(184, 111, 47, 0.16);
    --panel-glow: rgba(184, 111, 47, 0.16);
    --panel-header-bg-1: rgba(248, 239, 225, 0.98);
    --panel-header-bg-2: rgba(241, 230, 212, 0.95);
    --panel-chip-bg: rgba(184, 111, 47, 0.1);
    --panel-chip-border: rgba(184, 111, 47, 0.28);
    --panel-chip-text: #5e4126;
    --panel-icon-bg: rgba(255, 251, 244, 0.92);
    --panel-icon-hover-bg: rgba(255, 255, 255, 0.98);
    --panel-icon-active-bg: linear-gradient(160deg, rgba(184, 111, 47, 0.2), rgba(184, 111, 47, 0.08));
    --panel-card-bg-1: rgba(253, 248, 240, 0.92);
    --panel-card-bg-2: rgba(246, 237, 224, 0.86);
    --panel-mode-bg: rgba(253, 248, 240, 0.92);
    --panel-editor-bg-1: rgba(255, 252, 246, 0.96);
    --panel-editor-bg-2: rgba(250, 243, 232, 0.92);
    --panel-code-bg-1: rgba(255, 252, 246, 0.95);
    --panel-code-bg-2: rgba(250, 243, 232, 0.9);
    --panel-scroll-thumb: #c8ad8b;
    --panel-scroll-thumb-hover: #b89267;
    --panel-scroll-track: #f4e8d6;
    --panel-close-text: #b14d42;
    --panel-close-border: rgba(177, 77, 66, 0.35);
    --panel-close-hover-bg: rgba(177, 77, 66, 0.12);
    --panel-close-hover-border: #b14d42;
    --panel-close-hover-text: #7a2a22;
    --panel-success-bg: linear-gradient(160deg, rgba(56, 143, 95, 0.18), rgba(56, 143, 95, 0.08));
    --panel-success-border: rgba(56, 143, 95, 0.38);
    --panel-subtle-btn-bg: rgba(184, 111, 47, 0.09);
    --panel-subtle-btn-border: rgba(184, 111, 47, 0.34);
    --panel-subtle-btn-text: #6d4a26;
    --hljs-text: #2f261f;
    --hljs-comment: #8a7a66;
    --hljs-keyword: #7b4dd8;
    --hljs-title: #1f7a4b;
    --hljs-string: #a15a1b;
    --hljs-number: #bb3f2d;
    --hljs-variable: #2f261f;
    --hljs-type: #b5317f;
    --hljs-link: #1c7a8d;
  }
  .panel::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 84px;
    background: radial-gradient(80% 100% at 20% 0%, var(--panel-glow), transparent 70%);
    pointer-events: none;
  }
  .panel[data-dock="bottom"] { border-radius: 14px 14px 0 0; max-height: 100vh; }
  .panel[data-dock="left"], .panel[data-dock="right"] { border-radius: 0; min-height: 100vh; max-height: 100vh; }
  .panel[data-dock="left"] { border-right: 1px solid var(--panel-border); }
  .panel[data-dock="right"] { border-left: 1px solid var(--panel-border); }
  .panel[data-dock="bottom"], .panel[data-dock="left"], .panel[data-dock="right"] { box-shadow: 0 14px 34px rgba(0, 0, 0, 0.36); }
  .panel[data-fullscreen="true"] {
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-height: 100vh !important;
    min-height: 100vh !important;
    border-radius: 0 !important;
    border-width: 0;
    box-shadow: none;
  }
  .panel::-webkit-scrollbar { width: 0; height: 0; }

  .resize-handle { position: absolute; z-index: 2147483648; }
  .resize-handle.top { top: -4px; left: 0; right: 0; height: 8px; cursor: ns-resize; }
  .resize-handle.bottom { bottom: -4px; left: 0; right: 0; height: 8px; cursor: ns-resize; }
  .resize-handle.left { left: -4px; top: 0; bottom: 0; width: 8px; cursor: ew-resize; }
  .resize-handle.right { right: -4px; top: 0; bottom: 0; width: 8px; cursor: ew-resize; }
  .resize-handle.top-left { top: -4px; left: -4px; width: 12px; height: 12px; cursor: nwse-resize; }
  .resize-handle.top-right { top: -4px; right: -4px; width: 12px; height: 12px; cursor: nesw-resize; }
  .resize-handle.bottom-left { bottom: -4px; left: -4px; width: 12px; height: 12px; cursor: nesw-resize; }
  .resize-handle.bottom-right { bottom: -4px; right: -4px; width: 12px; height: 12px; cursor: nwse-resize; }

  .header {
    display: grid;
    gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--panel-border-soft);
    background: linear-gradient(180deg, var(--panel-header-bg-1), var(--panel-header-bg-2));
    flex-shrink: 0;
    position: relative;
    z-index: 1;
  }
  .header-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    cursor: move;
    user-select: none;
    touch-action: none;
  }
  .header-sub {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .title-wrap { display: grid; gap: 1px; }
  .title-kicker {
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--panel-accent);
    font-weight: 700;
  }
  .title { font-size: 14px; color: var(--panel-text); font-weight: 700; line-height: 1.1; }
  .header-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .dock-actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .icon-btn {
    border: 1px solid var(--panel-border-soft);
    background: var(--panel-icon-bg);
    color: var(--panel-subtle);
    border-radius: 9px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 130ms ease;
  }
  .icon-btn:hover { background: var(--panel-icon-hover-bg); border-color: var(--panel-accent); color: var(--panel-text); transform: translateY(-1px); }
  .icon-btn.active { background: var(--panel-icon-active-bg); border-color: var(--panel-accent); color: var(--panel-text); }
  .icon-btn.close-btn { color: var(--panel-close-text); border-color: var(--panel-close-border); }
  .icon-btn.close-btn:hover { background: var(--panel-close-hover-bg); border-color: var(--panel-close-hover-border); color: var(--panel-close-hover-text); }

  .body { padding: 12px; display: grid; gap: 10px; overflow-y: auto; flex-grow: 1; position: relative; z-index: 1; align-content: start; scrollbar-width: none; -ms-overflow-style: none; }
  .body::-webkit-scrollbar { width: 0; height: 0; }
  .top-row {
    display: grid;
    gap: 8px;
    grid-template-columns: minmax(0, 1fr);
  }
  .info-card {
    display: grid;
    gap: 6px;
    border: 1px solid var(--panel-border-soft);
    border-radius: 10px;
    background: linear-gradient(180deg, var(--panel-card-bg-1), var(--panel-card-bg-2));
    padding: 8px 10px;
  }
  .status {
    font-size: 11px;
    color: var(--panel-chip-text);
    background: var(--panel-chip-bg);
    border: 1px solid var(--panel-chip-border);
    border-radius: 999px;
    padding: 4px 9px;
    width: fit-content;
    max-width: 100%;
  }
  .meta {
    font-size: 11px;
    color: var(--panel-subtle);
    word-break: break-all;
    font-family: "JetBrains Mono", "Consolas", monospace;
    line-height: 1.4;
  }
  .model {
    font-size: 11px;
    color: var(--panel-subtle);
    font-family: "JetBrains Mono", "Consolas", monospace;
    line-height: 1.4;
  }
  .mode-switch {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    border: 1px solid var(--panel-border-soft);
    border-radius: 10px;
    background: var(--panel-mode-bg);
    padding: 4px;
    min-width: 0;
  }
  .toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 8px;
    align-items: center;
    border: 1px solid var(--panel-border-soft);
    border-radius: 10px;
    background: linear-gradient(180deg, var(--panel-card-bg-1), var(--panel-card-bg-2));
    padding: 8px;
  }
  .theme-picker {
    display: grid;
    gap: 4px;
    min-width: 112px;
  }
  .locale-picker {
    display: grid;
    gap: 4px;
    min-width: 102px;
  }
  .theme-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--panel-subtle);
    font-weight: 700;
  }
  .theme-select {
    appearance: none;
    border: 1px solid var(--panel-border-soft);
    border-radius: 9px;
    background: var(--panel-editor-bg-1);
    color: var(--panel-text);
    padding: 6px 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .theme-select:focus {
    outline: 2px solid var(--panel-accent-soft);
    outline-offset: 1px;
    border-color: var(--panel-accent);
  }
  .mode-btn {
    border: 1px solid transparent;
    background: transparent;
    color: var(--panel-subtle);
    border-radius: 8px;
    padding: 7px 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 120ms ease;
  }
  .mode-btn.active {
    background: var(--panel-accent-soft);
    color: var(--panel-text);
    border-color: var(--panel-chip-border);
  }
  .workspace {
    display: grid;
    gap: 10px;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    align-items: start;
  }
  .workspace-col {
    display: grid;
    gap: 10px;
    min-width: 0;
  }
  .section {
    display: grid;
    gap: 6px;
    border: 1px solid var(--panel-border-soft);
    border-radius: 10px;
    background: linear-gradient(180deg, var(--panel-card-bg-1), var(--panel-card-bg-2));
    padding: 8px;
  }
  .label {
    font-size: 10px;
    color: #c2deef;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
  }
  .hljs { display: block; color: var(--hljs-text); background: transparent; }
  .hljs-comment, .hljs-quote { color: var(--hljs-comment); font-style: italic; }
  .hljs-keyword, .hljs-selector-tag, .hljs-built_in, .hljs-meta .hljs-keyword { color: var(--hljs-keyword); }
  .hljs-title, .hljs-title.function_, .hljs-function .hljs-title, .hljs-class .hljs-title { color: var(--hljs-title); }
  .hljs-string, .hljs-attr, .hljs-template-tag, .hljs-template-variable { color: var(--hljs-string); }
  .hljs-number, .hljs-literal, .hljs-symbol, .hljs-bullet { color: var(--hljs-number); }
  .hljs-variable, .hljs-params, .hljs-property { color: var(--hljs-variable); }
  .hljs-type, .hljs-tag, .hljs-name, .hljs-operator { color: var(--hljs-type); }
  .hljs-link, .hljs-regexp { color: var(--hljs-link); }
  .hljs-addition { color: #86efac; background: rgba(34, 197, 94, 0.1); }
  .hljs-deletion { color: #fca5a5; background: rgba(239, 68, 68, 0.12); }
  pre {
    margin: 0;
    background: linear-gradient(180deg, var(--panel-code-bg-1), var(--panel-code-bg-2));
    border: 1px solid var(--panel-border-soft);
    border-radius: 10px;
    padding: 9px;
    max-height: 240px;
    overflow: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--panel-scroll-thumb) var(--panel-scroll-track);
    font-size: 12px;
    line-height: 1.45;
    white-space: pre;
    font-family: "JetBrains Mono", "Consolas", monospace;
  }
  pre::-webkit-scrollbar { width: 8px; height: 8px; }
  pre::-webkit-scrollbar-track { background: var(--panel-scroll-track); border-radius: 8px; }
  pre::-webkit-scrollbar-thumb { background: var(--panel-scroll-thumb); border-radius: 8px; border: 2px solid var(--panel-scroll-track); }
  pre::-webkit-scrollbar-thumb:hover { background: var(--panel-scroll-thumb-hover); }
  textarea {
    width: 100%;
    min-height: 76px;
    background: linear-gradient(180deg, var(--panel-editor-bg-1), var(--panel-editor-bg-2));
    color: var(--panel-text);
    border: 1px solid var(--panel-border-soft);
    border-radius: 10px;
    padding: 9px;
    box-sizing: border-box;
    resize: vertical;
    overflow: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--panel-scroll-thumb) var(--panel-scroll-track);
    font-size: 12px;
    font-family: "JetBrains Mono", "Consolas", monospace;
  }
  textarea:focus { outline: 2px solid var(--panel-accent-soft); outline-offset: 1px; border-color: var(--panel-accent); }
  textarea::-webkit-scrollbar { width: 8px; }
  textarea::-webkit-scrollbar-track { background: var(--panel-scroll-track); border-radius: 8px; }
  textarea::-webkit-scrollbar-thumb { background: var(--panel-scroll-thumb); border-radius: 8px; border: 2px solid var(--panel-scroll-track); }
  textarea::-webkit-scrollbar-thumb:hover { background: var(--panel-scroll-thumb-hover); }
  .actions { display: grid; grid-template-columns: 1.3fr 1fr 1fr 1fr; gap: 7px; }
  button.action {
    border: 1px solid var(--panel-border-soft);
    border-radius: 10px;
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    color: var(--panel-text);
    background: var(--panel-icon-bg);
    transition: all 130ms ease;
  }
  button.action:hover { transform: translateY(-1px); border-color: var(--panel-accent); }
  button.action.primary { background: linear-gradient(160deg, var(--panel-accent-soft), rgba(0, 0, 0, 0.01)); border-color: var(--panel-chip-border); }
  button.action.positive { background: var(--panel-success-bg); border-color: var(--panel-success-border); }
  button.action.subtle { background: var(--panel-subtle-btn-bg); border-color: var(--panel-subtle-btn-border); color: var(--panel-subtle-btn-text); }
  button.action:disabled { opacity: 0.45; cursor: not-allowed; transform: none; border-color: var(--panel-border-soft); }
  .history-list {
    display: grid;
    gap: 6px;
    max-height: 230px;
    overflow: auto;
    padding-right: 2px;
  }
  .history-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    border: 1px solid var(--panel-border-soft);
    border-radius: 8px;
    padding: 6px 8px;
    background: var(--panel-editor-bg-2);
  }
  .history-main { min-width: 0; display: grid; gap: 2px; }
  .history-title {
    font-size: 11px;
    color: var(--panel-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 600;
  }
  .history-meta {
    font-size: 10px;
    color: var(--panel-subtle);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: "JetBrains Mono", "Consolas", monospace;
  }
  .history-btn {
    border: 1px solid var(--panel-border-soft);
    border-radius: 8px;
    background: var(--panel-icon-bg);
    color: var(--panel-text);
    font-size: 11px;
    font-weight: 600;
    padding: 5px 8px;
    cursor: pointer;
  }
  .history-empty {
    font-size: 11px;
    color: var(--panel-subtle);
    border: 1px dashed var(--panel-border-soft);
    border-radius: 8px;
    padding: 8px;
  }
  .toast {
    position: absolute;
    top: 10px;
    right: 12px;
    z-index: 2147483649;
    max-width: min(70%, 380px);
    border-radius: 10px;
    border: 1px solid var(--panel-border-soft);
    padding: 8px 10px;
    font-size: 12px;
    font-weight: 600;
    backdrop-filter: blur(6px);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.32);
  }
  .toast.success {
    background: linear-gradient(160deg, rgba(73, 216, 154, 0.24), rgba(73, 216, 154, 0.12));
    border-color: var(--panel-success-border);
    color: var(--panel-text);
  }
  .toast.error {
    background: linear-gradient(160deg, rgba(255, 99, 99, 0.26), rgba(255, 99, 99, 0.14));
    border-color: rgba(255, 130, 130, 0.56);
    color: #fff3f3;
  }
  @media (max-width: 640px) {
    .panel { width: calc(100vw - 16px); left: 8px; right: 8px; top: 8px; max-height: 100vh; min-width: 0; border-radius: 12px; }
    .header { padding: 10px 10px; gap: 6px; }
    .header-main { align-items: flex-start; }
    .header-sub { align-items: stretch; }
    .header-actions { gap: 4px; }
    .dock-actions { gap: 4px; }
    .icon-btn { padding: 4px 6px; font-size: 10px; }
    .actions { grid-template-columns: 1fr; }
    .toolbar { grid-template-columns: 1fr; }
    .workspace { grid-template-columns: minmax(0, 1fr); }
    .theme-picker { min-width: 0; }
  }
`;
export function Panel(props) {
    if (!props.visible)
        return null;
    const generateLabel = props.mode === 'quick' ? props.texts.generateQuick : props.texts.generateAi;
    const inputLabel = props.mode === 'quick' ? props.texts.inputLabelQuick : props.texts.inputLabelAi;
    const inputPlaceholder = props.mode === 'quick'
        ? props.texts.inputPlaceholderQuick
        : props.texts.inputPlaceholderAi;
    const resizeHandles = props.isFullscreen
        ? []
        : props.dock === 'float'
            ? ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se']
            : props.dock === 'bottom'
                ? ['n']
                : props.dock === 'left'
                    ? ['e']
                    : props.dock === 'right'
                        ? ['w']
                        : [];
    const handleClassMap = {
        n: 'top',
        s: 'bottom',
        w: 'left',
        e: 'right',
        nw: 'top-left',
        ne: 'top-right',
        sw: 'bottom-left',
        se: 'bottom-right'
    };
    return (_jsxs("div", { className: "panel", id: "altpatch-panel", "data-dock": props.dock, "data-fullscreen": props.isFullscreen ? 'true' : 'false', "data-theme": props.theme, style: props.panelStyle, ref: props.panelRef, children: [props.toast ? (_jsx("div", { className: `toast ${props.toast.type}`, children: props.toast.message })) : null, resizeHandles.length > 0 && (_jsx(_Fragment, { children: resizeHandles.map((direction) => (_jsx("div", { className: `resize-handle ${handleClassMap[direction]}`, onPointerDown: (e) => props.onResizeStart(e, direction) }, direction))) })), _jsxs("div", { className: "header", id: "altpatch-header", ref: props.headerRef, children: [_jsxs("div", { className: "header-main", onPointerDown: props.onDragStart, children: [_jsxs("div", { className: "title-wrap", children: [_jsx("div", { className: "title-kicker", children: props.texts.panelTitle }), _jsx("div", { className: "title", children: props.texts.panelSubtitle })] }), _jsxs("div", { className: "header-actions", children: [_jsx("button", { className: "icon-btn", title: props.isFullscreen ? props.texts.exitFullscreen : props.texts.fullscreen, "aria-label": props.isFullscreen ? props.texts.exitFullscreen : props.texts.fullscreen, onClick: props.onToggleFullscreen, children: props.isFullscreen ? _jsx(Minimize2, { size: 14 }) : _jsx(Maximize2, { size: 14 }) }), _jsx("button", { className: "icon-btn close-btn", id: "altpatch-close", title: props.texts.close, "aria-label": props.texts.close, onClick: props.onClose, children: _jsx(X, { size: 14 }) })] })] }), _jsxs("div", { className: "header-sub", children: [_jsxs("div", { className: "dock-actions", children: [_jsx("button", { className: `icon-btn ${props.dock === 'bottom' ? 'active' : ''}`, onClick: () => props.onSetDock('bottom'), children: props.texts.dockBottom }), _jsx("button", { className: `icon-btn ${props.dock === 'left' ? 'active' : ''}`, onClick: () => props.onSetDock('left'), children: props.texts.dockLeft }), _jsx("button", { className: `icon-btn ${props.dock === 'right' ? 'active' : ''}`, onClick: () => props.onSetDock('right'), children: props.texts.dockRight }), _jsx("button", { className: `icon-btn ${props.dock === 'float' ? 'active' : ''}`, onClick: () => props.onSetDock('float'), children: props.texts.dockFloat })] }), _jsx("div", { className: "header-actions", children: _jsx("button", { className: "icon-btn", id: "altpatch-open-editor", onClick: props.onJumpToEditor, children: props.texts.backToVsCode }) })] })] }), _jsxs("div", { className: "body", children: [_jsxs("div", { className: "top-row", children: [_jsxs("div", { className: "info-card", children: [_jsx("div", { className: "status", id: "altpatch-status", children: props.status }), _jsx("div", { className: "meta", id: "altpatch-meta", children: props.meta }), props.modelName ? _jsxs("div", { className: "model", children: [props.texts.llmModel, ": ", props.modelName] }) : null] }), _jsxs("div", { className: "toolbar", children: [_jsxs("div", { className: "mode-switch", children: [_jsx("button", { className: `mode-btn ${props.mode === 'quick' ? 'active' : ''}`, id: "altpatch-mode-quick", onClick: () => props.onSwitchMode('quick'), children: props.texts.quickText }), _jsx("button", { className: `mode-btn ${props.mode === 'ai' ? 'active' : ''}`, id: "altpatch-mode-ai", onClick: () => props.onSwitchMode('ai'), children: props.texts.aiAssist })] }), _jsxs("label", { className: "theme-picker", htmlFor: "altpatch-theme-select", children: [_jsx("span", { className: "theme-label", children: props.texts.theme }), _jsx("select", { id: "altpatch-theme-select", className: "theme-select", value: props.theme, onChange: (event) => props.onSetTheme(event.target.value), children: props.themeOptions.map((themeOption) => (_jsx("option", { value: themeOption.id, children: themeOption.label }, themeOption.id))) })] }), _jsxs("label", { className: "locale-picker", htmlFor: "altpatch-locale-select", children: [_jsx("span", { className: "theme-label", children: props.texts.language }), _jsx("select", { id: "altpatch-locale-select", className: "theme-select", value: props.locale, onChange: (event) => props.onSetLocale(event.target.value), children: props.localeOptions.map((localeOption) => (_jsx("option", { value: localeOption.id, children: localeOption.label }, localeOption.id))) })] })] })] }), _jsxs("div", { className: "workspace", children: [_jsxs("div", { className: "workspace-col", children: [_jsxs("section", { className: "section", children: [_jsx("div", { className: "label", children: props.texts.codeContext }), _jsx("pre", { id: "altpatch-code", dangerouslySetInnerHTML: { __html: props.codeHtml } })] }), _jsxs("section", { className: "section", children: [_jsx("div", { className: "label", children: props.texts.history }), props.historyItems.length === 0 ? (_jsx("div", { className: "history-empty", children: props.texts.noHistory })) : (_jsx("div", { className: "history-list", id: "altpatch-history-list", children: props.historyItems.map((item) => (_jsxs("div", { className: "history-item", children: [_jsxs("div", { className: "history-main", children: [_jsx("div", { className: "history-title", children: item.title }), _jsx("div", { className: "history-meta", children: item.meta })] }), _jsx("button", { className: "history-btn", onClick: () => props.onRestoreHistory(item.id), children: props.texts.restore })] }, item.id))) }))] })] }), _jsxs("div", { className: "workspace-col", children: [_jsxs("section", { className: "section", children: [_jsx("div", { className: "label", id: "altpatch-input-label", children: inputLabel }), _jsx("textarea", { id: "altpatch-input", placeholder: inputPlaceholder, value: props.inputValue, onChange: (event) => props.onInputChange(event.target.value) }), _jsxs("div", { className: "actions", children: [_jsx("button", { className: "action primary", id: "altpatch-generate", onClick: props.onGenerate, children: generateLabel }), _jsx("button", { className: "action positive", id: "altpatch-apply", onClick: props.onApply, disabled: props.applyDisabled, children: props.texts.apply }), _jsx("button", { className: "action", id: "altpatch-undo", onClick: props.onUndo, disabled: props.undoDisabled, children: props.texts.undo }), _jsx("button", { className: "action subtle", id: "altpatch-discard", onClick: props.onDiscard, children: props.texts.discard })] })] }), _jsxs("section", { className: "section", children: [_jsx("div", { className: "label", children: props.texts.llmStream }), _jsx("pre", { id: "altpatch-stream-output", dangerouslySetInnerHTML: { __html: props.streamOutput } })] }), _jsxs("section", { className: "section", children: [_jsx("div", { className: "label", children: props.texts.diff }), _jsx("pre", { id: "altpatch-diff", dangerouslySetInnerHTML: { __html: props.diffHtml } })] })] })] })] })] }));
}
//# sourceMappingURL=Panel.js.map