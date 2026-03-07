# @quirkybird/webpack-plugin-altpatch

AltPatch webpack plugin for element-to-source locating and AI-assisted patch workflow in webpack dev server.

## Install

```bash
pnpm add -D @quirkybird/webpack-plugin-altpatch
```

## Usage

```js
const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { altpatch } = require('@quirkybird/webpack-plugin-altpatch');

module.exports = {
  mode: 'development',
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.js'
  },
  devServer: {
    hot: true
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './public/index.html' }),
    altpatch({
      projectRoot: process.cwd(),
      apiPrefix: '/api'
    })
  ]
};
```

## Options

- `projectRoot?: string`
- `apiPrefix?: string` (default: `/api`)
- `enableInDevOnly?: boolean`
- `locator?: { enabled?: boolean; env?: string; dataAttribute?: string }`
- `llm?: { apiKey?: string; baseUrl?: string; model?: string; timeoutMs?: number; maxTokens?: number }`

## Notes

- 需要配合 `webpack-dev-server` 使用，插件会自动注册 API 路由与 runtime 资源。
- Locator 插桩通过自动补丁 `babel-loader` 的 `plugins` 实现；若项目未使用 `babel-loader`，会跳过并打印提示。
