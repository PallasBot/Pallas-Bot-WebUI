<script setup lang="ts">
import { fetchLogs } from "@/api/consoleApi";
import { PALLAS_API_TOKEN_KEY } from "@/api/http";
import type { LogEntry, LogEntryLevel, LogScope } from "@/api/pallasTypes";
import { Document } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

const LEVELS: LogEntryLevel[] = ["debug", "info", "success", "warn", "error"];

const streamStatus = ref("连接中");
const paused = ref(false);
const filterText = ref("");
const enabledLevels = ref<Set<LogEntryLevel>>(new Set(LEVELS));
const scope = ref<LogScope>("all");
const entries = ref<LogEntry[]>([]);
const maxLines = ref(2000);
const fetchN = ref(500);
const logEndRef = ref<HTMLElement | null>(null);

let es: EventSource | null = null;

function streamUrl(): string {
  const base = (import.meta.env.BASE_URL as string) || "/pallas/";
  const root = base.replace(/\/$/, "");
  const tok =
    typeof sessionStorage !== "undefined" ? (sessionStorage.getItem(PALLAS_API_TOKEN_KEY) || "").trim() : "";
  const q = new URLSearchParams({ token: tok, scope: scope.value });
  return `${window.location.origin}${root}/api/logs/stream?${q.toString()}`;
}

function closeStream(): void {
  if (es) {
    es.close();
    es = null;
  }
}

function startStream(): void {
  closeStream();
  const tok =
    typeof sessionStorage !== "undefined" ? (sessionStorage.getItem(PALLAS_API_TOKEN_KEY) || "").trim() : "";
  if (!tok) {
    streamStatus.value = "无 Token";
    return;
  }
  const url = streamUrl();
  const source = new EventSource(url);
  es = source;
  source.onopen = () => {
    streamStatus.value = "实时";
  };
  source.onerror = () => {
    streamStatus.value = "重连中";
  };
  source.onmessage = (ev: MessageEvent<string>) => {
    try {
      const row = JSON.parse(ev.data) as LogEntry & { type?: string };
      if (row && "type" in row && row.type === "ready") return;
      if (typeof row.id !== "number") return;
      if (paused.value) return;
      entries.value = [...entries.value.filter((it) => it.id !== row.id), row].slice(-1000);
      void scrollToEnd();
    } catch {
      /* ignore */
    }
  };
}

async function loadInitial(): Promise<void> {
  const d = await fetchLogs(fetchN.value, scope.value);
  entries.value = Array.isArray(d.entries) ? d.entries : [];
  maxLines.value = d.max;
  await scrollToEnd();
}

async function scrollToEnd(): Promise<void> {
  if (paused.value) return;
  await nextTick();
  logEndRef.value?.scrollIntoView({ block: "end" });
}

const filtered = computed(() => {
  const f = filterText.value.trim().toLowerCase();
  return entries.value.filter((l) => {
    if (!enabledLevels.value.has(l.level)) return false;
    if (!f) return true;
    return (
      l.message.toLowerCase().includes(f) ||
      l.scope.toLowerCase().includes(f) ||
      l.level.toLowerCase().includes(f)
    );
  });
});

function levelClass(lv: LogEntryLevel): string {
  const m: Record<LogEntryLevel, string> = {
    debug: "lev-debug",
    info: "lev-info",
    success: "lev-success",
    warn: "lev-warn",
    error: "lev-error",
  };
  return m[lv] ?? "lev-plain";
}

function toggleLevel(lv: LogEntryLevel): void {
  const next = new Set(enabledLevels.value);
  if (next.has(lv)) next.delete(lv);
  else next.add(lv);
  enabledLevels.value = next;
}

async function onRefresh(): Promise<void> {
  try {
    await loadInitial();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "刷新失败");
  }
}

async function onClearView(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      "此操作仅清空浏览器视图中的日志，不会影响服务端的日志缓冲区。",
      "清空当前日志视图？",
      { type: "warning", confirmButtonText: "清空", cancelButtonText: "取消" },
    );
    entries.value = [];
  } catch {
    /* cancel */
  }
}

function copyVisible(): void {
  const lines = filtered.value.map(
    (x) =>
      `${formatTime(x.time)} ${String(x.level).toUpperCase()} [${x.scope}] ${x.message}`,
  );
  const t = lines.join("\n");
  if (!t.trim()) {
    ElMessage.warning("当前无可复制内容");
    return;
  }
  void navigator.clipboard.writeText(t).then(
    () => ElMessage.success("已复制"),
    () => ElMessage.error("复制失败"),
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString();
  } catch {
    return iso;
  }
}

watch([entries, paused], () => {
  void scrollToEnd();
});

watch(scope, () => {
  void loadInitial().catch((e) => ElMessage.error(e instanceof Error ? e.message : "加载失败"));
  startStream();
});

onMounted(() => {
  void loadInitial().catch((e) => ElMessage.error(e instanceof Error ? e.message : "加载失败"));
  startStream();
});

onUnmounted(() => {
  closeStream();
});
</script>

