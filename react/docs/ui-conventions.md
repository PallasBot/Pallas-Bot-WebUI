# React UI 约定

> 控件内核为 React + shadcn；色板保持 Pallas（天蓝 accent），手法参考 gsuid。  
> **方向：逐步抛弃 hub 页级壳（`PageChrome` / `.console-hub-page__*` / `.panel` 等），新功能与重构优先 shadcn + Tailwind。**

## 迁移：hub → shadcn

| 阶段 | 做法 |
| --- | --- |
| **现在（AI 区）** | `/ai/*` 为试点：页头 `PageMasthead`，工具条/正文用 shadcn（`Card` / `Button` / `Input` / `Select`…），**不要**再引入 hub 页级 class |
| **观感对齐** | 可对齐控制台密度与白底工具条「样子」（圆角、阴影、单行 chrome），但用 **Tailwind / shadcn 组件实现**，禁止把 AI 页绑死到 `.console-hub-page__chrome-tools` |
| **非 AI 存量** | 暂留 `PageChrome` / `.panel`；页头迁 `PageMasthead`；工具条统一 `ChromeTools` + `ChromeField`（`AiPageHeader` / `ConsoleChromeTools` / `ConsoleChromeField` 为兼容别名） |
| **禁止** | 新页或大重构再新增 hub 专用 CSS 文件、扩大 `Ui*`、新写 `.btn` / `.inp` 调用 |

共享工具条：`components/ChromeTools.tsx` + `ChromeField.tsx`（可选 Lucide 图标、`ChromeOptionLabel`）；样式走 token + Tailwind。页标题 → 下一块间距统一为 `--console-page-masthead-gap`（默认 18px，与 `--hub-page-gap` 同步）；工具条 → 面板为 `--console-chrome-tools-gap`（默认 10px）。父级已有 `gap` / `space-y` 时页头与工具条不再叠底边距。

## 控件真相

| 用途 | 用 | 不要用 |
| --- | --- | --- |
| 按钮 | `@/components/ui/button` → `Button` | 新增 `UiButton` 调用（兼容层仅存量） |
| 输入 | `@/components/ui/input` → `Input` | 新代码堆 `.inp` / 新 UiInput |
| 下拉 | Radix `Select`（弹层随 `data-surface` 玻璃/纯色） | 原生 `<select>` / 新 `UiSelect`（系统菜单无法玻璃化） |
| 开关 | `Switch` | 自写 checkbox 冒充 |
| 字段标签 | `Label` + 布局；存量 `UiField` 可暂留 | 新写 `ui-field` 专用 CSS |

`Ui*` 已标 `@deprecated`，内部转发到 shadcn。**禁止新增 Ui* 文件或扩大其 API。**

### 按钮层级（gsuid 手法 × hub 主色）

| variant | 用途 |
| --- | --- |
| `default` | 主 CTA（hub `--accent` 渐变，与 `.btn--primary` 同系） |
| `secondary` | 弱底次要操作 |
| `outline` | 描边 |
| `ghost` | 低强调 |
| `destructive` | 危险 |

遗留 `.btn` / `.btn--primary` 与 `Button` 同高、主色同系；新代码优先 `Button`。

### 下拉 / Dialog 弹层（gsuid 手法）

- 组件：`Select` / `Popover` / `DropdownMenu` Content → `ui-surface-popover`；`Dialog` / `AlertDialog` → `ui-surface-dialog`（居中实心底，对齐 gsuid EditConfig）
- **标题 / 副标题一律左对齐**（`DialogHeader` / `AlertDialogHeader` / Title / Description 默认 `text-left`；勿用居中标题）
- **配置类弹窗**用 shadcn `Dialog`，勿再用 `ConsoleModal` / 右侧 `Sheet`
- 存量 `ConsoleModal` 仅兼容未迁移弹窗；新配置类弹窗一律 shadcn `Dialog`
- 菜单偏 gsuid：**近实心底** + 轻阴影；glass 模式只轻 blur（高不透明），避免半透 + 强阴影叠出脏边
- `SelectItem`：悬停用弱灰底，勾选色走 `--accent`（勿用重 accent 铺底）
- **配置弹窗一律实心底**（`--bg-card`），不随「毛玻璃」半透
- `data-surface="glass"` 主要影响页面卡片与壳层；原生 `<select>` 无法玻璃化，新表单用 Radix `Select`

### 输入框描边（gsuid 手法）

- 默认边：Select / Input / 搜索走 `--control-edge`（浅色约 `rgba(15,23,42,0.13)`）+ `--control-shadow`；日期选择保持 Button outline，不跟这套
- 卡片/壳层阴影：`--shadow-intensity`（偏好「阴影强度」），与控件描边无关
- 聚焦：轻边色（accent ≈16%）+ `0 0 0 2px` 淡 soft（accent ≈8%）；**不要** `ring-1`/`ring-2` + `ring-offset` 叠出厚色圈
- 搜索条已有同款覆写；新 `Input` / `Textarea` / `SelectTrigger` 跟同一套

