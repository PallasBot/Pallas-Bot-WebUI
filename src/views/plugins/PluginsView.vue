<script setup lang="ts">
import { fetchPlugins } from "@/api/consoleApi";
import { pallasConnectionKey } from "@/types/pallas-connection";
import type { PluginRow } from "@/api/pallasTypes";
import { View } from "@element-plus/icons-vue";
import { computed, inject, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";

const loading = ref(true);
const rows = ref<PluginRow[]>([]);
const dialog = ref(false);
const current = ref<PluginRow | null>(null);
const router = useRouter();
const conn = inject(pallasConnectionKey, null);

async function load() {
  loading.value = true;
  try {
    rows.value = await fetchPlugins();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
    rows.value = [];
  } finally {
    loading.value = false;
  }
}
onMounted(() => {
  void load();
});

watch(
  () => conn?.healthTick.value,
  () => {
    if (conn?.ok.value && !loading.value && rows.value.length === 0) {
      void load();
    }
  },
);

watch(
  () => conn?.ok.value,
  (v) => {
    if (v !== true) return;
    const run = () => {
      if (rows.value.length === 0) {
        void load();
      }
    };
    if (loading.value) {
      window.setTimeout(run, 80);
    } else {
      run();
    }
  },
  { immediate: true },
);

function openMeta(p: PluginRow) {
  current.value = p;
  dialog.value = true;
}

function pluginTypeLabel(p: PluginRow): string {
  const t = (p.metadata?.type || "").trim();
  return t || "未标注";
}

const plugCategory = ref<string>("all");
const plugSearch = ref("");

const plugCategories = computed(() => {
  const s = new Set<string>();
  for (const p of rows.value) {
    s.add(pluginTypeLabel(p));
  }
  return [...s].sort((a, b) => {
    if (a === "未标注") return 1;
    if (b === "未标注") return -1;
    return a.localeCompare(b, "zh-CN");
  });
});

const filteredPlugins = computed(() => {
  let list = rows.value;
  if (plugCategory.value !== "all") {
    list = list.filter((p) => pluginTypeLabel(p) === plugCategory.value);
  }
  const q = plugSearch.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.module.toLowerCase().includes(q) ||
        (p.metadata?.name || "").toLowerCase().includes(q) ||
        (p.metadata?.description || "").toLowerCase().includes(q),
    );
  }
  return list;
});

watch(rows, () => {
  if (plugCategory.value === "all") return;
  if (!plugCategories.value.includes(plugCategory.value)) {
    plugCategory.value = "all";
  }
});
</script>

<template>
  <div class="view-page plugins-page">
    <div class="main-wrap panel--wide"
    >
      <h1 class="main-title">插件列表</h1>
      <p class="main-sub">按元数据类型分片筛选，卡片栅格浏览；在哪些群/号上关插件，请到「好友与群」。</p>
      <el-card
        v-loading="loading"
        shadow="hover"
        class="plug-card-wrap"
      >
        <div class="plug-toolbar">
          <el-radio-group
            v-model="plugCategory"
            class="plug-cat"
            size="default"
          >
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button
              v-for="c in plugCategories"
              :key="c"
              :label="c"
            >{{ c }}</el-radio-button>
          </el-radio-group>
          <el-input
            v-model="plugSearch"
            class="plug-q"
            clearable
            placeholder="搜索 name / 模块 / 标题 / 简介"
          />
        </div>
        <el-empty
          v-if="!filteredPlugins.length && !loading"
          description="当前筛选下无插件"
          :image-size="80"
        />
        <el-row
          v-else
          :gutter="14"
          class="plug-grid"
        >
          <el-col
            v-for="p in filteredPlugins"
            :key="p.name"
            :xs="24"
            :sm="12"
            :md="8"
            :lg="6"
          >
            <el-card
              class="plug-tile"
              shadow="hover"
            >
              <div class="pc-hd">
                <span class="pc-title">{{ p.metadata?.name || p.name }}</span>
                <el-tag
                  size="small"
                  type="info"
                >{{ pluginTypeLabel(p) }}</el-tag>
              </div>
              <div class="pc-name mono">{{ p.name }}</div>
              <div class="pc-mod">{{ p.module }}</div>
              <div class="pc-desc">{{ p.metadata?.description || "—" }}</div>
              <div class="pc-ft">
                <el-button
                  :icon="View"
                  link
                  type="primary"
                  @click="openMeta(p)"
                >详情</el-button>
              </div>
            </el-card>
          </el-col>
        </el-row>
        <div class="ft">
          <el-button
            type="primary"
            plain
            :loading="loading"
            @click="load"
          >刷新</el-button>
          <el-button
            plain
            @click="router.push({ name: 'instances' })"
          >去「好友与群」里关插件</el-button>
          <el-text
            class="c"
            type="info"
          >共 {{ rows.length }} 个，当前 {{ filteredPlugins.length }} 个</el-text>
        </div>
      </el-card>
    </div>

    <el-dialog
      v-model="dialog"
      :title="current ? `元数据: ${current.name}` : '元数据'"
      width="min(90vw, 640px)"
      destroy-on-close
    >
      <el-scrollbar
        v-if="current"
        max-height="60vh"
      >
        <pre class="json">{{ JSON.stringify(current, null, 2) }}</pre>
      </el-scrollbar>
    </el-dialog>
  </div>
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
  max-width: 1100px;
}
.main-wrap {
  background: var(--c-nav-bg);
  border-radius: var(--pallas-radius-md);
  border: 1px solid rgba(22, 100, 196, 0.12);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.06);
  padding: 18px;
}
.panel--wide {
  max-width: 1280px;
}
.plug-card-wrap {
  border: 1px solid rgba(22, 100, 196, 0.1);
}
.plug-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.plug-cat {
  flex: 1;
  min-width: 0;
  :deep(.el-radio-button__inner) {
    border-radius: var(--pallas-radius-sm, 8px);
  }
}
.plug-q {
  width: 280px;
  max-width: 100%;
}
.plug-grid {
  margin-top: 4px;
}
.plug-tile {
  height: 100%;
  margin-bottom: 14px;
  border: 1px solid rgba(22, 100, 196, 0.1);
  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    min-height: 168px;
  }
}
.pc-hd {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.pc-title {
  font-weight: 600;
  color: var(--c-main);
  font-size: 15px;
  line-height: 1.35;
  flex: 1;
  min-width: 0;
}
.pc-name {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
.pc-mod {
  font-size: 12px;
  line-height: 1.45;
  color: var(--el-text-color-regular);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}
.pc-desc {
  flex: 1;
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.pc-ft {
  margin-top: auto;
  padding-top: 4px;
}
.mono {
  font-family: ui-monospace, Consolas, monospace;
}
.al {
  border: 1px solid rgba(22, 100, 196, 0.15);
}
.ft {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  .c {
    font-size: 13px;
  }
}
.json {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: ui-monospace, Consolas, monospace;
}
</style>
