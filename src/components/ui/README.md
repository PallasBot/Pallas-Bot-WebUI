# Ui* 控件约定

新表单控件优先用本目录组件，而不是直接堆 `.inp` / `.sel` / 裸 switch。

| 组件 | 用途 |
| --- | --- |
| `UiInput` | 文本 / 密码（可 `revealable`）/ search |
| `UiSelect` | 原生 select 壳 |
| `UiSwitch` | 布尔开关（默认无旁侧文案；偏好页可 `show-label`） |
| `UiField` | 标签行 + `?`/`meta` 槽 + 控件（配置 `PluginConfigFieldShell`） |
| `UiButton` / `UiCard` / `UiDialog` / `UiBadge` | 已有，继续用 |

**已接入（点状）**：配置表单链路；Instances / Protocol 账号搜索；FriendsGroups / Database 列表搜索；Logs / LogErrors 筛选；Preferences / Setup / Update 口令；Charts 日期；备份目录；分页跳转；ConsoleHubSearch。

Hub 侧栏字重：普通 **500**，分组 / 选中 **600**（不再用 560–740 中间档）。

**仍可用裸 class**：高度定制布局、尚未迁移的旧页面、range 滑块等。新代码优先 `Ui*`。

样式吃全局 token（`--radius-control`、`--control-border` 等）；组件 scoped 只写结构。
