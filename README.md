# Pallas-Bot-WebUI

面向 [**Pallas-Bot**](https://github.com/PallasBot/Pallas-Bot) 的独立 Web 控制台前端：React 18、TypeScript、Vite、react-router-dom、TanStack Query。构建产物由主仓插件 **`pb_webui`** 挂载，浏览器访问路径与 API 前缀均以 **`/pallas/`** 为基址。

历史 Vue 实现见分支 [`archive/vue`](https://github.com/PallasBot/Pallas-Bot-WebUI/tree/archive/vue)。

## 与主仓的关系

| 项目 | 说明 |
| --- | --- |
| **本仓库** | 前端源码与发版产物（如 `dist.zip`） |
| **Pallas-Bot** | NoneBot2 运行时、`/pallas/api` 与静态资源托管（插件包名 `pb_webui`） |
| **典型访问** | `http://<主机>:<端口>/pallas/`（端口见主仓 `config/pallas.toml` 中 `[bootstrap] port`，默认多为 `8088`） |
| **运行产物目录** | 默认 `data/pb_webui/public-react/`（`pallas_webui_frontend=react`） |

文档入口：[网页控制台](https://PallasBot.github.io/Pallas-Bot-Docs/guide/web-console)、[快速开始](https://PallasBot.github.io/Pallas-Bot-Docs/guide/quickstart)、[FAQ](https://PallasBot.github.io/Pallas-Bot-Docs/deploy/faq)。

## 仓库结构（简要）

```
src/
  api/           # HTTP 封装与 OpenAPI 生成类型
  components/    # 可复用组件（含 ui/ shadcn）
  layout/        # 控制台壳层
  pages/         # 功能页面
  styles/        # 全局与控制台样式
  config/        # 导航与配置段元数据
scripts/         # OpenAPI 同步、版本写入等
docs/            # 控件约定等
```

## 环境要求

- **Node.js**：建议 **20 LTS** 或更新
- **包管理器**：npm

## 本地开发

1. 先启动 **Pallas-Bot**，保证本机可访问其 HTTP（默认 `http://127.0.0.1:8088`）。
2. 在本仓库根目录：

```bash
npm install
npm run dev
```

Vite 默认开发端口为 **5173**，并将 **`/pallas/api`** 代理到后端（见 `vite.config.ts`）。后端端口非 `8088` 时：

```bash
VITE_PROXY_TARGET=http://127.0.0.1:<port> npm run dev
```

控制台 OpenAPI 类型（同级需有 [Pallas-Bot](https://github.com/PallasBot/Pallas-Bot)）：

```bash
npm run sync:console-openapi-types
```

路径可用 `PALLAS_BOT_ROOT`。Bot 侧改 API 后优先在主仓跑 `uv run python tools/sync_console_openapi.py`。

## 构建与集成

```bash
npm run build
```

类型检查（`tsc -b`）+ Vite 打包，并写入 `dist/console-version.json`。

将 **`dist/`** 同步到主仓 **`data/pb_webui/public-react/`**，或通过 Release 的 `dist.zip`（zip 根为 `public-react/`）解压到 `data/pb_webui/`。更新静态资源后需**重启** Pallas-Bot。

## 与后端的约定

| 项 | 值 |
| --- | --- |
| 应用 `base` / 路由前缀 | `/pallas/` |
| 控制台 API | `/pallas/api`（开发时由 Vite 代理） |
| 写操作鉴权 | 主仓可配置 `PALLAS_WEBUI_API_TOKEN` |
| 健康检查 | `GET /pallas/api/health` |

控件约定见 [docs/ui-conventions.md](./docs/ui-conventions.md)。

## 发版

推送 **`v*`** tag，或合并进 `main` 的 PR（默认 patch；标签 `bump:minor` / `bump:major` 可改递增）时，Actions 构建并上传 **`dist.zip`**。

## 相关仓库

| 仓库 | 说明 |
| --- | --- |
| [Pallas-Bot](https://github.com/PallasBot/Pallas-Bot) | Bot 本体（挂载本仓构建产物） |
| [Pallas-Bot-AI](https://github.com/PallasBot/Pallas-Bot-AI) | 媒体后端（唱歌 / TTS 等） |
| [Pallas-Bot-Docs](https://github.com/PallasBot/Pallas-Bot-Docs) | 文档站 |

## 许可证

以 `package.json` 中 **`license`** 字段为准（当前为 **MIT**）。
