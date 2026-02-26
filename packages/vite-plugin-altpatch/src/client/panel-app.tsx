import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getElementInfo } from '@locator/runtime/dist/adapters/getElementInfo';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import xml from 'highlight.js/lib/languages/xml';
import diff from 'highlight.js/lib/languages/diff';
import { Panel, panelStyles, type DockMode, type Mode } from './Panel';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('diff', diff);

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

type AltPatchAppProps = {
  apiPrefix: string;
};

const DEFAULT_PANEL_WIDTH = 500;
const DEFAULT_PANEL_HEIGHT = 560;
const DEFAULT_PANEL_TOP = 16;
const DEFAULT_PANEL_RIGHT = 16;

function resolveSourceLocation(target: Element): SourceLocation | null {
  const runtime = (window as any).__ALTPATCH_LOCATOR_RUNTIME__;
  if (runtime?.locate) {
    const resolved = runtime.locate(target);
    if (resolved) return resolved;
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

function dockStyle(dock: DockMode, size: { width: number; height: number }, pos: { x: number | null; y: number | null }): React.CSSProperties {
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
    return { position: 'fixed', left: 0, right: 0, bottom: 0, top: 'auto', width: '100vw', height: '320px' };
  }
  if (dock === 'left') {
    return { position: 'fixed', left: 0, top: 0, bottom: 0, right: 'auto', width: '420px', height: '100vh' };
  }
  return { position: 'fixed', right: 0, top: 0, bottom: 0, left: 'auto', width: '420px', height: '100vh' };
}

function useResize(ref: React.RefObject<HTMLDivElement>, enabled: boolean, onResize: (rect: DOMRectReadOnly) => void): void {
  useEffect(() => {
    if (!ref.current || !enabled) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) onResize(entry.contentRect);
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [enabled, onResize, ref]);
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

  const locationRef = useRef<SourceLocation | null>(null);
  const sourceRef = useRef<string>('');
  const modifiedRef = useRef<string | null>(null);
  const diffRef = useRef<Array<{ type: 'add' | 'del' | 'ctx'; content: string }>>([]);
  const selectedTextRef = useRef<string>('');

  const [dock, setDock] = useState<DockMode>('float');
  const [panelSize, setPanelSize] = useState({ width: DEFAULT_PANEL_WIDTH, height: DEFAULT_PANEL_HEIGHT });
  const [panelPos, setPanelPos] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<Mode>('quick');
  const [status, setStatus] = useState('Ready');
  const [meta, setMeta] = useState('No target selected.');
  const [codeHtml, setCodeHtml] = useState('Select an element with Alt+Click.');
  const [diffHtml, setDiffHtml] = useState('No diff yet.');
  const [inputValue, setInputValue] = useState('');
  const [applyDisabled, setApplyDisabled] = useState(true);

  const setStatusSafe = useCallback((message: string) => setStatus(message), []);

  const handleSetDock = useCallback((next: DockMode) => {
    setDock(next);
  }, []);

  const handleModeSwitch = useCallback((next: Mode) => {
    setMode(next);
    if (next === 'quick') {
      setInputValue(selectedTextRef.current);
      setStatusSafe('Switched to Quick Text mode.');
    } else {
      setInputValue('');
      setStatusSafe('Switched to AI Assist mode.');
    }
  }, [setStatusSafe]);

  const handleInputChange = useCallback((value: string) => setInputValue(value), []);

  const resetFloatPosition = useCallback(() => {
    setPanelSize({ width: DEFAULT_PANEL_WIDTH, height: DEFAULT_PANEL_HEIGHT });
    setPanelPos({ x: null, y: null });
  }, []);

  const loadSource = useCallback(
    async (location: SourceLocation) => {
      setStatusSafe('Reading source...');
      const data = await postJson<ReadFileResponse>(`${apiPrefix}/read-file`, { filePath: location.filePath });
      sourceRef.current = data.content;
      setMeta(`${location.filePath}:${location.line}:${location.column}`);
      setCodeHtml(renderHighlighted(snippetFromSource(data.content, location.line || 1), 'code'));
      setStatusSafe('Ready');
    },
    [apiPrefix, setStatusSafe]
  );

  const handleGenerate = useCallback(async () => {
    if (!locationRef.current) {
      setStatusSafe('No target selected. Alt+Click first.');
      return;
    }

    if (mode === 'quick') {
      const location = locationRef.current;
      const newText = inputValue;
      if (!newText) {
        setStatusSafe('请输入要替换的新文本。');
        return;
      }
      setStatusSafe('Generating quick diff...');
      try {
        const next = buildQuickTextAfter(sourceRef.current, location.line, selectedTextRef.current, newText);
        modifiedRef.current = next;
        const diffData = await postJson<DiffResponse>(`${apiPrefix}/diff`, {
          filePath: location.filePath,
          before: sourceRef.current,
          after: next
        });
        diffRef.current = diffData.diff || [];
        setDiffHtml(renderHighlighted(renderDiff(diffRef.current), 'diff'));
        setApplyDisabled(!modifiedRef.current);
        setStatusSafe('Quick text diff generated.');
      } catch (error) {
        setStatusSafe(`Quick mode failed: ${String(error)}`);
      }
      return;
    }

    const instruction = inputValue.trim();
    if (!instruction) {
      setStatusSafe('Please enter a prompt.');
      return;
    }

    setStatusSafe('Generating patch (mock)...');
    try {
      const data = await postJson<ModifyResponse>(`${apiPrefix}/modify`, {
        filePath: locationRef.current.filePath,
        instruction,
        location: {
          line: locationRef.current.line,
          column: locationRef.current.column,
          framework: locationRef.current.framework
        }
      });
      modifiedRef.current = data.after;
      diffRef.current = data.diff || [];
      setDiffHtml(renderHighlighted(renderDiff(diffRef.current), 'diff'));
      setApplyDisabled(!modifiedRef.current);
      setStatusSafe(data.explanation || 'Patch generated.');
    } catch (error) {
      setStatusSafe(`Generate failed: ${String(error)}`);
    }
  }, [apiPrefix, inputValue, mode, setStatusSafe]);

  const handleApply = useCallback(async () => {
    if (!locationRef.current || !modifiedRef.current) {
      setStatusSafe('No generated patch to apply.');
      return;
    }
    setStatusSafe('Applying patch...');
    try {
      await postJson<{ ok: boolean }>(`${apiPrefix}/write-file`, {
        filePath: locationRef.current.filePath,
        content: modifiedRef.current
      });
      sourceRef.current = modifiedRef.current;
      setCodeHtml(renderHighlighted(snippetFromSource(sourceRef.current, locationRef.current.line || 1), 'code'));
      setStatusSafe('Applied successfully. File updated locally.');
    } catch (error) {
      setStatusSafe(`Apply failed: ${String(error)}`);
    }
  }, [apiPrefix, setStatusSafe]);

  const handleDiscard = useCallback(() => {
    modifiedRef.current = null;
    diffRef.current = [];
    setDiffHtml('No diff yet.');
    setApplyDisabled(true);
  }, []);

  const handleAltClick = useCallback(
    (event: MouseEvent) => {
      if (!event.altKey) return;
      event.preventDefault();
      event.stopPropagation();

      const target = event.target;
      if (!(target instanceof Element)) return;

      if (dock === 'float') {
        resetFloatPosition();
      }

      setVisible(true);
      modifiedRef.current = null;
      diffRef.current = [];
      setDiffHtml('No diff yet.');
      setApplyDisabled(true);
      const location = resolveSourceLocation(target);
      if (!location || !location.filePath || location.filePath.trim().length === 0) {
        setStatusSafe('AltPatch: could not resolve source location.');
        return;
      }

      locationRef.current = location;
      selectedTextRef.current = extractEditableText(target);
      if (mode === 'quick') {
        setInputValue(selectedTextRef.current);
      }

      void loadSource(location).catch((error) => setStatusSafe(`Read failed: ${String(error)}`));
    },
    [dock, loadSource, mode, resetFloatPosition, setStatusSafe]
  );

  useEffect(() => {
    window.addEventListener('click', handleAltClick, true);
    return () => window.removeEventListener('click', handleAltClick, true);
  }, [handleAltClick]);

  useResize(
    panelRef,
    dock === 'float',
    (rect) => setPanelSize({ width: Math.round(rect.width), height: Math.round(rect.height) })
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!dragState.current.active || dock !== 'float') return;
      setPanelPos({ x: dragState.current.originX + (event.clientX - dragState.current.startX), y: dragState.current.originY + (event.clientY - dragState.current.startY) });
    };
    const onPointerUp = () => {
      if (!dragState.current.active) return;
      dragState.current.active = false;
      if (dragState.current.pointerId !== null) {
        panelRef.current?.releasePointerCapture?.(dragState.current.pointerId);
      }
      dragState.current.pointerId = null;
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dock]);

  const handleDragStart = useCallback(
    (event: React.PointerEvent) => {
      if (dock !== 'float') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('button')) return;
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
    [dock]
  );

  const panelStyle = useMemo(() => dockStyle(dock, panelSize, panelPos), [dock, panelPos, panelSize]);

  const applyDisabledFlag = useMemo(() => applyDisabled, [applyDisabled]);

  return (
    <Panel
      dock={dock}
      mode={mode}
      status={status}
      meta={meta}
      codeHtml={codeHtml}
      diffHtml={diffHtml}
      inputValue={inputValue}
      applyDisabled={applyDisabledFlag}
      visible={visible}
      panelStyle={panelStyle}
      panelRef={panelRef}
      headerRef={headerRef}
      onDragStart={handleDragStart}
      onClose={() => setVisible(false)}
      onSetDock={handleSetDock}
      onSwitchMode={handleModeSwitch}
      onInputChange={handleInputChange}
      onGenerate={handleGenerate}
      onApply={handleApply}
      onDiscard={handleDiscard}
    />
  );
};

function mountIntoShadow(apiPrefix: string): void {
  const hostId = 'altpatch-tooltip-host';
  let host = document.getElementById(hostId);
  if (!host) {
    host = document.createElement('div');
    host.id = hostId;
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
