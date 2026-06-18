# AGENTS.md

本文件用于指导人类贡献者与自动化 Agent 在 **Pallas-Bot-WebUI** 仓库内一致地工作。

## 项目概览

- **项目名**：Pallas-Bot-WebUI
- **技术栈**：Vue 3、TypeScript、Vite、Vue Router、Axios
- **主要代码目录**：`src/`（页面 `src/pages/`、全局样式 `src/styles/app.css`）
- **与主仓关系**：构建产物由 [Pallas-Bot](https://github.com/PallasBot/Pallas-Bot) 的 `pallas_webui` 插件挂载，基址 **`/pallas/`**

## 本地开发

```bash
npm install
npm run dev    # 默认 5173，/pallas/api 代理到后端
npm run build  # vue-tsc + vite build
```

后端端口非 8088 时：`VITE_PROXY_TARGET=http://127.0.0.1:<port> npm run dev`

## Agent 工作约定

### 修改范围

- **优先修改 `src/`**，避免无意义的全仓格式化或无关文件改动。
- **最小必要改动**：只改完成任务所需的页面、组件与样式。
- **不提交密钥**：`.env`、token、私钥等勿入库。

### 代码风格

- 与周边 Vue/TS 文件保持一致：命名、导入顺序、模板结构。
- 样式优先复用 `app.css` 已有类（`panel`、`panel__hd--split`、`row-actions`、`inst-db-panel__hd` 等），页面特有样式放 scoped 或 `app.css` 中带页面根类名前缀。
- 新增函数非必要不要以下划线 `_` 开头；注释保持精简。

### 窄屏体验（必做）

控制台大量在移动端或窄窗口使用。**新增或改动面板标题栏、表格、批量操作、侧栏按钮时，必须考虑窄屏布局**，不可只做桌面宽屏。

**自检断点**：`@media (max-width: 560px)`（见 `src/styles/app.css`）。提交前用 DevTools 响应式模式或真机预览 **≤560px** 宽度。

**常见要点**：

| 场景 | 做法 |
| --- | --- |
| 面板标题 +「添加到侧栏」 | 宽屏：`panel__hd--split` + `row-actions`，`PanelSidebarAdd` 与操作按钮同排。窄屏：标题与 `+` **同一行右上**（`friends-groups-hd-pin-wrap` + grid），批量/危险按钮 **次行** 或均分一行，避免 `+` 单独浮在删除按钮上方。 |
| 实例/协议类双行标题 | 使用 `inst-db-panel__hd` + `inst-db-panel__hd-side` + `inst-db-panel__actions`；窄屏规则见 `app.css` 内 `inst-db-panel__hd` grid。 |
| 标题栏内多个按钮 | 勿让全局窄屏规则 `.panel__hd .row-actions > .btn { width: 100% }` 误伤；参考 `friends-groups-req-hd-bulk-btns`、`database-backups-page` 等已有 override。 |
| 表格 | 使用 `table-wrap` 横向滚动；长路径列允许 `word-break`。列多（≥5）或含长路径/堆栈时，窄屏优先 **卡片列表** 替代横向表格（参考 `DatabaseBackupsPage.vue`），避免表头与可见列错位、行高被隐藏列撑爆。 |
| 首页等特殊面板 | 需保持横排时使用 `home-page__panel-hd-nowrap` 等既有类，勿随意改全局 `panel__hd` 规则。 |

**参考页面**：`FriendsGroupsPage.vue`（好友/入群申请标题栏）、`DatabaseBackupsPage.vue`（备份清理）、`InstancesPage.vue` / `ProtocolManagePage.vue`（实例双行标题）。

**GS 路线窄屏清单**（P6）：[`docs/webui-gs-shadcn-narrow-screen-checklist.md`](docs/webui-gs-shadcn-narrow-screen-checklist.md)

### 提交与 PR

- 推荐提交说明：`feat(scope): 中文说明` / `fix(scope): …`
- **自动化 Agent 创建 git commit 前**：先给出提交信息草案，**得到确认后再提交**。
- 不要擅自 `git push` 或做破坏性 Git 操作，除非维护者明确要求。
