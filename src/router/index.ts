import { createRouter, createWebHistory } from "vue-router";
import AppShell from "@/layout/AppShell.vue";
import HomePage from "@/pages/HomePage.vue";
import LogsPage from "@/pages/LogsPage.vue";
import PluginsPage from "@/pages/PluginsPage.vue";
import PluginConfigPage from "@/pages/PluginConfigPage.vue";
import CommonConfigPage from "@/pages/CommonConfigPage.vue";
import InstancesPage from "@/pages/InstancesPage.vue";
import BotSocialConfigPage from "@/pages/BotSocialConfigPage.vue";
import DatabasePage from "@/pages/DatabasePage.vue";
import UpdatePage from "@/pages/UpdatePage.vue";
import AiExtensionPage from "@/pages/AiExtensionPage.vue";
import SecurityPage from "@/pages/SecurityPage.vue";
import FriendsPage from "@/pages/FriendsPage.vue";
import GroupsPage from "@/pages/GroupsPage.vue";
import PreferencesPage from "@/pages/PreferencesPage.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: AppShell,
      children: [
        { path: "", name: "home", component: HomePage, meta: { title: "总览" } },
        { path: "logs", name: "logs", component: LogsPage, meta: { title: "运行日志" } },
        { path: "plugins", name: "plugins", component: PluginsPage, meta: { title: "插件" } },
        {
          path: "plugins/:name",
          name: "plugin-config",
          component: PluginConfigPage,
          meta: { title: "插件配置" },
        },
        { path: "common-config", name: "common-config", component: CommonConfigPage, meta: { title: "通用配置" } },
        { path: "instances", name: "instances", component: InstancesPage, meta: { title: "实例" } },
        { path: "friends", name: "friends", component: FriendsPage, meta: { title: "好友" } },
        { path: "groups", name: "groups", component: GroupsPage, meta: { title: "群" } },
        {
          path: "bot-social-config",
          name: "bot-social-config",
          component: BotSocialConfigPage,
          meta: { title: "好友与群颗粒配置" },
        },
        { path: "database", name: "database", component: DatabasePage, meta: { title: "数据库" } },
        { path: "update", name: "update", component: UpdatePage, meta: { title: "更新" } },
        { path: "ai", name: "ai", component: AiExtensionPage, meta: { title: "AI 扩展" } },
        { path: "security", name: "security", component: SecurityPage, meta: { title: "安全" } },
        { path: "preferences", name: "preferences", component: PreferencesPage, meta: { title: "外观偏好" } },
      ],
    },
  ],
});

const baseTitle = "Pallas 控制台";

router.afterEach((to) => {
  const piece = to.meta.title as string | undefined;
  document.title = piece ? `${piece} · ${baseTitle}` : baseTitle;
});

export default router;
