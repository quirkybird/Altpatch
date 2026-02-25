import fs from 'node:fs/promises';
import path from 'node:path';

export class FsGuard {
  constructor(private readonly projectRoot: string) {}

  private safePath(filePath: string): string {
    const resolved = path.resolve(this.projectRoot, filePath);
    if (!resolved.startsWith(this.projectRoot)) {
      throw new Error('Path escape detected');
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
