import fs from 'node:fs/promises';
import path from 'node:path';

function normalizeForCompare(value: string): string {
  const normalized = path.resolve(value).replace(/[/\\]+/g, path.sep);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function normalizeIncomingPath(filePath: string): string {
  return filePath.replace(/^file:\/\//, '').trim();
}

export class FsGuard {
  constructor(private readonly projectRoot: string) {}

  private safePath(filePath: string): string {
    const incoming = normalizeIncomingPath(filePath);
    const resolved = path.isAbsolute(incoming)
      ? path.resolve(incoming)
      : path.resolve(this.projectRoot, incoming);

    const rootCmp = normalizeForCompare(this.projectRoot);
    const resolvedCmp = normalizeForCompare(resolved);
    const startsWithRoot = resolvedCmp === rootCmp || resolvedCmp.startsWith(`${rootCmp}${path.sep}`);
    if (!startsWithRoot) {
      throw new Error(`Path escape detected: ${filePath}`);
    }
    return resolved;
  }

  async read(filePath: string): Promise<string> {
    return fs.readFile(this.safePath(filePath), 'utf8');
  }

  async write(filePath: string, content: string): Promise<void> {
    await fs.writeFile(this.safePath(filePath), content, 'utf8');
  }
}
