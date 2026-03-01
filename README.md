# AltPatch

AltPatch 是一款面向前端研发流程的智能改动工具：通过 `Alt + Click` 直接定位页面元素对应源码，并生成可执行 patch，缩短从需求到代码落地的路径。

当前阶段以 **Vite 插件** 为核心形态；后续将扩展为 **浏览器插件**，覆盖更广的在线页面调试与协作场景。

## 项目定位

- 当前主线：`Vite 插件 + 本地运行时面板 + OpenAI Compatible LLM`。
- 核心目标：把“定位元素 -> 生成改动 -> 应用文件 -> 回滚历史”串成一个连续工作流。
- 未来方向：在保留本地工程上下文能力的基础上，扩展浏览器插件形态，支持跨站点、跨环境的交互式改动建议。

## 核心能力

- `Alt + Click` 页面元素后自动解析源码位置（文件/行/列）。
- 内置运行时面板（Shadow DOM 挂载），支持 `Quick Text` 与 `AI Assist` 两种改动模式。
- 基于 OpenAI Compatible 接口生成结构化 patch，并支持流式输出。
- 支持单文件和多文件改动（自动或指定目标文件）。
- 支持应用、撤销、历史恢复、跳转 VS Code。
- 提供独立 API 路由，支持嵌入 Vite Dev Server 或独立 Express 服务。

## 仓库结构

```text
altpatch/
├─ apps/
│  ├─ demo-vite-react/      # 演示应用（Vite + React）
│  └─ server/               # 可选独立服务端（Express + WS）
├─ packages/
│  ├─ vite-plugin-altpatch/ # Vite 插件入口（主产品形态）
│  ├─ altpatch-ui-runtime/  # 运行时面板与交互逻辑
│  ├─ altpatch-api/         # API 路由注册与请求处理
│  └─ server-core/          # LLM、diff、文件安全访问等核心能力
└─ turbo.json               # Turborepo 任务编排
```

## 环境要求

- Node.js 18+
- pnpm 10+

## 快速开始（Monorepo）

```bash
pnpm install
pnpm --filter @apps/demo-vite-react dev
```

启动后访问 Vite 开发地址，在页面中按 `Alt + Click` 即可打开 AltPatch 面板并定位元素。

## 在 Vite 项目中接入

当前仓库内示例（`apps/demo-vite-react/vite.config.ts`）使用方式如下：

```ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { altpatch } from '@quirkybird/vite-plugin-altpatch'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      altpatch({
        projectRoot: process.cwd(),
        apiPrefix: '/api',
        locator: {
          env: 'development',
          dataAttribute: 'path'
        },
        llm: {
          apiKey: env.ALTPATCH_LLM_API_KEY,
          baseUrl: env.ALTPATCH_LLM_BASE_URL,
          model: env.ALTPATCH_LLM_MODEL,
          timeoutMs: Number(env.ALTPATCH_LLM_TIMEOUT_MS ?? 60000),
          maxTokens: Number(env.ALTPATCH_LLM_MAX_TOKENS ?? 16384)
        }
      })
    ]
  }
})
```

### 插件配置项

`altpatch(options)` 支持以下参数：

- `projectRoot?: string`：项目根目录，用于文件安全读写范围。
- `apiPrefix?: string`：API 前缀，默认 `/api`。
- `enableInDevOnly?: boolean`：默认仅在 `serve` 生效；设为 `false` 可在 build 场景也启用。
- `locator?: { enabled?: boolean; env?: string; dataAttribute?: string }`
- `llm?: { apiKey?: string; baseUrl?: string; model?: string; timeoutMs?: number; maxTokens?: number }`

说明：`mockModify` 目前在类型中保留，但未在主流程启用。

## LLM 配置

AltPatch 使用 OpenAI Compatible 协议，核心环境变量如下：

- `ALTPATCH_LLM_API_KEY`（必填）
- `ALTPATCH_LLM_BASE_URL`（默认 `https://api.openai.com/v1`）
- `ALTPATCH_LLM_MODEL`（默认 `gpt-4o-mini`）
- `ALTPATCH_LLM_TIMEOUT_MS`（默认 `30000`）
- `ALTPATCH_LLM_MAX_TOKENS`（可选）

建议在本地使用 `.env.local`，并确保该文件不会被提交到公开仓库。

## 可选：独立服务端模式

除 Vite 插件内置 API 外，也可以单独启动服务端：

```bash
pnpm --filter @apps/server dev
```

默认地址：

- `http://127.0.0.1:7331/health`
- `ws://127.0.0.1:7331/ws`

可用环境变量：

- `ALTPATCH_PORT`：服务端口（默认 `7331`）
- `ALTPATCH_ROOT`：项目根目录（默认 `INIT_CWD` 或 `process.cwd()`）

## API 概览

以下路由由 `@packages/altpatch-api` 提供，前缀默认 `/api`：

- `GET /health`
- `GET /api/llm-config`
- `POST /api/read-file`
- `POST /api/modify`
- `POST /api/modify-stream`（SSE）
- `POST /api/modify-multi`
- `POST /api/diff`
- `POST /api/write-file`
- `POST /api/write-files`
- `POST /api/open-in-editor`

## 常用开发命令

### 根目录

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm clean
```

### 子项目

```bash
pnpm --filter @apps/demo-vite-react dev
pnpm --filter @apps/server dev
pnpm --filter @quirkybird/vite-plugin-altpatch typecheck
```

## 当前边界

- 目前主流程围绕 Vite 开发态设计，定位与交互能力在本地开发体验最完整。
- 代码插桩目标主要是 `jsx/tsx` 文件。
- LLM 改动质量依赖提示词质量、上下文范围与模型能力。

## 路线图（Roadmap）

### Phase 1（进行中）

- Vite 插件产品化
- 运行时面板交互和多文件 patch 体验完善
- API 稳定性与错误可观测性增强

### Phase 2（规划中）

- 浏览器插件形态（Browser Extension）
- 面向线上页面的元素定位与上下文桥接
- 与本地工程、CI、代码托管平台的联动能力

## 常见问题

### 1) 按 `Alt + Click` 没有反应

- 确认在开发服务器（`vite dev`）中运行。
- 确认 `altpatch()` 已加入 `vite.config.ts`。
- 确认 `locator.enabled` 未被关闭。

### 2) 生成 patch 报配置错误

- 检查 `ALTPATCH_LLM_API_KEY` 是否存在。
- 检查 `ALTPATCH_LLM_BASE_URL` 是否为有效 URL。
- 检查模型名是否可用、超时和 token 配置是否合理。

### 3) 文件写入失败

- 确认 `projectRoot` 指向正确工程根目录。
- 确认目标文件位于允许读写范围内。

## 贡献

欢迎提交 Issue / PR，建议附上：

- 复现步骤
- 期望行为与实际行为
- 关键日志（脱敏后）
- 运行环境（Node、pnpm、系统）

## License

待补充。
