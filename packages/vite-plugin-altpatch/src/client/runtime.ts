import { getElementInfo } from '@locator/runtime/dist/adapters/getElementInfo';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import xml from 'highlight.js/lib/languages/xml';
import diff from 'highlight.js/lib/languages/diff';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('diff', diff);

type Mode = 'quick' | 'ai';

type SourceLocation = {
  filePath: string;
  line: number;
  column: number;
  framework: 'react' | 'vue' | 'svelte' | 'unknown';
};

type LocatorAdapter = {
  name: string;
  locate(target: Element): SourceLocation | null;
};

type ReadFileResponse = {
  filePath: string;
  content: string;
};

type ModifyResponse = {
  patch: string;
  before: string;
  after: string;
  diff: Array<{ type: 'add' | 'del' | 'ctx'; content: string }>;
  explanation?: string;
  confidence?: number;
  modelTraceId?: string;
};

type DiffResponse = {
  patch: string;
  diff: Array<{ type: 'add' | 'del' | 'ctx'; content: string }>;
};

type PanelRefs = {
  root: HTMLDivElement;
  header: HTMLDivElement;
  closeButton: HTMLButtonElement;
  status: HTMLDivElement;
  meta: HTMLDivElement;
  modeQuickBtn: HTMLButtonElement;
  modeAiBtn: HTMLButtonElement;
  inputLabel: HTMLDivElement;
  code: HTMLPreElement;
  input: HTMLTextAreaElement;
  generateBtn: HTMLButtonElement;
  applyBtn: HTMLButtonElement;
  discardBtn: HTMLButtonElement;
  diff: HTMLPreElement;
};

type RuntimeState = {
  mode: Mode;
  location: SourceLocation | null;
  source: string;
  modified: string | null;
  diff: Array<{ type: 'add' | 'del' | 'ctx'; content: string }>;
  selectedText: string;
};

declare global {
  interface Window {
    __ALTPATCH_LOCATOR_RUNTIME__?: {
      locate(target: Element): SourceLocation | null;
    };
  }
}

let locatorAdapter: LocatorAdapter | null = null;
let refs: PanelRefs | null = null;

const state: RuntimeState = {
  mode: 'quick',
  location: null,
  source: '',
  modified: null,
  diff: [],
  selectedText: ''
};

function setLocatorAdapter(adapter: LocatorAdapter | null): void {
  locatorAdapter = adapter;
}

