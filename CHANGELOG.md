# Changelog

更早版本见 [GitHub Releases](https://github.com/PallasBot/Pallas-Bot-WebUI/releases)。

<!-- entries -->

## [0.8.30] - 2026-08-07

### 更新公告

- 需要 Bot >= 4.1.32；请勿只升控制台。
- 提供方可注册多个模型，并为每个模型配置按输入 Token 区间、每日时段或按次计费的价格条件。

### Added

- 提供方配置支持注册多个模型，默认调用模型可作为任务编排的常用模型。
- 模型费用支持按 Token 或按次的价格条件配置。

### Fixed

- 注册模型选择器首次打开会发现可用模型。
- 模型价格条件切换计费方式时不再新增重复配置，并使用每日时段选择器编辑时段。

### 提交明细

### Added

* feat(ai-config): 支持提供方多模型与价格条件 ([e17b32f](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e17b32f100ede343febd278fe66311adec6ea62c))

**完整变更**: [`v0.8.29...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.29...HEAD)


## [0.8.29] - 2026-08-07

### Added

* feat(charts): 展示入站执行容量 ([fd497d8](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/fd497d87ec571c70b5e99a508bc6028a15c2c6fb))
* feat(ai): 增加复读语义风格控制台 ([8448afa](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/8448afa48ff23007f8efcedb5f08f3ce52b71e44))
* feat(ai): 支持视觉选图任务编排 ([74164b4](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/74164b4983c947c26f0656b7409ecc135b23daae))
* feat(charts): 丰富入站压力趋势 ([421bfd8](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/421bfd87a02b568bdb367a093b7365add5fa798e))
* feat(charts): 图表化入站调度历史 ([86e23f3](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/86e23f3b795f71ce6b44549725fd4ea59a4ed5bd))
* feat(charts): 展示学习流水线与调度指标 ([ccf75d8](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ccf75d889391ab5c09b5adad99927dc16d50c665))

### Fixed

* fix(test): 修复浏览器环境 smoke 测试 ([2a7ad11](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2a7ad1186822ce22432cc772d5ed7cb3ef2baa99))
* fix(webui): 统一手机端顶部品牌名称 ([e434ccb](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e434ccbfafdfb5914d19e4060a9251488fac1e26))
* fix(toolbar): 恢复钉住操作区毛玻璃底 ([afbce40](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/afbce40e93a50b94a31295d8e0a4bca83802902a))
* fix(ai-config): 常用模型展示提供方默认值 ([883c379](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/883c379e10359f3458333799d90caf1c839f1047))
* fix(ai-config): 展示提供方密钥尾号提示 ([20bd224](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/20bd22459d216ec6b5ac30d70bd243741e707176))
* fix(ai): 修正视觉选图分档与任务标签布局 ([677cae6](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/677cae6d304457bce65f3cd497bef6abafb7a328))
* fix(charts): 默认展示近期入站历史 ([f98f498](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f98f498a8543a17303484363d99d408b17d9e101))

### Changed

* refactor(ai-config): 收紧智能对话常用配置 ([4eea174](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/4eea17461095fb4b5d6fda81c14ad96e192f2d1c))
* refactor(ai): 收敛复读页职责 ([5241e64](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/5241e64d0b7051ba8baf5e608e2b9e16a1abba57))

**完整变更**: [`v0.8.28...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.28...HEAD)

## [0.8.28] - 2026-08-05

### 更新公告

- 需要 Bot >= 4.1.31；请勿只升控制台。
- 入站调度面板补齐学习流水线、近期历史、执行容量与预算高压趋势，便于判断高峰降级和排队状态。
- 智能对话页支持视觉选图任务编排与复读语义风格配置，常用模型配置更紧凑、密钥识别更清晰。
- 优化窄屏顶部品牌与工具栏操作区显示。

### 提交明细

### Added

* feat(charts): 展示 LLM 预算高压指标 ([581f397](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/581f397e8790a555d2045c1f7d0d2d51016f4a24))

### Fixed

* fix(protocol): 托管账号优先显示实例名 ([6568ab9](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/6568ab963a3b0b7e74595dbbb657e71e30a0437e))

**完整变更**: [`v0.8.27...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.27...HEAD)

## [0.8.27] - 2026-08-05

### 更新公告

- 仍需 Bot >= 4.1.28；请勿只升控制台。
- 创建协议账号会读取并显示协议管理的默认后端，未手动修改时与私聊“创建牛牛”保持一致。

### 提交明细

### Added

* feat(charts): 展示后台任务积压状态 ([951f9c0](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/951f9c05c7a142ee273489972c4706d6a91fa4cb))
* feat(charts): 展示学习队列运行指标 ([1061eba](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1061eba3d19cec43d3a8fdf7c582e51a3014de7d))

### Fixed

* fix(charts): 修复入站调度窄屏标题换行 ([7520b5a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/7520b5a0405189343f78bf98843eec45de8d4952))
* fix(charts): 修复入站调度窄屏标题对齐 ([b2f31c5](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/b2f31c5d97a82d494afbe130187a543032a71ab6))

**完整变更**: [`v0.8.26...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.26...HEAD)

## [0.8.26] - 2026-08-04

### 更新公告

- 需要 Bot >= 4.1.28；请勿只升控制台。
- 入站调度面板展示队列、车道与 P95 分级，高峰状态更容易判断。
- 日志支持查看消息主进程、work aux 与 embed aux 的独立来源。
- SnowLuma Runtime 支持选择独立镜像，协议运行环境切换更清晰。
- 插件商店进入后会清除更新提醒，避免已查看内容持续显示绿点。

### 提交明细

### Added

* feat(logs): 支持辅进程日志来源 ([ff48525](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ff48525611216cee956d3f5f4130f07384481e52))
* feat(protocol): 添加 Snowluma Runtime 独立镜像切换能力 ([dbd83c0](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/dbd83c05ce6619964220e2377686d2a905995032))
* feat(charts): 增加入站调度面板 ([2da8a73](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2da8a7399ceaac81fd75acc2a8ecef9440311f8e))

### Fixed

* fix(charts): 区分入站 P95 告警等级 ([1938e96](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1938e96f8236ba9a0694a90f89904630eb8026c2))
* fix(charts): 优化入站调度面板状态呈现 ([4800891](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/4800891f7f9e727655280156dd75ae42df525f8e))
* fix(plugin-store): 进入商店后清除更新提醒绿点 ([d3fac87](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d3fac872bc5749b6a3ffda8ca7ac7124fcfa9460))

**完整变更**: [`v0.8.25...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.25...HEAD)

## [0.8.25] - 2026-08-03

### 更新公告

- 仍需 Bot >= 4.1.27；请勿只升控制台。
- 协议账号保存操作改为「保存配置」，并单独反馈 SnowLuma WS 是否已热更新。

### 提交明细

### Fixed

* fix(protocol): 保存配置不再误示重启 ([5859560](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/58595608d9823e3bd9f7cb5d095b254cb47ec6f5))

**完整变更**: [`v0.8.24...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.24...HEAD)

## [0.8.24] - 2026-08-03

### 更新公告

- 需要 Bot >= 4.1.27；请勿只升控制台
- 账号配置可填写处事方式、主动程度、分歧处理、偏好与避免项，并将「牛格种子」明确为表达基调
- Bot 重启弹窗按真实进度逐项显示已发送指令、进程退出、等待恢复和恢复在线
- 修复账号、群和用户配置中开关开启时整个控件外框被强调色覆盖的问题
- 多机协同部署补充部署名配置提示，排查节点归属更直接
- SnowLuma WS 配置保存后会明确显示连接是否已热更新

### 提交明细

### Added

* feat(protocol): SnowLuma WS 配置支持热更新 ([7adb7a9](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/7adb7a9feb1eac805ad973ab1740ec278caa6185))
* feat(restart): 以阶段进度展示 Bot 重启状态 ([18af955](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/18af95560cbdd0b9e3710fcd8572b653ec006cee))
* feat(persona): 支持控制台配置账号处事风格 ([13bbd2a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/13bbd2a2acaebfe00c2f859faa7ee10ef356341a))
* feat(community): 支持多机协同部署名配置提示 ([5e510ad](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/5e510adf2c17a0d6f7c1a3d7ce6bb588e7804941))

### Fixed

* fix(community): 修复部署显示名编辑被刷新覆盖 ([430077b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/430077bb62bc0950f1703400d91facaae202f606))
* fix(ui): 修复配置开关开启态 ([d3ccec5](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d3ccec5c268d7c1af4b799007e887a8a5a958bbc))

**完整变更**: [`v0.8.23...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.23...HEAD)

## [0.8.23] - 2026-08-03

### 更新公告

- 仍需 Bot ≥ 4.1.26；请勿只升控制台
- CPU 型号改在核心使用率图下方显示，不再占据 CPU 指标标题区

### Fixed

- 修正系统性能卡片中 CPU 型号位于核心使用率图上方的布局

### 提交明细

### Fixed

* fix(home): 将 CPU 型号移至核心图下方 ([f25562b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f25562b1a0859f3dbcce41eb4a3682715e85644b))

**完整变更**: [`v0.8.22...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.22...HEAD)

## [0.8.22] - 2026-08-03

### 更新公告

- 需要 Bot ≥ 4.1.26；请勿只升控制台
- AI 人员页补齐 CPU 型号与口癖候选分页，长列表更易查看
- 窄屏下优化唱歌音色配置布局
- LLM 运行时调试不再展示已退役的人设塑形细节

### 提交明细

### Fixed

* fix(ai): 优化唱歌音色窄屏布局 ([311c022](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/311c022ad26b8f9ff44ca8f4cb52145637f3b829))
* fix(ai): 分页加载口癖候选并展示 CPU 型号 ([c094513](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c09451314543c6c57d1de2b140a360fc972cd7b3))

### Changed

* refactor(api): 清理退役人设调试类型 ([b556617](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/b55661793636a58c76ac1e482a35173cb9f764ef))

**完整变更**: [`v0.8.21...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.21...HEAD)

## [0.8.21] - 2026-08-02

### 更新公告

- 仍需 Bot ≥ 4.1.24；请勿只升控制台
- 下载 / 安装等忙碌态不再让下载图标整颗乱转，改为加载指示

### Fixed

- 按钮忙碌态：非刷新类图标改用 Loader2，避免 Download 等图标鬼畜旋转

### 提交明细

### Fixed

* fix(ui): 忙碌态下载图标改用 Loader2 避免鬼畜旋转 ([8b5bf43](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/8b5bf43ff290fc1fac97193d2a6f544da8081c2c))

**完整变更**: [`v0.8.20...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.20...HEAD)

## [0.8.20] - 2026-08-02

### 更新公告

- 仍需 Bot ≥ 4.1.24；请勿只升控制台
- 唱歌音色列表可一键添加音频映射，并改为多列卡片布局
- 音频映射多组可并排显示
- 唱歌推理下拉固定包含 RVC，选项展示更清晰

### Added

- 音色列表「添加映射」快捷入口

### Changed

- 音色资产与音频映射改为多列布局
- 唱歌推理下拉固定包含 RVC 并优化展示

### 提交明细

### Added

* feat(ai): 音色列表支持一键添加音频映射 ([aa80ead](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/aa80ead019dead674c0271833bbe392a3e2f2634))
* feat(ai): 唱歌推理下拉固定包含 RVC 并优化展示 ([a9538bf](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a9538bf661ea19f000a6395602a2772c1897e1c1))

### Fixed

* fix(ai): 音色资产与音频映射改为多列布局 ([cf44122](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/cf4412208cd351be82716bbec17e6cbbd38972e4))

**完整变更**: [`v0.8.19...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.19...HEAD)

## [0.8.19] - 2026-08-02

### 更新公告

- 仍需 Bot ≥ 4.1.24；请勿只升控制台
- 更新页历史提交表改为横向滚动，长说明与操作按钮不再自动换行

### Fixed

- 更新页 Bot 历史提交表单元格不换行，窄屏可左右滑动

### 提交明细

### Fixed

* fix(update): 历史提交表横向滚动不换行 ([7e2a51b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/7e2a51b5e6d5cb2828083deb9f7f73ebf9a14c7d))

**完整变更**: [`v0.8.18...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.18...HEAD)

## [0.8.18] - 2026-08-02

### 更新公告

- 需要 Bot ≥ 4.1.24；请勿只升控制台
- 更新页增加 Bot Release / Commit 历史与定向更新（需配套 Bot）
- 修复更新页等 `asChild` 按钮把空图标交给 Slot 导致的白屏
- 实例与协议账号工具条可按连接状态筛选
- 操作按钮统一补图标与悬停动效；开关统一为控制台样式
- 日志列表改为文档流布局，避免换行叠行；scope 徽章缩短为导入 id
- 默认控件圆角改为 10px；侧栏选中圆角跟随偏好并去掉加粗
- 插件商店在空基线时不再把整店标成上新绿点

### Added

- 更新页 Bot 工具条与版本历史面板
- 实例 / 协议账号连接状态筛选

### Fixed

- `Button` 在 `asChild` 时不再向 Slot 传入 null 图标子节点
- 日志虚拟列表绝对定位导致的换行叠行
- 插件商店空基线整店绿点

### Changed

- 操作按钮图标与刷新动效
- 开关统一走 `console-bool-switch`
- 默认 `--radius-control` 10px；侧栏跟随控件圆角

### 提交明细

### Added

* feat(ui): 操作按钮统一补图标与悬停动效 ([f30ccc3](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f30ccc3f0f0f6f9215b5038df99f05e538ff530e))
* feat(update): 更新页 Bot 工具条与版本历史面板 ([2a80227](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2a8022755af1155a50dc90d72f44aa771736be7b))
* feat(instances): 工具条增加连接状态筛选 ([825f386](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/825f3869f389c047c10547880c521a2cb06dc80c))

### Fixed

* fix(prefs): 默认控件圆角改为 10px ([1c21645](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1c21645822d6110ac236007f07c51f953e29b2ef))
* fix(logs): 日志改文档流布局并缩短 scope 徽章 ([511cee0](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/511cee0415ddcf94cedf550387e8d288107ba41d))
* fix(prefs): 侧栏选中圆角跟随控件半径并去掉加粗 ([e516cd4](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e516cd4911d00aeabab98c7750da8711d713a26e))
* fix(ui): 刷新/商店/编配图标与账号选择器展示 ([c5ef118](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c5ef1187958ccbd56f405b2196fc9ae64e7d52a2))
* fix(ui): 开关统一走 console-bool-switch ([4dea86a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/4dea86a1b06634532c2504b0e2b804debc6da0e8))
* fix(ui): asChild 时避免 Slot 收到 null 图标子节点 ([76e988e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/76e988e558aab94a0a59f8cca9202d1e1df4af73))
* fix(prefs): 分段与控件圆角跟随 --radius-control ([736c2b9](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/736c2b95c9e6b8f8d4b2a7dc6da9eb28366d48fc))
* fix(plugin-store): 避免空基线把整店标成上新绿点 ([b581367](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/b581367b7f453b09b97491b2b68f7547054195df))

**完整变更**: [`v0.8.17...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.17...HEAD)

## [0.8.17] - 2026-08-01

### 更新公告

- 需要 Bot ≥ 4.1.23；请勿只升控制台
- 媒体页「音频映射」说明改为标明：左侧是命令前缀（如「一歌」→「一歌唱歌」）

### Changed

- 音频映射副标题文案

### 提交明细

### Fixed

* fix(ai): 音频映射说明标明命令前缀用法 ([1bf8efe](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1bf8efe896b3d8426a0f99fff15498b6788f5794))
* fix(changelog): 补齐 0.8.16 更新公告 ([4108b0e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/4108b0ef38d06b5eabcffab7fe1681c383b20894))

**完整变更**: [`v0.8.16...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.16...HEAD)

## [0.8.16] - 2026-08-01

### 更新公告

- 仍需 Bot ≥ 4.1.22；请勿只升控制台
- 修正 0.8.15 变更说明重复段，并在 AGENTS 中写明须先写 `## [Unreleased]` 再发版

### Fixed

- 合并重复的 0.8.15 CHANGELOG 段

### Changed

- AGENTS：补充 Unreleased 发版与 CHANGELOG 约定

### 提交明细

### Fixed

* fix(changelog): 合并重复的 0.8.15 段并保留更新公告 ([7450a69](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/7450a6949acd5fedf3915a1dd50f0c6c7c8e3f39))

### Changed

* docs(agents): 补充 Unreleased 发版与 CHANGELOG 约定 ([034d57a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/034d57a7d0c2808c4efa71cd4cdd3bb531f6c440))

**完整变更**: [`v0.8.15...v0.8.16`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.15...v0.8.16)

## [0.8.15] - 2026-08-01

### 更新公告

- 需要 Bot ≥ 4.1.22；请勿只升控制台
- 媒体服务进程在跑但健康异常时，可点「启动」自动修复，或「重启」强制停再起
- 启动后轮询等到健康就绪，不再只看进程是否在跑
- 插件商店支持更新/上新导航提醒；Bot QQ 可用 Combobox 选择
- 修复商店提醒圆点截断与社区店超时清点

### Added

- 插件商店更新/上新导航提醒与 Bot QQ Combobox

### Fixed

- 媒体 Runtime 不健康时的启动修复与重启入口
- 商店提醒圆点截断与社区店超时清点

### 提交明细

### Added

* feat(plugin-store): 商店更新/上新导航提醒与 Bot QQ Combobox ([ee4f131](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ee4f1310e9c36ecdc0d5072238c15f9a2a335ce8))

### Fixed

* fix(ai): 媒体服务不健康时可修复启动并支持重启 ([3dd0357](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/3dd03570ce234d9e8b25b2b53f684a9918f9e5ae))
* fix(plugin-store): 修复提醒圆点截断与社区店超时清点 ([2b2e46f](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2b2e46fa7bad7a3cfa9f25789c31b845d829ea1f))
* fix(ai): 补齐 SingSpeakers speaker_backends 类型 ([b807734](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/b80773472cf8548cfcd86f74456864fd5b3bc95e))

**完整变更**: [`v0.8.14...v0.8.15`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.14...v0.8.15)

## [0.8.14] - 2026-08-01

### 更新公告

- 需要 Bot ≥ 4.1.21；请勿只升控制台
- 媒体服务启停后自动刷新运行状态，启动中会显示「启动中」
- 唱歌音色列表可为每个音色单独指定优先推理后端（覆盖全局优先）

### Added

- 音色行可选优先 SVC 后端，并保存 `speaker_backends`

### Fixed

- 媒体 Runtime 启停后轮询刷新，避免界面仍显示已停止

### 提交明细

### Added

* feat(ai): 音色列表可指定优先推理后端 ([d643cfb](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d643cfb399d5b7a29905710e804a9c4d875f6936))

### Fixed

* fix(ai): 媒体服务启动后轮询刷新运行状态 ([97406a9](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/97406a9cd1bfca80a8e5b275a73481401dfbfb0b))
* fix(changelog): 合并重复的 0.8.13 段 ([77b9e30](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/77b9e307a929a499f9a90396640214efca4df8a0))

**完整变更**: [`v0.8.13...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.13...HEAD)

## [0.8.13] - 2026-08-01

相对 **0.8.12** 至本版的控制台更新。

### 更新公告

- 需要 Bot ≥ 4.1.18；请勿只升控制台
- 协议账号：外置连接可查看、选中与断开本机 WS；卡片展示协议与端口，完整能力仍需协议插件
- 账号 / 实例卡片：点卡片选中、点昵称编辑；显示 QQ 头像；选中仅描边不高亮底
- 状态胶囊更紧凑；运行中用强调色；弹窗内状态尺寸不变
- 加载态三态消闪；壳层预取；社区页进页更快
- 实例页批量操作迁入工具条；窄屏日志 meta 贴紧

### Added

- 外置连接断开本机 WS；协议卡协议/端口与头像
- 账号/实例卡点击选中（无勾选框）

### Fixed

- 社区页进页加速与数值级加载态
- 窄屏日志 meta 贴紧与正文换行
- 外置预览/空列表导致的控制台白屏循环更新

### Changed

- 加载态三态消闪与壳层预取
- 实例全选等批量操作迁入工具条
- 状态胶囊样式与选中描边

### 提交明细

### Added

* feat(protocol): 外置断开、实例卡选中与头像展示 ([aa8410d](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/aa8410d81e1e5c28a21102ba0060ae06ce58ab85))
* feat(webui): 加载态三态消闪与壳层预取 ([0aa2e73](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/0aa2e739e339114d6a976d43c7c277bbf5a26859))

### Fixed

* fix(console): 社区页进页加速与数值级加载态 ([26ae8d5](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/26ae8d5697a0c6fcbf6bfc68bf11611e346e5369))
* fix(logs): 窄屏日志 meta 贴紧与正文换行 ([33e25b6](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/33e25b60993b46115a03c2b5f14f31395d3f45e9))

### Changed

* refactor(instances): 全选等批量操作迁入工具条 ([3347add](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/3347add2802038acf3d6e31bfb1a098896306b7d))

**完整变更**: [`v0.8.12...v0.8.13`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.12...v0.8.13)

## [0.8.12] - 2026-07-31

相对 **0.8.11** 至本版的控制台更新。

### 更新公告

- 需要 Bot ≥ 4.1.17；请勿只升控制台
- AI 配置可看回调端口状态并一键对齐
- 更新 / 插件商店等异步任务切页后可恢复进度
- 运行日志：定宽布局、级别与 scope 着色、多行完整显示；级别筛选收进顶部筛选区
- AI 统计：Token 输入/输出双纵轴；发言感知与工具调用/会话占比；接话路径文案与 @ 对话区分更清晰
- 隐藏尚未接入的音频/视频能力勾选；音频映射分区标题与用语对齐

### Added

- 回调端口状态、一键对齐与高级表单
- 切页后恢复异步 job 进度
- 统计页发言感知 / 工具调用 / 工具会话占比
- Token 趋势双纵轴（输入左、输出右）

### Fixed

- 运行日志叠字、续行误合并、单行截断与窄屏布局
- pip 插件卡空行：副标题展示包名/模块 id

### Changed

- 接话路径与任务路由文案（现编非 @ 对话等）
- 思考强度说明与 DeepSeek 提示

### 提交明细

### Added

* feat(ai): 统计双纵轴与发言感知/工具占比 ([2ac0ca0](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2ac0ca04d89ba3f794bec83e7d58ca4893d22006))
* feat(console): 切页后恢复异步 job 进度 ([0a7a2f0](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/0a7a2f0e05f1e6d0d5f4c3a473cf35955c5336ae))
* feat(ai): 回调端口状态、一键对齐与高级表单 ([e3a2c5a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e3a2c5a92b12506665f13e9583c228378279ee4a))

### Fixed

* fix(logs): 运行日志定宽布局与级别/scope 着色 ([0c416cf](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/0c416cf88974f4ab0528d172822f4df616dac4a1))
* fix(ai): 隐藏未接入的音频与视频能力勾选 ([edfa3b5](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/edfa3b53f81de0ad464e6189401c6eef390d8090))
* fix(ai): 对齐音频映射分区标题并改用语 ([643e20c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/643e20c3ca6b8e67437867c6840dc8bf0d6c9075))

### Changed

* docs(ai): 补充思考强度中性说明与 DeepSeek 提示 ([352e8c4](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/352e8c477c8c8ac72141f58e92b949fb2febdff7))
* docs(agents): 同步面向用户用语约定 ([1d119cd](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1d119cd4ff2bdadd5621a5ac222585b4d03da0b3))

**完整变更**: [`v0.8.11...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.11...HEAD)

## [0.8.11] - 2026-07-30

相对 **0.8.10** 至本版的控制台更新。

### 更新公告

- 需要 Bot ≥ 4.1.16；请勿只升控制台
- 更新页统一 WebUI / Bot / 插件自动更新；进度走任务流；汇报用牛可任选在线账号
- 媒体页可更新 Runtime；安装主按钮按状态切换；有更新才出更新按钮
- TTS 页可配中翻日
- 记忆页可配 Embedding 提供方与线路（仅远程时显示网关）；探测状态更清晰
- 接话 / 媒体分区下拉有轻分组；插件配置保存失败只 toast，不再顶部重复报错

### Added

- 统一自动更新面板（WebUI / Bot / 插件）与汇报用牛账号选择器
- 记忆页 Embedding 提供方状态、诊断提示与 Provider 网关
- TTS 中翻日配置；媒体连接页更新 Runtime

### Fixed

- 自动更新走 job 进度；补汇报类型字段样式
- Embedding 仅远程显示线路；网关添加/编辑按钮对齐
- 插件配置保存失败只 toast，去掉弹窗顶部重复报错

### Changed

- 媒体页文案去黑话；安装主按钮按状态收敛；按 `has_update` 显隐更新按钮
- 接话 / 媒体分区下拉轻分组；精简配置段声明

### 提交明细

### Added

* feat(ai): 记忆页 Embedding 接入 Provider 网关面板 ([e9a60e7](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e9a60e7b4aeb1bbc87158023ff0c7d311f4dff28))
* feat(ai): 记忆页 Embedding 提供方状态与配置 ([8d9e856](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/8d9e8563e460804b67e04866c8228e4ff3cb088a))
* feat(ai): Runtime 安装按 has_update 显隐更新按钮 ([10e66da](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/10e66da2be71ede4b657a44b427223d6b9a52fd9))
* feat(update): 汇报用牛改用账号选择器，支持任选在线 ([ef342cf](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ef342cf4aa92455f11461554d4a982826e0c305d))
* feat(ai): TTS 页增加中翻日配置 ([c68fdb1](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c68fdb1a0d3041e0fe5e602a1d8134557601ff0e))
* feat(ai): 收敛媒体服务安装主按钮 ([ae17979](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ae17979d37345b915012dc9a5a0a3be907cb38bc))
* feat(ai): 媒体页文案去黑话并精简插件嵌入 ([b2df2c3](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/b2df2c3a8fccd91af9f5e4bd1bdbb9f7b1e4f508))
* feat(update): 统一自动更新面板（WebUI/Bot/插件） ([66de14e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/66de14ee7f042c71f5676c27478c8a39c8d08de0))
* feat(ai): 媒体连接页支持更新 Runtime ([3b96a9e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/3b96a9e115ad0ac6149dbd8c662e20bf43850a6e))

### Fixed

* fix(ai): Embedding 仅远程显示线路；网关添加/编辑按钮对齐 ([16252a8](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/16252a8df294ecb4d1ddaf652e0895be2fe38f54))
* fix(plugins): 配置保存失败只 toast，去掉弹窗顶部重复报错 ([3dcc60d](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/3dcc60d3e5b49ae1951cc913b9e167a888fbbb96))
* fix(ai): Embedding 记忆页展示端点字段与诊断提示 ([d77934f](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d77934f32c8db447983cbede40cac75fc18b98e3))
* fix(update): 补自动更新汇报类型并统一汇报用牛字段样式 ([c200313](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c200313a4676b40a651de1a4fc9905f3ca685111))
* fix(update): 自动更新走 job 进度，面板移到 Bot 下方 ([dfee93e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/dfee93e75b974af3a061646a42e5b0a289e89f48))

### Changed

* refactor(ai): 接话/媒体分区下拉分组，精简配置段声明 ([43c18b9](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/43c18b9271e06566d513043627b18825bf8fc125))
* chore(api): 同步 Embedding 诊断 OpenAPI 类型 ([34ee9dd](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/34ee9ddeeec3b0cdb1d588d7fb270dd59851a116))

**完整变更**: [`v0.8.10...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.10...HEAD)

## [0.8.10] - 2026-07-29

相对 **0.8.9** 至本版的控制台更新。

### 更新公告

- 需要 Bot ≥ 4.1.15；请勿只升控制台
- 媒体页说明收到标题旁问号弹层，长文不再常驻虚线框；弹层正文不再被圆角裁切
- 媒体资产下载可看进度条与任务日志（需配套较新的 Pallas-Bot-AI）
- 控制台登录改称「密钥」；插件触发统一称「命令」
- 插件列表在收藏之后固定「牛牛核心」靠前

### Added

- 媒体资产下载进度条（`AiJobProgressBlock`）

### Fixed

- 配置说明弹层圆角裁字
- 媒体说明收纳与 TTS 提示文案精简

### Changed

- 登录相关文案：口令 → 密钥；插件触发：口令 → 命令
- 插件目录排序：收藏后优先 `pb_core`

### 提交明细

### Added

* feat(ai): 媒体资产下载显示进度条 ([04bbfe0](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/04bbfe085cf6b806a11c7d81f097b0f375c9fd3e))

### Fixed

* fix(plugins): 插件列表在收藏后固定牛牛核心靠前 ([fd75f7e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/fd75f7ee09b09a802bd9a9c163339b4283de0a22))
* fix(ai): 媒体说明收进标题旁问号并修弹层圆角裁字 ([164b2de](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/164b2defc8b81cfb55630b71fbfb2522c76e1ce8))

### Changed

* chore(ui): 控制台登录改称密钥，插件触发改称命令 ([e6004c0](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e6004c0c33c9391c1a5e09e6b5e05da77d82ee8f))

**完整变更**: [`v0.8.9...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.9...HEAD)

## [0.8.9] - 2026-07-29

### Added

* feat(ai): 媒体服务安装进度面板 ([fe0311a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/fe0311abe952091c5e9b000a66e1d3ae326aade1))

### Fixed

* fix(ai): 任务编排模型列表按提供方收窄 ([9cbb1c1](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9cbb1c1bb9d19e5d332318a17172b904e52e6edb))
* fix(ai): 媒体资产等面板待 Runtime 健康后再请求 ([7112de5](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/7112de527e4db804c15fc28950055083a3aef90c))
* fix(ui): 拉开更新进度条与完成后文案间距 ([8a4f563](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/8a4f56394526229b6a9dddb52f7b850d93a86ba5))

**完整变更**: [`v0.8.8...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.8...HEAD)

## [0.8.9] - 2026-07-29

相对 **0.8.8** 至本版的控制台更新。

### 更新公告

- 需要 Bot ≥ 4.1.14；请勿只升控制台
- AI 媒体服务支持安装进度面板（克隆 / 引导安装可看日志流）
- 媒体资产等面板会等 Runtime 健康后再请求，减少空报错
- 任务编排模型列表按当前提供方收窄
- 更新进度条与完成后文案间距略拉开

### Added

- 媒体服务安装进度面板

### Fixed

- Runtime 未就绪时不抢先拉媒体资产
- 任务编排模型列表按提供方过滤
- 更新进度条文案间距

### 提交明细

### Added

* feat(ai): 媒体服务安装进度面板 ([fe0311a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/fe0311a))

### Fixed

* fix(ai): 任务编排模型列表按提供方收窄 ([9cbb1c1](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9cbb1c1))
* fix(ai): 媒体资产等面板待 Runtime 健康后再请求 ([7112de5](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/7112de5))
* fix(ui): 拉开更新进度条与完成后文案间距 ([8a4f563](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/8a4f563))

**完整变更**: [`v0.8.8...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.8...HEAD)

## [0.8.8] - 2026-07-29

### Added

* feat(console): 危险操作统一二次确认弹窗 ([00a7035](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/00a7035632c6dbfe173a6d3224764b6575dda954))

### Fixed

* fix(community): 多机协同入池文案支持自动写入密钥 ([5f83392](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/5f83392e8857601da948d6b5be5a85665b735070))

**完整变更**: [`v0.8.7...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.7...HEAD)

## [0.8.8] - 2026-07-29

相对 **0.8.7** 至本版的控制台更新。

### 更新公告

- 需要 Bot ≥ 4.1.13；请勿只升控制台
- 危险操作统一二次确认弹窗；窄屏下保留外边距，避免贴边
- 社区页多机协同入池说明对齐自动写入密钥

### Added

- 统一确认弹窗与相关 hooks

### Fixed

- 窄屏确认弹窗边距
- 多机协同入池文案（可自动写入密钥）

### 提交明细

### Added

* feat(console): 危险操作统一二次确认弹窗 ([00a7035](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/00a7035))

### Fixed

* fix(community): 多机协同入池文案支持自动写入密钥 ([5f83392](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/5f83392))

**完整变更**: [`v0.8.7...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.7...HEAD)

## [0.8.7] - 2026-07-28

相对 **0.8.6** 至本版的控制台更新。

### 更新公告

- 需要 Bot ≥ 4.1.12；请勿只升控制台
- 对话配置 → 工具：可增删 MCP 服务器（stdio / HTTP、工具白名单、HTTP 允许前缀）
- 保存后刷新工具目录；注册失败与常驻连接状态可在页上看到

### Added

- 工具页 MCP 服务器配置卡片

### Changed

- MCP 状态摘要展示常驻连接数

### 提交明细

### Added

* feat(ai): MCP 状态展示常驻连接数 ([a7cc24c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a7cc24c4eb089aafa087aa81b447f46daa7b8666))
* feat(ai): 对话工具页增加 MCP 服务器配置入口 ([92a99f3](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/92a99f35146db2f80c3ac235f629d3e26ffce468))

**完整变更**: [`v0.8.6...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.6...HEAD)

## [0.8.6] - 2026-07-28

相对 **0.8.5** 至本版的控制台更新。

### 更新公告

- 需要 Bot ≥ 4.1.11；请勿只升控制台
- 运行日志默认更安静（info+）；级别改为色点；行首时间只显示时分秒
- 范围改为「消息 / 控制台 / 其它」；按 worker 筛选更准；实时状态不再乱闪
- 虚拟列表支持可变行高与换行；可导出当前视图
- LLM 连通测试：flush 密钥、跳过已禁用提供方；草稿可测并展示错误详情

### Added

- 运行日志导出当前视图
- 虚拟列表 react-virtual 可变行高

### Fixed

- 切换分片来源时清空实时缓冲，避免串台与闪烁
- SSE 批刷降低重绘抖动；git-mirror 改写 Bot remote 只调 apply-bot

### Changed

- 日志范围：消息 / 控制台 / 其它（对齐 Bot facet）
- 默认启用级别改为 info+（v2 存储键）
- 级别标签收成色点；行首时间仅时分秒

### 提交明细

### Added

* feat(logs): 范围改为消息/控制台/其它并稳住实时流 ([e7d8bd6](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e7d8bd6630357510030805a44a4f27582555670d))
* feat(logs): 级别标签收成色点 ([91b9baf](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/91b9baf6bc3cb0487b51316f3168025b49da7238))
* feat(logs): 虚拟列表改用 react-virtual 可变行高 ([186d662](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/186d662f25ade6065f410fe307656875f8511f26))
* feat(logs): 运行日志页支持导出当前视图 ([23ff565](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/23ff5652f9505346c2e940943dc51ad12caa9e2a))

### Fixed

* fix(logs): 行首仅时分秒，并按来源键过滤条目 ([349a206](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/349a206dd3e86a18bbbfd4da8620edefe15ff65c))
* fix(logs): 默认级别改为 info+（v2 存储键） ([7945564](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/7945564b0e93868c1a7727d7d05359893e6eb886))
* fix(llm): 连通测试 flush 密钥并跳过已禁用提供方 ([23e3aef](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/23e3aef34e5307e2177fa00bea4bb3c5506e4769))
* fix(llm): 草稿可测连通并原样展示提供方错误 ([5461606](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/546160650253c97432c748daf3b43f04d0a85215))
* fix(logs): 日志流行内取消 scope 定宽空隙 ([c154e21](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c154e21b56d563dc91c8d0689911b44f0f384ba7))
* fix(git-mirror): 改写 Bot remote 改为只调 apply-bot ([8eca3b0](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/8eca3b027fd3f9ea4627b3fa38a3903a6c3b0e73))

### Changed

* perf(logs): 运行日志 SSE 约 90ms 批刷 ([a111251](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a1112510b0289e9398c6d6220e622b137204e354))

**完整变更**: [`v0.8.5...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.5...HEAD)

## [0.8.5] - 2026-07-27

相对 **0.8.4** 至本版的控制台更新。

### 更新公告

- 需要 Bot ≥ 4.1.10；请勿只升控制台
- 协议账号：卡片操作与电源开关更顺手；停 QQ 后状态与后端一致
- SnowLuma Runtime：配置进对话框；成员可单独启停 QQ；多选与工具条整理
- 实例页协议账号改为卡片视图；偏好磁贴与窄屏侧栏等小修正
- 提供方网关模型选择改用统一 Combobox

### Added

- Protocol Runtime 配置对话框；成员单独启停 QQ
- SnowLuma Runtime 删除与多选清理

### Fixed

- 协议账号启停后状态与 `process_running` 对齐，避免骨架整页闪白
- Runtime 多选框与已连接账号样式；多选操作迁入页面工具条

### Changed

- 协议账号 / 实例页改为卡片视图
- 提供方网关模型选择改用 AiModelSelect

---

### 提交明细

### Added

* feat(protocol): Runtime 配置对话框与账号卡片启停体验 ([d492e8c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d492e8ce71ac6bfaf31dc177525f2e6cf9e4e266))
* feat(protocol): Runtime 卡片悬停文案与成员启停 QQ ([6faac34](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/6faac348eb84bd0fad1751641deca77c001ad72a))
* feat(protocol): SnowLuma Runtime 支持删除与多选清理 ([5b0f372](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/5b0f37254359a51d18eb1eea8f5d33b0af14ecf8))

### Fixed

* fix(protocol): Runtime 多选框与已连接账号样式对齐 ([f12fbf7](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f12fbf7dcd3b2ed3ad8d3068b35cf40480749e55))
* fix(protocol): Runtime 多选操作迁入页面工具条 ([4853a4e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/4853a4eb2f5319211434279f777625b9707e4b29))
* fix(provider): 网关模型选择改用 AiModelSelect ([a8d647c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a8d647c8fe28875c7a39610cb8b196a318086e38))

**完整变更**: [`v0.8.4...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.4...HEAD)

## [0.8.4] - 2026-07-27

相对 **0.8.3** 至本版的控制台更新。

### 更新公告

- **需要 Bot ≥ 4.1.10**；插件商店进度、观测统计等依赖新后端，请勿只升控制台
- 插件商店：安装 / 更新 / 卸载可在卡片内看进度与百分比，不再干等无反馈
- AI 观测：费用分区与区间明细、调用/用量分布图、日期筛选与补零趋势更完整
- 操作成功/失败改为右上角 toast，少占版面
- 首页延后拉更新检查、资源轮询更省；路由按需加载，首屏更轻
- 协议：Runtime 面板与 SnowLuma 选择更好用；好友群配置页整理
- 偏好可一键复原单项；部分文案「反哺」改为「纠错」
- 社区页窄屏 KPI 布局修正；README 代码复制按钮更稳

### Added

- 插件商店异步装更卸与卡片进度条
- AI 观测：费用分区、分布图、日期筛选与补零趋势
- 偏好项复原；协议 SnowLuma Runtime 选择增强

### Fixed

- 社区页窄屏 KPI 布局
- README 代码块复制按钮状态

### Changed

- 多页操作反馈改为 toast；「反哺」文案改为「纠错」
- 路由懒加载与样式按需引入；hub 主题与进度条布局

---

### 提交明细

### Added

* feat(prefs): 偏好项复原与阴影默认值 ([f6d5e8b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f6d5e8b9055c2b8a96fde9e742558cd243ea9077))
* feat(plugin-store): 异步装更卸与卡片进度 ([c68cafb](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c68cafbba3e196eee306726f37374b03fc4700c0))
* feat(protocol): Runtime 面板与 SnowLuma 选择 ([df7ad4d](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/df7ad4d93d62e037a486408aba894dcfe13ac2c0))
* feat(ai-stats): 分布图与日期筛选 ([9e0fc69](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9e0fc697150969f0b51b124209a8f1d4de7a729b))
* feat(ai-stats): 补零趋势、提供方堆叠与日历禁空日 ([cfc99fd](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/cfc99fd20b8fbf42736421ddc579504451ce4bb1))
* feat(ai-stats): 费用分区与区间费用明细 ([a7b892b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a7b892bbf82f9734973a9514c8d282e1aedf4d9e))

### Fixed

* fix(readme): 稳定代码块复制按钮状态 ([79ab695](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/79ab695ff59375ceba529f027b42392e591c2a66))
* fix(community): 窄屏 KPI 左对齐并用 Lucide 图标 ([773c283](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/773c28334711ec8aaab51e6979c4b0d750573a31))
* fix(ai-stats): 百万级紧凑数字用两位小数 ([a09e265](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a09e265c75367f7246b2ff575ae90b76c5d05ab4))
* fix(ai-stats): 提供方调用按日期区间聚合 ([3f9a494](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/3f9a4947906dcec4fdf612452515c0cb0f91e670))

### Changed

* perf(shell): 路由懒加载与样式按需引入 ([61d8bac](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/61d8bac7f684a6abbb3b93cdd3ae067b4b848187))
* perf(home): 延后更新检查并拉长资源轮询 ([6cbb0c4](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/6cbb0c4dcff15a4f993a840e4f4752612647463f))
* refactor(social): 整理好友群配置页 ([ae8d15b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ae8d15bfd0e8cb49f55134aaf5f7b3b5606de287))
* refactor(ui): 操作反馈改用 toast ([9919b16](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9919b16513d27b533438c4345987fa230228b5b9))
* style(ui): 行高、主按钮与迁移提示 ([1b6048d](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1b6048ddc88ded777ee3bf05f6b4f05e6afdc036))
* chore(copy): 「反哺」改为「纠错」并收紧观测文案 ([30f542d](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/30f542d4d9beed6bf7984b8ed954ea1e2eab9539))
* style(console): hub 主题与商店进度条同行百分比 ([af2fb96](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/af2fb9606db181619e870a5a3a7a583c54e58187))

**完整变更**: [`v0.8.3...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.3...HEAD)

## [0.8.3] - 2026-07-27

相对 **0.8.2** 至本版的控制台更新。

### 更新公告

媒体服务「测试连通」不再误报不可达；任务编排改高低档会同步全任务列表；提供方 API 密钥芯片可拖拽排序并标主用。

### Added

- API 密钥 TagsInput 支持拖拽改序，第一位显示「主用」

### Fixed

- 媒体服务测通结果字段与控制台 API 对齐（`ok` / `status_code`）
- 任务编排高低档写回对应任务组，避免有全任务配置时界面不刷新

### 提交明细

### Added

* feat(ai-config): API 密钥芯片支持拖拽排序 ([e11da7a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e11da7a2ffbb4b88b995e7405752b29f921acbdb))

### Fixed

* fix(ai-config): 高低档编排同步写回全任务 ([384baa5](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/384baa59538f7ed235e178379f32a0fa048f99fb))
* fix(ai-config): 测通成功文案在无状态码时省略 HTTP 段 ([2441bba](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2441bba08ccb93073f2c73d290c268d04f785715))
* fix(types): 社区连通结果用手写契约避免 OpenAPI 退化 ([745e282](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/745e282bcb8f3d34a4289f373380b10d7a277a5f))
* fix(ai-config): 媒体服务测通按 ok 字段判定 ([9cd651f](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9cd651f171cadebea2acb1dc475c255a6c79b1d0))

### Changed

* docs(release): 补充 0.8.3 公告（密钥排序与任务编排） ([27a9e58](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/27a9e58c30df5ef2e6bab701ec5174c742071e3f))
* chore(openapi): 同步控制台类型以消除 CI drift ([0ed3ae1](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/0ed3ae1f3675f5a48dfcab56db35492dd1fb2f93))

**完整变更**: [`v0.8.2...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.2...HEAD)

## [0.8.2] - 2026-07-27

相对 **0.8.1** 至本版的控制台更新。合入 main 发版后，本说明会升为正式版本段并附提交明细。

### 更新公告

去掉已下线的「酒后对话附带语音」配置项；配置分区标题分隔线在窄屏/滚动时不再被裁切。

### Fixed

- 移除 `chat_tts_enable`（酒后附带语音）字段标签；语音请用官方扩展「牛牛说」
- 配置分区标题分隔线被裁切

### 提交明细

### Fixed

* fix(ui): 移除酒后对话附带语音配置项 ([c00e855](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c00e855fb3e873fd85e35e87cd900d2d4d2d2a26))
* fix(ui): 修复配置分区标题分隔线被裁切 ([c067c68](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c067c689965211f7cfe0d41a88335ef852935a3b))

### Changed

* docs(release): 准备 0.8.2 更新公告（Unreleased） ([c9b98d1](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c9b98d1d258079aa7f5e19708c7f03c2b13fad41))

**完整变更**: [`v0.8.1...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.1...HEAD)

## [0.8.1] - 2026-07-26

### 更新公告

CHANGELOG 弹窗更易扫读：标题层次、列表圆点与字号间距已调整；全文分节标题与 Bot 仓库对齐为 Added / Fixed / Changed。

### Fixed

- CHANGELOG / 发行说明 Markdown 列表在 Tailwind preflight 下丢失圆点

### Changed

- 更新页 CHANGELOG 弹窗正文与标题层次加大，窄屏 footer 可纵向排布
- CHANGELOG 与发版脚本分节统一为 Keep a Changelog 英文标题（Added / Fixed / Changed）

### 提交明细

### Fixed

* fix(update): CHANGELOG 弹窗更易读并统一 Added/Fixed/Changed ([e962442](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e962442e0f4df586b0488eed3c1b600635a1f439))

**完整变更**: [`v0.8.0...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.8.0...HEAD)

## [0.8.0] - 2026-07-26

相对 **0.7.12**（随 Bot **v4.1.6** 捆绑）至本版的控制台更新。

### 更新公告

本版加强人设对话治理与本轮动作决策配置，AI 字段说明面向新手重写，更新后可弹出仓库 CHANGELOG；社区投稿独立成页。

#### 你会明显感觉到

- 场景正反例、本轮回复风格变体、人设输出防火墙可用中文表单配置
- 对话策略里一键开关本轮动作决策；模型走「接入 → 任务编排 → 本轮动作决策」
- 应用更新后可弹出 CHANGELOG；偏好里可开关弹窗
- 社区投稿独立成页；挂载已有 SnowLuma Runtime 时不覆盖镜像

### Added

#### AI / 人设

- 场景正反例：新增 / 编辑 / 启停 / 删除；场景字段改为可搜索 Combobox（规范值 + 自定义）
- 本轮回复风格变体：启用、概率、风格芯片；自定义 affect 映射仍可保留
- 人设输出防火墙：中文表单（启用、严格度、策略、重述上限），不再暴露原始 JSON 键名
- 对话策略：本轮动作决策开关；发言感知配置分组（随 0.7.12 已入 main，本版一并收录说明）

#### 更新与偏好

- CHANGELOG 弹窗与更新页排版；开发 / 更新偏好合并，开发模式开关布局修正

#### 社区

- 社区投稿独立成页；去掉更新页上重复的运维面板

### Fixed

- 配置表单点开关后内容被顶出可视区
- AI 配置保存反馈改为 toast（去掉易被忽略的行内绿字）
- 恢复更新日志 OpenAPI 类型契约
- 幽灵复制按钮成功后显示同色打勾
- 协议：已有 SnowLuma Runtime 挂载时不覆盖镜像

### Changed

- AI 配置分区、任务说明与字段帮助文案整理

### 提交明细

### Added

* feat(ai-config): 人设防火墙改用中文专用表单 ([8d3e7c0](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/8d3e7c0fc419f1ec35540305dd0fee1bad388804))
* feat(persona): 场景示例改用可搜索选择框 ([4485de8](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/4485de8c3716d926d25c27daad0011a89db7f3f2))
* feat(persona): 增加场景正反例管理界面 ([67108af](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/67108af36a3aebe95cd3cb1a21a1927f0ea2908a))
* feat(ai): 配置本轮回复风格变体 ([74b35ed](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/74b35ed163c02cb3ec14bd432bc4ada08ece90ec))
* feat(ui): 社区投稿独立成页，并移除更新页重复运维面板 ([a56faf9](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a56faf95f7cc83bd196d3e409a705f15df8de9a8))
* feat(update): CHANGELOG 弹窗与更新页排版优化 ([ef50a6d](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ef50a6d6d9c2ad5aa06055294a7783cc9b6f769b))

### Fixed

* fix(ai-config): 保存反馈改为 toast ([741c5c7](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/741c5c73600b37a105cc3c6c4b08b70cbff714bc))
* fix(ai-config): 优化本轮决策与风格表单 ([a507850](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a507850ace8e4cc8b29be40fd10516f9179acf93))
* fix(persona): 补齐场景示例管理错误反馈 ([e37e33d](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e37e33d5eabd9c2de4a4a50dec7e229eb7408be6))
* fix(ui): 修复配置表单点开关后内容被顶出可视区 ([69ef95e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/69ef95ed7bf1f30b30f6d95eddc59a7f96709425))
* fix(api): 恢复更新日志类型契约 ([e2c704b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e2c704b9fec6d3bf90228dcb7548da6e517b3cd0))
* fix(prefs): 合并开发与更新偏好并修正开发模式开关布局 ([bc96469](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/bc964696724da394b7072fe5008c5ba132d52d81))
* fix(ui): 幽灵复制按钮成功后显示同色打勾 ([af14858](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/af1485862b87a2216c05818f864a66fb1c8023bb))
* fix(protocol): 挂载已有 SnowLuma Runtime 时不覆盖镜像 ([51b73c4](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/51b73c40c4282005a5c476bad33a87700c21f193))

### Changed

* docs(release): 准备 0.8.0 更新公告并支持 Unreleased 升版 ([55cfd60](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/55cfd602f2c0776a39b6c821559275775c3f850e))
* chore(ai-config): 优化配置分区与任务说明 ([877479c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/877479c8b5cef0be89e64d99063d2c09da631aae))

**完整变更**: [`v0.7.12...v0.8.0`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.12...v0.8.0)

## [0.7.12] - 2026-07-26

### Added

* feat(ai): 对话策略页暴露发言感知配置分组 ([4b81608](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/4b816081701d0aa95ce7184c7a20c74151dea528))

**完整变更**: [`v0.7.11...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.11...HEAD)

## [0.7.11] - 2026-07-26

### Added

* feat(webui): README 代码块恢复幽灵 Copy 按钮 ([8d9aed4](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/8d9aed40d49a00cb6b0f06a83f19eeea4c52ec12))
* feat(ai): 优化人物工具任务页与联网搜索配置入口 ([43a7c6a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/43a7c6ae1d0f5b6cf8556296b902968dadc36bfb))
* feat(ai): 增加人物、工具与任务观测入口 ([1b99123](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1b99123781ad2702292d2995591724237b607a40))
* feat(ai): 近 7/30 天 Token 卡展示费用 ([48b9032](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/48b9032f522d6b5dfd341bc0a6152258026cb5e7))
* feat(ai): 对话策略字段改用软召回配置标签 ([9d95a59](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9d95a59cba1a9431ae9ec0683a1c80d22dffb8ab))

### Fixed

* fix(ai): 口癖文案对齐短习惯并支持停用已启用项 ([8340281](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/83402815aa88ab8e9ea4ae0601b66307df191123))
* fix(ai): 工具可见性与联网搜索文案更易懂 ([f61d13c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f61d13c84235cd71b792cf6dc53474b51bd49b5e))
* fix(ai): 配置文案「闲聊」改为「LLM 对话」 ([78a6936](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/78a6936a34caed5e1dd410821a5cc8b3497a1873))

### Changed

* refactor(ai): 更新任务页面文案与过滤功能 ([02fc18c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/02fc18cfe3666d23ff00b5364964417b3aec42b1))
* refactor(ai): 观测工具并入配置并优化人设导出 ([d1b9b5c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d1b9b5c75b983b0a393f6fbb9c0dd67bb29ce336))

**完整变更**: [`v0.7.10...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.10...HEAD)

## [0.7.10] - 2026-07-26

### Added

* feat(protocol): NapCat Overview 展示 WebUI token 与端口 ([aeccb7a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/aeccb7a10c1e910236614fadc455a49d3b607b7d))

**完整变更**: [`v0.7.9...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.9...HEAD)

## [0.7.9] - 2026-07-26

### Added

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

### Fixed

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

### Changed

* docs(release): 重写 v0.7.8 说明（含自 v0.7.2 累计） ([65e359c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/65e359cdc6c86e002cfbbe5f0a48c299c2ce279f))

### Changed

* refactor(ui): 群/好友配置弹窗对齐 divider 与开关字段 ([b5d968a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/b5d968a8a0458f2f3adcd60b5c9b59f42fecb139))
* refactor(ui): 恢复 Git 镜像源弹窗 divider 扁分区 ([36d2203](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/36d22033e6939f2475ba839dd553f0836790e7dc))
* refactor(ui): 配置弹窗改用 divider 扁分区 ([6fe5587](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/6fe55879b35ef96ec838aa8fe03e97e6a5e64d18))
* refactor(ai): 刷新与保存回到工具条，新增提供方后整页保存 ([3aa7462](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/3aa74628116cb770ec384c43bc85d5ce100ff03b))
* refactor(protocol): 重启全部并入协议账号选项菜单 ([e3ed899](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e3ed8999a70d165b0434c99e06f3e65fd284afa9))
* refactor(chrome): 统一工具条行距与簇距约定 ([5002623](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/5002623bbc04cceb6362c2db28d707ecdf8e4e7f))

### Changed

* chore(api): 按 Bot main openspec 对齐 console 类型 ([8311381](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/8311381bc1db64b6a61512693a40f9bea0338d39))
* chore(api): 同步 console OpenAPI 类型（LLM tools preview/overrides） ([aa0059c](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/aa0059c4e31c495bfeabef282b76e19f12571b9a))
* chore(ui): 帮助图分组说明去掉技术字段名 ([ff4b1ac](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ff4b1acd97dc70931454272b128de151cd44a5f4))
* chore(ui): 帮助分组与协议 WebUI 文案微调 ([758a773](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/758a77375ce5821954bf7cbcf16278a1cdc3caa0))
* chore(ci): main 直推不再触发 Release 发版 ([d6aa069](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d6aa069671c095e86788c0d21682fe2f58f6439a))

**完整变更**: [`v0.7.8...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.8...HEAD)

## [0.7.8] - 2026-07-25

相对 **0.7.2**（Bot **v4.1.1** 捆绑）至本版的累计说明；中间 0.7.3～0.7.7 的逐条提交见下文各节。

### 更新公告

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

### Changed

* chore(api): 同步控制台 OpenAPI 类型 ([70f75f5](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/70f75f5d5bfc2b722a7893adc344de842da97b8f))

**完整变更**: [`v0.7.6...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.6...HEAD)

## [0.7.6] - 2026-07-25

### Added

* feat(provider): 通用主备 Provider 线路面板 ([a13f736](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a13f7361445eb300efe18a94d63c425af6bf7f00))
* feat(help): 插件配置帮助图分组与芯片 portal 滚动 ([0abc877](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/0abc877ca2086979cbff8af30099ef49b556cddc))
* feat(community): 投稿可不选 Bot，支持粘贴截图 ([2362613](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2362613721eb21132c0ac1fd6a394c3a4c00a0e6))
* feat(charts): 数据看板插件筛选与 AI 统计展示优化 ([7331050](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/7331050954a614678902824af3d1a7ec4aad9a6d))
* feat(community): 社区投稿面板，并统一 Bot Select 展示 ([c6e2349](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c6e23499c8c780de57f09d02f9e06b1d52f5dece))
* feat(ai): 任务编排支持高低档/全任务切换且全任务优先 ([6d5ab1e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/6d5ab1e3bb972ffb28f172a8f66ac386913e608b))
* feat(ai-stats): 统计页增加趋势图与记忆/门控面板 ([dacd4ad](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/dacd4ad6e07187bf8fbdfd44c3871bfc64d807d1))

### Changed

* refactor(community): 投稿页迁 shadcn Card，无 Bot 截图用瓦片展示 ([2b4dafa](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2b4dafa31d8236ba0c97df8eed9e825f3ace0073))

**完整变更**: [`v0.7.5...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.5...HEAD)

## [0.7.5] - 2026-07-24

### Fixed

* fix(console): 看板中文名与布局，页头版本与主题修正 ([c388077](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c388077b9b2ee076e3f06e5fd7101c4b8d6952f0))
* fix(console): 看板中文名与布局，移除流量编排并修正页头版本展示 ([e0c8b66](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e0c8b6659ddba8d70bee6e67c6863b87c5ef7711))
* fix(ui): Git 镜像源弹窗窄屏留 16px 呼吸距 ([5f1983f](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/5f1983fb2d075d695884e2762433f31456add87d))

**完整变更**: [`v0.7.4...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.4...HEAD)

## [0.7.4] - 2026-07-24

### Fixed

* fix(build): 恢复 Tailwind content glob（注释清洗误删 /**/） ([a0af0fa](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a0af0fa9bd1fe294a0fa24254182a5f62680c175))

**完整变更**: [`v0.7.3...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.3...HEAD)

## [0.7.3] - 2026-07-24

### Fixed

* fix(styles): 修复分区注释被提前闭合导致样式失效 ([2a2965e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2a2965ea6ab1f7edc66de3228af53d750cdf016b))

**完整变更**: [`v0.7.2...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.2...HEAD)

## [0.7.2] - 2026-07-24

### Changed

* chore(openapi): 同步 Bot 控制台 OpenAPI 类型 ([e51315e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/e51315e00053490e6a879b0acbd218249ce7b778))

**完整变更**: [`v0.7.1...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.1...HEAD)

## [0.7.1] - 2026-07-24

### Changed

* docs: 精简 ui-conventions 表述 ([9432229](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9432229b49eeb2d3c2ef9deec4919fb0a6e5dbcb))

**完整变更**: [`v0.7.0...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.7.0...HEAD)

## [0.7.0] - 2026-07-24

### Added

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

### Fixed

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

### Changed

* refactor(react): 壳层导航与 Tailwind 主题桥接 ([0115c2b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/0115c2b95f090766d2049b29037ec092ca53c119))
* refactor(react): 弹窗与共享组件对齐 shadcn Dialog/Select ([f0e5c1d](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f0e5c1d74fab31a4447b5c6b0d355d16e282ee04))
* refactor(ai): align template indentation and improve readability in AiHistoryPage.vue ([96a1dbe](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/96a1dbe07dfd0c430776cbee9093a3acab96c01b))

### Changed

* chore(repo): React 提升为仓库根并更新发版 CI ([f82d789](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f82d789defffad752c90061f4cf8477db108c64c))
* style(react): 同步 hub/token 与页面密度样式 ([1cb4fa2](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1cb4fa2983839094581ed65b111c8cf429c2ef0e))
* chore: 忽略本地 agent 与 worktree 目录 ([c425843](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c425843622dd88f262941a40863e3399d890d0cc))

**完整变更**: [`v0.6.51...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.51...HEAD)

## [0.6.51] - 2026-07-22

### Added

* feat(protocol): 增加账号运行时切换设置 ([a682490](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a6824907a3d761ce418b4459148a9ccfac287d8e))

### Fixed

* fix(protocol): 修复控制台接口基址 ([baeebb3](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/baeebb351286b81d6c2f2d4157e7c1922ca35bb7))

### Changed

* chore(worktree): 忽略本地工作树 ([865a348](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/865a34811b11c20d02f6c853677d11ccf36eea47))

**完整变更**: [`v0.6.50...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.50...HEAD)

## [0.6.50] - 2026-07-22

### Fixed

* fix(ai-config): 修复响应式分区与模型操作布局 ([08b7be8](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/08b7be8d0fbcf1674e63fa415174321141a893da))
* fix(home): 恢复 KPI 右侧入口宽度 ([2a81fae](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2a81fae6e164821a2d460d7e018952e375f8642e))
* fix(home): 保持 KPI 右侧入口同行 ([264fcf0](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/264fcf09e74919e5cb6c9ec90da8180ee2b05ff0))
* fix(webui): 修复控制台布局与构建版本标识 ([437b088](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/437b088fb282cab2737f489ffb0e3b324f398f5f))

**完整变更**: [`v0.6.49...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.49...HEAD)

## [0.6.49] - 2026-07-22

### Fixed

* fix(webui): 优化 AI 配置窄屏布局 ([647161a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/647161ae689c92e3e3dc11adbd0ca73df6df8952))

**完整变更**: [`v0.6.48...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.48...HEAD)

## [0.6.48] - 2026-07-22

### Added

* feat(ai): 配置页搜索、专家模式切换与模型管理紧凑操作 ([cac5039](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/cac50399a724c02e4ec107048ecd0d369bd2ec2d))
* feat(ai): AI 首页卡片顺序与显隐偏好 ([02ce58f](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/02ce58f11811073a82728e5bd706613f6d1ed284))
* feat(ai): 拆分历史会话工作区并按 workspace 同步路由 ([7fe6466](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/7fe64669d483336c2cb712fef504c89d5e058803))
* feat(ai): 侧栏按 AI 可达性收成 essentials 导航 ([2053028](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/20530282dd1471130453b5abe3d7aadd1cf61d03))
* feat(protocol): 协议账号日志按二维码行分段渲染 ([c7b9e51](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c7b9e5105cd40b5761e0eaea5f08aec8d4fe1704))
* feat(protocol): SnowLuma Runtime 管理与创建流 ([d3ee813](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d3ee8130346ae7956a6365d7be3728b71e46fbb8))

### Fixed

* fix(ai): AI 体检向导接入 PagePinned 钉顶布局 ([bc3b7e6](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/bc3b7e62c6ad208e24c78f65da36dc29a8764ffc))
* fix(ui): 插件商店非本地分区隐藏空工具条 actions ([956d99d](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/956d99d25f395efccf9b9b5ec3d27ed8688ab4a4))
* fix(ui): 运行日志搜索筛选同行并移除刷新按钮 ([4598890](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/459889061e1a22715fbdda468556ac12076f090a))
* fix(ui): 实例与协议面板标题栏统计位与搜索全宽 ([ef44ece](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ef44ecea33dadb0e15aa3d24f59bdd3d0480a495))
* fix(ui): Hub 工具条窄屏保持单行并截断来源 select ([c12ab38](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c12ab38bddf5bc4dc3652650cbb94d96583ffd99))
* fix(ui): Safari 日期控件与统计筛选窄屏布局 ([50a26ce](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/50a26cea8d78d598efaee3ac74572fc95971e28c))

### Changed

* style(ui): 侧栏滚动条默认隐藏、悬停显现 ([89d6e29](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/89d6e293ba6715e1f58f7353c7bf950cbb02a6ca))

**完整变更**: [`v0.6.47...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.47...HEAD)

## [0.6.47] - 2026-07-21

### Fixed

* fix(ui): 高流量页与 AiHistory 双栏窄屏收口 ([fa4aa26](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/fa4aa26e2a9853f67881cbbb67729d172bfa0afc))

### Changed

* refactor(ui): 外迁 AiHistory 页面共享样式到 ai-history.css ([9ab8baa](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9ab8baa5b3667f352df930eef6b03de1faac55f2))
* refactor(ui): 拆分 AiHistory 判定轨迹与孤立行为块 ([882516a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/882516acb6bbb035022514699623d9392ad2195a))

**完整变更**: [`v0.6.46...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.46...HEAD)

## [0.6.46] - 2026-07-21

### Added

* feat(ui): AiHistory 会话区 PageFill 与列表密度收口 ([ba719fa](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ba719fac53d01a9f299f1492f83d0842a905b741))

### Fixed

* fix(ui): AiHistory 抽离组件后恢复共享样式 ([2c420f8](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2c420f857b5a70116cb4d77429556c0ce7da8593))

### Changed

* refactor(ui): 拆分 AiHistory 回合维护体与牛格观测面板 ([2a78eb3](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2a78eb3a84a5244fdc6f229a6ba412a07bfe90a2))
* refactor(ui): 拆分 AiHistory 规则编辑与重放弹窗 ([80e8686](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/80e86868b25ed18576b484b85f8241f7d59313ef))
* refactor(ui): 拆分 AiHistory 维护区业务面板 ([8c8f265](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/8c8f2654d5840b71b4ee9fa75a623670434c74ad))
* refactor(ui): 拆分 AiHistory 塑形与高级调试块 ([1369de4](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1369de4caef964559f53624e7766208cf7797a46))
* refactor(ui): 拆分 AiHistory 回合线程与行为标注控件 ([4ae6c93](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/4ae6c93645bed3cc3b5c26a224ac3a8ebb40cde8))
* refactor(ui): 拆分 AiHistory 维护/规则/记忆工作区壳 ([1c91ced](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1c91cedd729769f2355e269a219ab8367d3e4681))
* refactor(ui): 拆分 AiHistory 工作区 chrome 与会话双栏壳 ([476f36e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/476f36e03c451dae5d1d22d0cf51e282ddbec03c))

**完整变更**: [`v0.6.45...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.45...HEAD)

## [0.6.45] - 2026-07-21

### Added

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

### Fixed

* fix(ui): 配置项帮助按钮贴齐字段标题 ([487fdce](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/487fdce1748f158376215b1fdb6ae3461566258a))
* fix(ui): 修复数据库页 KPI 条被异常撑高 ([070c8a8](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/070c8a85c9e31e225be30de8cbbbf64412135239))

### Changed

* chore(openapi): 同步 Bot LLM Provider 模型发现接口类型 ([9808a0a](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9808a0a06d9916d41d085e3761edb94b6344f9f4))

**完整变更**: [`v0.6.44...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.44...HEAD)

## [0.6.44] - 2026-07-21

### Added

* feat(ui): 协议与商店等残留控件接入 Ui* ([c8d4e5b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/c8d4e5b591db8080e34a99f130ac7a96f51e0007))
* feat(ui): 圆角滑块并联动控件半径 ([4c47b87](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/4c47b871eb41e872d4b4cb8077e34ea24bfc87a7))
* feat(ui): 全局按钮去胶囊化 ([ad5d698](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ad5d6983186706ffa43cf17473f9d59b2a99f353))
* feat(ui): 按钮去胶囊化并清爽 Git 镜像源弹窗 ([85dcdbe](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/85dcdbe6a8191f3835014e8b132a496a42e5bbb5))
* feat(ui): AI History/Statistics 筛选接入 Ui* ([18de9f9](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/18de9f9106b3eb7845a2f513b7474cea014c82cd))
* feat(ui): 侧栏字重收口并扩展 Ui* 接入 ([a0611d6](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a0611d66f83f498e207b6cdc9782bb20be55b4d0))
* feat(ui): 列表筛选与 Hub 搜索接入 Ui* ([39321c3](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/39321c3d870d3b1fe37d04159346f1eb02a10ff5))
* feat(ui): 扩展 Ui* 原语并接入配置表单 ([a419149](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a419149f84ce69c431f804f7db139826ec29628e))
* feat(ui): 配置表单与表面系统清爽化 ([8af57ca](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/8af57cae565898bdacbade80b2d24db52de8884b))

### Fixed

* fix(charts): 移除总看板 AI 专项跳转块 ([9853639](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/9853639877f7c133546232be81382d1a2501205d))
* fix(ui): 协议账号操作栏搜索与按钮对齐 ([6a5e229](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/6a5e229a7a632e0d369f06329b2d4a3c6ba01f0e))
* fix(ui): 合并配置字段帮助按钮样式规则 ([2051fe0](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2051fe0c62a0374608fe6a3ccb8de5fdacedbf0e))
* fix(ui): 配置网格长标签截断防叠字 ([bc7fffa](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/bc7fffa585ce1d959e65e31efba49c6dc02764c1))
* fix(ai-config): 刷新模型不经 AI，并解除须先选模型的死锁 ([5358ec5](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/5358ec5c6b4f398744278e95d392284f1851d262))
* fix(webui): 首页与日志体验收口，更新说明支持表格与复制 ([bb08940](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/bb08940d97622c1e81511ce78f15c96aa80a780e))

**完整变更**: [`v0.6.43...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.43...HEAD)

## [0.6.43] - 2026-07-21

### Fixed

* fix(webui): 集中嵌入式刷新与窄屏标题栏样式 ([f4a4dfe](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f4a4dfee91c35fd3668a3142e0a34a296d33dd62))
* fix(webui): AI 历史「去验证」切换会话工作区并监听 query ([eef1a41](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/eef1a41c4ee1143a16cfa23cff85b357d8f5e2cf))
* fix(webui): 图表与 AI 统计日期工具栏去掉月份仅保留起止 ([212211e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/212211e5de357c952eda15d43f4a2aa9a2734aeb))
* fix(webui): AI 配置窄屏标题栏与嵌入面板扁平化 ([2b7dc34](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2b7dc3497121bf5d9f11644a4245dafb0fa5ab25))

### Changed

* refactor(webui): 抽出 PanelHdCollapseCaret 并迁移面板展开收起 ([f237e76](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/f237e76a3a14252fe51094b8f014b21d1471bc63))

### Changed

* style(webui): 好友申请 container query、prefs 单行与其它窄屏样式 ([df9c47b](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/df9c47bee4bd6874f1ba6d6d5475babb3186e977))
* style(webui): RefreshIconButton 默认 embedded 并统一标题旁刷新样式 ([22cd181](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/22cd181665effd593a9490fb45da5e208b149c93))
* chore: 预提交同步控制台 OpenAPI 类型 ([2a77c70](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2a77c70508255a8578396335486371961e026b73))

**完整变更**: [`v0.6.42...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.42...HEAD)

## [0.6.42] - 2026-07-20

### Added

* feat(webui): 官方商店插件镜像可单独切换 ([6b3df2d](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/6b3df2db7639b5b7371a0ae0570ed0afc9e77642))
* feat(ai-config): 能力包媒体模型管理、LLM/媒体 IA 与控制台 UI 修复 ([79b6ccf](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/79b6ccf481b8b60d0f4cb5008afde0bd16dbdb10))

### Fixed

* fix(webui): 窄屏按钮布局、规则弹窗与画画运行态展示 ([48b4b41](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/48b4b419e79ef6d17a10d97d528ca44eaf9570d9))
* fix(ai-config): 按 review 修正镜像 scope 应用与下载轮询 ([61a6ff8](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/61a6ff883603814dd99796c737714563dcce61fe))

### Changed

* chore(openapi): 同步 Bot main 控制台 OpenAPI 类型 ([b05e856](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/b05e8564b7bb216c6c9d21474f38b185d186d87d))
* chore(openapi): 生成类型与 Bot main openspec 对齐 ([fba47c1](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/fba47c1b42b52679aea623ab5df681f76999cf30))
* chore(openapi): 同步控制台 OpenAPI 生成类型 ([acfe24f](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/acfe24f891b1e3a4af1742985d003ecfa158eeb3))

**完整变更**: [`v0.6.41...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.41...HEAD)

## [0.6.41] - 2026-07-20

### Added

* feat(ai-config): Docker 连接态与 LLM 聊天文案 ([1fdfe07](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/1fdfe070ffb997b88b82e04eb651e02aa70e9586))

### Changed

* docs(draw): 画画页强调直连网关，弱化 AI Runtime ([2b82dbb](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/2b82dbb3c899178e180f63f0c9cd6ad9fc6fd59c))

**完整变更**: [`v0.6.40...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.40...HEAD)

## [0.6.40] - 2026-07-20

### Added

* feat(ai-config): AI Runtime 托管状态与启停控件 ([5b380f2](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/5b380f2b928db5ab83a4b1e8b27cbe6e5c231e48))

### Changed

* docs(ai-config): 闲聊改为内核 Provider，弱化必须装 AI Runtime ([598e523](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/598e5239177fff83beb3bdbe69112c665661f854))

**完整变更**: [`v0.6.39...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.39...HEAD)

## [0.6.39] - 2026-07-20

### Added

* feat(webui): 更新页与插件商店接入 Git 镜像源 ([ccb4f3e](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ccb4f3ecfcf5df7c81d8a230e71c294b25ad7cb1))

### Fixed

* fix(ai): 默认 healthPaths 与 AI /health 对齐 ([d8d9781](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/d8d9781c866318c3da1a9ae4f7f7c5a453eef4f9))

### Changed

* chore(openapi): 同步 Bot main 控制台类型 ([ce1abfe](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/ce1abfef2c3da7a0e672a9d5de9c776d0a9a9622))
* chore(ci): Keep a Changelog 并去掉发版类型脚注 ([a950bbb](https://github.com/PallasBot/Pallas-Bot-WebUI/commit/a950bbb7a8587aa3899368a3236c34a84b4cb744))

**完整变更**: [`v0.6.38...HEAD`](https://github.com/PallasBot/Pallas-Bot-WebUI/compare/v0.6.38...HEAD)
