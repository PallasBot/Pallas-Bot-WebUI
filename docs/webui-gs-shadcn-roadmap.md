# WebUI · GS / shadcn 视觉路线

主文档（进度维护）：[Pallas-Bot/docs/architecture/webui-gs-shadcn-roadmap.md](https://github.com/PallasBot/Pallas-Bot/blob/main/docs/architecture/webui-gs-shadcn-roadmap.md)

## 本仓库实现

| 路径 | 说明 |
| --- | --- |
| `src/styles/ui.css` | shadcn 语义 token + Ui 组件样式 |
| `src/components/ui/` | `UiButton`、`UiCard`、`UiBadge`、`UiDialog` |
| `src/styles/console-hub.css` | Hub 壳层 GS 覆盖 |
| `src/utils/consolePrefsDocument.ts` | 偏好 → `html[data-*]` 映射（可单测） |

## 自检与测试

- 窄屏清单：[webui-gs-shadcn-narrow-screen-checklist.md](./webui-gs-shadcn-narrow-screen-checklist.md)
- 偏好矩阵 smoke：`npm run test:smoke`（`tests/consolePrefsDocument.test.ts`）

Agent 开工前请读主文档并更新阶段状态。
