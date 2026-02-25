export function toUnifiedDiff(before: string, after: string): Array<{ type: 'add' | 'del' | 'ctx'; content: string }> {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  if (before === after) {
    return beforeLines.map((line) => ({ type: 'ctx' as const, content: line }));
  }
  return [
    ...beforeLines.map((line) => ({ type: 'del' as const, content: line })),
    ...afterLines.map((line) => ({ type: 'add' as const, content: line }))
  ];
}
