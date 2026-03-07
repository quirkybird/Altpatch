import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import locatorBabelJsx from '@locator/babel-jsx';
import { registerAltpatchExpressApi } from '../../altpatch-api/src/index';
import type { AltPatchWebpackPluginOptions } from './types';

export type { AltPatchWebpackPluginOptions } from './types';

const PLUGIN_NAME = 'altpatch-webpack-plugin';
const RUNTIME_PUBLIC_BASE = '/__altpatch';
const RUNTIME_ENTRY_FILE = 'runtime-entry.js';
const BODY_PARSER_INSTALLED_KEY = '__altpatchBodyParserInstalled';

type Logger = {
  warn: (message: string) => void;
  info: (message: string) => void;
};

type AnyObject = Record<string, unknown>;

function isBabelLoaderName(name: string): boolean {
  return /(^|[\\/])babel-loader([\\/]|$)/.test(name);
}

function asArray<T>(input: T | T[] | undefined): T[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.map')) return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function createRuntimeStaticMiddleware(runtimeDir: string) {
  const runtimeDirWithSep = runtimeDir.endsWith(path.sep) ? runtimeDir : `${runtimeDir}${path.sep}`;

  return (req: { method?: string; url?: string }, res: {
    statusCode: number;
    setHeader: (name: string, value: string) => void;
    end: (chunk?: string) => void;
    once?: (event: string, listener: () => void) => void;
  }, next: () => void) => {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') return next();

    const urlPath = (req.url ?? '/').split('?')[0] || '/';
    const decoded = decodeURIComponent(urlPath);
    const relative = decoded === '/' ? `/${RUNTIME_ENTRY_FILE}` : decoded;
    const safeRelative = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, '');
    const absolute = path.resolve(runtimeDir, `.${safeRelative}`);

    if (!absolute.startsWith(runtimeDirWithSep) && absolute !== runtimeDir) return next();
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return next();

    res.statusCode = 200;
    res.setHeader('Content-Type', contentTypeFor(absolute));
    fs.createReadStream(absolute).pipe(res as never);
  };
}

function findRuntimeDistDir(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    here,
    path.resolve(here, '../dist')
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, RUNTIME_ENTRY_FILE))) return dir;
  }
  return null;
}

function ensureLocatorPlugin(plugins: unknown[], locatorOptions: AnyObject): unknown[] {
  const hasLocator = plugins.some((item) => {
    if (Array.isArray(item)) {
      const first = item[0];
      return first === locatorBabelJsx || first === '@locator/babel-jsx';
    }
    return item === locatorBabelJsx || item === '@locator/babel-jsx';
  });

  if (hasLocator) return plugins;
  return [...plugins, [locatorBabelJsx, locatorOptions]];
}

function patchRuleForLocator(rule: AnyObject, locatorOptions: AnyObject): number {
  let patchedCount = 0;

  const nestedRules = asArray(rule.rules as AnyObject[] | undefined);
  for (const nested of nestedRules) patchedCount += patchRuleForLocator(nested, locatorOptions);

  const oneOfRules = asArray(rule.oneOf as AnyObject[] | undefined);
  for (const nested of oneOfRules) patchedCount += patchRuleForLocator(nested, locatorOptions);

  const directLoader = typeof rule.loader === 'string' ? rule.loader : null;
  if (directLoader && isBabelLoaderName(directLoader) && typeof rule.options === 'object' && rule.options !== null) {
    const options = rule.options as AnyObject;
    const plugins = Array.isArray(options.plugins) ? options.plugins : [];
    options.plugins = ensureLocatorPlugin(plugins, locatorOptions);
    patchedCount += 1;
  }

  const useList = asArray(rule.use as (string | AnyObject)[] | undefined);
  for (const useItem of useList) {
    if (typeof useItem === 'string') continue;
    const loader = typeof useItem.loader === 'string' ? useItem.loader : null;
    if (!loader || !isBabelLoaderName(loader)) continue;
    if (typeof useItem.options !== 'object' || useItem.options === null) continue;
    const options = useItem.options as AnyObject;
    const plugins = Array.isArray(options.plugins) ? options.plugins : [];
    options.plugins = ensureLocatorPlugin(plugins, locatorOptions);
    patchedCount += 1;
  }

  return patchedCount;
}

