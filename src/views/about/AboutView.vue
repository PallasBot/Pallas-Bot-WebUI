<script setup lang="ts">
import { fetchSystem } from "@/api/consoleApi";
import PallasSidebarShell from "@/components/layout/PallasSidebarShell.vue";
import { pallasConnectionKey } from "@/types/pallas-connection";
import { Cpu, Link, Monitor, Reading } from "@element-plus/icons-vue";
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
  release: "当前连接实例返回的版本与构建元数据。",
  runtime: "当前 Bot 进程暴露的运行态基础指标。",
};
const navItems = [
  { index: "overview", label: "产品定位", icon: Reading },
  { index: "release", label: "构建信息", icon: Monitor },
  { index: "runtime", label: "运行态信息", icon: Cpu },
];

const conn = inject(pallasConnectionKey);
if (!conn) {
  throw new Error("Pallas: missing pallasConnection");
}
const { last, refresh, ok } = conn;

const REPO = "https://github.com/PallasBot/Pallas-Bot";
const WEBUI_REPO = "https://github.com/PallasBot/Pallas-Bot-WebUI";
const runtimeLoading = ref(false);
const runtimeRows = ref<{ k: string; v: string }[]>([]);

const releaseRows = computed(() => {
  if (!last.value) return [] as { k: string; v: string }[];
  return [
    { k: "NoneBot2", v: last.value.nonebot2 },
    { k: "Pallas-Bot", v: last.value.pallas_bot },
    { k: "Console 版本", v: last.value.console?.version || "unknown" },
    { k: "Console Commit", v: last.value.console?.commit || "local/unknown" },
    { k: "Build Time", v: last.value.console?.build_time || "unknown" },
    { k: "HTTP 基址", v: last.value.console?.http_base || "—" },
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

watch(
  () => ok.value,
  (v) => {
    if (v === true && !last.value) {
      void refresh();
    }
    if (v === true) {
      void loadRuntime();
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
      <el-card class="ac" shadow="hover">
        <p class="p">
          <strong>Pallas 控制台</strong>是主仓的 Web 管理面，生产环境通常由同一 Bot HTTP
          进程在 <code>/pallas</code> 提供静态页面，并通过 <code>/pallas/api</code> 暴露管理接口。
        </p>
        <p class="p p2">
          控制台职责是“可观测 + 可运维 + 可配置”，不替代业务插件内部逻辑。建议把它放在受控网络与鉴权策略下运行。
        </p>
        <div class="repo-row">
          <el-link :href="REPO" type="primary" target="_blank" rel="noopener" :icon="Link" class="repo-link">Pallas-Bot</el-link>
          <el-link :href="WEBUI_REPO" type="primary" target="_blank" rel="noopener" :icon="Link" class="repo-link">Pallas-Bot-WebUI</el-link>
        </div>
      </el-card>
    </div>

    <div v-show="section === 'release'" class="panel">
      <el-card class="ac" shadow="hover">
        <el-skeleton v-if="ok === null" :rows="4" animated />
        <template v-else>
          <el-descriptions v-if="last" :column="1" border size="small">
            <el-descriptions-item v-for="r in releaseRows" :key="r.k" :label="r.k">
              <span class="mono">{{ r.v }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="/health">
              <el-tag v-if="ok" type="success" size="small">可访问</el-tag>
              <el-tag v-else type="warning" size="small">异常</el-tag>
            </el-descriptions-item>
          </el-descriptions>
          <p v-else class="muted">未获取到构建元数据，请确认 pallas_webui 已正确加载。</p>
          <el-button class="rbtn" type="primary" plain @click="refresh">刷新构建信息</el-button>
        </template>
      </el-card>
    </div>

    <div v-show="section === 'runtime'" class="panel">
      <el-card class="ac" shadow="hover">
        <el-skeleton v-if="runtimeLoading" :rows="4" animated />
        <el-descriptions v-else :column="1" border size="small">
          <el-descriptions-item v-for="r in runtimeRows" :key="r.k" :label="r.k">
            <span class="mono">{{ r.v }}</span>
          </el-descriptions-item>
        </el-descriptions>
        <el-button class="rbtn" type="primary" plain @click="loadRuntime">刷新运行态</el-button>
      </el-card>
    </div>
  </PallasSidebarShell>
</template>

<style scoped lang="scss">
.main-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
  letter-spacing: 0.02em;
}
.main-sub {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--el-text-color-secondary);
}
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
</style>
