import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-diff';
import {
  Panel,
  panelStyles,
  type PanelHistoryItem,
  type DockMode,
  type Mode,
  type ThemeMode,
  type PanelThemeOption,
  type PanelLocale,
  type PanelLocaleOption,
  type PanelTexts
} from './Panel';
import { computePanelPlacementFromPointer } from './panel-placement';

type PrismLike = {
  languages?: Record<string, unknown>;
  highlight?: (text: string, grammar: unknown, language: string) => string;
};

const prism = (globalThis as { Prism?: PrismLike }).Prism;

type SourceLocation = {
  filePath: string;
  line: number;
  column: number;
  framework: 'react' | 'vue' | 'svelte' | 'unknown';
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
};

type DiffResponse = {
  patch: string;
  diff: Array<{ type: 'add' | 'del' | 'ctx'; content: string }>;
};
type RelatedFile = { filePath: string; content: string };
type ModifyMultiResultItem = {
  filePath: string;
  instruction: string;
  reason?: string;
  result?: ModifyResponse;
  error?: string;
};
type ModifyMultiResponse = {
  plan: Array<{ filePath: string; instruction: string; reason?: string }>;
  results: ModifyMultiResultItem[];
};

type AltPatchAppProps = {
  apiPrefix: string;
};
type HistorySnapshot = PanelHistoryItem & {
  filePath: string;
  line: number;
  column: number;
  content: string;
};

const DEFAULT_PANEL_WIDTH = 500;
const DEFAULT_PANEL_HEIGHT = 560;
const DEFAULT_PANEL_TOP = 16;
const DEFAULT_PANEL_RIGHT = 16;
const MIN_PANEL_WIDTH = 360;
const MIN_PANEL_HEIGHT = 320;
const MAX_HISTORY_ITEMS = 20;
const PANEL_HOST_ID = 'altpatch-tooltip-host';
const STORAGE_DOCK_KEY = 'altpatch.panel.dock';
const STORAGE_SIZE_KEY = 'altpatch.panel.size';
const STORAGE_THEME_KEY = 'altpatch.panel.theme';
const PANEL_LOCALE_OPTIONS: PanelLocaleOption[] = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' }
];

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadStoredDock(): DockMode {
  const storage = getLocalStorage();
  const raw = storage?.getItem(STORAGE_DOCK_KEY);
  if (raw === 'float' || raw === 'bottom' || raw === 'left' || raw === 'right') return raw;
  return 'float';
}

function loadStoredTheme(): ThemeMode {
  const storage = getLocalStorage();
  const raw = storage?.getItem(STORAGE_THEME_KEY);
  if (raw === 'ocean' || raw === 'paper') return raw;
  return 'ocean';
}

function loadStoredPanelSize(): { width: number; height: number } {
  const storage = getLocalStorage();
  const raw = storage?.getItem(STORAGE_SIZE_KEY);
  if (!raw) {
    return { width: DEFAULT_PANEL_WIDTH, height: DEFAULT_PANEL_HEIGHT };
  }
  try {
    const parsed = JSON.parse(raw) as { width?: unknown; height?: unknown };
    const width = Number(parsed.width);
    const height = Number(parsed.height);
    return {
      width: Number.isFinite(width) ? Math.max(MIN_PANEL_WIDTH, Math.floor(width)) : DEFAULT_PANEL_WIDTH,
      height: Number.isFinite(height) ? Math.max(MIN_PANEL_HEIGHT, Math.floor(height)) : DEFAULT_PANEL_HEIGHT
    };
  } catch {
    return { width: DEFAULT_PANEL_WIDTH, height: DEFAULT_PANEL_HEIGHT };
  }
}

type PanelRuntimeTexts = PanelTexts & {
  ready: string;
  openingEditor: string;
  openedEditor: string;
  openEditorFailed: string;
  noTargetSelected: string;
  selectElementWithAltClick: string;
  noDiffYet: string;
  switchedQuick: string;
  switchedAi: string;
  readingSource: string;
  quickEmptyText: string;
  generatingQuickDiff: string;
  quickGenerated: string;
  quickFailed: string;
  enterPrompt: string;
  generatingPatch: string;
  patchGenerated: string;
  generateFailed: string;
  noGeneratedPatch: string;
  applyingPatch: string;
  applySuccess: string;
  applyFailed: string;
  undoing: string;
  undoSuccess: string;
  undoFailed: string;
  restoreFailed: string;
  noTargetSelectedFirst: string;
  resolveFailed: string;
  readFailed: string;
  quickReplaceNotFound: string;
  themeOcean: string;
  themePaper: string;
  scopeLocal: string;
  scopeFull: string;
};

