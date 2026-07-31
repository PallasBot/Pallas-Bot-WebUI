# AGENTS.md

本文件用于指导人类贡献者与自动化 Agent 在 **Pallas-Bot-WebUI** 仓库内一致地工作。

## 项目概览

- **项目名**：Pallas-Bot-WebUI
- **技术栈**：React 18、TypeScript、Vite、react-router-dom、TanStack Query、shadcn/ui（Radix + Tailwind）
- **主要代码目录**：`src/`（页面 `src/pages/`、样式 `src/styles/`）
- **与主仓关系**：构建产物由 [Pallas-Bot](https://github.com/PallasBot/Pallas-Bot) 的 `pb_webui` 插件挂载，基址 **`/pallas/`**；默认静态目录 `data/pb_webui/public-react/`
- **历史 Vue**：分支 `archive/vue`，勿再往 `main` 合入 Vue 栈

## 本地开发

```bash
npm install
npm run dev    # 默认 5173，/pallas/api 代理到后端
npm run build  # tsc -b + vite build
```

后端端口非 8088 时：`VITE_PROXY_TARGET=http://127.0.0.1:<port> npm run dev`

控制台 OpenAPI 类型（同级需有 [Pallas-Bot](https://github.com/PallasBot/Pallas-Bot)）：

```bash
npm run sync:console-openapi-types   # 从 ../Pallas-Bot/openspec 生成
# 或安装 pre-commit 后：pre-commit install
```

路径可用 `PALLAS_BOT_ROOT`。Bot 侧改 API 后优先在主仓跑 `uv run python tools/sync_console_openapi.py`。

## Agent 工作约定

### 修改范围

- **优先修改 `src/`**，避免无意义的全仓格式化或无关文件改动。
- **最小必要改动**：只改完成任务所需的页面、组件与样式。
- **不提交密钥**：`.env`、token、私钥等勿入库。

### 代码风格

- 与周边 React/TS 文件保持一致：命名、导入顺序、组件结构。
- 样式优先复用 `src/styles/console/` 与既有 utility class；页面特有样式放对应 css 或带页面根类名前缀。
- 新增控件优先 shadcn（`src/components/ui/`）；注释保持精简。
- 新增函数非必要不要以下划线 `_` 开头。
- 录入已知结构值时，优先使用带预设选项的 `Combobox`，而非自由文本 `Input`；后端允许扩展值时保留自定义输入，并提供规范值搜索与说明。
- 结构化策略配置应提供符合用途的表单；原始配置仅放在原始 TOML 模式。
- **面向用户的用语**：插件 / 群触发称「命令」（勿写「口令」）；控制台登录称「密钥」；社区统计 / 共享语料访问凭证可保留「口令」。与主仓 `AGENTS.md` 一致。

### 窄屏体验（必做）

控制台大量在移动端或窄窗口使用。**新增或改动面板标题栏、表格、批量操作、侧栏按钮时，必须考虑窄屏布局**，不可只做桌面宽屏。

**自检断点**：`@media (max-width: 560px)`（见 `src/styles/console/app.css` 等）。提交前用 DevTools 响应式模式或真机预览 **≤560px** 宽度。

**常见要点**：

| 场景 | 做法 |
| --- | --- |
| 面板标题 +「添加到侧栏」 | 宽屏标题与操作同排；窄屏标题与 `+` 同一行，批量/危险按钮次行，避免 `+` 单独浮在删除上方。 |
| 实例/协议类双行标题 | 沿用既有 `inst-db-panel__*` / PageChrome 布局约定。 |
| 表格 | 列多或含长路径时窄屏优先卡片列表，避免表头与可见列错位。 |

### 提交与 PR

- 推荐提交说明：`feat(scope): 中文说明` / `fix(scope): …`
- **自动化 Agent 创建 git commit 前**：先给出提交信息草案，**得到确认后再提交**。
- 不要擅自 `git push` 或做破坏性 Git 操作，除非维护者明确要求。
- 需要 **minor/major** 发版时，给 PR 打上 `bump:minor` / `bump:major` 标签（默认 patch）。
