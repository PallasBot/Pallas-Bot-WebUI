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

## 构建

```bash
npm run build
```

重启 `Pallas-Bot` 后访问：`http://<host>:<port>/pallas/`

## 自动下载模式（推荐线上）

当主仓不跟踪 `data/` 时，建议使用 `dist.zip` 发布方式：

1. 在主仓 `.env` 配置：

```env
PALLAS_WEBUI_DIST_ZIP_URL=https://github.com/TogetsuDo/Pallas-Bot-WebUI/releases/latest/download/dist.zip
```

主仓启动时若发现 `data/pallas_webui/public/index.html` 不存在，会自动下载并解压。
如需强制更新到新包，删除 `data/pallas_webui/public` 后重启主仓即可触发重新下载。

## 自动发版（推送 vTag）

仓库已内置 GitHub Actions 发版流程：推送 `v*` tag 时自动构建并上传 `dist.zip` 到 Release。

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