function injectRuntimeScriptIntoHtml(html: string): string {
  const snippet = `<script type="module" src="${RUNTIME_PUBLIC_BASE}/${RUNTIME_ENTRY_FILE}"></script>`;
  if (html.includes(snippet)) return html;

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${snippet}\n</head>`);
  }

  return `${snippet}\n${html}`;
}

export class AltpatchWebpackPlugin {
  private readonly options: AltPatchWebpackPluginOptions;

  constructor(options: AltPatchWebpackPluginOptions = {}) {
    this.options = options;
  }

  apply(compiler: {
    context?: string;
    options: AnyObject;
    hooks: AnyObject;
    webpack?: AnyObject;
    getInfrastructureLogger?: (name: string) => Logger;
  }): void {
    const logger = compiler.getInfrastructureLogger?.(PLUGIN_NAME) ?? console;
    const mode = typeof compiler.options.mode === 'string' ? compiler.options.mode : 'development';
    const enableInDevOnly = this.options.enableInDevOnly ?? true;
    if (enableInDevOnly && mode !== 'development') return;

    this.applyLocatorPatch(compiler, logger);
    this.applyDevServerPatch(compiler, logger);
    this.applyHtmlInjection(compiler);
  }

  private applyLocatorPatch(compiler: { options: AnyObject }, logger: Logger): void {
    const locatorEnabled = this.options.locator?.enabled ?? true;
    if (!locatorEnabled) return;

    const moduleOptions = compiler.options.module as AnyObject | undefined;
    const rules = asArray(moduleOptions?.rules as AnyObject[] | undefined);
    if (rules.length === 0) {
      logger.warn(`[${PLUGIN_NAME}] webpack.module.rules not found; locator transform was skipped.`);
      return;
    }

    const locatorOptions = {
      env: this.options.locator?.env ?? 'development',
      dataAttribute: this.options.locator?.dataAttribute ?? 'path'
    };

    let patched = 0;
    for (const rule of rules) patched += patchRuleForLocator(rule, locatorOptions);

    if (patched === 0) {
      logger.warn(
        `[${PLUGIN_NAME}] Did not find any babel-loader rule to patch. ` +
        'Locator attributes are disabled unless you configure babel-loader for JSX/TSX.'
      );
      return;
    }
    logger.info(`[${PLUGIN_NAME}] Locator transform enabled on ${patched} babel-loader rule(s).`);
  }

  private applyDevServerPatch(compiler: { context?: string; options: AnyObject }, logger: Logger): void {
    const devServer = compiler.options.devServer as AnyObject | undefined;
    if (!devServer) {
      logger.warn(`[${PLUGIN_NAME}] webpack-dev-server is not configured; API/runtime middleware was skipped.`);
      return;
    }

    const projectRoot = path.resolve(this.options.projectRoot ?? compiler.context ?? process.cwd());
    const apiPrefix = this.options.apiPrefix ?? '/api';
    const llm = this.options.llm;
    const runtimeDir = findRuntimeDistDir();
    const setupMiddlewares = devServer.setupMiddlewares as ((middlewares: unknown[], server: AnyObject) => unknown[]) | undefined;

    devServer.setupMiddlewares = (middlewares: unknown[], server: AnyObject): unknown[] => {
      const app = server?.app as AnyObject | undefined;
      if (app && typeof app.use === 'function') {
        if (!app[BODY_PARSER_INSTALLED_KEY]) {
          app.use(express.json({ limit: '2mb' }));
          app[BODY_PARSER_INSTALLED_KEY] = true;
        }

        registerAltpatchExpressApi(app as never, {
          projectRoot,
          apiPrefix,
          env: {},
          llm
        });

        if (runtimeDir) {
          app.use(RUNTIME_PUBLIC_BASE, createRuntimeStaticMiddleware(runtimeDir));
        } else {
          logger.warn(
            `[${PLUGIN_NAME}] Could not find ${RUNTIME_ENTRY_FILE} in package dist; runtime script endpoint was not mounted.`
          );
        }
      } else {
        logger.warn(`[${PLUGIN_NAME}] webpack-dev-server app instance not available; API/runtime middleware was skipped.`);
      }

      if (typeof setupMiddlewares === 'function') return setupMiddlewares(middlewares, server);
      return middlewares;
    };
  }

  private applyHtmlInjection(compiler: { hooks: AnyObject; webpack?: AnyObject }): void {
    const webpack = compiler.webpack as AnyObject | undefined;
    const stage = webpack?.Compilation?.PROCESS_ASSETS_STAGE_SUMMARIZE ?? 1000;
    const RawSource = webpack?.sources?.RawSource;
    const htmlWebpackPluginCtor = asArray(compiler.options.plugins as AnyObject[] | undefined)
      .map((plugin) => plugin?.constructor as AnyObject | undefined)
      .find((ctor) => typeof ctor?.getHooks === 'function');

    if (!RawSource && !htmlWebpackPluginCtor) return;

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation: AnyObject) => {
      if (htmlWebpackPluginCtor) {
        const hooks = htmlWebpackPluginCtor.getHooks(compilation);
        hooks.beforeEmit.tap(PLUGIN_NAME, (data: { html: string }) => {
          data.html = injectRuntimeScriptIntoHtml(data.html);
          return data;
        });
      }

      if (!RawSource) return;
      compilation.hooks.processAssets.tap(
        { name: PLUGIN_NAME, stage },
        () => {
          const assetNames = Object.keys(compilation.assets).filter((asset) => asset.endsWith('.html'));
          for (const name of assetNames) {
            const asset = compilation.getAsset(name);
            if (!asset) continue;
            const original = asset.source.source().toString();
            const updated = injectRuntimeScriptIntoHtml(original);
            if (updated === original) continue;
            compilation.updateAsset(name, new RawSource(updated));
          }
        }
      );
    });
  }
}

export function altpatch(options: AltPatchWebpackPluginOptions = {}): AltpatchWebpackPlugin {
  return new AltpatchWebpackPlugin(options);
}
