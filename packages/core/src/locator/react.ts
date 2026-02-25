import type { SourceLocation } from '../protocol/messages';

export function locateReact(target: Element): SourceLocation | null {
  const filePath = target.getAttribute('data-altpatch-file');
  const line = Number(target.getAttribute('data-altpatch-line'));
  const column = Number(target.getAttribute('data-altpatch-column'));
  if (!filePath || !Number.isFinite(line) || !Number.isFinite(column)) {
    return null;
  }
  return { filePath, line, column, framework: 'react' };
}
