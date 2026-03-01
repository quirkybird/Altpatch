import { Router, type Express } from 'express';
import type { ViteDevServer } from 'vite';
import type { WebSocketServer } from 'ws';
export type AltpatchApiOptions = {
    projectRoot: string;
    apiPrefix?: string;
    env?: NodeJS.ProcessEnv;
    llm?: {
        apiKey?: string;
        baseUrl?: string;
        model?: string;
        timeoutMs?: number;
        maxTokens?: number;
    };
    onFileWritten?: (filePath: string) => void;
    onReloadHint?: (filePath: string) => void;
};
export type AltpatchExpressOptions = AltpatchApiOptions & {
    wss?: WebSocketServer;
};
export declare function registerAltpatchViteApi(server: ViteDevServer, options: AltpatchApiOptions): void;
export declare function createAltpatchExpressRouter(options: AltpatchExpressOptions): Router;
export declare function registerAltpatchExpressApi(app: Express, options: AltpatchExpressOptions): void;
//# sourceMappingURL=index.d.ts.map