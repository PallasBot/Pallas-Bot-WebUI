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
            description: "容量、账号与接入摘要；协议进程见「实例与连接」。",
          },
        },
        {
          path: "logs",
          name: "logs",
          component: LogsPage,
          meta: {
            title: "运行日志",
            description: "结构化或原始行视图，支持关键字过滤。",
          },
        },
        {
          path: "plugins",
          name: "plugins",
          component: PluginsPage,
          meta: {
            title: "插件目录",
            description: "已启用模块；单项可调参，列表可展开预览。",
          },
        },
        {
          path: "plugins/:name",
          name: "plugin-config",
          component: PluginConfigPage,
          meta: {
            title: "插件配置",
            description: "受控参数；保存后由后端生效。",
          },
        },
        {
          path: "common-config",
          name: "common-config",
          component: CommonConfigPage,
          meta: {
            title: "通用配置",
            description: "跨模块公共项；保存后由后端生效。",
          },
        },
        {
          path: "instances",
          name: "instances",
          component: InstancesPage,
          meta: { title: "实例与连接", description: "在线与协议快照" },
        },
        {
          path: "protocol",
          name: "protocol",
          component: ProtocolManagePage,
          meta: {
            title: "协议端管理",
            description: "协议内置页与运维入口。",
          },
        },
        {
          path: "friends-groups",
          name: "friends-groups",
          component: FriendsGroupsPage,
          meta: {
            title: "好友与群聊",
            description: "好友/群聊列表与好友、入群审批。",
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
            description: "按 QQ/群号的独立策略表。",
          },
        },
        {
          path: "database",
          name: "database",
          component: DatabasePage,
          meta: {
            title: "数据库",
            description: "存储类型与体量明细。",
          },
        },
        {
          path: "update",
          name: "update",
          component: UpdatePage,
          meta: {
            title: "更新",
            description: "发行说明与升级窗口提示。",
          },
        },
        {
          path: "ai",
          name: "ai",
          component: AiExtensionPage,
          meta: {
            title: "AI 扩展",
            description: "扩展服务配置与健康；运行记录由后端读取。",
          },
        },
        {
          path: "security",
          redirect: { name: "preferences", hash: "#console-password" },
        },
        {
          path: "preferences",
          name: "preferences",
          component: PreferencesPage,
          meta: {
            title: "偏好与口令",
            description: "主题、圆角、密度与控制台登录口令。",
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
