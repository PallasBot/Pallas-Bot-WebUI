# Pallas-Bot-WebUI

面向 [**Pallas-Bot**](https://github.com/PallasBot/Pallas-Bot) 的独立 Web 控制台前端：Vue 3、TypeScript、Vite、Vue Router、Axios。构建产物由主仓插件 **`pb_webui`** 挂载，浏览器访问路径与 API 前缀均以 **`/pallas/`** 为基址。

## 与主仓的关系

| 项目 | 说明 |
| --- | --- |
| **本仓库** | 前端源码与发版产物（如 `dist.zip`） |
| **Pallas-Bot** | NoneBot2 运行时、`/pallas/api` 与静态资源托管（插件包名 `pb_webui`） |
| **典型访问** | `http://<主机>:<端口>/pallas/`（端口见主仓 `config/pallas.toml` 中 `[bootstrap] port`，默认多为 `8088`） |

文档入口：[网页控制台](https://PallasBot.github.io/Pallas-Bot-Docs/guide/web-console)、[快速开始](https://PallasBot.github.io/Pallas-Bot-Docs/guide/quickstart)、[FAQ](https://PallasBot.github.io/Pallas-Bot-Docs/deploy/faq)。插件包说明见主仓 `docs/plugins/pb_webui/`（现行包名 **`pb_webui`**，旧称 `pallas_webui`）。

## 仓库结构（简要）

```
src/
  api/           # HTTP 封装与类型（对接 /pallas/api）
  components/    # 可复用组件
  layout/        # 控制台壳层与导航
  pages/         # 各功能页面（路由一级入口）
  router/        # 路由与 meta
  styles/        # 全局样式
  utils/         # 工具函数
scripts/         # 构建辅助（如版本写入、资源压缩）
```

- **`dist/`**：`npm run build` 输出，勿手改；由主仓集成或 Release 资产分发。

## 环境要求

- **Node.js**：与当前 Vite 6 兼容的版本（建议 **20 LTS** 或更新）
- **包管理器**：npm（或自行用 pnpm / yarn，需能执行 `package.json` 中的 scripts）

## 本地开发

1. 先启动 **Pallas-Bot**，保证本机可访问其 HTTP（默认 `http://127.0.0.1:8088`）。
2. 在本仓库根目录：

```bash
npm install
npm run dev
```

Vite 默认开发端口为 **5173**，并将 **`/pallas/api`** 代理到后端（见 `vite.config.ts`）。若后端端口不是 `8088`，可设置环境变量 **`VITE_PROXY_TARGET`** 再启动，例如 PowerShell：

```powershell
$env:VITE_PROXY_TARGET = "http://127.0.0.1:9000"
npm run dev
```

浏览器打开开发地址后，从应用内导航即可；路由使用 `createWebHistory`，与生产环境同样基于 **`/pallas/`** 子路径。

## 构建与集成

```bash
npm run build
```

该命令会执行类型检查（`vue-tsc -b`）、Vite 打包，并运行 `scripts/write-console-version.mjs` 写入控制台版本元数据。

将生成的 **`dist/`** 交由主仓 `pb_webui` 使用。当前运行产物目录以 Bot 仓实际部署为准，直接同步到 **`/data/pb_webui/`**（若该目录下区分 `public/`，则同步 `dist/` 内容到对应静态子目录）。也可通过主仓 Release / 自动下载流程拉取 `dist.zip`。更新静态资源后需**重启** Pallas-Bot。

## 与后端的约定

| 项 | 值 |
| --- | --- |
| 应用 `base` / 路由前缀 | `/pallas/` |
| 控制台 API | `/pallas/api`（开发时由 Vite 代理） |
| 写操作鉴权 | 主仓可配置 `PALLAS_WEBUI_API_TOKEN` |
| 健康检查 | `GET /pallas/api/health` |

### 协议端管理（`pallas-plugin-protocol`）

协议管理 UI 已迁入本仓，不再使用独立 HTML 壳 **`/protocol/console`**。安装官方扩展 `pallas-plugin-protocol` 后，在控制台侧栏打开 **协议连接**（`/pallas/protocol`）即可；旧书签会自动 307 跳转。

| 本仓路由 | 说明 |
| --- | --- |
| `/pallas/protocol` | 协议账号列表与工作区 |
| `/pallas/protocol/create` | 新建 NapCat / SnowLuma 账号 |
| `/pallas/protocol/import` | 批量导入旧实例目录 |
| `/pallas/protocol/assets` | 运行时下载与 Docker 镜像 |
| `/pallas/protocol/settings` | 重定向至 `/pallas/preferences`（外观、轮询、口令） |

协议 **HTTP API** 仍挂在主仓配置的路径（常见 `PALLAS_PROTOCOL_WEBUI_PATH`，默认类似 `/protocol/napcat`），供上列页面调用；仅 **`/protocol/napcat/login`** 等登录入口保留在协议插件侧。若环境自定义了 `PALLAS_PROTOCOL_WEBUI_PATH`，以实例接口返回的 `webui_path` 为准。

## 发版（可选）

推送 **`v*`** 形式的 Git tag 时，本仓库的 GitHub Actions 可构建并上传 **`dist.zip`** 到 Release，供主仓或运维脚本拉取。示例：

```bash
git tag v0.4.14
git push origin v0.4.14
```

主仓侧也可在 release 流程中拉取本仓库源码并执行构建，两种方式可并存。

## 相关仓库

| 仓库 | 说明 |
| --- | --- |
| [Pallas-Bot](https://github.com/PallasBot/Pallas-Bot) | Bot 本体（挂载本仓构建产物） |
| [Pallas-Bot-AI](https://github.com/PallasBot/Pallas-Bot-AI) | AI 对话 / 唱歌 / TTS 等后端 |
| [Pallas-Bot-Docs](https://github.com/PallasBot/Pallas-Bot-Docs) | 文档站 |
| [community-plugin-index](https://github.com/PallasBot/community-plugin-index) | 社区插件商店索引 |

## 许可证

以 `package.json` 中 **`license`** 字段为准（当前为 **MIT**）。
