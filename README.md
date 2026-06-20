# Pallas-Bot-WebUI

面向 [**Pallas-Bot**](https://github.com/PallasBot/Pallas-Bot) 的独立 Web 控制台前端：Vue 3、TypeScript、Vite、Vue Router、Axios。构建产物由主仓插件 `pallas_webui` 挂载，浏览器访问路径与 API 前缀均以 **`/pallas/`** 为基址。

## 与主仓的关系

| 项目 | 说明 |
| --- | --- |
| **本仓库** | 前端源码与发版产物（如 `dist.zip`） |
| **Pallas-Bot** | NoneBot2 运行时、`/pallas/api` 与静态资源托管 |
| **典型访问** | `http://<主机>:<端口>/pallas/`（端口见主仓 `config/pallas.toml` 中 `[bootstrap] port`，默认多为 `8088`） |

主仓文档入口：[控制台插件说明](https://github.com/PallasBot/Pallas-Bot/blob/main/docs/plugins/pallas_webui/README.md)、[部署](https://github.com/PallasBot/Pallas-Bot/blob/main/docs/Deployment.md)、[FAQ](https://github.com/PallasBot/Pallas-Bot/blob/main/docs/FAQ.md)。

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

协议进程自带页（非本仓路由）常见为 **`/protocol/console`**；若主仓配置了 `PALLAS_PROTOCOL_WEBUI_PATH`，以实际环境为准。

## 发版（可选）

推送 **`v*`** 形式的 Git tag 时，本仓库的 GitHub Actions 可构建并上传 **`dist.zip`** 到 Release，供主仓或运维脚本拉取。示例：

```bash
git tag v0.4.14
git push origin v0.4.14
```

主仓侧也可在 release 流程中拉取本仓库源码并执行构建，两种方式可并存。

## 许可证

以 `package.json` 中 **`license`** 字段为准（当前为 **MIT**）。
