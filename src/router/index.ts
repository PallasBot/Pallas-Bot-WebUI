import { createRouter, createWebHistory } from "vue-router";
import AppShell from "@/layout/AppShell.vue";
import HomePage from "@/pages/HomePage.vue";
import { installRouteLoading } from "@/utils/routeLoading";
import { SIDEBAR_PIN_DEFINITIONS } from "@/config/sidebarPins";

const LogsPage = () => import("@/pages/LogsPage.vue");
const LogErrorsPage = () => import("@/pages/LogErrorsPage.vue");
const PluginsPage = () => import("@/pages/PluginsPage.vue");
const PluginConfigPage = () => import("@/pages/PluginConfigPage.vue");
const CommonConfigPage = () => import("@/pages/CommonConfigPage.vue");
const InstancesPage = () => import("@/pages/InstancesPage.vue");
const ProtocolManagePage = () => import("@/pages/ProtocolManagePage.vue");
const DatabasePage = () => import("@/pages/DatabasePage.vue");
const DatabaseBackupsPage = () => import("@/pages/DatabaseBackupsPage.vue");
const UpdatePage = () => import("@/pages/UpdatePage.vue");
const AiExtensionPage = () => import("@/pages/AiExtensionPage.vue");
const FriendsGroupsPage = () => import("@/pages/FriendsGroupsPage.vue");
const PreferencesPage = () => import("@/pages/PreferencesPage.vue");
const CommunityPage = () => import("@/pages/CommunityPage.vue");

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
            description: "容量、账号与接入摘要",
          },
        },
        {
          path: "logs",
          name: "logs",
          component: LogsPage,
          meta: {
            title: "运行日志",
            description: "结构化或原始行视图",
            keepAlive: false,
          },
        },
        {
          path: "log-errors",
          name: "log-errors",
          component: LogErrorsPage,
          meta: {
            title: "日志报错",
            description: "ERROR / CRITICAL 快照与持久化记录",
          },
        },
        {
          path: "plugins",
          name: "plugins",
          component: PluginsPage,
          meta: {
            title: "插件目录",
            description: "已启用模块",
          },
        },
        {
          path: "plugins/:name",
          name: "plugin-config",
          component: PluginConfigPage,
          meta: {
            title: "插件配置",
            description: "受控参数；保存后由后端生效",
          },
        },
        {
          path: "common-config",
          name: "common-config",
          component: CommonConfigPage,
          meta: {
            title: "通用配置",
            description: "跨模块公共项；保存后由后端生效",
          },
        },
        /** 兼容旧链接 /common-config/{id}（API 或书签）；插件分区进插件配置，其余进 query */
        {
          path: "common-config/:sectionId",
          redirect: (to) => {
            const id = String(to.params.sectionId ?? "").trim();
            if (id === "pallas_webui" || id === "pallas_protocol" || id === "help") {
              return { name: "plugin-config", params: { name: id } };
            }
            return { name: "common-config", query: { section: id } };
          },
        },
        {
          path: "instances",
          name: "instances",
          component: InstancesPage,
          meta: { title: "数据库实例", description: "库内 Bot 与 NoneBot 连接" },
        },
        {
          path: "protocol",
          name: "protocol",
          component: ProtocolManagePage,
          meta: {
            title: "协议端实例",
            description: "协议账号与运维入口",
          },
        },
        {
          path: "friends-groups",
          name: "friends-groups",
          component: FriendsGroupsPage,
          meta: {
            title: "好友与群聊",
            description: "列表、配置与审批",
          },
        },
        { path: "friends", redirect: "/friends-groups" },
        { path: "groups", redirect: "/friends-groups" },
        { path: "bot-social-config", redirect: "/friends-groups" },
        {
          path: "database",
          name: "database",
          component: DatabasePage,
          meta: {
            title: "数据库",
            description: "存储类型与体量明细",
          },
        },
        {
          path: "database/backups",
          name: "database-backups",
          component: DatabaseBackupsPage,
          meta: {
            title: "备份清理",
            description: "浏览并删除历史逻辑备份",
          },
        },
        {
          path: "update",
          name: "update",
          component: UpdatePage,
          meta: {
            title: "更新",
            description: "发行说明与升级窗口提示",
          },
        },
        {
          path: "corpus-config",
          redirect: { name: "common-config", query: { section: "corpus_federation" } },
        },
        {
          path: "ai",
          name: "ai",
          component: AiExtensionPage,
          meta: {
            title: "AI 扩展",
            description: "扩展服务配置与健康；运行记录由后端读取",
          },
        },
        {
          path: "community",
          name: "community",
          component: CommunityPage,
          meta: {
            title: "统计与语料",
            description: "社区公开统计与本部署语料、联邦状态",
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
            description: "主题、圆角、密度与控制台登录口令",
          },
        },
      ],
    },
  ],
});

const consoleSurfaceTitle = "控制台";

router.afterEach((to) => {
  const h = (to.hash || "").trim();
  const pin = SIDEBAR_PIN_DEFINITIONS.find((p) => p.path === to.path && p.hash === h);
  let piece = pin?.label ?? (to.meta.title as string | undefined);
  if (to.name === "plugin-config") {
    const n = to.params.name;
    if (typeof n === "string" && n.trim()) piece = n.trim();
  }
  const title = typeof piece === "string" ? piece.trim() : "";
  document.title = title ? `${title} · ${consoleSurfaceTitle}` : consoleSurfaceTitle;
});

installRouteLoading(router);

export default router;