const PANEL_I18N: Record<PanelLocale, PanelRuntimeTexts> = {
  zh: {
    panelTitle: 'AltPatch',
    panelSubtitle: '实时编辑面板',
    backToVsCode: '回到 VS Code',
    dockBottom: '底部',
    dockLeft: '左侧',
    dockRight: '右侧',
    dockFloat: '浮动',
    close: '关闭',
    quickText: '快速文本',
    aiAssist: 'AI 辅助',
    theme: '主题',
    language: '语言',
    codeContext: '代码上下文',
    diff: '变更 Diff',
    apply: '应用',
    undo: '撤销',
    discard: '丢弃',
    history: '历史记录',
    noHistory: '暂无应用历史',
    restore: '恢复',
    generateQuick: '预览文本差异',
    generateAi: '生成 AI Patch',
    inputLabelQuick: '新文本',
    inputLabelAi: '提示词',
    inputPlaceholderQuick: '输入要替换成的新文本',
    inputPlaceholderAi: '例如：把按钮背景改成红色，加个 hover 阴影',
    llmStream: '实时输出',
    llmModel: '模型',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    ready: '就绪',
    openingEditor: '正在打开 VS Code...',
    openedEditor: '已在 VS Code 中定位当前文件。',
    openEditorFailed: '打开 VS Code 失败',
    noTargetSelected: '未选择目标元素。',
    selectElementWithAltClick: '请使用 Alt+Click 选择一个元素。',
    noDiffYet: '暂无 Diff',
    switchedQuick: '已切换到快速文本模式。',
    switchedAi: '已切换到 AI 辅助模式。',
    readingSource: '正在读取源码...',
    quickEmptyText: '请输入要替换成的新文本。',
    generatingQuickDiff: '正在生成快速 Diff...',
    quickGenerated: '快速文本 Diff 已生成。',
    quickFailed: '快速模式失败',
    enterPrompt: '请输入提示词。',
    generatingPatch: '正在生成 Patch...',
    patchGenerated: 'Patch 已生成。',
    generateFailed: '生成失败',
    noGeneratedPatch: '当前没有可应用的 Patch。',
    applyingPatch: '正在应用 Patch...',
    applySuccess: '应用成功，文件已更新。',
    applyFailed: '应用失败',
    undoing: '正在撤销...',
    undoSuccess: '已撤销到上一版本。',
    undoFailed: '撤销失败',
    restoreFailed: '恢复历史失败',
    noTargetSelectedFirst: '未选择目标元素，请先 Alt+Click。',
    resolveFailed: 'AltPatch: 无法解析元素源码位置。',
    readFailed: '读取失败',
    quickReplaceNotFound: '未在定位附近找到可替换文本，请切换 AI 辅助或重新定位。',
    themeOcean: '海洋蓝',
    themePaper: '纸张浅色',
    scopeLocal: '作用范围',
    scopeFull: '作用范围：整文件'
  },
  en: {
    panelTitle: 'AltPatch',
    panelSubtitle: 'Live Edit Panel',
    backToVsCode: 'Back to VS Code',
    dockBottom: 'Bottom',
    dockLeft: 'Left',
    dockRight: 'Right',
    dockFloat: 'Float',
    close: 'Close',
    quickText: 'Quick Text',
    aiAssist: 'AI Assist',
    theme: 'Theme',
    language: 'Language',
    codeContext: 'Code Context',
    diff: 'Diff',
    apply: 'Apply',
    undo: 'Undo',
    discard: 'Discard',
    history: 'History',
    noHistory: 'No apply history yet.',
    restore: 'Restore',
    generateQuick: 'Preview Text Diff',
    generateAi: 'Generate AI Patch',
    inputLabelQuick: 'New Text',
    inputLabelAi: 'Prompt',
    inputPlaceholderQuick: 'Enter replacement text',
    inputPlaceholderAi: 'For example: turn button background red and add a hover shadow',
    llmStream: 'Live Output',
    llmModel: 'Model',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit Fullscreen',
    ready: 'Ready',
    openingEditor: 'Opening VS Code...',
    openedEditor: 'Opened current file in VS Code.',
    openEditorFailed: 'Open VS Code failed',
    noTargetSelected: 'No target selected.',
    selectElementWithAltClick: 'Select an element with Alt+Click.',
    noDiffYet: 'No diff yet.',
    switchedQuick: 'Switched to Quick Text mode.',
    switchedAi: 'Switched to AI Assist mode.',
    readingSource: 'Reading source...',
    quickEmptyText: 'Please enter replacement text.',
    generatingQuickDiff: 'Generating quick diff...',
    quickGenerated: 'Quick text diff generated.',
    quickFailed: 'Quick mode failed',
    enterPrompt: 'Please enter a prompt.',
    generatingPatch: 'Generating patch...',
    patchGenerated: 'Patch generated.',
    generateFailed: 'Generate failed',
    noGeneratedPatch: 'No generated patch to apply.',
    applyingPatch: 'Applying patch...',
    applySuccess: 'Applied successfully. File updated locally.',
    applyFailed: 'Apply failed',
    undoing: 'Undoing...',
    undoSuccess: 'Reverted to previous version.',
    undoFailed: 'Undo failed',
    restoreFailed: 'Restore history failed',
    noTargetSelectedFirst: 'No target selected. Alt+Click first.',
    resolveFailed: 'AltPatch: could not resolve source location.',
    readFailed: 'Read failed',
    quickReplaceNotFound: 'Could not find replaceable text near the location. Switch to AI Assist or reselect.',
    themeOcean: 'Console Blue',
    themePaper: 'Paper Light',
    scopeLocal: 'Scope',
    scopeFull: 'Scope: full file'
  }
};

