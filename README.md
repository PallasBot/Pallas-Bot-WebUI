# Pallas-Bot-WebUI

`Pallas-Bot-WebUI` 是 `Pallas-Bot` 的独立前端工程，技术栈为 Vue 3 + TypeScript + Vite + Element Plus。
构建产物由主仓插件 `src/plugins/pallas_webui` 托管，默认挂载路径为 `/pallas/`，接口前缀为 `/pallas/api`。

## 与 Pallas-Bot 主仓关系

- WebUI 仓库：`Pallas-Bot-WebUI`（当前仓库）
- 主程序仓库：`Pallas-Bot`（后端/API/插件运行入口）
- 运行时访问链路：`Pallas-Bot` 提供 `/pallas/api`，并挂载本仓构建出的 `dist`
- 发布链路：主仓 `release` 流程会拉取本仓源码构建 `dist`，并打包为 `pallas-webui-dist.zip` 附在主仓 Release

建议把两个仓库一起看：

- Pallas-Bot（主仓）：<https://github.com/PallasBot/Pallas-Bot>
- Pallas-Bot-WebUI（前端）：<https://github.com/PallasBot/Pallas-Bot-WebUI>

## 目录职责

- `src/views/`：页面视图（仪表盘、实例、好友与群、数据库管理、AI拓展等）
- `src/api/`：前端 API 封装与类型定义
- `src/layout/`：控制台整体布局与导航
- `dist/`：构建输出（不手改）

## 启动说明

1. 先启动 `Pallas-Bot` 主程序（默认 `http://127.0.0.1:8088`）。
2. 打开 WebUI：
   - 生产/集成模式：直接访问 `http://<host>:<port>/pallas/`
   - 本仓开发模式：在本目录执行 `npm install && npm run dev`，通过 Vite 代理访问后端
3. 打开 Protocol 管理页：`http://<host>:<port>/protocol/napcat`（若配置了 `PALLAS_PROTOCOL_WEBUI_PATH`，以该值为准）。

本地开发（PowerShell 示例，后端端口非默认时）：

```powershell
$env:VITE_PROXY_TARGET="http://127.0.0.1:9000"
npm install
npm run dev
```

## 构建

```bash
npm run build
```

重启 `Pallas-Bot` 后访问：`http://<host>:<port>/pallas/`

## 自动下载模式（推荐线上）

当主仓不跟踪 `data/` 时，建议使用 release 资产自动拉取方式：

1. 在主仓 `.env` 配置：

```env
# 方式1：直接给完整地址
PALLAS_WEBUI_DIST_ZIP_URL=

# 方式2（推荐）：让主仓自动按 repo/tag/asset 解析
PALLAS_WEBUI_DIST_ZIP_REPO=PallasBot/Pallas-Bot-WebUI
PALLAS_WEBUI_DIST_ZIP_TAG=
PALLAS_WEBUI_DIST_ZIP_ASSET=dist.zip
```

主仓启动时若发现 `data/pallas_webui/public/index.html` 不存在，会自动下载并解压。
如需强制更新到新包，删除 `data/pallas_webui/public` 后重启主仓即可触发重新下载。

## 自动发版（推送 vTag）

仓库已内置 GitHub Actions 发版流程：推送 `v*` tag 时自动构建并上传 `dist.zip` 到 Release。
主仓 release 也可直接构建并打包本仓 `dist`，两种方式可并存。

操作示例：

```bash
git tag v0.1.1
git push origin v0.1.1
```

发布完成后，主仓若使用 `releases/latest/download/dist.zip`，即可在下次拉取时自动获取新版本。

## 对接约定

- 路由基址：`/pallas/`
- API 前缀：`/pallas/api`
- 写操作鉴权：主仓可通过 `PALLAS_WEBUI_API_TOKEN` 开启
- AI 扩展配置持久化：主仓 `data/pallas_webui/ai_extension.json`
- 健康检查版本来源：`/pallas/api/health`（`nonebot2` / `pallas_bot` / `console` 元信息）