<template>
  <div class="logs-page">
    <el-card class="logs-card" shadow="never">
      <template #header>
        <div class="logs-hd">
          <div class="logs-hd-titles">
            <div class="logs-title-row">
              <el-icon class="logs-ico" :size="18">
                <Document />
              </el-icon>
              <span class="logs-title">运行日志</span>
              <el-tag :type="streamStatus === '实时' ? 'success' : 'info'" size="small" effect="plain">
                {{ streamStatus }}
              </el-tag>
            </div>
            <p class="logs-desc">
              最近 {{ filtered.length }} / {{ entries.length }} 条 · SSE 推送 · 单次最多 {{ fetchN }}（上限 {{ maxLines }}）
            </p>
          </div>
          <div class="logs-tools">
            <el-input
              v-model="filterText"
              size="small"
              clearable
              placeholder="搜索消息 / 模块 / 级别"
              class="logs-search"
            />
            <el-radio-group v-model="scope" size="small">
              <el-radio-button label="all">全部</el-radio-button>
              <el-radio-button label="webui">控制台</el-radio-button>
              <el-radio-button label="protocol">协议</el-radio-button>
            </el-radio-group>
            <el-button size="small" @click="paused = !paused">
              {{ paused ? "继续" : "暂停" }}
            </el-button>
            <el-button size="small" @click="onRefresh">刷新</el-button>
            <el-button size="small" type="danger" plain @click="onClearView">清空视图</el-button>
            <el-button size="small" @click="copyVisible">复制</el-button>
          </div>
        </div>
      </template>

      <div class="logs-body-stack">
        <div class="logs-level-row">
          <button
            v-for="lv in LEVELS"
            :key="lv"
            type="button"
            class="lvl-pill"
            :class="{ off: !enabledLevels.has(lv) }"
            @click="toggleLevel(lv)"
          >
            {{ lv.toUpperCase() }}
          </button>
        </div>

        <el-card class="logs-scroll-card" shadow="never">
          <div class="logs-viewport">
            <div v-if="filtered.length === 0" class="logs-empty">暂无日志</div>
            <div v-for="log in filtered" :key="log.id" class="log-row">
              <span class="log-t">{{ formatTime(log.time) }}</span>
              <span class="log-lv" :class="levelClass(log.level)">{{ log.level.toUpperCase() }}</span>
              <span class="log-sc">[{{ log.scope }}]</span>
              <span class="log-msg">{{ log.message }}</span>
            </div>
            <div ref="logEndRef" />
          </div>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.logs-page {
  width: 100%;
  max-width: none;
  min-height: min(100vh - 7rem, 900px);
}
.logs-card {
  border-radius: 12px !important;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  min-height: min(calc(100vh - 8rem), 820px);
  :deep(.el-card__header) {
    padding: 18px 20px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
  :deep(.el-card__body) {
    padding: 12px 18px 16px;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
}
.logs-body-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
}
.logs-scroll-card {
  border-radius: var(--el-border-radius-base) !important;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  :deep(.el-card__body) {
    padding: 0;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
}
.logs-hd {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.logs-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.logs-ico {
  color: var(--el-color-primary);
}
.logs-title {
  font-size: var(--pallas-type-section-title-size, 0.9375rem);
  font-weight: 650;
  color: var(--el-text-color-primary);
}
.logs-desc {
  margin: 6px 0 0;
  font-size: var(--pallas-type-section-desc-size, 0.8125rem);
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
.logs-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.logs-search {
  width: 200px;
}
.logs-level-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.lvl-pill {
  border-radius: 999px;
  border: 1px solid var(--el-border-color);
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  color: var(--el-text-color-regular);
}
.lvl-pill.off {
  opacity: 0.45;
  text-decoration: line-through;
}
.logs-viewport {
  flex: 1;
  min-height: 240px;
  max-height: min(calc(100vh - 14rem), 640px);
  overflow: auto;
  border-radius: 0;
  background: var(--el-fill-color-light);
  font-family: var(--pallas-font-mono-em, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.45;
}
.logs-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--el-text-color-placeholder);
}
.log-row {
  display: flex;
  gap: 8px;
  padding: 2px 10px;
  white-space: pre-wrap;
  word-break: break-word;
}
.log-row:hover {
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
}
.log-t {
  flex: none;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.log-lv {
  flex: none;
  width: 3.5rem;
  font-weight: 700;
  font-size: 10px;
}
.lev-debug {
  color: var(--el-text-color-secondary);
}
.lev-info {
  color: var(--el-color-primary);
}
.lev-success {
  color: var(--el-color-success);
}
.lev-warn {
  color: var(--el-color-warning);
}
.lev-error {
  color: var(--el-color-danger);
  font-weight: 800;
}
.log-sc {
  flex: none;
  width: 7rem;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--el-text-color-secondary);
}
.log-msg {
  flex: 1;
  min-width: 0;
}
@media (max-width: 768px) {
  .logs-search {
    width: 100%;
    max-width: none;
  }
}
</style>
