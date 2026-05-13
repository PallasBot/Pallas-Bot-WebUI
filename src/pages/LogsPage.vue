<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { fetchLogs } from "@/api/consoleApi";
import type { LogEntry, LogScope, LogsData } from "@/api/pallasTypes";

const err = ref("");
const loading = ref(false);
const scope = ref<LogScope>("all");
const n = ref(200);
const payload = ref<LogsData | null>(null);
const view = ref<"feed" | "raw">("feed");
const q = ref("");

async function load() {
  loading.value = true;
  err.value = "";
  try {
    payload.value = await fetchLogs(n.value, scope.value);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    payload.value = null;
  } finally {
    loading.value = false;
  }
}

watch([scope, n], () => {
  void load();
});

onMounted(load);

const entries = computed(() => payload.value?.entries ?? []);
const lines = computed(() => payload.value?.lines ?? []);

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase();
  if (!needle) return entries.value;
  return entries.value.filter(
    (e) =>
      e.message.toLowerCase().includes(needle) ||
      e.scope.toLowerCase().includes(needle) ||
      e.level.toLowerCase().includes(needle) ||
      e.time.toLowerCase().includes(needle),
  );
});

function lineClass(lv: LogEntry["level"]): string {
  if (lv === "debug") return "log-line log-line--debug";
  if (lv === "warn") return "log-line log-line--warn";
  if (lv === "error") return "log-line log-line--err";
  if (lv === "success") return "log-line log-line--success";
  if (lv === "info") return "log-line log-line--info";
  return "log-line log-line--okline";
}
</script>

<template>
  <div>
    <header class="page-hero">
      <p class="page-hero__eyebrow">Observability</p>
      <h1 class="page-hero__title">运行日志</h1>
      <p class="page-hero__desc">按时间线查看运行期输出；支持结构化条目与原始行两种视图，并可在前端按关键字过滤。</p>
    </header>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">筛选与视图</h2>
        <div class="row-actions">
          <select
            v-model="scope"
            class="sel"
          >
            <option value="all">全部</option>
            <option value="webui">WebUI</option>
            <option value="protocol">协议</option>
          </select>
          <input
            v-model.number="n"
            class="inp"
            type="number"
            min="20"
            max="2000"
            style="width: 100px"
          >
          <input
            v-model="q"
            class="inp"
            type="search"
            placeholder="筛选消息 / scope / 级别…"
            style="min-width: 200px; flex: 1"
          >
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': view === 'feed' }"
            @click="view = 'feed'"
          >
            结构化
          </button>
          <button
            type="button"
            class="btn"
            :class="{ 'btn--primary': view === 'raw' }"
            @click="view = 'raw'"
          >
            原始行
          </button>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="loading"
            @click="load"
          >
            {{ loading ? "加载中…" : "刷新" }}
          </button>
        </div>
      </div>
      <div class="panel__bd">
        <p
          v-if="payload?.max != null"
          class="muted"
          style="margin: 0 0 12px"
        >
          单次上限 {{ payload.max }} 条 · 当前返回 {{ entries.length }} 条条目 · 原始行 {{ lines.length }} 行
        </p>

        <div
          v-if="view === 'feed'"
        >
          <div
            v-if="!filtered.length && !loading"
            class="muted"
          >
            暂无条目（或筛选无结果）。
          </div>
          <div
            v-else
            class="log-feed"
          >
            <div
              v-for="row in filtered"
              :key="row.id"
              :class="lineClass(row.level)"
            >
              <span class="log-line__time">{{ row.time }}</span>
              <span>
                <span
                  class="badge"
                  :class="{
                    'badge--ok':
                      row.level === 'info' || row.level === 'success' || row.level === 'debug',
                    'badge--warn': row.level === 'warn',
                    'badge--err': row.level === 'error',
                  }"
                >{{ row.level }}</span>
              </span>
              <span class="muted">{{ row.scope }}</span>
              <span class="log-line__msg">{{ row.message }}</span>
            </div>
          </div>
        </div>

        <div v-else>
          <div
            v-if="!lines.length && !loading"
            class="muted"
          >
            无原始行数据（后端可能仅返回结构化 entries）。
          </div>
          <pre
            v-else
            class="pre-block"
            style="max-height: min(72vh, 760px)"
          >{{ lines.join("\n") }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
