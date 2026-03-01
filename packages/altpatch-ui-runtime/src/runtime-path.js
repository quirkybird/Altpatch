import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const runtimeEntryTsPath = fileURLToPath(new URL('./runtime-entry.ts', import.meta.url));
const runtimeEntryJsPath = fileURLToPath(new URL('./runtime-entry.js', import.meta.url));
export const runtimeEntryPath = (existsSync(runtimeEntryTsPath) ? runtimeEntryTsPath : runtimeEntryJsPath).replace(/\\/g, '/');
//# sourceMappingURL=runtime-path.js.map