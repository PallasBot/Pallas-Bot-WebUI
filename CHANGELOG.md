# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [语义化版本](https://semver.org/lang/zh-CN/)。

更早版本见 [GitHub Releases](https://github.com/PallasBot/Pallas-Bot-WebUI/releases)。

<!-- entries -->

## [0.7.12] - 2026-07-26

### 🚀 新功能

* feat(ai): 对话策略页暴露发言感知配置分组 ([4b81608](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/4b816081701d0aa95ce7184c7a20c74151dea528))

**完整变更**: [`v0.7.11...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.11...HEAD)


## [0.7.11] - 2026-07-26

### 🚀 新功能

* feat(webui): README 代码块恢复幽灵 Copy 按钮 ([8d9aed4](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/8d9aed40d49a00cb6b0f06a83f19eeea4c52ec12))
* feat(ai): 优化人物工具任务页与联网搜索配置入口 ([43a7c6a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/43a7c6ae1d0f5b6cf8556296b902968dadc36bfb))
* feat(ai): 增加人物、工具与任务观测入口 ([1b99123](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1b99123781ad2702292d2995591724237b607a40))
* feat(ai): 近 7/30 天 Token 卡展示费用 ([48b9032](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/48b9032f522d6b5dfd341bc0a6152258026cb5e7))
* feat(ai): 对话策略字段改用软召回配置标签 ([9d95a59](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9d95a59cba1a9431ae9ec0683a1c80d22dffb8ab))

### 🐛 错误修复

* fix(ai): 口癖文案对齐短习惯并支持停用已启用项 ([8340281](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/83402815aa88ab8e9ea4ae0601b66307df191123))
* fix(ai): 工具可见性与联网搜索文案更易懂 ([f61d13c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f61d13c84235cd71b792cf6dc53474b51bd49b5e))
* fix(ai): 配置文案「闲聊」改为「LLM 对话」 ([78a6936](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/78a6936a34caed5e1dd410821a5cc8b3497a1873))

### ♻️ 重构

* refactor(ai): 更新任务页面文案与过滤功能 ([02fc18c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/02fc18cfe3666d23ff00b5364964417b3aec42b1))
* refactor(ai): 观测工具并入配置并优化人设导出 ([d1b9b5c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d1b9b5c75b983b0a393f6fbb9c0dd67bb29ce336))

**完整变更**: [`v0.7.10...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.10...HEAD)


## [0.7.10] - 2026-07-26

### 🚀 新功能

* feat(protocol): NapCat Overview 展示 WebUI token 与端口 ([aeccb7a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/aeccb7a10c1e910236614fadc455a49d3b607b7d))

**完整变更**: [`v0.7.9...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.9...HEAD)


## [0.7.9] - 2026-07-26

### 🚀 新功能

* feat(ui): 长列表选择统一 Combobox 搜索 ([e1b8c9f](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e1b8c9fbadec0bdcf003e72056521a4f432b754a))
* feat(ui): Bot 账号选择改用可搜索 Combobox ([0424cae](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/0424cae4d702a785d46e7d098824da0325518300))
* feat(ai): 对话工具页增加口语选型预览与描述覆盖 ([28f15f5](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/28f15f5894d0f4f51977ff6f10e67cd342ab42ba))
* feat(ai): 对话工具页支持 hints 覆盖与策略字段 ([5bf4b2c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/5bf4b2cf72bd3c0917a8d2c02f70f6d26af9b883))
* feat(ui): 唱歌/TTS 保存上工具条，音色映射按 Speaker 分组 ([fc19a2b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/fc19a2be3f6101bdd291f88510ce3f82dccdd9c4))
* feat(database): 增加 Mongo→PostgreSQL 迁移向导 ([b2daa23](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/b2daa231f5c873fed7c99b30d6c62ebaa9f48d00))
* feat(database): 健康摘要与表白名单只读浏览 ([d4cc7f3](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d4cc7f39c00f576a5a3633f6e78d063dcaa39350))
* feat(ui): 配置弹窗身份头栏与字段「?」说明 ([08083ca](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/08083cad3fd275ccf4bf91595267837c2de1884f))
* feat(protocol): 分段下拉选项补充图标 ([20fdaa2](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/20fdaa2cd91fc41f7f298430d36a14eac77cf16f))
* feat(ui): 工具条右侧操作横滑右钉，支持竖向 sticky ([d84016d](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d84016d31e694f8d69c87726fc270358bd2f80e8))
* feat(database): 后端配置并入分区 Select，弹窗标签加粗 ([2def335](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2def3357429ab65aeb480a7308c69832f42b0ea9))
* feat(database): 后端配置并列卡片与连通探测 ([9d6d627](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9d6d62724616c209861756939f1b8afb34d67f40))
* feat(protocol): Docker 镜像选择器，账号与资产页可搜可选本地镜像 ([f52deeb](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f52deeb77809943e9fc010fda1d14163abf075e3))
* feat(ui): 抽取 CopyIconButton，社区与 AI 记忆改用幽灵复制图标 ([882725f](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/882725f61ecfc31da0d3ee0c0f7dbc9692ac7d3d))
* feat(update): 对接更新进度 job，进度条显示真实百分比 ([e26b405](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e26b405d6c8a6a62126d9e8cb63376e199d1f0d9))
* feat(community): 语料与热词同页双面板，本部署改称本机语料 ([85a0e28](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/85a0e2842390756b8a3f020e7ef654ba003eec86))
* feat(plugin-config): 工作区迁入 ChromeTools 并隐藏类型标签 ([dab2888](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/dab28882c1debc042cbcf8a83135f7f8f7239bb3))

### 🐛 错误修复

* fix(ci): OpenAPI 漂移检查同时接受 Bot main/`dev` openspec ([b5ada30](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/b5ada30b8de27964c4a3a8f0fe846091f61c2b68))
* fix(ui): 好友群聊分区 Select 显式图标并按内容宽度 ([6a35a0b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/6a35a0bd373a8c62746bdd987a602276b05de165))
* fix(ui): 好友群聊分区 Select 触发器显示图标 ([ad1c56b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ad1c56bae9f61860d00ab365b536246a93e2215d))
* fix(ui): 存储视图切换、滚动锚定与工具条 Select 收窄 ([d788290](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d7882903de8f7bea85d9567a7e52962b1c5754f2))
* fix(protocol): 窄屏账号分区 Tab 均分可点 ([14b67fa](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/14b67fa0af1d7747ee6a81de42ff1df11dd8e314))
* fix(database): 群与好友配置支持删除记录 ([c7298e6](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c7298e669c4cd597098c9d59e6ba180ccc5a5e25))
* fix(ui): 修复工具条 Select 中文被纵向裁切 ([1bcd676](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1bcd67617ebfd5874a53250bd8c85f2f58eed5e5))
* fix(store): 连点更新时保持排队中按钮状态 ([f4298a5](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f4298a5c65f04cec6b9fdcc7efbcf1016a85a94e))
* fix(database): 健康 KPI 移至条末 ([ed65ab1](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ed65ab1de42692e0522a4194f4a741ec030847eb))
* fix(database): 只读浏览改为短字段列表与行详情 Dialog ([37d4002](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/37d400253cceebacc4a342846383aa1dee8e797f))
* fix(ui): 帮助图分组恢复分区卡，与插件配置分组对齐 ([c1b231b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c1b231b0b73a18e2376f30f1ea4e915801e56b73))
* fix(plugins): 无 field_groups 时仍按 ui_group 渲染配置分组 ([46e2a2c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/46e2a2cffc84c638d9fc68b1bd5e38e2c6df1f0f))
* fix(logs): 报错页来源 Select 前置，刷新回到工具条 ([121f824](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/121f8242769b3e7c19af08290e860ce14a0ad878))
* fix(database): 探测/保存时去掉 password_set ([dc36c5e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/dc36c5e2c7001961a15e6f7cb470c8291964d910))
* fix(ui): 优化看板/社区载入态，抽取 ConsoleHint 并同步仪表盘账号 ([e993273](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e9932730983dd853b13a2d4eb8f91ee7cddeb309))
* fix(store): 插件详情 README/更新日志分栏改为 Select ([70ec52f](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/70ec52f35bd30c28f152a89a4f5fa5db440c39c9))
* fix(ui): masthead 窄屏同行、商店操作上移并去掉重复保存提示 ([3b94eef](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/3b94eef53dde3a6153e202244eec4e097aa2c111))
* fix(ai): 窄屏配置网格保持两列 ([f837760](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f837760fd4839261ccd76f58c352c63f3759d243))
* fix(social): 群配置封禁与轮盘同行并对齐标题字重 ([a31c27a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a31c27a9035619778a0ad128e543cb88d4efae6e))
* fix(backup): 修复窄屏「开始备份」按钮错位 ([bad5ddb](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/bad5ddbaed35950b189719ce8ff982b6c57798bc))
* fix(social): 群好友弹窗 footer 同行，名单改芯片输入 ([469f9ef](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/469f9ef628716a86f8dde7414d20ff625a572f67))
* fix(shell): 手机侧栏导航竖直居中且文字左对齐 ([79253c0](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/79253c077fd2dec0bccf6a72367830263e9a134c))
* fix(ai): 作用域提示统一虚线框，情感零点线加粗 ([0bf758e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/0bf758e6f347269e9ed6178598d7e79e0b0af3be))
* fix(login): 深色主题改用 --bg-deep 等变量 ([f857bb4](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f857bb4c03c3d0fe4604c0dce903f45246ef6d3a))

### 📚 文档更新

* docs(release): 重写 v0.7.8 说明（含自 v0.7.2 累计） ([65e359c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/65e359cdc6c86e002cfbbe5f0a48c299c2ce279f))

### ♻️ 重构

* refactor(ui): 群/好友配置弹窗对齐 divider 与开关字段 ([b5d968a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/b5d968a8a0458f2f3adcd60b5c9b59f42fecb139))
* refactor(ui): 恢复 Git 镜像源弹窗 divider 扁分区 ([36d2203](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/36d22033e6939f2475ba839dd553f0836790e7dc))
* refactor(ui): 配置弹窗改用 divider 扁分区 ([6fe5587](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/6fe55879b35ef96ec838aa8fe03e97e6a5e64d18))
* refactor(ai): 刷新与保存回到工具条，新增提供方后整页保存 ([3aa7462](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/3aa74628116cb770ec384c43bc85d5ce100ff03b))
* refactor(protocol): 重启全部并入协议账号选项菜单 ([e3ed899](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e3ed8999a70d165b0434c99e06f3e65fd284afa9))
* refactor(chrome): 统一工具条行距与簇距约定 ([5002623](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/5002623bbc04cceb6362c2db28d707ecdf8e4e7f))

### 🔨 其他更改

* chore(api): 按 Bot main openspec 对齐 console 类型 ([8311381](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/8311381bc1db64b6a61512693a40f9bea0338d39))
* chore(api): 同步 console OpenAPI 类型（LLM tools preview/overrides） ([aa0059c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/aa0059c4e31c495bfeabef282b76e19f12571b9a))
* chore(ui): 帮助图分组说明去掉技术字段名 ([ff4b1ac](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ff4b1acd97dc70931454272b128de151cd44a5f4))
* chore(ui): 帮助分组与协议 WebUI 文案微调 ([758a773](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/758a77375ce5821954bf7cbcf16278a1cdc3caa0))
* chore(ci): main 直推不再触发 Release 发版 ([d6aa069](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d6aa069671c095e86788c0d21682fe2f58f6439a))

**完整变更**: [`v0.7.8...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.8...HEAD)


## [0.7.8] - 2026-07-25

相对 **0.7.2**（Bot **v4.1.1** 捆绑）至本版的累计说明；中间 0.7.3～0.7.7 的逐条提交见下文各节。

### 亮点

- AI：工具清单、语料预览/检索试探、历史工具轨迹；统计趋势与记忆/门控；任务编排高低档/全任务
- Provider：通用主备线路面板；帮助图分组与芯片 portal
- 社区投稿：面板、可不选 Bot、粘贴截图；数据看板插件筛选
- 协议：账号工作区与 Docker 镜像拉取；账号选择器收藏排序
- 修复：样式失效、Tailwind content、看板中文名/页头版本、窄屏弹窗边距

### Added

#### AI / 对话

- 对话配置：LLM 工具清单面板；「本进程未加载」等禁用原因文案
- 语料源：条目预览、检索试探
- 历史会话：工具轨迹展示
- 任务编排：高低档 / 全任务切换（全任务优先）
- AI 统计：趋势图、记忆 / 门控面板

#### Provider / 帮助

- 通用主备 Provider 线路面板（`provider_gateway`）
- 插件配置帮助图分组与芯片 portal 滚动

#### 社区与看板

- 社区投稿面板；可不选 Bot；支持粘贴截图；无 Bot 截图瓦片展示
- 数据看板：插件筛选与 AI 统计展示优化
- 多处账号选择器：收藏账号优先排序

#### 协议

- 账号工作区体验与 Docker 镜像拉取进度
- 原生 WebUI 鉴权旁注等字段展示

### Fixed

- 分区注释被提前闭合导致样式失效；Tailwind `content` glob 被误删
- 看板中文名与布局；页头版本 / 主题展示；移除流量编排
- Git 镜像源弹窗窄屏留白

**完整变更**: [`v0.7.2...v0.7.8`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.2...v0.7.8)


## [0.7.7] - 2026-07-25

### 🔨 其他更改

* chore(api): 同步控制台 OpenAPI 类型 ([70f75f5](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/70f75f5d5bfc2b722a7893adc344de842da97b8f))

**完整变更**: [`v0.7.6...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.6...HEAD)


## [0.7.6] - 2026-07-25

### 🚀 新功能

* feat(provider): 通用主备 Provider 线路面板 ([a13f736](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a13f7361445eb300efe18a94d63c425af6bf7f00))
* feat(help): 插件配置帮助图分组与芯片 portal 滚动 ([0abc877](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/0abc877ca2086979cbff8af30099ef49b556cddc))
* feat(community): 投稿可不选 Bot，支持粘贴截图 ([2362613](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2362613721eb21132c0ac1fd6a394c3a4c00a0e6))
* feat(charts): 数据看板插件筛选与 AI 统计展示优化 ([7331050](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/7331050954a614678902824af3d1a7ec4aad9a6d))
* feat(community): 社区投稿面板，并统一 Bot Select 展示 ([c6e2349](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c6e23499c8c780de57f09d02f9e06b1d52f5dece))
* feat(ai): 任务编排支持高低档/全任务切换且全任务优先 ([6d5ab1e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/6d5ab1e3bb972ffb28f172a8f66ac386913e608b))
* feat(ai-stats): 统计页增加趋势图与记忆/门控面板 ([dacd4ad](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/dacd4ad6e07187bf8fbdfd44c3871bfc64d807d1))

### ♻️ 重构

* refactor(community): 投稿页迁 shadcn Card，无 Bot 截图用瓦片展示 ([2b4dafa](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2b4dafa31d8236ba0c97df8eed9e825f3ace0073))

**完整变更**: [`v0.7.5...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.5...HEAD)


## [0.7.5] - 2026-07-24

### 🐛 错误修复

* fix(console): 看板中文名与布局，页头版本与主题修正 ([c388077](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c388077b9b2ee076e3f06e5fd7101c4b8d6952f0))
* fix(console): 看板中文名与布局，移除流量编排并修正页头版本展示 ([e0c8b66](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e0c8b6659ddba8d70bee6e67c6863b87c5ef7711))
* fix(ui): Git 镜像源弹窗窄屏留 16px 呼吸距 ([5f1983f](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/5f1983fb2d075d695884e2762433f31456add87d))

**完整变更**: [`v0.7.4...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.4...HEAD)


## [0.7.4] - 2026-07-24

### 🐛 错误修复

* fix(build): 恢复 Tailwind content glob（注释清洗误删 /**/） ([a0af0fa](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a0af0fa9bd1fe294a0fa24254182a5f62680c175))

**完整变更**: [`v0.7.3...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.3...HEAD)


## [0.7.3] - 2026-07-24

### 🐛 错误修复

* fix(styles): 修复分区注释被提前闭合导致样式失效 ([2a2965e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2a2965ea6ab1f7edc66de3228af53d750cdf016b))

**完整变更**: [`v0.7.2...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.2...HEAD)


## [0.7.2] - 2026-07-24

### 🔨 其他更改

* chore(openapi): 同步 Bot 控制台 OpenAPI 类型 ([e51315e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e51315e00053490e6a879b0acbd218249ce7b778))

**完整变更**: [`v0.7.1...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.1...HEAD)


## [0.7.1] - 2026-07-24

### 📚 文档更新

* docs: 精简 ui-conventions 表述 ([9432229](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9432229b49eeb2d3c2ef9deec4919fb0a6e5dbcb))

**完整变更**: [`v0.7.0...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.0...HEAD)


## [0.7.0] - 2026-07-24

### 🚀 新功能

* feat(console): 壳层页面、配置控件与 OpenAPI 类型 ([5e971b1](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/5e971b1290d184e0a2feb3a7cbd330fb4c6d50a3))
* feat(protocol): Runtime 页与画画网关控件 ([d31da9e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d31da9e10105a48eb044c6a077db7ce81603ed26))
* feat(ai): 观测/记忆/人格页与配置分段 ([ece61aa](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ece61aa8a7dfd4fbbb40a3ea6fd8786277bc5228))
* feat(ai-config): 对话开关增加酒后 TTS 项 ([ce25936](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ce2593698842660efc787fcb728e0f36e6809f92))
* feat(react): AI 配置区对齐 ChromeTools 与 shadcn 字段 ([0b23053](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/0b230531f5c046901a2486204578d1ce4af5e849))
* feat(react): 控制台主页面迁 PageMasthead 与 Card ([b5d4971](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/b5d4971f91705ad9eea91477cb57e83c811442fc))
* feat(react): 统一页头工具条并加强控件描边 ([05b6eaf](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/05b6eafd25d7dc54fbe8623da63bde9ab583b3bd))
* feat(react): 控件骨架自有化并解耦 Vue 源码依赖 ([05526b1](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/05526b18282e65eb32255615d50037a1faa3ecdb))
* feat(react): 配置表单与分栏增加对比色表面 ([1cea547](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1cea54795692fa0bf9150686d4f7654e2ccfbb4d))
* feat(react): 非 AI 视觉对齐 P2（页面密度与窄屏） ([30d4ed7](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/30d4ed78bf8e8b98e272670858ae4dbd369aa7d7))
* feat(react): 非 AI 视觉对齐 P1（Update/Community/对话框） ([633b717](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/633b717dd3c8dfb8714278d87ba1e580b1b97757))
* feat(react): 非 AI 视觉对齐 P0（Ui* 与配置/侧栏） ([02cee76](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/02cee7629ac609356c84e64927becd84b1964aa5))

### 🐛 错误修复

* fix(react): 修复深色模式主按钮与搜索图标对比度 ([06e2e9f](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/06e2e9f48a1f2cc666ed5165311cffc22505ff22))
* fix(react): 配置字段展示与插件 README 辅助 ([03e269e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/03e269eb847145a49a7b6ef5af035d00b584f6a1))
* fix(react): 协议账号日志面板对话框下去掉多余 glass ([fd8cc87](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/fd8cc87f045a664ea9a64d797b5850fb71642c7e))
* fix(react): 协议账号/商店脚/主题按钮与 README 视觉收口 ([ab5f29e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ab5f29eb447a841c6d778da81d07228337adf0fa))
* fix(react): 协议账号弹窗/商店脚栏/README/主题按钮对齐 ([074f3df](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/074f3dfca166e250d2af09b7bcb7bbf62dd17b30))
* fix(react): 对齐日期选择器、系统性能条与弹窗画布 ([5c93c22](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/5c93c22ddef2925933ad7458708a146f221b26a7))
* fix(react): 对齐协议端入口与 Runtime 面板 ([f187db8](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f187db8734559bf3f8634e622f11cb2c0e6d084a))
* fix(react): 重构日志报错页卡片与操作区 ([abaa8b8](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/abaa8b8aca922ab37279653450e914e28d0ab2e0))
* fix(react): 重构数据看板图表布局与图例 ([cf427f5](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/cf427f5d2139774988ba1744558d23a43455d9a1))
* fix(react): 修复运行日志行重叠 ([e86f47c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e86f47c1838d125ef39abf2eb51601f5c4dadb95))

### ♻️ 重构

* refactor(react): 壳层导航与 Tailwind 主题桥接 ([0115c2b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/0115c2b95f090766d2049b29037ec092ca53c119))
* refactor(react): 弹窗与共享组件对齐 shadcn Dialog/Select ([f0e5c1d](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f0e5c1d74fab31a4447b5c6b0d355d16e282ee04))
* refactor(ai): align template indentation and improve readability in AiHistoryPage.vue ([96a1dbe](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/96a1dbe07dfd0c430776cbee9093a3acab96c01b))

### 🔨 其他更改

* chore(repo): React 提升为仓库根并更新发版 CI ([f82d789](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f82d789defffad752c90061f4cf8477db108c64c))
* style(react): 同步 hub/token 与页面密度样式 ([1cb4fa2](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1cb4fa2983839094581ed65b111c8cf429c2ef0e))
* chore: 忽略本地 agent 与 worktree 目录 ([c425843](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c425843622dd88f262941a40863e3399d890d0cc))

**完整变更**: [`v0.6.51...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.51...HEAD)


## [0.6.51] - 2026-07-22

### 🚀 新功能

* feat(protocol): 增加账号运行时切换设置 ([a682490](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a6824907a3d761ce418b4459148a9ccfac287d8e))

### 🐛 错误修复

* fix(protocol): 修复控制台接口基址 ([baeebb3](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/baeebb351286b81d6c2f2d4157e7c1922ca35bb7))

### 🔨 其他更改

* chore(worktree): 忽略本地工作树 ([865a348](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/865a34811b11c20d02f6c853677d11ccf36eea47))

**完整变更**: [`v0.6.50...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.50...HEAD)


## [0.6.50] - 2026-07-22

### 🐛 错误修复

* fix(ai-config): 修复响应式分区与模型操作布局 ([08b7be8](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/08b7be8d0fbcf1674e63fa415174321141a893da))
* fix(home): 恢复 KPI 右侧入口宽度 ([2a81fae](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2a81fae6e164821a2d460d7e018952e375f8642e))
* fix(home): 保持 KPI 右侧入口同行 ([264fcf0](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/264fcf09e74919e5cb6c9ec90da8180ee2b05ff0))
* fix(webui): 修复控制台布局与构建版本标识 ([437b088](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/437b088fb282cab2737f489ffb0e3b324f398f5f))

**完整变更**: [`v0.6.49...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.49...HEAD)


## [0.6.49] - 2026-07-22

### 🐛 错误修复

* fix(webui): 优化 AI 配置窄屏布局 ([647161a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/647161ae689c92e3e3dc11adbd0ca73df6df8952))

**完整变更**: [`v0.6.48...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.48...HEAD)


## [0.6.48] - 2026-07-22

### 🚀 新功能

* feat(ai): 配置页搜索、专家模式切换与模型管理紧凑操作 ([cac5039](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/cac50399a724c02e4ec107048ecd0d369bd2ec2d))
* feat(ai): AI 首页卡片顺序与显隐偏好 ([02ce58f](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/02ce58f11811073a82728e5bd706613f6d1ed284))
* feat(ai): 拆分历史会话工作区并按 workspace 同步路由 ([7fe6466](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/7fe64669d483336c2cb712fef504c89d5e058803))
* feat(ai): 侧栏按 AI 可达性收成 essentials 导航 ([2053028](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/20530282dd1471130453b5abe3d7aadd1cf61d03))
* feat(protocol): 协议账号日志按二维码行分段渲染 ([c7b9e51](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c7b9e5105cd40b5761e0eaea5f08aec8d4fe1704))
* feat(protocol): SnowLuma Runtime 管理与创建流 ([d3ee813](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d3ee8130346ae7956a6365d7be3728b71e46fbb8))

### 🐛 错误修复

* fix(ai): AI 体检向导接入 PagePinned 钉顶布局 ([bc3b7e6](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/bc3b7e62c6ad208e24c78f65da36dc29a8764ffc))
* fix(ui): 插件商店非本地分区隐藏空工具条 actions ([956d99d](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/956d99d25f395efccf9b9b5ec3d27ed8688ab4a4))
* fix(ui): 运行日志搜索筛选同行并移除刷新按钮 ([4598890](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/459889061e1a22715fbdda468556ac12076f090a))
* fix(ui): 实例与协议面板标题栏统计位与搜索全宽 ([ef44ece](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ef44ecea33dadb0e15aa3d24f59bdd3d0480a495))
* fix(ui): Hub 工具条窄屏保持单行并截断来源 select ([c12ab38](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c12ab38bddf5bc4dc3652650cbb94d96583ffd99))
* fix(ui): Safari 日期控件与统计筛选窄屏布局 ([50a26ce](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/50a26cea8d78d598efaee3ac74572fc95971e28c))

### 🔨 其他更改

* style(ui): 侧栏滚动条默认隐藏、悬停显现 ([89d6e29](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/89d6e293ba6715e1f58f7353c7bf950cbb02a6ca))

**完整变更**: [`v0.6.47...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.47...HEAD)


## [0.6.47] - 2026-07-21

### 🐛 错误修复

* fix(ui): 高流量页与 AiHistory 双栏窄屏收口 ([fa4aa26](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/fa4aa26e2a9853f67881cbbb67729d172bfa0afc))

### ♻️ 重构

* refactor(ui): 外迁 AiHistory 页面共享样式到 ai-history.css ([9ab8baa](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9ab8baa5b3667f352df930eef6b03de1faac55f2))
* refactor(ui): 拆分 AiHistory 判定轨迹与孤立行为块 ([882516a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/882516acb6bbb035022514699623d9392ad2195a))

**完整变更**: [`v0.6.46...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.46...HEAD)


## [0.6.46] - 2026-07-21

### 🚀 新功能

* feat(ui): AiHistory 会话区 PageFill 与列表密度收口 ([ba719fa](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ba719fac53d01a9f299f1492f83d0842a905b741))

### 🐛 错误修复

* fix(ui): AiHistory 抽离组件后恢复共享样式 ([2c420f8](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2c420f857b5a70116cb4d77429556c0ce7da8593))

### ♻️ 重构

* refactor(ui): 拆分 AiHistory 回合维护体与牛格观测面板 ([2a78eb3](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2a78eb3a84a5244fdc6f229a6ba412a07bfe90a2))
* refactor(ui): 拆分 AiHistory 规则编辑与重放弹窗 ([80e8686](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/80e86868b25ed18576b484b85f8241f7d59313ef))
* refactor(ui): 拆分 AiHistory 维护区业务面板 ([8c8f265](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/8c8f2654d5840b71b4ee9fa75a623670434c74ad))
* refactor(ui): 拆分 AiHistory 塑形与高级调试块 ([1369de4](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1369de4caef964559f53624e7766208cf7797a46))
* refactor(ui): 拆分 AiHistory 回合线程与行为标注控件 ([4ae6c93](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/4ae6c93645bed3cc3b5c26a224ac3a8ebb40cde8))
* refactor(ui): 拆分 AiHistory 维护/规则/记忆工作区壳 ([1c91ced](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1c91cedd729769f2355e269a219ab8367d3e4681))
* refactor(ui): 拆分 AiHistory 工作区 chrome 与会话双栏壳 ([476f36e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/476f36e03c451dae5d1d22d0cf51e282ddbec03c))

**完整变更**: [`v0.6.45...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.45...HEAD)


## [0.6.45] - 2026-07-21

### 🚀 新功能

* feat(ui): 首页窄屏页头与 AI/插件配置轻量抛光 ([9e9f985](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9e9f98541f5555390d8f67e47f33bd29036b68b2))
* feat(ui): 运行日志页接入 PageChrome 与钉顶工具条 ([f67f306](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f67f306d7af67f6292e76bfc8a8fe4dd62af9a91))
* feat(ui): 残留 .btn 接入 UiButton 并补齐窄屏选择器 ([8e3f4d5](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/8e3f4d5c5fb4e8820ef36b5de8a4b0ffb5d4d7d8))
* feat(ui): 数据看板日期筛选改为扁平工具条 ([d762659](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d762659c7b3222cdd01675bb5a553b779b0f5cff))
* feat(ui): 分页器与配置弹窗接入 UiButton ([0f96511](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/0f96511564ef592e7a2065864c5fc7fd940dbb00))
* feat(ui): Setup/AI 向导与协议子页 PageChrome ([2b9f643](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2b9f6432d3b88efa34030fe5e7b154afdeef1a4b))
* feat(ui): 社区页 KPI 改为扁平 MetricTile ([0d18a7c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/0d18a7c03a3488a98644e52b6581e6c92fcf5357))
* feat(ui): 数据看板与社区页 PageChrome 对齐 ([cfa0e7e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/cfa0e7ecda39fb4e02510bc4aa79d084560f7885))
* feat(ui): AI 观测/历史外层 chrome 扁平化 ([0879662](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/08796627d2d9a64502bb79682a9dc5d061b3f8ca))
* feat(ui): 收藏星与协议返回链对齐 UiButton ([e2f0a8e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e2f0a8e9fdfc9900dfaa9b180b596d9c67d1a815))
* feat(ui): 数据库/备份页 PageChrome 与扁平 KPI ([033a42c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/033a42c8d3d604e25a14fa49735996ab8582c9c0))
* feat(ui): 实例/协议/好友群 PageChrome 对齐 ([6c946f1](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/6c946f18ad917c2e3e74e27bae21c9d3a69eaae1))
* feat(ui): 首页 KPI MetricTile 去嵌套噪音 ([4b0bdea](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/4b0bdea0e04f126c575fe6b1f8cc342abc3f4111))
* feat(ui): 插件商店搜索与空态去嵌套 ([b0380ca](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/b0380cac88439934063b4b8e696ffa4bfbf272cd))
* feat(ui): 布局 gutter token 与 PageFill/PagePinned ([dce3eda](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/dce3edaf87b901aff1c0eb44b9e112cfd9d56e8d))
* feat(ui): PageChrome 与表面契约，Prefs/Update/Plugins 去嵌套 ([273ce11](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/273ce11a5f3657b0e9c8b900e89dbcd8ea1a94a0))
* feat(ui): 更新页与 AI 统计/历史布局清爽化 ([411cdbc](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/411cdbce140d0198b523ad89cf650874e2d50da0))

### 🐛 错误修复

* fix(ui): 配置项帮助按钮贴齐字段标题 ([487fdce](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/487fdce1748f158376215b1fdb6ae3461566258a))
* fix(ui): 修复数据库页 KPI 条被异常撑高 ([070c8a8](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/070c8a85c9e31e225be30de8cbbbf64412135239))

### 🔨 其他更改

* chore(openapi): 同步 Bot LLM Provider 模型发现接口类型 ([9808a0a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9808a0a06d9916d41d085e3761edb94b6344f9f4))

**完整变更**: [`v0.6.44...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.44...HEAD)


## [0.6.44] - 2026-07-21

### 🚀 新功能

* feat(ui): 协议与商店等残留控件接入 Ui* ([c8d4e5b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c8d4e5b591db8080e34a99f130ac7a96f51e0007))
* feat(ui): 圆角滑块并联动控件半径 ([4c47b87](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/4c47b871eb41e872d4b4cb8077e34ea24bfc87a7))
* feat(ui): 全局按钮去胶囊化 ([ad5d698](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ad5d6983186706ffa43cf17473f9d59b2a99f353))
* feat(ui): 按钮去胶囊化并清爽 Git 镜像源弹窗 ([85dcdbe](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/85dcdbe6a8191f3835014e8b132a496a42e5bbb5))
* feat(ui): AI History/Statistics 筛选接入 Ui* ([18de9f9](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/18de9f9106b3eb7845a2f513b7474cea014c82cd))
* feat(ui): 侧栏字重收口并扩展 Ui* 接入 ([a0611d6](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a0611d66f83f498e207b6cdc9782bb20be55b4d0))
* feat(ui): 列表筛选与 Hub 搜索接入 Ui* ([39321c3](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/39321c3d870d3b1fe37d04159346f1eb02a10ff5))
* feat(ui): 扩展 Ui* 原语并接入配置表单 ([a419149](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a419149f84ce69c431f804f7db139826ec29628e))
* feat(ui): 配置表单与表面系统清爽化 ([8af57ca](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/8af57cae565898bdacbade80b2d24db52de8884b))

### 🐛 错误修复

* fix(charts): 移除总看板 AI 专项跳转块 ([9853639](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9853639877f7c133546232be81382d1a2501205d))
* fix(ui): 协议账号操作栏搜索与按钮对齐 ([6a5e229](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/6a5e229a7a632e0d369f06329b2d4a3c6ba01f0e))
* fix(ui): 合并配置字段帮助按钮样式规则 ([2051fe0](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2051fe0c62a0374608fe6a3ccb8de5fdacedbf0e))
* fix(ui): 配置网格长标签截断防叠字 ([bc7fffa](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/bc7fffa585ce1d959e65e31efba49c6dc02764c1))
* fix(ai-config): 刷新模型不经 AI，并解除须先选模型的死锁 ([5358ec5](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/5358ec5c6b4f398744278e95d392284f1851d262))
* fix(webui): 首页与日志体验收口，更新说明支持表格与复制 ([bb08940](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/bb08940d97622c1e81511ce78f15c96aa80a780e))

**完整变更**: [`v0.6.43...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.43...HEAD)


## [0.6.43] - 2026-07-21

### 🐛 错误修复

* fix(webui): 集中嵌入式刷新与窄屏标题栏样式 ([f4a4dfe](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f4a4dfee91c35fd3668a3142e0a34a296d33dd62))
* fix(webui): AI 历史「去验证」切换会话工作区并监听 query ([eef1a41](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/eef1a41c4ee1143a16cfa23cff85b357d8f5e2cf))
* fix(webui): 图表与 AI 统计日期工具栏去掉月份仅保留起止 ([212211e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/212211e5de357c952eda15d43f4a2aa9a2734aeb))
* fix(webui): AI 配置窄屏标题栏与嵌入面板扁平化 ([2b7dc34](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2b7dc3497121bf5d9f11644a4245dafb0fa5ab25))

### ♻️ 重构

* refactor(webui): 抽出 PanelHdCollapseCaret 并迁移面板展开收起 ([f237e76](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f237e76a3a14252fe51094b8f014b21d1471bc63))

### 🔨 其他更改

* style(webui): 好友申请 container query、prefs 单行与其它窄屏样式 ([df9c47b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/df9c47bee4bd6874f1ba6d6d5475babb3186e977))
* style(webui): RefreshIconButton 默认 embedded 并统一标题旁刷新样式 ([22cd181](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/22cd181665effd593a9490fb45da5e208b149c93))
* chore: 预提交同步控制台 OpenAPI 类型 ([2a77c70](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2a77c70508255a8578396335486371961e026b73))

**完整变更**: [`v0.6.42...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.42...HEAD)


## [0.6.42] - 2026-07-20

### 🚀 新功能

* feat(webui): 官方商店插件镜像可单独切换 ([6b3df2d](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/6b3df2db7639b5b7371a0ae0570ed0afc9e77642))
* feat(ai-config): 能力包媒体模型管理、LLM/媒体 IA 与控制台 UI 修复 ([79b6ccf](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/79b6ccf481b8b60d0f4cb5008afde0bd16dbdb10))

### 🐛 错误修复

* fix(webui): 窄屏按钮布局、规则弹窗与画画运行态展示 ([48b4b41](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/48b4b419e79ef6d17a10d97d528ca44eaf9570d9))
* fix(ai-config): 按 review 修正镜像 scope 应用与下载轮询 ([61a6ff8](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/61a6ff883603814dd99796c737714563dcce61fe))

### 🔨 其他更改

* chore(openapi): 同步 Bot main 控制台 OpenAPI 类型 ([b05e856](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/b05e8564b7bb216c6c9d21474f38b185d186d87d))
* chore(openapi): 生成类型与 Bot main openspec 对齐 ([fba47c1](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/fba47c1b42b52679aea623ab5df681f76999cf30))
* chore(openapi): 同步控制台 OpenAPI 生成类型 ([acfe24f](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/acfe24f891b1e3a4af1742985d003ecfa158eeb3))

**完整变更**: [`v0.6.41...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.41...HEAD)


## [0.6.41] - 2026-07-20

### 🚀 新功能

* feat(ai-config): Docker 连接态与 LLM 聊天文案 ([1fdfe07](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1fdfe070ffb997b88b82e04eb651e02aa70e9586))

### 📚 文档更新

* docs(draw): 画画页强调直连网关，弱化 AI Runtime ([2b82dbb](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2b82dbb3c899178e180f63f0c9cd6ad9fc6fd59c))

**完整变更**: [`v0.6.40...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.40...HEAD)


## [0.6.40] - 2026-07-20

### 🚀 新功能

* feat(ai-config): AI Runtime 托管状态与启停控件 ([5b380f2](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/5b380f2b928db5ab83a4b1e8b27cbe6e5c231e48))

### 📚 文档更新

* docs(ai-config): 闲聊改为内核 Provider，弱化必须装 AI Runtime ([598e523](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/598e5239177fff83beb3bdbe69112c665661f854))

**完整变更**: [`v0.6.39...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.39...HEAD)


## [0.6.39] - 2026-07-20

### 🚀 新功能

* feat(webui): 更新页与插件商店接入 Git 镜像源 ([ccb4f3e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ccb4f3ecfcf5df7c81d8a230e71c294b25ad7cb1))

### 🐛 错误修复

* fix(ai): 默认 healthPaths 与 AI /health 对齐 ([d8d9781](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d8d9781c866318c3da1a9ae4f7f7c5a453eef4f9))

### 🔨 其他更改

* chore(openapi): 同步 Bot main 控制台类型 ([ce1abfe](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ce1abfef2c3da7a0e672a9d5de9c776d0a9a9622))
* chore(ci): Keep a Changelog 并去掉发版类型脚注 ([a950bbb](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a950bbb7a8587aa3899368a3236c34a84b4cb744))

**完整变更**: [`v0.6.38...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.38...HEAD)

