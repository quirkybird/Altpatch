# @quirkybird/vite-plugin-altpatch

AltPatch Vite plugin for element-to-source locating and AI-assisted patch workflow in Vite dev server.

## Install

```bash
pnpm add -D @quirkybird/vite-plugin-altpatch
```

## Usage

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { altpatch } from '@quirkybird/vite-plugin-altpatch';

export default defineConfig({
  plugins: [
    react(),
    altpatch({
      projectRoot: process.cwd(),
      apiPrefix: '/api'
    })
  ]
});
```

## Options

- `projectRoot?: string`
- `apiPrefix?: string` (default: `/api`)
- `enableInDevOnly?: boolean`
- `locator?: { enabled?: boolean; env?: string; dataAttribute?: string }`
- `llm?: { apiKey?: string; baseUrl?: string; model?: string; timeoutMs?: number; maxTokens?: number }`
