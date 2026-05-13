<script setup lang="ts">
import { fetchBotUpdateCheck, fetchSystem } from "@/api/consoleApi";
import type { BotUpdateCheckData } from "@/api/pallasTypes";
import PallasSidebarShell from "@/components/layout/PallasSidebarShell.vue";
import { pallasConnectionKey } from "@/types/pallas-connection";
import { BookOpenIcon, CpuIcon, DesktopIcon } from "tdesign-icons-vue-next";
import { computed, inject, onMounted, ref, watch } from "vue";

type AboutSection = "overview" | "release" | "runtime";

const section = ref<AboutSection>("overview");
const sectionTitle: Record<AboutSection, string> = {
  overview: "产品定位",
  release: "发布与构建信息",
  runtime: "运行态信息",
};
const sectionSub: Record<AboutSection, string> = {
  overview: "控制台与主仓关系、生产路径与职责边界。",
  release: "健康检查与控制台的构建元数据；Pallas-Bot 与「更新」页同源（主仓 git tag / commit）。",
  runtime: "当前 Bot 进程暴露的运行态基础指标。",
};
const navItems = [
  { index: "overview", label: "产品定位", icon: BookOpenIcon },
  { index: "release", label: "构建信息", icon: DesktopIcon },
  { index: "runtime", label: "运行态信息", icon: CpuIcon },
];

const conn = inject(pallasConnectionKey);
if (!conn) {
  throw new Error("Pallas-Bot: missing pallasConnection");
}
const { last, refresh, ok } = conn;

const REPO = "https://github.com/PallasBot/Pallas-Bot";
const WEBUI_REPO = "https://github.com/PallasBot/Pallas-Bot-WebUI";
const runtimeLoading = ref(false);
const runtimeRows = ref<{ k: string; v: string }[]>([]);

/** 与「更新」页 Bot 区块一致：来自 /update/bot/check 的 git tag / commit */
const botBuildCheck = ref<BotUpdateCheckData | null>(null);
const botBuildLoading = ref(false);

function formatBotVersionFromCheck(d: BotUpdateCheckData | null): string {
  if (!d) return "";
  const tag = (d.current_tag || "").trim();
  const commit = (d.current_commit || "").trim();
  return tag || commit || "未知";
}

const pallasBotBuildLabel = computed(() => {
  if (botBuildLoading.value && !botBuildCheck.value) return "加载中…";
  const fromCheck = formatBotVersionFromCheck(botBuildCheck.value);
  if (fromCheck) return fromCheck;
  return last.value?.pallas_bot || "—";
});

const releaseRows = computed(() => {
  if (!last.value) return [] as { k: string; v: string }[];
  return [
    { k: "NoneBot2", v: last.value.nonebot2 },
    { k: "Pallas-Bot", v: pallasBotBuildLabel.value },
    { k: "控制台版本", v: last.value.console?.version || "未知" },
    { k: "控制台提交", v: last.value.console?.commit || "本地/未知" },
    { k: "构建时间", v: last.value.console?.build_time || "未知" },
    { k: "HTTP 服务根路径", v: last.value.console?.http_base || "—" },
  ];
});

async function loadRuntime() {
  if (ok.value !== true) return;
  runtimeLoading.value = true;
  try {
    const s = await fetchSystem();
    runtimeRows.value = [
      { k: "Driver 监听", v: s.nonebot2_driver?.host && s.nonebot2_driver?.port ? `${s.nonebot2_driver.host}:${s.nonebot2_driver.port}` : "-" },
      { k: "插件数量", v: String(s.plugin_count ?? "-") },
      { k: "Bot 数量", v: String(s.bot_count ?? "-") },
      { k: "超管数量", v: String(s.superuser_count ?? "-") },
      { k: "平台", v: s.runtime?.platform || "-" },
      { k: "Python", v: s.runtime?.python || "-" },
    ];
  } finally {
    runtimeLoading.value = false;
  }
}

async function loadBotBuildCheck() {
  if (ok.value !== true) return;
  botBuildLoading.value = true;
  try {
    botBuildCheck.value = await fetchBotUpdateCheck();
  } catch {
    botBuildCheck.value = null;
  } finally {
    botBuildLoading.value = false;
  }
}

async function refreshBuildInfo() {
  await refresh();
  if (ok.value === true) await loadBotBuildCheck();
}

