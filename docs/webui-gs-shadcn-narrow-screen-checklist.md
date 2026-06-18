# WebUI · GS 窄屏自检清单（≤560px）

断点：`@media (max-width: 560px)`（`src/styles/app.css`）。DevTools 响应式或真机预览 **宽度 560px 及以下**。

## 通用项（每页）

- [ ] 顶栏 / 侧栏可打开，当前路由高亮正常
- [ ] 面板标题与「添加到侧栏」`+` 不重叠、不单独漂在危险按钮上方
- [ ] 标题栏 `UiButton` 未被全局规则误拉成整列全宽（批量操作区有 override 的除外）
- [ ] 主按钮可点、focus ring 可见（Tab 切换）
- [ ] 路由切换后内容区有轻过渡，无白屏卡住

## 页面清单

| 页面 | 路由 | 重点 |
| --- | --- | --- |
| 首页 | `/` | 账户信息胶囊横排；dashboard 卡片不溢出 |
| 通用配置 | `/common-config` | masthead 操作换行；配置卡片可读 |
| 实例 | `/instances` | 双行标题 grid；收藏星与操作同排 |
| 协议 | `/protocol` | 同实例；二维码弹窗 `UiDialog` 按钮可点 |
| 运行日志 | `/logs` | 视图切换按钮窄屏 override；滚动区高度正常 |
| 日志报错 | `/log-errors` | 清理按钮与搜索不重叠；卡片复制按钮可换行 |
| 插件目录 | `/plugins` | 卡片 grid；离开页后其他路由不被拉回 |
| 插件商店 | `/plugin-store` | 详情 `UiDialog` 全宽可读；footer 按钮换行 |
| 插件配置 | `/plugins/:name` | 工作区 tabs；保存栏 |
| 数据库 | `/database` | 群/好友配置折叠；添加行横排 |
| 备份清理 | `/database-backups` | 标题 `+` 与标题同行；卡片列表非错位表格 |
| 好友与群 | `/friends-groups` | 申请批量按钮均分一行；Bot 选择器 |
| 社区统计 | `/community` | 全网部署：设置按钮次行全宽；语料 grid |
| AI 扩展 | `/ai-extension` | 三面板标题栏按钮换行；NCM 表单 |
| 更新 | `/update` | release notes 换行；操作按钮 |
| 偏好与口令 | `/preferences` | 设置卡片单列；主题色 swatch 可点 |

## 偏好矩阵（与 smoke 测试联动）

在 **偏好与口令** 页或 DevTools 改 `localStorage` 后刷新，抽测以下组合（不必全跑 432 格，CI 已跑 smoke）：

| 维度 | 取值 |
| --- | --- |
| 颜色模式 | 浅色 / 深色 / 跟随系统 |
| 界面风格 | 纯色 / 毛玻璃 |
| 主题色 | 六档 accent |
| 圆角 | 紧凑 / 默认 / 更圆 |
| 密度 | 舒适 / 紧凑 |

抽测页建议：**首页**（壳层 + 卡片）、**插件商店**（interactive 卡片 + Dialog）、**协议**（表格/卡片 + Dialog）。

自动化：

```bash
cd Pallas-Bot-WebUI
npm run test:smoke
```

## 动效与无障碍

- [ ] `prefers-reduced-motion: reduce` 下 Dialog / Toast / 路由过渡不明显或已关闭
- [ ] Dialog：Esc、遮罩关闭；打开时背景不滚动

## 参考

- [webui-gs-shadcn-roadmap.md（主仓）](https://github.com/PallasBot/Pallas-Bot/blob/main/docs/architecture/webui-gs-shadcn-roadmap.md)
- WebUI `AGENTS.md` 窄屏表格
