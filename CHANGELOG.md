# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [语义化版本](https://semver.org/lang/zh-CN/)。

更早版本见 [GitHub Releases](https://github.com/PallasBot/Pallas-Bot-WebUI/releases)。

<!-- entries -->

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

