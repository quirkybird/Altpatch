import { createPatch, diffLines } from 'diff';

export function toUnifiedDiff(before: string, after: string): Array<{ type: 'add' | 'del' | 'ctx'; content: string }> {
  const parts = diffLines(before, after);
  const output: Array<{ type: 'add' | 'del' | 'ctx'; content: string }> = [];

  for (const part of parts) {
    const type = part.added ? 'add' : part.removed ? 'del' : 'ctx';
    const lines = part.value.split('\n');
    for (const line of lines) {
      if (line.length === 0) {
        continue;
      }
      output.push({ type, content: line });
    }
  }

  return output;
}

export function buildDiff(filePath: string, before: string, after: string) {
  const patch = createPatch(filePath, before, after);
  return {
    patch,
    diff: toUnifiedDiff(before, after)
  };
}
