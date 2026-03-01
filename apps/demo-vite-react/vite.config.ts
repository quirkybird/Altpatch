import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { altpatch } from '../../packages/vite-plugin-altpatch/src/index';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');

  return {
    plugins: [
      react(),
      altpatch({
        projectRoot: __dirname,
        apiPrefix: '/api',
        locator: {
          env: 'development',
          dataAttribute: 'path'
        },
        // Consuming app passes LLM config here (recommended for plugin users).
        llm: {
          apiKey: env.ALTPATCH_LLM_API_KEY,
          baseUrl: env.ALTPATCH_LLM_BASE_URL,
          model: env.ALTPATCH_LLM_MODEL,
          timeoutMs: Number(env.ALTPATCH_LLM_TIMEOUT_MS ?? 60000),
          maxTokens: Number(env.ALTPATCH_LLM_MAX_TOKENS ?? 16384)
        }
      })
    ]
  };
});
