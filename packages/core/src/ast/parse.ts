export function parseCode(source: string): { ok: boolean; length: number } {
  return { ok: source.length >= 0, length: source.length };
}
