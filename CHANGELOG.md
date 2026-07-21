# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [语义化版本](https://semver.org/lang/zh-CN/)。

更早版本见 [GitHub Releases](https://github.com/PallasBot/Pallas-Bot-WebUI/releases)。

<!-- entries -->

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

