import fs from 'node:fs/promises';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgRoot = __dirname;

const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`)
]);

const tsLikeExt = ['.ts', '.tsx', '.mts', '.cts'];
const resolvableExt = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'];

function isRelativeImport(source) {
  return source.startsWith('.') || source.startsWith('/');
}

async function tryResolveFile(basePath) {
  for (const ext of resolvableExt) {
    const candidate = `${basePath}${ext}`;
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // continue
    }
  }
  return null;
}

async function tryResolveDirectory(basePath) {
  for (const ext of resolvableExt) {
    const candidate = path.join(basePath, `index${ext}`);
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // continue
    }
  }
  return null;
}

function localTsPlugin() {
  return {
    name: 'local-ts',
    async resolveId(source, importer) {
      if (nodeBuiltins.has(source)) return { id: source, external: true };
      if (!isRelativeImport(source)) return null;

      const base = importer ? path.resolve(path.dirname(importer), source) : path.resolve(pkgRoot, source);

      try {
        const stat = await fs.stat(base);
        if (stat.isFile()) return base;
        if (stat.isDirectory()) {
          const resolved = await tryResolveDirectory(base);
          if (resolved) return resolved;
        }
      } catch {
        // continue
      }

      const asFile = await tryResolveFile(base);
      if (asFile) return asFile;
      return tryResolveDirectory(base);
    },
    async transform(code, id) {
      const ext = path.extname(id);
      if (!tsLikeExt.includes(ext)) return null;

      const transpiled = ts.transpileModule(code, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
          jsx: ext === '.tsx' ? ts.JsxEmit.ReactJSX : undefined,
          sourceMap: false
        },
        fileName: id,
        reportDiagnostics: false
      });

      return { code: transpiled.outputText, map: null };
    }
  };
}

function dtsEmitPlugin() {
  return {
    name: 'dts-emit',
    async generateBundle() {
      const typesSource = await fs.readFile(path.join(pkgRoot, 'src', 'types.ts'), 'utf8');
      const indexDts = [
        "import type { AltPatchWebpackPluginOptions } from './types';",
        "export type { AltPatchWebpackPluginOptions } from './types';",
        'export declare class AltpatchWebpackPlugin {',
        '  constructor(options?: AltPatchWebpackPluginOptions);',
        '  apply(compiler: any): void;',
        '}',
        'export declare function altpatch(options?: AltPatchWebpackPluginOptions): AltpatchWebpackPlugin;',
        ''
      ].join('\n');

      this.emitFile({ type: 'asset', fileName: 'index.d.ts', source: indexDts });
      this.emitFile({ type: 'asset', fileName: 'types.d.ts', source: typesSource });
    }
  };
}

function isExternal(id) {
  if (id.startsWith('\0')) return true;
  if (nodeBuiltins.has(id)) return true;
  if (isRelativeImport(id) || path.isAbsolute(id)) return false;
  return true;
}

export default {
  input: {
    index: path.join(pkgRoot, 'src', 'index.ts')
  },
  external: isExternal,
  treeshake: { moduleSideEffects: true },
  plugins: [localTsPlugin(), dtsEmitPlugin()],
  output: {
    dir: path.join(pkgRoot, 'dist'),
    format: 'esm',
    sourcemap: false,
    entryFileNames: '[name].js',
    chunkFileNames: 'chunks/[name]-[hash].js'
  }
};
