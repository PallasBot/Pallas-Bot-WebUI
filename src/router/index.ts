import { createRouter, createWebHistory } from "vue-router";
import AppShell from "@/layout/AppShell.vue";
import HomePage from "@/pages/HomePage.vue";
import { installConsoleSetupGuard } from "@/router/consoleSetupGuard";
import { installProtocolExtensionGuard } from "@/router/protocolExtensionGuard";
import { installRouteLoading } from "@/utils/routeLoading";
import { SIDEBAR_PIN_DEFINITIONS } from "@/config/sidebarPins";
import { routeChunkLoaders } from "@/router/chunkLoaders";

const ChartsPage = routeChunkLoaders.charts;
const LogsPage = routeChunkLoaders.logs;
const LogErrorsPage = routeChunkLoaders["log-errors"];
const PluginsPage = routeChunkLoaders.plugins;
const PluginStorePage = routeChunkLoaders["plugin-store"];
const CommonConfigPage = routeChunkLoaders["common-config"];
const InstancesPage = routeChunkLoaders.instances;
const ProtocolManagePage = routeChunkLoaders.protocol;
const DatabasePage = routeChunkLoaders.database;
const DatabaseBackupsPage = routeChunkLoaders["database-backups"];
const UpdatePage = routeChunkLoaders.update;
const AiExtensionPage = routeChunkLoaders["ai-config"];
const AiHomePage = routeChunkLoaders["ai-home"];
const AiStatisticsPage = routeChunkLoaders["ai-statistics"];
const AiHistoryPage = routeChunkLoaders["ai-history"];
const AiWizardPage = routeChunkLoaders["ai-wizard"];
const AiRuntimeOverviewPage = routeChunkLoaders["ai-runtime"];
const FriendsGroupsPage = routeChunkLoaders["friends-groups"];
const PreferencesPage = routeChunkLoaders.preferences;
const SetupWizardPage = routeChunkLoaders["setup-wizard"];
const CommunityPage = routeChunkLoaders.community;

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
            description: "运行概览",
          },
        },
        {
          path: "charts",
          name: "charts",
          component: ChartsPage,
          meta: {
            title: "数据看板",
            description: "插件与调用统计",
          },
        },
        {
          path: "logs",
          name: "logs",
          component: LogsPage,
          meta: {
            title: "运行日志",
            description: "检索导出",
          },
        },
        {
          path: "log-errors",
          name: "log-errors",
          component: LogErrorsPage,
          meta: {
            title: "日志报错",
            description: "错误归档",
          },
        },
        {
          path: "plugins/:name?",
          name: "plugins",
          component: PluginsPage,
          meta: {
            title: "插件目录",
            description: "已加载",
          },
        },
        {
          path: "plugin-store",
          name: "plugin-store",
          component: PluginStorePage,
          meta: {
            title: "插件商店",
            description: "官方扩展",
          },
        },
        {
          path: "common-config",
          name: "common-config",
          component: CommonConfigPage,
          meta: {
            title: "通用配置",
            description: "公共项",
          },
        },
        /** 兼容旧链接 /common-config/{id}（API 或书签）；插件分区进插件配置，其余进 query */
        {
          path: "common-config/:sectionId",
          redirect: (to) => {
            const id = String(to.params.sectionId ?? "").trim();
            if (id === "llm") {
              return { name: "ai-config", params: { section: "strategy" } };
            }
            if (id === "arknights_kb") {
              return { name: "ai-config", params: { section: "knowledge" } };
            }
            if (id === "pallas_webui" || id === "pallas_protocol" || id === "help") {
              return { name: "plugins", params: { name: id } };
            }
            return { name: "common-config", query: { section: id } };
          },
        },
        {
          path: "instances",
          name: "instances",
          component: InstancesPage,
          meta: { title: "数据库实例", description: "Bot 连接" },
        },
        {
          path: "protocol",
          name: "protocol",
          component: ProtocolManagePage,
          meta: {
            title: "协议连接",
            description: "Bot 在线账号",
          },
        },
        {
          path: "protocol/create",
          name: "protocol-create",
          component: routeChunkLoaders["protocol-create"],
          meta: {
            title: "创建协议账号",
            description: "新建 NapCat / SnowLuma 实例",
            requiresProtocolExtension: true,
          },
        },
        {
          path: "protocol/import",
          name: "protocol-import",
          component: routeChunkLoaders["protocol-import"],
          meta: {
            title: "导入协议账号",
            description: "批量导入旧实例目录",
            requiresProtocolExtension: true,
          },
        },
        {
          path: "protocol/assets",
          name: "protocol-assets",
          component: routeChunkLoaders["protocol-assets"],
          meta: {
            title: "协议资产",
            description: "运行时与镜像",
            requiresProtocolExtension: true,
          },
        },
        {
          path: "friends-groups",
          name: "friends-groups",
          component: FriendsGroupsPage,
          meta: {
            title: "好友与群聊",
            description: "列表审批",
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
            description: "存储明细",
          },
        },
        {
          path: "database/backups",
          name: "database-backups",
          component: DatabaseBackupsPage,
          meta: {
            title: "备份管理",
            description: "创建与清理逻辑备份",
          },
        },
        {
          path: "update",
          name: "update",
          component: UpdatePage,
          meta: {
            title: "更新",
            description: "版本升级",
          },
        },
        {
          path: "corpus-config",
          redirect: { name: "common-config", query: { section: "corpus_federation" } },
        },
        {
          path: "community-stats-config",
          redirect: { name: "common-config", query: { section: "community_stats" } },
        },
        {
          path: "ai",
          redirect: (to) => {
            const raw = to.query.section ?? to.query.tab;
            if (raw != null && String(raw).trim()) {
              const id = String(raw).trim();
              if (id === "runtime") return "/ai/runtime";
              return { path: `/ai/config/${id}` };
            }
            return "/ai/home";
          },
        },
        {
          path: "ai/home",
          name: "ai-home",
          component: AiHomePage,
          meta: {
            title: "AI 首页",
            description: "运行总览",
          },
        },
        {
          path: "ai/statistics",
          name: "ai-statistics",
          component: AiStatisticsPage,
          meta: {
            title: "AI 统计",
            description: "指标与分布",
          },
        },
        {
          path: "ai/history",
          name: "ai-history",
          component: AiHistoryPage,
          meta: {
            title: "AI 历史",
            description: "任务与会话",
          },
        },
        {
          path: "ai/wizard",
          name: "ai-wizard",
          component: AiWizardPage,
          meta: {
            title: "AI 体检向导",
            description: "连通性与提供方检查",
          },
        },
        {
          path: "ai/runtime",
          name: "ai-runtime",
          component: AiRuntimeOverviewPage,
          meta: {
            title: "Runtime 总览",
            description: "health / queue / circuit",
          },
        },
        {
          path: "setup",
          name: "setup-wizard",
          component: SetupWizardPage,
          meta: {
            title: "首次 Setup Wizard",
            description: "初始化与跳转收口",
          },
        },
        {
          path: "ai/config/model",
          redirect: "/ai/config/runtime",
        },
        {
          path: "ai/:legacySection(model|runtime|provider|routing|strategy|persona|knowledge|connection|ncm|logs)",
          redirect: (to) => {
            const raw = String(to.params.legacySection ?? "").trim();
            if (raw === "model") return "/ai/config/runtime";
            return `/ai/config/${raw}`;
          },
        },
        {
          path: "ai/config/:section?",
          name: "ai-config",
          component: AiExtensionPage,
          meta: {
            title: "AI 配置",
            description: "模型与能力",
          },
        },
        {
          path: "community",
          name: "community",
          component: CommunityPage,
          meta: {
            title: "统计与语料",
            description: "社区统计",
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
            description: "外观口令",
          },
        },
      ],
    },
  ],
});

const consoleSurfaceTitle = "控制台";

installConsoleSetupGuard(router);
installProtocolExtensionGuard(router);

router.afterEach((to) => {
  const h = (to.hash || "").trim();
  const pin = SIDEBAR_PIN_DEFINITIONS.find((p) => p.path === to.path && p.hash === h);
  let piece = pin?.label ?? (to.meta.title as string | undefined);
  if (to.name === "plugins") {
    piece = (to.meta.title as string | undefined) ?? "插件目录";
  }
  if (to.name === "ai-home") {
    piece = "AI 首页";
  } else if (to.name === "ai-statistics") {
    piece = "AI 统计";
  } else if (to.name === "ai-history") {
    piece = "AI 历史";
  } else if (to.name === "ai-config") {
    piece = "AI 配置";
  }
  const title = typeof piece === "string" ? piece.trim() : "";
  document.title = title ? `${title} · ${consoleSurfaceTitle}` : consoleSurfaceTitle;
});

installRouteLoading(router);

export default router;
