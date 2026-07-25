# `styles/console/` — React 自有控制台样式

自 Vue `src/styles/{app,console-hub,ai-hub,ai-history}.css` **ownership 迁入**（P3），
构建不再依赖上级 Vue 样式。

| 文件 | 职责 |
| --- | --- |
| `tokens.css` | 色板 / 半径 / glass / layout / accent / 明暗主题变量 |
| `app.css` | shell、面板、表单、各业务页表面（体量大，后续按页裁剪） |
| `console-hub.css` | hub 布局、PageFill/Pinned、masthead |
| `ai-hub.css` / `ai-history.css` | AI 区样式（视觉微调另排期） |

**约定**：改视觉只动本目录；Vue 仓同名文件不再是 React 构建依赖。
完全切栈后再做「复刻原有视觉」的精细对齐。
