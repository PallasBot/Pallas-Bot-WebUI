import { createRouter, createWebHistory } from "vue-router";
import ConsoleLayout from "../layout/ConsoleLayout.vue";
import AboutView from "../views/about/AboutView.vue";
import UpdateView from "../views/update/UpdateView.vue";
import AiExtensionView from "../views/ai/AiExtensionView.vue";
import DashboardView from "../views/DashboardView.vue";
import DatabaseView from "../views/database/DatabaseView.vue";
import InstancesView from "../views/instances/InstancesView.vue";
import NapCatView from "../views/napcat/NapCatView.vue";
import PluginsView from "../views/plugins/PluginsView.vue";
import SettingsView from "../views/settings/SettingsView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "console",
      component: ConsoleLayout,
      children: [
        {
          path: "",
          name: "dashboard",
          component: DashboardView,
          meta: { title: "仪表盘" },
        },
        {
          path: "accounts",
          name: "accounts",
          component: InstancesView,
          meta: { title: "实例", pallasScope: "accounts" },
        },
        {
          path: "plugins",
          name: "plugins",
          component: PluginsView,
          meta: { title: "插件列表" },
        },
        {
          path: "database",
          name: "database",
          component: DatabaseView,
          meta: { title: "数据库管理" },
        },
        {
          path: "ai-extension",
          name: "ai-extension",
          component: AiExtensionView,
          meta: { title: "AI拓展" },
        },
        {
          path: "instances",
          name: "instances",
          component: InstancesView,
          meta: { title: "好友与群", pallasScope: "social" },
        },
        {
          path: "napcat",
          name: "napcat",
          component: NapCatView,
          meta: { title: "协议管理" },
        },
        {
          path: "settings",
          name: "settings",
          component: SettingsView,
          meta: { title: "偏好与连接" },
        },
        {
          path: "about",
          name: "about",
          component: AboutView,
          meta: { title: "关于" },
        },
        {
          path: "update",
          name: "update",
          component: UpdateView,
          meta: { title: "更新" },
        },
      ],
    },
  ],
});

export default router;
