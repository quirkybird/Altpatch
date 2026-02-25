import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { attachAltPatchApi } from './server/api';
import type { AltPatchPluginOptions } from './types';

export type { AltPatchPluginOptions } from './types';

export function altpatch(options: AltPatchPluginOptions = {}): Plugin {
  const apiPrefix = options.apiPrefix ?? '/api';
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const runtimePath = fileURLToPath(new URL('./client/runtime.ts', import.meta.url)).replace(/\\/g, '/');

  return {
    name: 'altpatch-vite-plugin',
    apply: options.enableInDevOnly === false ? undefined : 'serve',

    configureServer(server) {
      attachAltPatchApi(server, projectRoot, apiPrefix);
    },

    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module', src: `/@fs/${runtimePath}` },
          injectTo: 'head-prepend'
        }
      ];
    }
  };
}
