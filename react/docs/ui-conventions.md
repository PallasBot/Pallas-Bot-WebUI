# React UI 约定（P0）

> 视觉契约：非 AI 页继续贴合 Vue hub token；**`/ai/*` 维持当前 React 观感，Vue 对等另排期。**

## 控件真相

| 用途 | 用 | 不要用 |
| --- | --- | --- |
| 按钮 | `@/components/ui/button` → `Button` | 新增 `UiButton` 调用（兼容层仅存量） |
| 输入 | `@/components/ui/input` → `Input` | 新代码堆 `.inp` / 新 UiInput |
| 下拉 | Radix `Select` 或 `nativeSelectClassName` | 新造 UiSelect API |
| 开关 | `Switch` | 自写 checkbox 冒充 |
| 字段标签 | `Label` + 布局；存量 `UiField` 可暂留 | 新写 `ui-field` 专用 CSS |

`Ui*`（`UiButton` / `UiInput` / `UiSelect` / `UiBadge` / `UiField`）已标 `@deprecated`，内部转发到 shadcn。**禁止新增 Ui* 文件或扩大其 API。**

## 密度

- 圆角：`rounded-[var(--radius-control)]`（prefs 滑块写入）
- 高度：默认控件 `h-9` / `min-h-[var(--ui-ctrl-height)]`
- Badge：去胶囊，用 control 圆角

## 页面骨架（P1）

| 组件 | 用途 |
| --- | --- |
| `PageChrome` | Hub masthead（title / lead / actions） |
| `PageFill` | 满高根（日志类） |
| `PagePinned` | Fill 内钉顶 chrome |
| `PageHeader` | deprecated 别名 → `PageChrome` |

表面契约仍是 Canvas / Card / Flat。`/ai/*` 视觉另排期，不必强改骨架。

## 侧栏钉住

不做。侧栏仅固定 `MAIN_NAV_ITEMS`；不引入 `PanelSidebarAdd` / `sidebarNavOrder` pin。

## 样式（P3）与业务 TS（P4）

控制台外观 CSS 在 `src/styles/console/`（自有 fork）。  
API / utils / 相关 config 在 `src/` 自有，**禁止**再 alias 到上级 Vue `src/`。  
视觉精细复刻原 Vue 观感：等完全切 React 生产栈后再排期。

## Toast

暂用 `ConsoleToastHost`；sonner 后置。
