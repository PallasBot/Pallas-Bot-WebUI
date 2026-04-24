<script setup lang="ts">
import PallasSidebarShell from "@/components/layout/PallasSidebarShell.vue";
import { pallasConnectionKey } from "@/types/pallas-connection";
import { Grid, Link, Monitor, Reading } from "@element-plus/icons-vue";
import { inject, computed, ref, watch } from "vue";

type AboutSection = "intro" | "stack" | "conn";

const section = ref<AboutSection>("intro");
const sectionTitle: Record<AboutSection, string> = {
  intro: "关于本控制台",
  stack: "技术栈",
  conn: "与 Bot 连接状态",
};
const sectionSub: Record<AboutSection, string> = {
  intro: "定位、部署方式与主仓库链接。",
  stack: "本 WebUI 所依赖的主要技术。",
  conn: "健康检查与版本元数据。",
};
const navItems = [
  { index: "intro", label: "关于", icon: Reading },
  { index: "stack", label: "技术栈", icon: Grid },
  { index: "conn", label: "连接状态", icon: Monitor },
];

const conn = inject(pallasConnectionKey);
if (!conn) {
  throw new Error("Pallas: missing pallasConnection");
}
const { last, refresh, ok } = conn;

const REPO = "https://github.com/PallasBot/Pallas-Bot";

const lines = computed(() => {
  if (!last.value) return [] as { k: string; v: string }[];
  return [
    { k: "NoneBot2", v: last.value.nonebot2 },
    { k: "Pallas-Bot 包", v: last.value.pallas_bot },
    { k: "Pallas Console", v: last.value.console?.version || "unknown" },
    { k: "HTTP 基址(元数据)", v: last.value.console?.http_base || "—" },
  ];
});

const stack = [
  { name: "Vue 3", note: "组合式 API" },
  { name: "Vite 6", note: "构建与开发服务器" },
  { name: "TypeScript", note: "全量类型" },
  { name: "Element Plus", note: "组件库" },
  { name: "Pallas API", note: "FastAPI/NoneBot 同进程" },
];

watch(
  () => ok.value,
  (v) => {
    if (v === true && !last.value) {
      void refresh();
    }
  },
  { immediate: true },
);
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

    <div
      v-show="section === 'intro'"
      class="panel"
    >
      <el-card
        class="ac"
        shadow="hover"
      >
        <p class="p">
          <strong>Pallas 控制台</strong>是独立于 Pallas-Bot 主仓库的前端工程：在Bot HTTP
          端口上以 <code>/pallas</code> 提供管理界面，以 <code>/pallas/api</code> 与内嵌
          FastAPI 路由交互，生产环境将构建产物置于主仓
          <code>data/pallas_webui/public</code>，也可配置 zip 直链由插件自动拉取。
        </p>
        <p class="p p2">功能范围随主仓 <code>pallas_webui</code> 暴露的 API 扩展；本页「关于」仅描述控制台自身。</p>
        <el-link
          :href="REPO"
          type="primary"
          target="_blank"
          rel="noopener"
          :icon="Link"
          class="repo-link"
        >
          打开 Pallas-Bot 主仓库
        </el-link>
      </el-card>
    </div>

    <div
      v-show="section === 'stack'"
      class="panel"
    >
      <el-card
        class="ac"
        shadow="hover"
      >
        <el-table
          :data="stack"
          size="small"
          border
          stripe
          class="st-table"
        >
          <el-table-column
            label="项"
            prop="name"
            min-width="120"
          />
          <el-table-column
            label="说明"
            prop="note"
            min-width="200"
          />
        </el-table>
      </el-card>
    </div>

    <div
      v-show="section === 'conn'"
      class="panel"
    >
      <el-card
        class="ac"
        shadow="hover"
      >
        <el-skeleton
          v-if="ok === null"
          :rows="3"
          animated
        />
        <template v-else>
          <el-descriptions
            v-if="last"
            :column="1"
            border
            size="small"
          >
            <el-descriptions-item
              v-for="r in lines"
              :key="r.k"
              :label="r.k"
            >
              {{ r.v }}
            </el-descriptions-item>
            <el-descriptions-item label="/health">
              <el-tag
                v-if="ok"
                type="success"
                size="small"
              >可访问</el-tag>
              <el-tag
                v-else
                type="warning"
                size="small"
              >异常，请在控制台点刷新</el-tag>
            </el-descriptions-item>
          </el-descriptions>
          <p
            v-else
            class="muted"
          >暂无元数据。请确认 pallas_webui 已开启。</p>
          <el-button
            class="rbtn"
            type="primary"
            plain
            @click="refresh"
          >刷新</el-button>
        </template>
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
  max-width: 920px;
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
  margin: 0 0 0.25rem;
  font-size: 15px;
  font-weight: 500;
}
.st-table {
  --el-table-border-color: rgba(22, 100, 196, 0.1);
  width: 100%;
}
html.dark .ac {
  border-color: rgba(100, 160, 255, 0.2);
}
</style>