function resolveSourceLocation(target: Element): SourceLocation | null {
  const normalizeLocatorPath = (input: unknown): string => {
    const raw = String(input ?? '').trim().replace(/^['"]|['"]$/g, '');
    if (!raw) return '';
    return raw.startsWith('/@fs/') ? raw.slice('/@fs/'.length) : raw;
  };
  const resolveByReactDebugSource = (): SourceLocation | null => {
    type ReactFiber = {
      _debugSource?: { fileName?: unknown; lineNumber?: unknown; columnNumber?: unknown } | null;
      _debugOwner?: ReactFiber | null;
    };
    type ReactRenderer = {
      findFiberByHostInstance?: (target: Element) => ReactFiber | null;
    };
    const renderers = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers;
    const list = renderers ? Array.from(renderers.values()) as ReactRenderer[] : [];
    for (const renderer of list) {
      if (!renderer?.findFiberByHostInstance) continue;
      const fiber = renderer.findFiberByHostInstance(target);
      let current: ReactFiber | null | undefined = fiber;
      while (current) {
        const source = current._debugSource;
        const filePath = normalizeLocatorPath(source?.fileName);
        if (filePath) {
          return {
            filePath,
            line: Number(source?.lineNumber) || 0,
            column: Number(source?.columnNumber) || 0,
            framework: 'react'
          };
        }
        current = current._debugOwner;
      }
    }
    return null;
  };

  const runtime = (window as any).__ALTPATCH_LOCATOR_RUNTIME__;
  if (runtime?.locate) {
    const resolved = runtime.locate(target);
    if (resolved) {
      const filePath = normalizeLocatorPath((resolved as { filePath?: unknown }).filePath);
      if (filePath) {
        return {
          ...(resolved as SourceLocation),
          filePath
        };
      }
    }
  }
  const reactSource = resolveByReactDebugSource();
  if (reactSource) {
    return reactSource;
  }

  if (target instanceof HTMLElement) {
    const locatorPath = target.closest('[data-locatorjs]')?.getAttribute('data-locatorjs');
    if (locatorPath) {
      const match = locatorPath.match(/^(.*):(\d+):(\d+)$/);
      if (match) {
        const parsedPath = normalizeLocatorPath(match[1]);
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
  const compact = (value: string): string => value.trim().replace(/\s+/g, ' ');

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return target.value || target.placeholder || '';
  }
  if (target instanceof HTMLButtonElement) {
    return compact(target.innerText);
  }
  if (target instanceof HTMLElement) {
    const attrs = [target.getAttribute('aria-label'), target.getAttribute('title'), target.getAttribute('placeholder')];
    for (const item of attrs) {
      if (item && item.trim()) {
        return compact(item);
      }
    }

    // Prefer the nearest direct text node to avoid matching against merged descendant text.
    const directText = Array.from(target.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => compact(node.textContent ?? ''))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0];
    if (directText) {
      return directText;
    }

    const lines = target.innerText
      .split('\n')
      .map((line) => compact(line))
      .filter(Boolean);
    if (lines.length > 0) {
      return lines.sort((a, b) => b.length - a.length)[0];
    }
  }
  return '';
}

function snippetFromSource(source: string, line: number, range = 8): string {
  const lines = source.split('\n');
  if (lines.length === 0) {
    return '';
  }
  const center = Math.min(lines.length, Math.max(1, line || 1));
  const start = Math.max(1, center - range);
  const end = Math.min(lines.length, center + range);
  const out: string[] = [];
  for (let i = start; i <= end; i += 1) {
    const marker = i === center ? '>' : ' ';
    out.push(`${marker}${String(i).padStart(4, ' ')} | ${lines[i - 1]}`);
  }
  return out.join('\n');
}

function buildSnippetNeedles(selectedText: string): string[] {
  const base = selectedText.trim();
  if (!base) return [];

  const compact = base.replace(/\s+/g, ' ');
  const lines = base
    .split('\n')
    .map((item) => item.trim().replace(/\s+/g, ' '))
    .filter((item) => item.length >= 2);
  const words = compact
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3)
    .sort((a, b) => b.length - a.length)
    .slice(0, 4);

  return Array.from(new Set([compact, ...lines, ...words])).filter(Boolean);
}

function resolveDisplayLineForSnippet(source: string, anchorLine: number, selectedText: string): number {
  const lines = source.split('\n');
  if (lines.length === 0) return 1;
  const clamped = Math.min(lines.length, Math.max(1, anchorLine || 1));
  const needles = buildSnippetNeedles(selectedText);
  if (needles.length === 0) return clamped;

  const includesNeedle = (line: string): boolean => {
    const compactLine = line.replace(/\s+/g, ' ');
    return needles.some((needle) => compactLine.includes(needle));
  };

  const window = 30;
  let bestLine = clamped;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = Math.max(1, clamped - window); i <= Math.min(lines.length, clamped + window); i += 1) {
    if (!includesNeedle(lines[i - 1] ?? '')) continue;
    const distance = Math.abs(i - clamped);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestLine = i;
      if (distance === 0) break;
    }
  }
  if (bestDistance < Number.POSITIVE_INFINITY) {
    return bestLine;
  }

  // Fallback to global search when locator anchor points to wrapper element instead of literal text.
  for (let i = 1; i <= lines.length; i += 1) {
    if (includesNeedle(lines[i - 1] ?? '')) {
      return i;
    }
  }

  return clamped;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildQuickTextAfter(source: string, line: number, oldText: string, nextText: string, notFoundMessage: string): string {
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

  throw new Error(notFoundMessage);
}

function renderDiff(diffLines: Array<{ type: 'add' | 'del' | 'ctx'; content: string }>, emptyLabel: string): string {
  if (diffLines.length === 0) {
    return emptyLabel;
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

function wantsMultiFileMode(instruction: string): boolean {
  return /(多文件|跨文件|多个文件|两个文件|multi[\s-]?file|across\s+files|multiple\s+files)/i.test(instruction);
}

async function readSseStream(
  response: Response,
  handlers: {
    onDelta: (chunk: string) => void;
    onDone: (payload: ModifyResponse) => void;
    onError: (payload: { error?: string; code?: string; details?: unknown }) => void;
    onScope?: (payload: { mode?: string; startLine?: number; endLine?: number }) => void;
  }
): Promise<void> {
  if (!response.body) {
    throw new Error('SSE response has no body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const parseBlock = (block: string) => {
    const lines = block.split('\n');
    let event = 'message';
    let data = '';
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return;
    let parsed: any;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    if (event === 'delta') handlers.onDelta(String(parsed?.content ?? ''));
    if (event === 'done') handlers.onDone(parsed as ModifyResponse);
    if (event === 'error') handlers.onError(parsed as { error?: string; code?: string; details?: unknown });
    if (event === 'scope') handlers.onScope?.(parsed as { mode?: string; startLine?: number; endLine?: number });
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);
      if (block) parseBlock(block);
      boundary = buffer.indexOf('\n\n');
    }
  }

  const tail = (buffer + decoder.decode()).trim();
  if (tail) parseBlock(tail);
}

function renderHighlighted(code: string, mode: 'code' | 'diff' = 'code'): string {
  const highlightWith = (source: string, language: string): string => {
    const grammar = prism?.languages?.[language];
    if (!grammar || typeof prism?.highlight !== 'function') return escapeHtml(source);
    return prism.highlight(source, grammar, language);
  };

  try {
    if (mode === 'diff') {
      const lines = code.split('\n');
      const rendered = lines.map((line) => {
        if (line.startsWith('+')) {
          const highlighted = highlightWith(line.slice(1), 'tsx');
          return `<span class="altpatch-line altpatch-diff-line altpatch-diff-add"><span class="altpatch-gutter">+ </span><span class="altpatch-code">${highlighted}</span></span>`;
        }
        if (line.startsWith('-')) {
          const highlighted = highlightWith(line.slice(1), 'tsx');
          return `<span class="altpatch-line altpatch-diff-line altpatch-diff-del"><span class="altpatch-gutter">- </span><span class="altpatch-code">${highlighted}</span></span>`;
        }
        if (line.startsWith('@@') || line.startsWith('+++') || line.startsWith('---')) {
          return `<span class="altpatch-line altpatch-diff-line altpatch-diff-meta"><span class="altpatch-code">${escapeHtml(line)}</span></span>`;
        }
        const content = line.startsWith(' ') ? line.slice(1) : line;
        const highlighted = highlightWith(content, 'tsx');
        return `<span class="altpatch-line altpatch-diff-line altpatch-diff-ctx"><span class="altpatch-gutter">  </span><span class="altpatch-code">${highlighted}</span></span>`;
      }).join('');
      return `<code class="altpatch-highlight altpatch-${mode}">${rendered}</code>`;
    }

    const lines = code.split('\n');
    const rendered = lines.map((line) => {
      const match = line.match(/^([ >])(\s*\d+)\s\|\s?(.*)$/);
      if (!match) {
        const highlighted = highlightWith(line, 'tsx');
        return `<span class="altpatch-line"><span class="altpatch-code">${highlighted}</span></span>`;
      }

      const marker = match[1];
      const lineNo = match[2];
      const source = match[3] ?? '';
      const gutter = `${marker}${lineNo} | `;
      const highlighted = highlightWith(source, 'tsx');
      return `<span class="altpatch-line"><span class="altpatch-gutter">${escapeHtml(gutter)}</span><span class="altpatch-code">${highlighted}</span></span>`;
    }).join('');

    return `<code class="altpatch-highlight altpatch-${mode} language-tsx">${rendered}</code>`;
  } catch {
    return `<code class="altpatch-highlight altpatch-${mode}">${escapeHtml(code)}</code>`;
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
    const details = parsed?.details;
    const pathHint = details?.requestUrl ? ` [requestUrl=${details.requestUrl}]` : '';
    throw new Error((parsed?.error || `Request failed: ${response.status}`) + pathHint);
  }
  return parsed as T;
}

function clipText(input: string, maxLength = 46): string {
  const value = input.trim().replace(/\s+/g, ' ');
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

function buildHistoryTitle(mode: Mode, inputValue: string): string {
  const prefix = mode === 'quick' ? 'Quick' : 'AI';
  const content = inputValue.trim().length > 0 ? clipText(inputValue) : '(empty)';
  return `${prefix}: ${content}`;
}

function formatHistoryMeta(filePath: string, line: number, column: number, createdAt: number): string {
  const time = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${time} · ${filePath}:${line}:${column}`;
}

function parseRelativeImportSpecifiers(source: string): string[] {
  const matches = source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g);
  const out: string[] = [];
  for (const match of matches) {
    const spec = (match[1] ?? match[2] ?? '').trim();
    if (!spec.startsWith('.')) continue;
    out.push(spec);
  }
  return [...new Set(out)];
}

function dirnameLike(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx < 0 ? '' : normalized.slice(0, idx);
}

function joinPosix(baseDir: string, segment: string): string {
  const joined = `${baseDir}/${segment}`.replace(/\/+/g, '/');
  const parts = joined.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      out.pop();
      continue;
    }
    out.push(part);
  }
  const rooted = (baseDir.startsWith('/') || /^[a-zA-Z]:\//.test(baseDir)) ? '/' : '';
  const text = `${rooted}${out.join('/')}`;
  return /^[a-zA-Z]:\//.test(baseDir) ? text.slice(1) : text;
}

function resolveRelativeImportCandidates(baseFilePath: string, specifier: string): string[] {
  const baseDir = dirnameLike(baseFilePath);
  const target = joinPosix(baseDir, specifier);
  const hasExt = /\.[a-z0-9]+$/i.test(target);
  if (hasExt) return [target];
  return [
    `${target}.ts`,
    `${target}.tsx`,
    `${target}.js`,
    `${target}.jsx`,
    `${target}/index.ts`,
    `${target}/index.tsx`,
    `${target}/index.js`,
    `${target}/index.jsx`
  ];
}

async function collectRelatedFilesForPrompt(apiPrefix: string, filePath: string, source: string): Promise<RelatedFile[]> {
  const specs = parseRelativeImportSpecifiers(source).slice(0, 8);
  const seen = new Set<string>();
  const related: RelatedFile[] = [];

  for (const spec of specs) {
    const candidates = resolveRelativeImportCandidates(filePath, spec);
    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      try {
        const data = await postJson<ReadFileResponse>(`${apiPrefix}/read-file`, { filePath: candidate });
        related.push({
          filePath: candidate,
          content: data.content.length > 12_000 ? `${data.content.slice(0, 12_000)}\n...<trimmed>` : data.content
        });
        break;
      } catch {
        // Candidate not found; try next one.
      }
    }
  }

  return related;
}

function dockStyle(
  dock: DockMode,
  size: { width: number; height: number },
  pos: { x: number | null; y: number | null },
  isFullscreen: boolean
): React.CSSProperties {
  if (isFullscreen) {
    return {
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh'
    };
  }
  if (dock === 'float') {
    return {
      position: 'fixed',
      width: `${size.width}px`,
      height: `${size.height}px`,
      left: pos.x !== null ? `${pos.x}px` : 'auto',
      top: pos.y !== null ? `${pos.y}px` : `${DEFAULT_PANEL_TOP}px`,
      right: pos.x !== null ? 'auto' : `${DEFAULT_PANEL_RIGHT}px`
    };
  }
  if (dock === 'bottom') {
    return { position: 'fixed', left: 0, right: 0, bottom: 0, top: 'auto', width: '100vw', height: `${Math.max(MIN_PANEL_HEIGHT, size.height)}px` };
  }
  if (dock === 'left') {
    return { position: 'fixed', left: 0, top: 0, bottom: 0, right: 'auto', width: `${Math.max(MIN_PANEL_WIDTH, size.width)}px`, height: '100vh' };
  }
  return { position: 'fixed', right: 0, top: 0, bottom: 0, left: 'auto', width: `${Math.max(MIN_PANEL_WIDTH, size.width)}px`, height: '100vh' };
}

const AltPatchApp: React.FC<AltPatchAppProps> = ({ apiPrefix }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ active: boolean; startX: number; startY: number; originX: number; originY: number; pointerId: number | null }>({
    active: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    pointerId: null
  });
  const resizeState = useRef<{
    active: boolean;
    direction: string;
    startX: number;
    startY: number;
    originWidth: number;
    originHeight: number;
    originX: number;
    originY: number;
    pointerId: number | null;
  }>({
    active: false,
    direction: '',
    startX: 0,
    startY: 0,
    originWidth: 0,
    originHeight: 0,
    originX: 0,
    originY: 0,
    pointerId: null
  });

  const locationRef = useRef<SourceLocation | null>(null);
  const sourceRef = useRef<string>('');
  const modifiedRef = useRef<string | null>(null);
  const multiApplyFilesRef = useRef<Array<{ filePath: string; content: string; before: string }>>([]);
  const diffRef = useRef<Array<{ type: 'add' | 'del' | 'ctx'; content: string }>>([]);
  const selectedTextRef = useRef<string>('');
  const hoverOverlayRef = useRef<HTMLDivElement | null>(null);
  const altPressedRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

  const [dock, setDock] = useState<DockMode>(() => loadStoredDock());
  const [panelSize, setPanelSize] = useState(() => loadStoredPanelSize());
  const [panelPos, setPanelPos] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [visible, setVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mode, setMode] = useState<Mode>('quick');
  const [theme, setTheme] = useState<ThemeMode>(() => loadStoredTheme());
  const [locale, setLocale] = useState<PanelLocale>('zh');
  const [status, setStatus] = useState(PANEL_I18N.zh.ready);
  const [meta, setMeta] = useState(PANEL_I18N.zh.noTargetSelected);
  const [modelName, setModelName] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [codeHtml, setCodeHtml] = useState(PANEL_I18N.zh.selectElementWithAltClick);
  const [diffHtml, setDiffHtml] = useState(PANEL_I18N.zh.noDiffYet);
  const [streamOutputRaw, setStreamOutputRaw] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [applyDisabled, setApplyDisabled] = useState(true);
  const [historyEntries, setHistoryEntries] = useState<HistorySnapshot[]>([]);
  const texts = useMemo(() => PANEL_I18N[locale], [locale]);
  const themeOptions = useMemo<PanelThemeOption[]>(
    () => [
      { id: 'ocean', label: texts.themeOcean },
      { id: 'paper', label: texts.themePaper }
    ],
    [texts.themeOcean, texts.themePaper]
  );

  const setStatusSafe = useCallback((message: string) => setStatus(message), []);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({ type, message });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2400);
  }, []);

  useEffect(() => {
    setStatus((prev) => (Object.values(PANEL_I18N).some((x) => x.ready === prev) ? texts.ready : prev));
    setMeta((prev) => (Object.values(PANEL_I18N).some((x) => x.noTargetSelected === prev) ? texts.noTargetSelected : prev));
    setCodeHtml((prev) =>
      Object.values(PANEL_I18N).some((x) => x.selectElementWithAltClick === prev) ? texts.selectElementWithAltClick : prev
    );
    setDiffHtml((prev) => (Object.values(PANEL_I18N).some((x) => x.noDiffYet === prev) ? texts.noDiffYet : prev));
  }, [texts]);

  useEffect(() => {
    const storage = getLocalStorage();
    if (!storage) return;
    storage.setItem(STORAGE_DOCK_KEY, dock);
  }, [dock]);

  useEffect(() => {
    const storage = getLocalStorage();
    if (!storage) return;
    storage.setItem(
      STORAGE_SIZE_KEY,
      JSON.stringify({
        width: Math.max(MIN_PANEL_WIDTH, Math.floor(panelSize.width)),
        height: Math.max(MIN_PANEL_HEIGHT, Math.floor(panelSize.height))
      })
    );
  }, [panelSize]);

  useEffect(() => {
    const storage = getLocalStorage();
    if (!storage) return;
    storage.setItem(STORAGE_THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`${apiPrefix}/llm-config`, { method: 'GET' });
        if (!response.ok) return;
        const payload = await response.json().catch(() => null) as { model?: string } | null;
        if (cancelled) return;
        if (payload?.model && String(payload.model).trim()) {
          setModelName(String(payload.model).trim());
        }
      } catch {
        // Ignore model display fetch failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiPrefix]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const stopDrag = useCallback(() => {
    if (!dragState.current.active && dragState.current.pointerId === null) return;
    dragState.current.active = false;
    if (dragState.current.pointerId !== null) {
      try {
        panelRef.current?.releasePointerCapture?.(dragState.current.pointerId);
      } catch {
        // Capture may already be released by browser; ignore.
      }
    }
    dragState.current.pointerId = null;
  }, []);

  const stopResize = useCallback(() => {
    if (!resizeState.current.active && resizeState.current.pointerId === null) return;
    resizeState.current.active = false;
    if (resizeState.current.pointerId !== null) {
      try {
        panelRef.current?.releasePointerCapture?.(resizeState.current.pointerId);
      } catch {
        // Capture may already be released by browser; ignore.
      }
    }
    resizeState.current.pointerId = null;
  }, []);

  const handleSetDock = useCallback((next: DockMode) => {
    setIsFullscreen(false);
    setDock(next);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    stopDrag();
    stopResize();
    setIsFullscreen((prev) => !prev);
  }, [stopDrag, stopResize]);

  const handleModeSwitch = useCallback((next: Mode) => {
    setMode(next);
    setStreamOutputRaw('');
    multiApplyFilesRef.current = [];
    if (next === 'quick') {
      setInputValue(selectedTextRef.current);
      setStatusSafe(texts.switchedQuick);
    } else {
      setInputValue('');
      setStatusSafe(texts.switchedAi);
    }
  }, [setStatusSafe, texts.switchedAi, texts.switchedQuick]);

  const handleInputChange = useCallback((value: string) => setInputValue(value), []);

  const loadSource = useCallback(
    async (location: SourceLocation) => {
      setStatusSafe(texts.readingSource);
      const data = await postJson<ReadFileResponse>(`${apiPrefix}/read-file`, { filePath: location.filePath });
      sourceRef.current = data.content;
      setMeta(`${location.filePath}:${location.line}:${location.column}`);
      const displayLine = resolveDisplayLineForSnippet(data.content, location.line || 1, selectedTextRef.current);
      setCodeHtml(renderHighlighted(snippetFromSource(data.content, displayLine), 'code'));
      setStatusSafe(texts.ready);
    },
    [apiPrefix, setStatusSafe, texts.readingSource, texts.ready]
  );

  const handleGenerate = useCallback(async () => {
    if (!locationRef.current) {
      setStatusSafe(texts.noTargetSelectedFirst);
      return;
    }

    if (mode === 'quick') {
      setStreamOutputRaw('');
      multiApplyFilesRef.current = [];
      const location = locationRef.current;
      const newText = inputValue;
      if (!newText) {
        setStatusSafe(texts.quickEmptyText);
        return;
      }
      setStatusSafe(texts.generatingQuickDiff);
      try {
        const next = buildQuickTextAfter(sourceRef.current, location.line, selectedTextRef.current, newText, texts.quickReplaceNotFound);
        modifiedRef.current = next;
        const diffData = await postJson<DiffResponse>(`${apiPrefix}/diff`, {
          filePath: location.filePath,
          before: sourceRef.current,
          after: next
        });
        diffRef.current = diffData.diff || [];
        setDiffHtml(renderHighlighted(renderDiff(diffRef.current, texts.noDiffYet), 'diff'));
        setApplyDisabled(!modifiedRef.current);
        setStatusSafe(texts.quickGenerated);
        showToast('success', texts.quickGenerated);
      } catch (error) {
        setStatusSafe(`${texts.quickFailed}: ${String(error)}`);
        showToast('error', `${texts.quickFailed}: ${String(error)}`);
      }
      return;
    }

    const instruction = inputValue.trim();
    if (!instruction) {
      setStatusSafe(texts.enterPrompt);
      return;
    }

    setStatusSafe(texts.generatingPatch);
    setStreamOutputRaw('');
    try {
      const relatedFiles = await collectRelatedFilesForPrompt(
        apiPrefix,
        locationRef.current.filePath,
        sourceRef.current
      );
      if (wantsMultiFileMode(instruction)) {
        const targetFilePaths = relatedFiles.slice(0, 2).map((item) => item.filePath);
        const multi = await postJson<ModifyMultiResponse>(`${apiPrefix}/modify-multi`, {
          entryFilePath: locationRef.current.filePath,
          instruction,
          includeImportedFiles: true,
          maxFiles: 4,
          targetFilePaths,
          relatedFiles,
          scopeMode: 'local-preferred',
          anchor: {
            line: locationRef.current.line,
            column: locationRef.current.column
          },
          location: {
            line: locationRef.current.line,
            column: locationRef.current.column,
            framework: locationRef.current.framework
          },
          contextWindow: {
            beforeLines: 80,
            afterLines: 80
          }
        });

        const okResults = multi.results.filter((item) => item.result) as Array<ModifyMultiResultItem & { result: ModifyResponse }>;
        if (okResults.length === 0) {
          const errorSummary = multi.results.map((item) => `${item.filePath}: ${item.error ?? 'unknown error'}`).join('\n');
          throw new Error(errorSummary || 'No files were generated.');
        }

        multiApplyFilesRef.current = okResults.map((item) => ({
          filePath: item.filePath,
          content: item.result.after,
          before: item.result.before
        }));

        const currentFileResult = okResults.find((item) => item.filePath === locationRef.current?.filePath) ?? okResults[0];
        modifiedRef.current = currentFileResult.result.after;
        diffRef.current = currentFileResult.result.diff || [];
        setDiffHtml(renderHighlighted(renderDiff(diffRef.current, texts.noDiffYet), 'diff'));
        setApplyDisabled(false);
        const summaryLines = [
          `Multi-file plan: ${okResults.length} files`,
          ...okResults.map((item) => `- ${item.filePath}${item.reason ? ` (${item.reason})` : ''}`)
        ];
        setStreamOutputRaw(summaryLines.join('\n'));
        setStatusSafe(`${texts.patchGenerated} (${okResults.length} files)`);
        showToast('success', `${texts.patchGenerated} (${okResults.length} files)`);
        return;
      }
      const runStreamModify = async (
        scopeMode: 'local-preferred' | 'full-file'
      ): Promise<ModifyResponse> => {
        const body: Record<string, unknown> = {
          filePath: locationRef.current!.filePath,
          instruction,
          relatedFiles,
          scopeMode,
          location: {
            line: locationRef.current!.line,
            column: locationRef.current!.column,
            framework: locationRef.current!.framework
          }
        };

        if (scopeMode !== 'full-file') {
          body.anchor = {
            line: locationRef.current!.line,
            column: locationRef.current!.column
          };
          body.contextWindow = {
            beforeLines: 80,
            afterLines: 80
          };
        }

        const response = await fetch(`${apiPrefix}/modify-stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const failText = await response.text().catch(() => '');
          throw new Error(failText || `Request failed: ${response.status}`);
        }

        let donePayload: ModifyResponse | null = null;
        let streamError: string | null = null;
        let scopeError = false;

        await readSseStream(response, {
          onDelta: (chunk) => {
            if (!chunk) return;
            setStreamOutputRaw((prev) => `${prev}${chunk}`);
          },
          onDone: (payload) => {
            donePayload = payload;
          },
          onError: (payload) => {
            scopeError = payload?.code === 'SCOPE_ERROR';
            streamError = payload?.error || 'stream error';
          },
          onScope: (payload) => {
            if (payload.mode === 'local' && payload.startLine && payload.endLine) {
              setStatusSafe(`${texts.scopeLocal}: L${payload.startLine}-L${payload.endLine}`);
              return;
            }
            if (payload.mode === 'full') {
              setStatusSafe(texts.scopeFull);
            }
          }
        });

        if (streamError) {
          const error = new Error(streamError) as Error & { code?: string };
          if (scopeError) error.code = 'SCOPE_ERROR';
          throw error;
        }

        if (!donePayload) {
          throw new Error('Stream completed without final payload.');
        }

        return donePayload as ModifyResponse;
      };

      let finalPayload: ModifyResponse;
      try {
        finalPayload = await runStreamModify('local-preferred');
      } catch (error) {
        const maybeScopeError = error as { code?: string };
        if (maybeScopeError.code !== 'SCOPE_ERROR') throw error;
        setStatusSafe(texts.scopeFull);
        setStreamOutputRaw('');
        finalPayload = await runStreamModify('full-file');
      }

      modifiedRef.current = finalPayload.after;
      diffRef.current = finalPayload.diff || [];
      setDiffHtml(renderHighlighted(renderDiff(diffRef.current, texts.noDiffYet), 'diff'));
      setApplyDisabled(!modifiedRef.current);
      setStatusSafe(finalPayload.explanation || texts.patchGenerated);
      showToast('success', finalPayload.explanation || texts.patchGenerated);
    } catch (error) {
      setStatusSafe(`${texts.generateFailed}: ${String(error)}`);
      showToast('error', `${texts.generateFailed}: ${String(error)}`);
    }
  }, [apiPrefix, inputValue, mode, setStatusSafe, showToast, texts]);

  const handleApply = useCallback(async () => {
    if (multiApplyFilesRef.current.length > 0) {
      setStatusSafe(texts.applyingPatch);
      try {
        await postJson<{ ok: boolean; count: number }>(`${apiPrefix}/write-files`, {
          files: multiApplyFilesRef.current.map((item) => ({
            filePath: item.filePath,
            content: item.content
          }))
        });
        const current = locationRef.current;
        if (current) {
          const applied = multiApplyFilesRef.current.find((item) => item.filePath === current.filePath);
          if (applied) {
            sourceRef.current = applied.content;
            const displayLine = resolveDisplayLineForSnippet(sourceRef.current, current.line || 1, selectedTextRef.current);
            setCodeHtml(renderHighlighted(snippetFromSource(sourceRef.current, displayLine), 'code'));
          }
        }
        multiApplyFilesRef.current = [];
        modifiedRef.current = null;
        diffRef.current = [];
        setApplyDisabled(true);
        setDiffHtml(texts.noDiffYet);
        setStatusSafe(`${texts.applySuccess} (multi-file)`);
      } catch (error) {
        setStatusSafe(`${texts.applyFailed}: ${String(error)}`);
      }
      return;
    }

    if (!locationRef.current || !modifiedRef.current) {
      setStatusSafe(texts.noGeneratedPatch);
      return;
    }
    const location = locationRef.current;
    const previousContent = sourceRef.current;
    const nextContent = modifiedRef.current;
    if (previousContent === nextContent) {
      setStatusSafe(texts.noGeneratedPatch);
      return;
    }
    setStatusSafe(texts.applyingPatch);
    try {
      await postJson<{ ok: boolean }>(`${apiPrefix}/write-file`, {
        filePath: location.filePath,
        content: nextContent
      });
      const snapshot: HistorySnapshot = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: buildHistoryTitle(mode, inputValue),
        meta: formatHistoryMeta(location.filePath, location.line, location.column, Date.now()),
        filePath: location.filePath,
        line: location.line,
        column: location.column,
        content: previousContent
      };
      setHistoryEntries((prev) => [snapshot, ...prev].slice(0, MAX_HISTORY_ITEMS));
      sourceRef.current = nextContent;
      modifiedRef.current = null;
      setApplyDisabled(true);
      setDiffHtml(texts.noDiffYet);
      const displayLine = resolveDisplayLineForSnippet(sourceRef.current, location.line || 1, selectedTextRef.current);
      setCodeHtml(renderHighlighted(snippetFromSource(sourceRef.current, displayLine), 'code'));
      setStatusSafe(texts.applySuccess);
    } catch (error) {
      setStatusSafe(`${texts.applyFailed}: ${String(error)}`);
    }
  }, [apiPrefix, inputValue, mode, setStatusSafe, texts]);

  const handleUndo = useCallback(async () => {
    const last = historyEntries[0];
    if (!last) {
      setStatusSafe(texts.noHistory);
      return;
    }
    setStatusSafe(texts.undoing);
    try {
      await postJson<{ ok: boolean }>(`${apiPrefix}/write-file`, {
        filePath: last.filePath,
        content: last.content
      });
      sourceRef.current = last.content;
      modifiedRef.current = null;
      diffRef.current = [];
      setApplyDisabled(true);
      setDiffHtml(texts.noDiffYet);
      setStreamOutputRaw('');
      setHistoryEntries((prev) => prev.slice(1));
      setMeta(`${last.filePath}:${last.line}:${last.column}`);
      const displayLine = resolveDisplayLineForSnippet(last.content, last.line || 1, selectedTextRef.current);
      setCodeHtml(renderHighlighted(snippetFromSource(last.content, displayLine), 'code'));
      setStatusSafe(texts.undoSuccess);
    } catch (error) {
      setStatusSafe(`${texts.undoFailed}: ${String(error)}`);
    }
  }, [apiPrefix, historyEntries, setStatusSafe, texts]);

  const handleRestoreHistory = useCallback(async (id: string) => {
    const entry = historyEntries.find((item) => item.id === id);
    if (!entry) {
      setStatusSafe(texts.noHistory);
      return;
    }
    setStatusSafe(texts.undoing);
    try {
      await postJson<{ ok: boolean }>(`${apiPrefix}/write-file`, {
        filePath: entry.filePath,
        content: entry.content
      });
      sourceRef.current = entry.content;
      modifiedRef.current = null;
      diffRef.current = [];
      setApplyDisabled(true);
      setDiffHtml(texts.noDiffYet);
      setStreamOutputRaw('');
      setMeta(`${entry.filePath}:${entry.line}:${entry.column}`);
      const displayLine = resolveDisplayLineForSnippet(entry.content, entry.line || 1, selectedTextRef.current);
      setCodeHtml(renderHighlighted(snippetFromSource(entry.content, displayLine), 'code'));
      setStatusSafe(texts.undoSuccess);
    } catch (error) {
      setStatusSafe(`${texts.restoreFailed}: ${String(error)}`);
    }
  }, [apiPrefix, historyEntries, setStatusSafe, texts]);

  const handleJumpToEditor = useCallback(async () => {
    if (!locationRef.current) {
      setStatusSafe(texts.noTargetSelectedFirst);
      return;
    }
    setStatusSafe(texts.openingEditor);
    try {
      await postJson<{ ok: boolean }>(`${apiPrefix}/open-in-editor`, {
        filePath: locationRef.current.filePath,
        line: locationRef.current.line,
        column: locationRef.current.column
      });
      setStatusSafe(texts.openedEditor);
    } catch (error) {
      setStatusSafe(`${texts.openEditorFailed}: ${String(error)}`);
    }
  }, [apiPrefix, setStatusSafe, texts]);

  const handleDiscard = useCallback(() => {
    multiApplyFilesRef.current = [];
    modifiedRef.current = null;
    diffRef.current = [];
    setDiffHtml(texts.noDiffYet);
    setStreamOutputRaw('');
    setApplyDisabled(true);
  }, [texts.noDiffYet]);

  const handleAltClick = useCallback(
    (event: MouseEvent) => {
      if (!event.altKey) return;
      event.preventDefault();
      event.stopPropagation();

      const target = event.target;
      if (!(target instanceof Element)) return;

      if (dock === 'float' && !isFullscreen) {
        const placement = computePanelPlacementFromPointer(
          { x: event.clientX, y: event.clientY },
          panelSize,
          { width: window.innerWidth, height: window.innerHeight }
        );
        setPanelPos({ x: placement.x, y: placement.y });
      }

      setVisible(true);
      multiApplyFilesRef.current = [];
      modifiedRef.current = null;
      diffRef.current = [];
      setDiffHtml(texts.noDiffYet);
      setStreamOutputRaw('');
      setApplyDisabled(true);
      const location = resolveSourceLocation(target);
      if (!location || !location.filePath || location.filePath.trim().length === 0) {
        setStatusSafe(texts.resolveFailed);
        return;
      }

      locationRef.current = location;
      selectedTextRef.current = extractEditableText(target);
      if (mode === 'quick') {
        setInputValue(selectedTextRef.current);
      }

      void loadSource(location).catch((error) => setStatusSafe(`${texts.readFailed}: ${String(error)}`));
    },
    [dock, isFullscreen, loadSource, mode, panelSize, setStatusSafe, texts.noDiffYet, texts.readFailed, texts.resolveFailed]
  );

  useEffect(() => {
    window.addEventListener('click', handleAltClick, true);
    return () => window.removeEventListener('click', handleAltClick, true);
  }, [handleAltClick]);

  useEffect(() => {
    const ensureOverlay = (): HTMLDivElement => {
      if (hoverOverlayRef.current) return hoverOverlayRef.current;
      const node = document.createElement('div');
      node.id = 'altpatch-hover-outline';
      node.style.position = 'fixed';
      node.style.pointerEvents = 'none';
      node.style.zIndex = '2147483646';
      node.style.border = '2px solid #38bdf8';
      node.style.borderRadius = '8px';
      node.style.background = 'rgba(56, 189, 248, 0.08)';
      node.style.boxShadow = '0 0 0 1px rgba(56, 189, 248, 0.35), 0 0 0 6px rgba(56, 189, 248, 0.12)';
      node.style.display = 'none';
      document.documentElement.appendChild(node);
      hoverOverlayRef.current = node;
      return node;
    };

    const hideOverlay = () => {
      const overlay = hoverOverlayRef.current;
      if (overlay) overlay.style.display = 'none';
    };

    const isInsidePanelHost = (element: Element): boolean => {
      const host = document.getElementById(PANEL_HOST_ID);
      if (!host) return false;
      return element === host || host.contains(element);
    };

    const updateHoverOutline = (clientX: number, clientY: number) => {
      if (!altPressedRef.current) {
        hideOverlay();
        return;
      }
      const target = document.elementFromPoint(clientX, clientY);
      if (!(target instanceof Element) || isInsidePanelHost(target)) {
        hideOverlay();
        return;
      }
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        hideOverlay();
        return;
      }
      const overlay = ensureOverlay();
      overlay.style.left = `${Math.max(0, rect.left)}px`;
      overlay.style.top = `${Math.max(0, rect.top)}px`;
      overlay.style.width = `${Math.max(0, rect.width)}px`;
      overlay.style.height = `${Math.max(0, rect.height)}px`;
      overlay.style.display = 'block';
    };

    const onPointerMove = (event: PointerEvent) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      updateHoverOutline(event.clientX, event.clientY);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Alt') return;
      altPressedRef.current = true;
      if (lastPointerRef.current) {
        updateHoverOutline(lastPointerRef.current.x, lastPointerRef.current.y);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Alt') return;
      altPressedRef.current = false;
      hideOverlay();
    };

    const onWindowBlur = () => {
      altPressedRef.current = false;
      hideOverlay();
    };

    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onWindowBlur);

    return () => {
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onWindowBlur);
      hoverOverlayRef.current?.remove();
      hoverOverlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (isFullscreen) {
        stopDrag();
        stopResize();
        return;
      }
      if (dragState.current.active && dock === 'float') {
        setPanelPos({
          x: dragState.current.originX + (event.clientX - dragState.current.startX),
          y: dragState.current.originY + (event.clientY - dragState.current.startY)
        });
        return;
      }

      if (resizeState.current.active) {
        const deltaX = event.clientX - resizeState.current.startX;
        const deltaY = event.clientY - resizeState.current.startY;
        const { direction, originWidth, originHeight, originX, originY } = resizeState.current;

        if (dock === 'bottom') {
          if (direction !== 'n') return;
          const newHeight = Math.max(MIN_PANEL_HEIGHT, originHeight - deltaY);
          setPanelSize((prev) => ({ ...prev, height: newHeight }));
          return;
        }

        if (dock === 'left') {
          if (direction !== 'e') return;
          const newWidth = Math.max(MIN_PANEL_WIDTH, originWidth + deltaX);
          setPanelSize((prev) => ({ ...prev, width: newWidth }));
          return;
        }

        if (dock === 'right') {
          if (direction !== 'w') return;
          const newWidth = Math.max(MIN_PANEL_WIDTH, originWidth - deltaX);
          setPanelSize((prev) => ({ ...prev, width: newWidth }));
          return;
        }

        if (dock !== 'float') return;

        let newWidth = originWidth;
        let newHeight = originHeight;
        let newX = originX;
        let newY = originY;

        if (direction.includes('e')) {
          newWidth = Math.max(MIN_PANEL_WIDTH, originWidth + deltaX);
        }
        if (direction.includes('w')) {
          const possibleWidth = originWidth - deltaX;
          if (possibleWidth >= MIN_PANEL_WIDTH) {
            newWidth = possibleWidth;
            newX = originX + deltaX;
          }
        }
        if (direction.includes('s')) {
          newHeight = Math.max(MIN_PANEL_HEIGHT, originHeight + deltaY);
        }
        if (direction.includes('n')) {
          const possibleHeight = originHeight - deltaY;
          if (possibleHeight >= MIN_PANEL_HEIGHT) {
            newHeight = possibleHeight;
            newY = originY + deltaY;
          }
        }

        setPanelSize({ width: newWidth, height: newHeight });
        setPanelPos({ x: newX, y: newY });
      }
    };
    const onPointerUp = () => {
      stopDrag();
      stopResize();
    };
    const onPointerCancel = () => {
      stopDrag();
      stopResize();
    };
    const onLostPointerCapture = () => {
      stopDrag();
      stopResize();
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    panelRef.current?.addEventListener('lostpointercapture', onLostPointerCapture);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      panelRef.current?.removeEventListener('lostpointercapture', onLostPointerCapture);
    };
  }, [dock, isFullscreen, stopDrag, stopResize]);

  const handleDragStart = useCallback(
    (event: React.PointerEvent) => {
      if (isFullscreen) return;
      if (dock !== 'float') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('button')) return;
      event.preventDefault();
      stopResize();
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;
      dragState.current = {
        active: true,
        startX: event.clientX,
        startY: event.clientY,
        originX: rect.left,
        originY: rect.top,
        pointerId: event.pointerId
      };
      panelRef.current?.setPointerCapture?.(event.pointerId);
    },
    [dock, isFullscreen, stopResize]
  );

  const handleResizeStart = useCallback(
    (event: React.PointerEvent, direction: string) => {
      if (isFullscreen) return;
      const allowedDirections =
        dock === 'float' ? new Set(['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se']) :
        dock === 'bottom' ? new Set(['n']) :
        dock === 'left' ? new Set(['e']) :
        dock === 'right' ? new Set(['w']) :
        new Set<string>();
      if (!allowedDirections.has(direction)) return;
      event.preventDefault();
      event.stopPropagation();
      stopDrag();
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;
      resizeState.current = {
        active: true,
        direction,
        startX: event.clientX,
        startY: event.clientY,
        originWidth: rect.width,
        originHeight: rect.height,
        originX: rect.left,
        originY: rect.top,
        pointerId: event.pointerId
      };
      panelRef.current?.setPointerCapture?.(event.pointerId);
    },
    [dock, isFullscreen, stopDrag]
  );

  const panelStyle = useMemo(() => dockStyle(dock, panelSize, panelPos, isFullscreen), [dock, isFullscreen, panelPos, panelSize]);

  const applyDisabledFlag = useMemo(() => applyDisabled, [applyDisabled]);
  const undoDisabledFlag = useMemo(() => historyEntries.length === 0, [historyEntries.length]);
  const historyItems = useMemo<PanelHistoryItem[]>(
    () => historyEntries.map((entry) => ({ id: entry.id, title: entry.title, meta: entry.meta })),
    [historyEntries]
  );

  return (
    <Panel
      dock={dock}
      mode={mode}
      theme={theme}
      themeOptions={themeOptions}
      locale={locale}
      localeOptions={PANEL_LOCALE_OPTIONS}
      texts={texts}
      status={status}
      meta={meta}
      modelName={modelName}
      toast={toast}
      codeHtml={codeHtml}
      diffHtml={diffHtml}
      streamOutput={renderHighlighted(streamOutputRaw || '', 'code')}
      historyItems={historyItems}
      inputValue={inputValue}
      applyDisabled={applyDisabledFlag}
      undoDisabled={undoDisabledFlag}
      visible={visible}
      panelStyle={panelStyle}
      panelRef={panelRef}
      headerRef={headerRef}
      onDragStart={handleDragStart}
      onResizeStart={handleResizeStart}
      onClose={() => setVisible(false)}
      onJumpToEditor={handleJumpToEditor}
      onSetDock={handleSetDock}
      isFullscreen={isFullscreen}
      onToggleFullscreen={handleToggleFullscreen}
      onSwitchMode={handleModeSwitch}
      onSetTheme={setTheme}
      onSetLocale={setLocale}
      onInputChange={handleInputChange}
      onGenerate={handleGenerate}
      onApply={handleApply}
      onUndo={handleUndo}
      onRestoreHistory={handleRestoreHistory}
      onDiscard={handleDiscard}
    />
  );
};

function mountIntoShadow(apiPrefix: string): void {
  let host = document.getElementById(PANEL_HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = PANEL_HOST_ID;
    document.documentElement.appendChild(host);
  }

  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  if (!shadowRoot.querySelector('style[data-altpatch-panel-style]')) {
    const style = document.createElement('style');
    style.setAttribute('data-altpatch-panel-style', 'true');
    style.textContent = panelStyles;
    shadowRoot.appendChild(style);
  }

  let mount = shadowRoot.getElementById('altpatch-react-root');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'altpatch-react-root';
    shadowRoot.appendChild(mount);
  }

  const root = createRoot(mount);
  root.render(<AltPatchApp apiPrefix={apiPrefix} />);
}

export function mountAltPatchRuntime(apiPrefix = '/api'): void {
  if (typeof window === 'undefined') return;
  mountIntoShadow(apiPrefix);
}

