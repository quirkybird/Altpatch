import path from 'node:path';
import { transformAsync } from '@babel/core';
import locatorBabelJsx from '@locator/babel-jsx';
import { type Plugin } from 'vite';
import { registerAltpatchViteApi } from '../../altpatch-api/src/index';
import { runtimeEntryPath } from '../../altpatch-ui-runtime/src/index';
import type { AltPatchPluginOptions } from './types';

export type { AltPatchPluginOptions } from './types';

export function altpatch(options: AltPatchPluginOptions = {}): Plugin {
  const apiPrefix = options.apiPrefix ?? '/api';
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const locatorEnabled = options.locator?.enabled ?? true;
  const locatorEnv = options.locator?.env ?? 'development';
  const locatorDataAttribute = options.locator?.dataAttribute ?? 'path';
  let viteRoot = projectRoot;
  let hasWarnedLocatorWindowsFallback = false;

  return {
    name: 'altpatch-vite-plugin',
    enforce: 'pre',
    apply: options.enableInDevOnly === false ? undefined : 'serve',
    configResolved(config) {
      viteRoot = config.root;
    },

    configureServer(server) {
      registerAltpatchViteApi(server, {
        projectRoot,
        apiPrefix,
        env: {},
        llm: options.llm
      });
    },
    async transform(code, id) {
      if (!locatorEnabled) return null;
      const rawId = id.split('?')[0];
      const cleanId = rawId.startsWith('/@fs/') ? rawId.slice('/@fs/'.length) : rawId;
      if (!/\.(jsx|tsx)$/.test(cleanId)) return null;
      if (cleanId.includes('/node_modules/') || cleanId.includes('\\node_modules\\')) return null;
      const hasWindowsDrive = /^[a-zA-Z]:[\\/]/.test(cleanId);
      const filenameForLocator = hasWindowsDrive
        ? cleanId
        : cleanId.startsWith('/')
          ? path.resolve(viteRoot, `.${cleanId}`)
          : path.resolve(viteRoot, cleanId);
      const normalizedFilenameForLocator = filenameForLocator.replace(/\\/g, '/');

      let transformed;
      try {
        transformed = await transformAsync(code, {
          filename: normalizedFilenameForLocator,
          babelrc: false,
          configFile: false,
          sourceMaps: true,
          parserOpts: {
            sourceType: 'module',
            plugins: ['jsx', 'typescript']
          },
          plugins: [[locatorBabelJsx, { env: locatorEnv, dataAttribute: locatorDataAttribute }]]
        });
      } catch (error) {
        const message = String(error);
        const isWindowsLocatorEscapeIssue =
          process.platform === 'win32' &&
          message.includes('Bad character escape sequence');
        if (!isWindowsLocatorEscapeIssue) throw error;

        if (!hasWarnedLocatorWindowsFallback) {
          hasWarnedLocatorWindowsFallback = true;
          console.warn(
            '[altpatch] Locator transform skipped due to upstream Windows path escape issue in @locator/babel-jsx. ' +
            'Code transform continues without locator attributes for affected files.'
          );
        }
        return null;
      }

      if (!transformed?.code) return null;
      return {
        code: transformed.code,
        map: transformed.map ?? null
      };
    },

    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module', src: `/@fs/${runtimeEntryPath}` },
          injectTo: 'head'
        }
      ];
    }
  };
}
