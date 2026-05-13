<script setup lang="ts">
import { onMounted, ref } from "vue";
import { fetchDbOverview, postMongoAggregate } from "@/api/consoleApi";
import type { DbOverviewData } from "@/api/pallasTypes";

const err = ref("");
const overview = ref<DbOverviewData | null>(null);
const collection = ref("");
const pipelineText = ref("[\n  { \"$limit\": 20 }\n]");
const aggResult = ref<string>("");
const aggLoading = ref(false);

onMounted(async () => {
  try {
    overview.value = await fetchDbOverview();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
});

async function runAggregate() {
  aggLoading.value = true;
  aggResult.value = "";
  err.value = "";
  try {
    const pipeline = JSON.parse(pipelineText.value) as unknown[];
    const r = await postMongoAggregate({ collection: collection.value.trim(), pipeline });
    aggResult.value = JSON.stringify(r, null, 2);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    aggLoading.value = false;
  }
}
</script>

<template>
  <div>
    <header class="page-hero">
      <p class="page-hero__eyebrow">Data</p>
      <h1 class="page-hero__title">数据库</h1>
      <p class="page-hero__desc">查看后端返回的库概览；MongoDB 下可提交聚合管道（只读风险由后端约束）。</p>
    </header>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">概览</h2>
      </div>
      <div class="panel__bd">
        <pre class="pre-block">{{ overview ? JSON.stringify(overview, null, 2) : "—" }}</pre>
      </div>
    </div>

    <div
      v-if="overview && overview.backend === 'mongodb'"
      class="panel"
    >
      <div class="panel__hd">
        <h2 class="panel__title">MongoDB 聚合</h2>
        <button
          type="button"
          class="btn btn--primary"
          :disabled="aggLoading || !collection.trim()"
          @click="runAggregate"
        >
          {{ aggLoading ? "执行中…" : "执行" }}
        </button>
      </div>
      <div class="panel__bd">
        <div style="margin-bottom: 12px">
          <label class="muted" style="display: block; margin-bottom: 6px">集合名</label>
          <input
            v-model="collection"
            class="inp"
            style="max-width: 360px; width: 100%"
            placeholder="collection"
          >
        </div>
        <label class="muted" style="display: block; margin-bottom: 6px">Pipeline（JSON 数组）</label>
        <textarea
          v-model="pipelineText"
          class="textarea"
          rows="10"
        />
        <div
          v-if="aggResult"
          style="margin-top: 16px"
        >
          <div class="muted" style="margin-bottom: 8px">结果</div>
          <pre class="pre-block">{{ aggResult }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
