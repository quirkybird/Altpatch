export function renderDiffPanel(diffLines: Array<{ type: 'add' | 'del' | 'ctx'; content: string }>): string {
  return diffLines.map((line) => `${line.type.toUpperCase()} ${line.content}`).join('\n');
}
