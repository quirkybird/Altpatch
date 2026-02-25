import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import locatorBabelJsx from '@locator/babel-jsx';
import { altpatch } from '../../packages/vite-plugin-altpatch/src/index';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [[locatorBabelJsx, { env: 'development', dataAttribute: 'path' }]]
      }
    }),
    altpatch({
      projectRoot: __dirname,
      apiPrefix: '/api',
      mockModify: true
    })
  ]
});
