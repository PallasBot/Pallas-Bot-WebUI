<script setup lang="ts">
import { onMounted, ref } from "vue";
import { fetchLogs } from "@/api/consoleApi";
import type { LogEntry, LogScope } from "@/api/pallasTypes";

const err = ref("");
const loading = ref(false);
const scope = ref<LogScope>("all");
const n = ref(200);
const entries = ref<LogEntry[]>([]);

async function load() {
  loading.value = true;
  err.value = "";
  try {
    const data = await fetchLogs(n.value, scope.value);
    entries.value = data.entries?.length ? data.entries : [];
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    entries.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <header class="page-hero">
      <p class="page-hero__eyebrow">Observability</p>
      <h1 class="page-hero__title">运行日志</h1>
      <p class="page-hero__desc">从 NoneBot 日志环拉取最近条目，可按作用域筛选。</p>
    </header>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">筛选</h2>
        <div class="row-actions">
          <select
            v-model="scope"
            class="sel"
            @change="load"
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
            @change="load"
          >
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
        <div
          v-if="!entries.length && !loading"
          class="muted"
        >
          暂无条目。
        </div>
        <div
          v-else
          class="table-wrap"
        >
          <table class="data">
            <thead>
              <tr>
                <th>时间</th>
                <th>级别</th>
                <th>域</th>
                <th>消息</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in entries"
                :key="row.id"
              >
                <td style="white-space: nowrap; font-family: var(--font-mono); font-size: 12px">{{ row.time }}</td>
                <td>
                  <span
                    class="badge"
                    :class="{
                      'badge--ok': row.level === 'info' || row.level === 'success',
                      'badge--warn': row.level === 'warn',
                      'badge--err': row.level === 'error',
                    }"
                  >{{ row.level }}</span>
                </td>
                <td class="muted">{{ row.scope }}</td>
                <td style="word-break: break-word">{{ row.message }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