### 按钮（gsuid 手法）

- 圆角用 `--radius-control`，**不要** `999px` 胶囊次要按钮
- 次要：轻边（foreground ≈8–10%）+ `0 1px 2px` 分层小阴影
- 主按钮：实心 `--accent` + 轻阴影，勿大面积 glow

## 密度

- 圆角：`rounded-[var(--radius-control)]`（prefs；默认约 10px，勿强制 999 胶囊）
- 高度：默认控件 `h-9` / `min-h-[var(--ui-ctrl-height)]`
- Badge：去胶囊，用 control 圆角
- 工具条内 `SelectTrigger` / 原生 select：显式 `w-auto` / 定宽 + `shrink-0`，避免基类 `w-full` 盖住旁路按钮
- 刷新：`RefreshIconButton` → 内部 `Button`（outline/ghost），不要再叠 `.ui-btn` 太鼓胶囊
- 面板标题：`CardTitle` 默认 `font-semibold`（600，对齐 gsuid）；字号走 `--console-panel-title-size`。勿再在页面上写死 `text-[0.9375rem] font-semibold` / `font-medium` 覆盖字重

## 表面类

| 类名 | 用途 |
| --- | --- |
| `surface-contrast` | 相对卡片再抬一层（配置区、工具条） |
| `surface-muted` | 弱背景分区 |

内部跟 hub token；可用 Tailwind 组合，但不要另开粉主题色板。

## Token 注意

- hub `--accent` / `--border` / `--text` / `--foreground` / `--primary` = **完整色值**，供 `color-mix`、glass、侧栏、`.panel`
- Tailwind / shadcn 只用 `--ui-*` **HSL 分量**（如 `--ui-primary`）；`applyShellTheme` 只同步这些
- **禁止**把 HSL 分量写进 `--border` / `--primary` / `--foreground` / `--card`（会导致边框与选中态消失、界面发「飘」）
- Tailwind 色名 `accent` → `--ui-accent`（soft hover），**不要**覆盖 hub `--accent`
- 非 AI 页仍用 hub `.panel`：描边约 `border`×40–55% + 阴影分层；勿再叠 `0 0 0 1px` 与实线边双重描边

## `/ai/*` 试点（shadcn 原生）

**范围**：`/ai/*` 子树为全面迁移试点；其它控制台页仍用 hub 存量，**按模块重构时迁到 shadcn**（见上文「迁移」）。

**壳**：外层仍走 `AppShell`（侧栏/顶栏）；**页内**不再用 hub 页级 class。

| 用 | 不要用 |
| --- | --- |
| `PageMasthead`（标题密度可贴近 gsuid / tokens，勿再放大号独立体系；`AiPageHeader` 为兼容别名） | hub `PageHeader` / `PageChrome` / `.console-hub-page__*` |
| 单行工具条：`Select`（分段）+ `Input` + `Button`，白底/`bg-card` + 轻阴影（对齐控制台 chrome 观感） | 依赖 `ConsoleChromeTools` / `.console-hub-page__chrome-tools` |
| `Card` / `Button` / `Input` / `Badge` / `Sheet` / `Tabs` | `.panel`、`.btn`、`.inp`、`.ui-btn` |
| Tailwind + shadcn token（`bg-card`、`text-muted-foreground`…） | `ai-hub.css` / `ai-history.css` 专用 class；新建 hub 专用 CSS |
| `AiLayout` 上 `data-ui-zone="ai-native"` | 把 AI 页改回 hub 布局 |

**配置区布局**：页头 + **单层工具条**（分段 Select | 段内分栏插槽 | 搜索?/操作 | 刷新）+ 正文；**不要** AI 区顶部分区栏（观测/配置/…走侧栏）。换配置分段时工具条 middle/trailing 由段内 `useRegisterAiConfigChrome` 切换。

**Token**：页内优先 Tailwind → `--ui-*`；需要 accent 实色时可用 hub 完整色 `--accent`（与主仓一致），勿把 HSL 分量写进 hub 色槽。

**窄屏**：工具条单行可横向滚动；改动标题栏/表格时仍自检 ≤560px。

## 页面骨架（非 AI 区 · 存量）

| 组件 | 用途 | 迁移 |
| --- | --- | --- |
| `PageChrome` | Hub masthead | 模块重构时改为 `PageMasthead` |
| `ConsoleChromeTools` | Hub 紧凑工具条 | 新实现用 shadcn 单行条；本组件不扩大 API |
| `PageFill` / `PagePinned` | 满高 / 钉顶 | 可暂留 |
| `PageHeader` | deprecated → `PageChrome` | 勿新用 |

`/ai/*` 与控制台共用 shadcn 原语；页内布局见上文 AI 试点。

## 侧栏钉住

不做。

## 样式与业务 TS

`src/styles/console/`、api/utils 均自有。配置 dirty 行为另期。

## Toast

暂用 `ConsoleToastHost`；sonner 后置。