function resolveSourceLocation(target: Element): SourceLocation | null {
  if (locatorAdapter) {
    const resolved = locatorAdapter.locate(target);
    if (resolved) {
      return resolved;
    }
  }

  if (target instanceof HTMLElement) {
    const info = getElementInfo(target, 'jsx');
    const link = info?.thisElement?.link;
    if (link) {
      const cleanPath = String(link.filePath ?? '').trim();
      if (cleanPath.length > 0) {
        return {
          filePath: cleanPath,
          line: Number(link.line) || 0,
          column: Number(link.column) || 0,
          framework: 'react'
        };
      }
    }

    const locatorPath = target.closest('[data-locatorjs]')?.getAttribute('data-locatorjs');
    if (locatorPath) {
      const match = locatorPath.match(/^(.*):(\d+):(\d+)$/);
      if (match) {
        const parsedPath = match[1].trim().replace(/^['"]|['"]$/g, '');
        if (parsedPath.length > 0) {
          return {
            filePath: parsedPath,
            line: Number(match[2]) || 0,
            column: Number(match[3]) || 0,
            framework: 'react'
          };
        }
      }
    }
  }

  return null;
}

function extractEditableText(target: Element): string {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return target.value || target.placeholder || '';
  }
  if (target instanceof HTMLButtonElement) {
    return target.innerText.trim();
  }
  if (target instanceof HTMLElement) {
    const attrs = [target.getAttribute('aria-label'), target.getAttribute('title'), target.getAttribute('placeholder')];
    for (const item of attrs) {
      if (item && item.trim()) {
        return item.trim();
      }
    }
    return target.innerText.trim().replace(/\s+/g, ' ');
  }
  return '';
}

function snippetFromSource(source: string, line: number, range = 8): string {
  const lines = source.split('\n');
  if (lines.length === 0) {
    return '';
  }
  const center = Math.max(1, line || 1);
  const start = Math.max(1, center - range);
  const end = Math.min(lines.length, center + range);
  const out: string[] = [];
  for (let i = start; i <= end; i += 1) {
    const marker = i === center ? '>' : ' ';
    out.push(`${marker}${String(i).padStart(4, ' ')} | ${lines[i - 1]}`);
  }
  return out.join('\n');
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildQuickTextAfter(source: string, line: number, oldText: string, nextText: string): string {
  const srcLines = source.split('\n');
  const center = Math.max(1, line || 1) - 1;
  const start = Math.max(0, center - 20);
  const end = Math.min(srcLines.length - 1, center + 20);

  for (let i = start; i <= end; i += 1) {
    const current = srcLines[i];
    if (oldText && current.includes(oldText)) {
      srcLines[i] = current.replace(oldText, nextText);
      return srcLines.join('\n');
    }
  }

  if (oldText) {
    const re = new RegExp(escapeRegExp(oldText));
    if (re.test(source)) {
      return source.replace(re, nextText);
    }
  }

  throw new Error('未在定位附近找到可替换文本，请切换 AI Assist 或重新定位。');
}

function renderDiff(diffLines: Array<{ type: 'add' | 'del' | 'ctx'; content: string }>): string {
  if (diffLines.length === 0) {
    return 'No diff yet.';
  }
  return diffLines
    .map((line) => {
      if (line.type === 'add') return `+ ${line.content}`;
      if (line.type === 'del') return `- ${line.content}`;
      return `  ${line.content}`;
    })
    .join('\n');
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function renderHighlighted(code: string, mode: 'code' | 'diff' = 'code'): string {
  try {
    const highlighted =
      mode === 'diff'
        ? hljs.highlight(code, { language: 'diff', ignoreIllegals: true }).value
        : hljs.highlightAuto(code, ['typescript', 'javascript', 'xml']).value;
    return highlighted;
  } catch {
    return escapeHtml(code);
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(parsed?.error || `Request failed: ${response.status}`);
  }
  return parsed as T;
}

function setStatus(message: string): void {
  if (refs) {
    refs.status.textContent = message;
  }
}

function syncModeUI(panel: PanelRefs): void {
  const isQuick = state.mode === 'quick';
  panel.modeQuickBtn.classList.toggle('active', isQuick);
  panel.modeAiBtn.classList.toggle('active', !isQuick);
  panel.generateBtn.textContent = isQuick ? 'Preview Text Diff' : 'Generate AI Patch';
  panel.inputLabel.textContent = isQuick ? 'New Text' : 'Prompt';
  panel.input.placeholder = isQuick
    ? '输入要替换成的新文本'
    : '例如：把按钮背景改成红色，加个 hover 阴影';
}

function ensurePanel(): PanelRefs {
  if (refs) {
    return refs;
  }

  const hostId = 'altpatch-tooltip-host';
  let host = document.getElementById(hostId);
  if (!host) {
    host = document.createElement('div');
    host.id = hostId;
    document.documentElement.appendChild(host);
  }

  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  shadowRoot.innerHTML = `
    <style>
      :host { all: initial; }
      .panel { position: fixed; top: 16px; right: 16px; width: 500px; max-height: 84vh; overflow: auto; scrollbar-width: none; background: #0b1220; color: #e5e7eb; border: 1px solid #334155; border-radius: 12px; box-shadow: 0 16px 36px rgba(0,0,0,0.4); z-index: 2147483647; font-family: ui-sans-serif, system-ui; }
      .panel::-webkit-scrollbar { width: 0; height: 0; }
      .header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-bottom: 1px solid #334155; cursor: move; user-select: none; }
      .title { font-size: 12px; color: #93c5fd; font-weight: 600; }
      .close { border: 1px solid #334155; background: #111827; color: #cbd5e1; border-radius: 6px; width: 24px; height: 24px; cursor: pointer; }
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
    </style>
    <div class="panel" id="altpatch-panel">
      <div class="header" id="altpatch-header">
        <div class="title">AltPatch</div>
        <button class="close" id="altpatch-close" title="Close">x</button>
      </div>
      <div class="body">
        <div class="status" id="altpatch-status">Ready</div>
        <div class="meta" id="altpatch-meta">No target selected.</div>
        <div class="mode-switch">
          <button class="mode-btn" id="altpatch-mode-quick">Quick Text</button>
          <button class="mode-btn" id="altpatch-mode-ai">AI Assist</button>
        </div>
        <div class="label">Code Context</div>
        <pre id="altpatch-code">Select an element with Alt+Click.</pre>
        <div class="label" id="altpatch-input-label">Prompt</div>
        <textarea id="altpatch-input" placeholder=""></textarea>
        <div class="actions">
          <button class="action" id="altpatch-generate">Generate</button>
          <button class="action" id="altpatch-apply" disabled>Apply</button>
          <button class="action" id="altpatch-discard">Discard</button>
        </div>
        <div class="label">Diff</div>
        <pre id="altpatch-diff">No diff yet.</pre>
      </div>
    </div>
  `;

  const panelRefs: PanelRefs = {
    root: shadowRoot.getElementById('altpatch-panel') as HTMLDivElement,
    header: shadowRoot.getElementById('altpatch-header') as HTMLDivElement,
    closeButton: shadowRoot.getElementById('altpatch-close') as HTMLButtonElement,
    status: shadowRoot.getElementById('altpatch-status') as HTMLDivElement,
    meta: shadowRoot.getElementById('altpatch-meta') as HTMLDivElement,
    modeQuickBtn: shadowRoot.getElementById('altpatch-mode-quick') as HTMLButtonElement,
    modeAiBtn: shadowRoot.getElementById('altpatch-mode-ai') as HTMLButtonElement,
    inputLabel: shadowRoot.getElementById('altpatch-input-label') as HTMLDivElement,
    code: shadowRoot.getElementById('altpatch-code') as HTMLPreElement,
    input: shadowRoot.getElementById('altpatch-input') as HTMLTextAreaElement,
    generateBtn: shadowRoot.getElementById('altpatch-generate') as HTMLButtonElement,
    applyBtn: shadowRoot.getElementById('altpatch-apply') as HTMLButtonElement,
    discardBtn: shadowRoot.getElementById('altpatch-discard') as HTMLButtonElement,
    diff: shadowRoot.getElementById('altpatch-diff') as HTMLPreElement
  };

  setupDrag(panelRefs);
  setupActions(panelRefs);
  syncModeUI(panelRefs);
  refs = panelRefs;
  return panelRefs;
}

function setupDrag(panel: PanelRefs): void {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  panel.header.addEventListener('mousedown', (event) => {
    const rect = panel.root.getBoundingClientRect();
    dragging = true;
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    panel.root.style.right = 'auto';
  });

  window.addEventListener('mousemove', (event) => {
    if (!dragging) {
      return;
    }
    panel.root.style.left = `${event.clientX - offsetX}px`;
    panel.root.style.top = `${event.clientY - offsetY}px`;
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
  });

  panel.closeButton.addEventListener('click', () => {
    panel.root.style.display = 'none';
  });
}

function setupActions(panel: PanelRefs): void {
  panel.modeQuickBtn.addEventListener('click', () => {
    state.mode = 'quick';
    syncModeUI(panel);
    panel.input.value = state.selectedText;
    setStatus('Switched to Quick Text mode.');
  });

  panel.modeAiBtn.addEventListener('click', () => {
    state.mode = 'ai';
    syncModeUI(panel);
    panel.input.value = '';
    setStatus('Switched to AI Assist mode.');
  });

  panel.generateBtn.addEventListener('click', () => {
    if (state.mode === 'quick') {
      void generateQuickText(panel);
      return;
    }
    void generatePatch(panel);
  });

  panel.applyBtn.addEventListener('click', () => {
    void applyPatch(panel);
  });

  panel.discardBtn.addEventListener('click', () => {
    state.modified = null;
    state.diff = [];
    panel.diff.textContent = 'No diff yet.';
    panel.applyBtn.disabled = true;
    setStatus('Discarded generated patch.');
  });
}

async function loadSource(panel: PanelRefs, apiPrefix: string, location: SourceLocation): Promise<void> {
  setStatus('Reading source...');
  const data = await postJson<ReadFileResponse>(`${apiPrefix}/read-file`, { filePath: location.filePath });
  state.source = data.content;
  state.modified = null;
  state.diff = [];
  panel.applyBtn.disabled = true;
  panel.meta.textContent = `${location.filePath}:${location.line}:${location.column}`;
  panel.code.innerHTML = renderHighlighted(snippetFromSource(data.content, location.line || 1), 'code');
  panel.diff.textContent = 'No diff yet.';
  setStatus('Source loaded.');
}

async function generateQuickText(panel: PanelRefs): Promise<void> {
  if (!state.location) {
    setStatus('No target selected. Alt+Click first.');
    return;
  }
  const nextText = panel.input.value.trim();
  if (!nextText) {
    setStatus('请输入要替换的新文本。');
    return;
  }
  if (!state.selectedText) {
    setStatus('当前元素未提取到可编辑文本，请切换 AI Assist。');
    return;
  }

  try {
    const after = buildQuickTextAfter(state.source, state.location.line, state.selectedText, nextText);
    const diffData = await postJson<DiffResponse>('/api/diff', {
      filePath: state.location.filePath,
      before: state.source,
      after
    });

    state.modified = after;
    state.diff = diffData.diff || [];
    panel.diff.innerHTML = renderHighlighted(renderDiff(state.diff), 'diff');
    panel.applyBtn.disabled = false;
    setStatus('Quick text diff generated.');
  } catch (error) {
    setStatus(`Quick mode failed: ${String(error)}`);
  }
}

async function generatePatch(panel: PanelRefs): Promise<void> {
  if (!state.location) {
    setStatus('No target selected. Alt+Click first.');
    return;
  }
  const instruction = panel.input.value.trim();
  if (!instruction) {
    setStatus('Please enter a prompt.');
    return;
  }

  setStatus('Generating patch (mock)...');
  try {
    const data = await postJson<ModifyResponse>('/api/modify', {
      filePath: state.location.filePath,
      instruction,
      location: {
        line: state.location.line,
        column: state.location.column,
        framework: state.location.framework
      }
    });

    state.modified = data.after;
    state.diff = data.diff || [];
    panel.diff.innerHTML = renderHighlighted(renderDiff(state.diff), 'diff');
    panel.applyBtn.disabled = !state.modified;
    setStatus(data.explanation || 'Patch generated.');
  } catch (error) {
    setStatus(`Generate failed: ${String(error)}`);
  }
}

async function applyPatch(panel: PanelRefs): Promise<void> {
  if (!state.location || !state.modified) {
    setStatus('No generated patch to apply.');
    return;
  }

  setStatus('Applying patch...');
  try {
    await postJson<{ ok: boolean }>('/api/write-file', {
      filePath: state.location.filePath,
      content: state.modified
    });
    state.source = state.modified;
    panel.code.innerHTML = renderHighlighted(snippetFromSource(state.source, state.location.line || 1), 'code');
    setStatus('Applied successfully. File updated locally.');
  } catch (error) {
    setStatus(`Apply failed: ${String(error)}`);
  }
}

function setupLocatorAdapter(): void {
  setLocatorAdapter({
    name: 'locator-runtime',
    locate(target: Element): SourceLocation | null {
      const runtime = window.__ALTPATCH_LOCATOR_RUNTIME__;
      return runtime ? runtime.locate(target) : null;
    }
  });
}

export function mountAltPatchRuntime(apiPrefix = '/api'): void {
  if (typeof window === 'undefined') {
    return;
  }

  setupLocatorAdapter();

  if (import.meta.hot) {
    import.meta.hot.on('altpatch:reload-hint', (payload: { filePath?: string } | undefined) => {
      const filePath = payload?.filePath ?? 'unknown';
      setStatus(`HMR hint: ${filePath}`);
    });
  }

  window.addEventListener(
    'click',
    (event) => {
      if (!event.altKey) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const panel = ensurePanel();
      panel.root.style.display = 'block';
      const location = resolveSourceLocation(target);
      if (!location || !location.filePath || location.filePath.trim().length === 0) {
        setStatus('AltPatch: could not resolve source location.');
        return;
      }

      state.location = location;
      state.selectedText = extractEditableText(target);

      if (state.mode === 'quick') {
        panel.input.value = state.selectedText;
      }

      void loadSource(panel, apiPrefix, location).catch((error) => {
        setStatus(`Read failed: ${String(error)}`);
      });
    },
    true
  );
}

mountAltPatchRuntime();
