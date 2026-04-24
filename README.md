# Pallas-Bot-WebUI

`Pallas-Bot-WebUI` 是 `Pallas-Bot` 的独立前端工程，技术栈为 Vue 3 + TypeScript + Vite + Element Plus。
构建产物由主仓插件 `src/plugins/pallas_webui` 托管，默认挂载路径为 `/pallas/`，接口前缀为 `/pallas/api`。

## 目录职责

- `src/views/`：页面视图（仪表盘、实例、好友与群、数据库管理、AI拓展等）
- `src/api/`：前端 API 封装与类型定义
- `src/layout/`：控制台整体布局与导航
- `dist/`：构建输出（不手改）

## 本地开发

1. 启动 `Pallas-Bot` 主程序（默认 `http://127.0.0.1:8088`）。
2. 在本目录安装依赖并启动前端：

```bash
npm install
npm run dev
```

3. 如主程序端口不同，先设置代理目标（PowerShell）：

```powershell
$env:VITE_PROXY_TARGET="http://127.0.0.1:9000"
npm run dev
```

## 构建与发布

```bash
npm run build
```

将 `dist/` 的全部内容同步到主仓：

`Pallas-Bot/data/pallas_webui/public`

重启 `Pallas-Bot` 后访问：

`http://<host>:<port>/pallas/`

## 自动挂钩主仓（推荐）

目标：WebUI 每次构建后自动同步到主仓 `data/pallas_webui/public`。

可选做法：

1. 在本仓新增脚本（如 `scripts/sync-to-main.ps1`），将 `dist/*` 复制到主仓目标目录。
2. 在 `package.json` 增加 `postbuild`，执行该同步脚本。
3. 保持主仓 `pallas_webui_http_base` 与前端 `vite base` 一致（默认都为 `/pallas/`）。

示例（PowerShell）：

```powershell
robocopy ".\dist" "..\Pallas-Bot\data\pallas_webui\public" /MIR
```

## 对接约定

- 路由基址：`/pallas/`
- API 前缀：`/pallas/api`
- 写操作鉴权：主仓可通过 `PALLAS_WEBUI_API_TOKEN` 开启
- AI 扩展配置持久化：主仓 `data/pallas_webui/ai_extension.json`