watch(
  () => ok.value,
  (v) => {
    if (v === true && !last.value) {
      void refresh();
    }
    if (v === true) {
      void loadRuntime();
      void loadBotBuildCheck();
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (ok.value === true) void loadRuntime();
});
</script>

<template>
  <PallasSidebarShell
    v-model="section"
    aside-title="关于"
    menu-aria-label="关于分节"
    :nav-items="navItems"
  >
    <template #header="{ section: s }">
      <h1 class="main-title">{{ sectionTitle[s as AboutSection] }}</h1>
      <p class="main-sub">{{ sectionSub[s as AboutSection] }}</p>
    </template>

    <div v-show="section === 'overview'" class="panel">
      <t-card class="ac" bordered hover-shadow>
        <p class="p">
          <strong>Pallas-Bot 控制台</strong>是主仓的 Web 管理面，生产环境通常由同一 Bot HTTP
          进程在 <code>/pallas</code> 提供静态页面，并通过 <code>/pallas/api</code> 暴露管理接口。
        </p>
        <p class="p p2">
          控制台职责是“可观测 + 可运维 + 可配置”，不替代业务插件内部逻辑。建议把它放在受控网络与鉴权策略下运行。
        </p>
        <div class="repo-row">
          <t-link class="repo-link" theme="primary" :href="REPO" target="_blank" rel="noopener">Pallas-Bot</t-link>
          <t-link class="repo-link" theme="primary" :href="WEBUI_REPO" target="_blank" rel="noopener">Pallas-Bot-WebUI</t-link>
        </div>
      </t-card>
    </div>

    <div v-show="section === 'release'" class="panel">
      <t-card class="ac" bordered hover-shadow>
        <t-skeleton v-if="ok === null" animation="gradient" theme="paragraph" />
        <template v-else>
          <t-descriptions v-if="last" :column="1" bordered size="small">
            <t-descriptions-item v-for="r in releaseRows" :key="r.k" :label="r.k">
              <span class="mono">{{ r.v }}</span>
            </t-descriptions-item>
            <t-descriptions-item label="健康检查接口">
              <t-tag v-if="ok" theme="success" size="small">正常</t-tag>
              <t-tag v-else theme="warning" size="small">异常</t-tag>
            </t-descriptions-item>
          </t-descriptions>
          <p v-else class="muted">未获取到构建元数据，请确认 pallas_webui 已正确加载。</p>
          <t-button class="rbtn" theme="primary" variant="outline" @click="refreshBuildInfo">刷新构建信息</t-button>
        </template>
      </t-card>
    </div>

    <div v-show="section === 'runtime'" class="panel">
      <t-card class="ac" bordered hover-shadow>
        <t-skeleton v-if="runtimeLoading" animation="gradient" theme="paragraph" />
        <t-descriptions v-else :column="1" bordered size="small">
          <t-descriptions-item v-for="r in runtimeRows" :key="r.k" :label="r.k">
            <span class="mono">{{ r.v }}</span>
          </t-descriptions-item>
        </t-descriptions>
        <t-button class="rbtn" theme="primary" variant="outline" @click="loadRuntime">刷新运行态</t-button>
      </t-card>
    </div>
  </PallasSidebarShell>
</template>

<style scoped lang="scss">
.panel {
  width: 100%;
  max-width: none;
}
.ac {
  border: 1px solid rgba(22, 100, 196, 0.1);
}
.p {
  line-height: 1.65;
  color: var(--el-text-color-regular);
  margin: 0 0 0.75rem;
  font-size: 14px;
}
.p2 {
  margin-top: 0.25rem;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: 0 0 8px;
}
code {
  font-size: 0.9em;
  padding: 0 0.2em;
}
.rbtn {
  margin-top: 10px;
}
.repo-link {
  display: inline-flex;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}
.repo-row {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
html.dark .ac {
  border-color: rgba(100, 160, 255, 0.2);
}
.mono {
  font-family: ui-monospace, Consolas, monospace;
}
@media (max-width: 768px) {
  .p {
    font-size: 13px;
    line-height: 1.55;
  }
  .p2 {
    font-size: 12px;
  }
  .repo-row {
    gap: 10px;
  }
  .rbtn {
    width: 100%;
  }
}
</style>
