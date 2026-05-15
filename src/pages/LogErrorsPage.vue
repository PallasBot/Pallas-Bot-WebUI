<script setup lang="ts">
import { onMounted, ref } from "vue";
import { fetchPluginRunStats } from "@/api/consoleApi";
import type { MatcherErrorLogEntry } from "@/api/pallasTypes";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const pageReady = ref(false);
const loading = ref(false);
const entries = ref<MatcherErrorLogEntry[]>([]);

async function load() {
  loading.value = true;
  err.value = "";
  try {
    const stats = await fetchPluginRunStats();
    entries.value = stats.log_error_log ?? [];
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    entries.value = [];
  } finally {
    loading.value = false;
    pageReady.value = true;
  }
}

onMounted(load);

function formatAt(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  try {
    return new Date(sec * 1000).toLocaleString();
  } catch {
    return String(sec);
  }
}
</script>

<template>
  <div class="log-errors-page">
    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="1"
    />
    <div
      v-else
      class="log-errors-page__body"
    >
      <div class="panel">
        <div class="panel__hd panel__hd--split">
          <h2 class="panel__title">
            <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>日志报错
            <RefreshIconButton
              :busy="loading"
              label="刷新"
              @click="load"
            />
          </h2>
          <div class="row-actions">
            <PanelSidebarAdd main-path="/log-errors" />
          </div>
        </div>
        <div class="panel__bd">
          <p class="muted log-errors-page__hint">
            进程内 ERROR / CRITICAL 快照；持久化与每日 4:00 清理策略与 Matcher 异常归档一致。与「运行日志」实时流相互独立。
          </p>
          <div class="log-errors-page__scroll">
            <p
              v-if="loading && !entries.length"
              class="muted"
              style="margin: 0"
            >
              加载中…
            </p>
            <p
              v-else-if="!entries.length"
              class="muted"
              style="margin: 0"
            >
              暂无报错记录。
            </p>
            <ul
              v-else
              class="log-errors-page__list"
            >
              <li
                v-for="(it, idx) in entries"
                :key="`logerr-${it.at}-${idx}-${it.plugin}`"
                class="log-errors-page__item"
              >
                <div class="log-errors-page__head">
                  <span>{{ formatAt(it.at) }}</span>
                  <span class="log-errors-page__plugin">{{ it.plugin }}</span>
                  <span>{{ it.exc_type }}</span>
                </div>
                <div class="log-errors-page__msg">{{ it.message }}</div>
                <pre
                  v-if="it.traceback"
                  class="log-errors-page__tb"
                >{{ it.traceback }}</pre>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
