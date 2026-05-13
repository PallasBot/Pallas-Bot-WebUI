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
          meta: { title: "总览", description: "容量、接入与账号一览" },
        },
        {
          path: "logs",
          name: "logs",
          component: LogsPage,
          meta: { title: "运行日志", description: "检索与导出运行期输出" },
        },
        {
          path: "plugins",
          name: "plugins",
          component: PluginsPage,
          meta: { title: "插件", description: "已启用模块与可调参数" },
        },
        {
          path: "plugins/:name",
          name: "plugin-config",
          component: PluginConfigPage,
          meta: { title: "插件配置", description: "受控变更运行参数" },
        },
        {
          path: "common-config",
          name: "common-config",
          component: CommonConfigPage,
          meta: { title: "通用配置", description: "跨模块公共项" },
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
          meta: { title: "协议端管理", description: "协议控制台入口与策略" },
        },
        {
          path: "friends-groups",
          name: "friends-groups",
          component: FriendsGroupsPage,
          meta: { title: "好友与群", description: "列表与好友/入群审批" },
        },
        { path: "friends", redirect: "/friends-groups" },
        { path: "groups", redirect: "/friends-groups" },
        {
          path: "bot-social-config",
          name: "bot-social-config",
          component: BotSocialConfigPage,
          meta: { title: "好友与群颗粒配置", description: "按对象覆盖策略" },
        },
        {
          path: "database",
          name: "database",
          component: DatabasePage,
          meta: { title: "数据库", description: "存储规模与维护" },
        },
        {
          path: "update",
          name: "update",
          component: UpdatePage,
          meta: { title: "更新", description: "发行版与变更窗口" },
        },
        {
          path: "ai",
          name: "ai",
          component: AiExtensionPage,
          meta: { title: "AI 扩展", description: "扩展服务与运行记录" },
        },
        {
          path: "security",
          name: "security",
          component: SecurityPage,
          meta: { title: "安全", description: "控制台访问凭据" },
        },
        {
          path: "preferences",
          name: "preferences",
          component: PreferencesPage,
          meta: { title: "外观偏好", description: "本机界面呈现" },
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

export default router;
