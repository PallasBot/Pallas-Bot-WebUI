<script setup lang="ts">
import { onMounted, ref } from "vue";
import { fetchPluginRunStats } from "@/api/consoleApi";
import type { MatcherErrorLogEntry } from "@/api/pallasTypes";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { formatLogDisplayTime } from "@/utils/logDisplay";

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
            hub 进程内 ERROR / CRITICAL 快照；分片模式下另从各 worker/hub 落盘日志解析 ERROR。持久化与每日 4:00 清理策略与 Matcher 异常归档一致。与「运行日志」实时流相互独立。
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
            <div
              v-else
              class="log-feed log-feed--errors"
            >
              <div
                v-for="(it, idx) in entries"
                :key="`logerr-${it.at}-${idx}-${it.plugin}`"
                class="log-line log-line--stacked"
              >
                <span class="log-line__time">{{ formatLogDisplayTime(it.at) }}</span>
                <span class="log-line__lv log-line__lv--error">{{ it.exc_type }}</span>
                <span class="log-line__scope">[{{ it.plugin }}]</span>
                <span class="log-line__msg">{{ it.message }}</span>
                <pre
                  v-if="it.traceback"
                  class="log-line__tb"
                >{{ it.traceback }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
