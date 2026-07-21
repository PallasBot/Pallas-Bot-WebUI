# Ui* 控件约定

新表单控件优先用本目录组件，而不是直接堆 `.inp` / `.sel` / 裸 switch。

| 组件 | 用途 |
| --- | --- |
| `UiInput` | 文本 / 密码（可 `revealable`）/ search |
| `UiSelect` | 原生 select 壳 |
| `UiSwitch` | 布尔开关（默认无旁侧文案） |
| `UiField` | 标签行 + `?`/`meta` 槽 + 控件 |
| `UiButton` / `UiCard` / `UiDialog` / `UiBadge` | 已有，继续用 |

**仍可用裸 class**：页头一次性筛选、高度定制布局、尚未迁移的旧页面。新代码与配置表单链路优先 `Ui*`。

样式吃全局 token（`--radius-control`、`--control-border` 等）；组件 scoped 只写结构。
