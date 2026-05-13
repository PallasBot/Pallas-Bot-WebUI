import { createRouter, createWebHistory } from "vue-router";
import AppShell from "@/layout/AppShell.vue";
import HomePage from "@/pages/HomePage.vue";
import LogsPage from "@/pages/LogsPage.vue";
import PluginsPage from "@/pages/PluginsPage.vue";
import PluginConfigPage from "@/pages/PluginConfigPage.vue";
import CommonConfigPage from "@/pages/CommonConfigPage.vue";
import InstancesPage from "@/pages/InstancesPage.vue";
import DatabasePage from "@/pages/DatabasePage.vue";
import UpdatePage from "@/pages/UpdatePage.vue";
import AiExtensionPage from "@/pages/AiExtensionPage.vue";
import SecurityPage from "@/pages/SecurityPage.vue";

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
        { path: "database", name: "database", component: DatabasePage, meta: { title: "数据库" } },
        { path: "update", name: "update", component: UpdatePage, meta: { title: "更新" } },
        { path: "ai", name: "ai", component: AiExtensionPage, meta: { title: "AI 扩展" } },
        { path: "security", name: "security", component: SecurityPage, meta: { title: "安全" } },
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
