import { createRouter, createWebHistory } from "vue-router";
import AppShell from "@/layout/AppShell.vue";
import HomePage from "@/pages/HomePage.vue";
import LogsPage from "@/pages/LogsPage.vue";
import PluginsPage from "@/pages/PluginsPage.vue";
import PluginConfigPage from "@/pages/PluginConfigPage.vue";
import CommonConfigPage from "@/pages/CommonConfigPage.vue";
import InstancesPage from "@/pages/InstancesPage.vue";
import BotSocialConfigPage from "@/pages/BotSocialConfigPage.vue";
import ProtocolManagePage from "@/pages/ProtocolManagePage.vue";
import DatabasePage from "@/pages/DatabasePage.vue";
import UpdatePage from "@/pages/UpdatePage.vue";
import AiExtensionPage from "@/pages/AiExtensionPage.vue";
import SecurityPage from "@/pages/SecurityPage.vue";
import FriendsGroupsPage from "@/pages/FriendsGroupsPage.vue";
import PreferencesPage from "@/pages/PreferencesPage.vue";
import { installRouteLoading } from "@/utils/routeLoading";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: AppShell,
      children: [
        {
          path: "",
          name: "home",
          component: HomePage,
          meta: {
            title: "仪表盘",
            description:
              "面向生产运维的一屏摘要：框架与业务进程状态、消息吞吐、已登记账号及常用接入入口。协议进程级状态请在「实例与连接」核对。",
          },
        },
        {
          path: "logs",
          name: "logs",
          component: LogsPage,
          meta: {
            title: "运行日志",
            description:
              "按时间线查看运行期输出；支持结构化条目与原始行两种视图，并可在前端按关键字过滤。",
          },
        },
        {
          path: "plugins",
          name: "plugins",
          component: PluginsPage,
          meta: {
            title: "插件目录",
            description: "在此查看已启用模块；进入单项可调整受控参数。支持在列表中展开预览配置项，无需进入详情页。",
          },
        },
        {
          path: "plugins/:name",
          name: "plugin-config",
          component: PluginConfigPage,
          meta: {
            title: "插件配置",
            description: "编辑受控运行参数；保存后由后端生效。",
          },
        },
        {
          path: "common-config",
          name: "common-config",
          component: CommonConfigPage,
          meta: {
            title: "通用配置",
            description: "分区维护跨模块公共项；保存后立即由后端生效，请以实际运行结果为准。",
          },
        },
        {
          path: "instances",
          name: "instances",
          component: InstancesPage,
          meta: { title: "实例与连接", description: "在线状态与协议快照" },
        },
        {
          path: "protocol",
          name: "protocol",
          component: ProtocolManagePage,
          meta: {
            title: "协议端管理",
            description: "打开协议内置管理页（路径取自实例快照）；用于日常运维与排障。",
          },
        },
        {
          path: "friends-groups",
          name: "friends-groups",
          component: FriendsGroupsPage,
          meta: {
            title: "好友与群",
            description: "在同一页切换账号，查看好友与群列表，并处理好友申请与入群请求；操作经后端统一鉴权与审计。",
          },
        },
        { path: "friends", redirect: "/friends-groups" },
        { path: "groups", redirect: "/friends-groups" },
        {
          path: "bot-social-config",
          name: "bot-social-config",
          component: BotSocialConfigPage,
          meta: {
            title: "好友与群颗粒配置",
            description: "按 QQ 或群号维护独立策略表，与账号级 Bot 配置分层；变更写入前请确认影响范围。",
          },
        },
        {
          path: "database",
          name: "database",
          component: DatabasePage,
          meta: {
            title: "数据库",
            description: "查看存储后端类型、集合/表体量与体量明细；Bot 与协议状态请在「实例与连接」查看。",
          },
        },
        {
          path: "update",
          name: "update",
          component: UpdatePage,
          meta: {
            title: "更新",
            description: "检查上游发行说明并在维护窗口内执行升级；具体步骤与回滚策略由运行手册规定。",
          },
        },
        {
          path: "ai",
          name: "ai",
          component: AiExtensionPage,
          meta: {
            title: "AI 扩展",
            description:
              "查看扩展服务配置与健康状态；网易云可通过扩展服务完成短信登录。运行记录由后端代理读取。",
          },
        },
        {
          path: "security",
          name: "security",
          component: SecurityPage,
          meta: {
            title: "控制台口令",
            description: "更新控制台登录口令；请在低峰期执行并同步保管凭据。",
          },
        },
        {
          path: "preferences",
          name: "preferences",
          component: PreferencesPage,
          meta: {
            title: "外观偏好",
            description: "主题、圆角与密度仅保存在本机浏览器，用于控制台呈现，不参与服务端配置。",
          },
        },
      ],
    },
  ],
});

const baseTitle = "Pallas-Bot 控制台";

router.afterEach((to) => {
  const piece = to.meta.title as string | undefined;
  document.title = piece ? `${piece} · ${baseTitle}` : baseTitle;
});

installRouteLoading(router);

export default router;
