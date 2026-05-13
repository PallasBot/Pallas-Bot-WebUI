<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  fetchAiExtensionConfig,
  fetchAiExtensionLogs,
  postAiExtensionTest,
  putAiExtensionConfig,
} from "@/api/consoleApi";
import type { AiExtensionConfig } from "@/api/pallasTypes";

const err = ref("");
const ok = ref("");
const jsonText = ref("");
const testOut = ref("");
const logKind = ref<"uvicorn" | "celery">("uvicorn");
const logOut = ref("");

async function load() {
  err.value = "";
  try {
    const c = await fetchAiExtensionConfig();
    jsonText.value = JSON.stringify(c, null, 2);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function save() {
  err.value = "";
  ok.value = "";
  try {
    const body = JSON.parse(jsonText.value) as AiExtensionConfig;
    const c = await putAiExtensionConfig(body);
    jsonText.value = JSON.stringify(c, null, 2);
    ok.value = "已保存。";
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function runTest() {
  err.value = "";
  testOut.value = "";
  try {
    const r = await postAiExtensionTest();
    testOut.value = JSON.stringify(r, null, 2);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function loadLogs() {
  err.value = "";
  logOut.value = "";
  try {
    const r = await fetchAiExtensionLogs(logKind.value, 200);
    logOut.value = JSON.stringify(r, null, 2);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

onMounted(load);
</script>

<template>
  <div>
    <header class="page-hero">
      <p class="page-hero__eyebrow">AI Stack</p>
      <h1 class="page-hero__title">AI 扩展</h1>
      <p class="page-hero__desc">直连扩展配置与健康探测；日志为后端代理读取。</p>
    </header>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>
    <div
      v-if="ok"
      class="alert alert--ok"
    >
      {{ ok }}
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">配置 JSON</h2>
        <div class="row-actions">
          <button
            type="button"
            class="btn"
            @click="load"
          >
            重新加载
          </button>
          <button
            type="button"
            class="btn btn--primary"
            @click="save"
          >
            保存
          </button>
          <button
            type="button"
            class="btn"
            @click="runTest"
          >
            健康测试
          </button>
        </div>
      </div>
      <div class="panel__bd">
        <textarea
          v-model="jsonText"
          class="textarea"
          rows="14"
        />
        <div
          v-if="testOut"
          style="margin-top: 16px"
        >
          <div class="muted" style="margin-bottom: 8px">测试结果</div>
          <pre class="pre-block">{{ testOut }}</pre>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">扩展日志</h2>
        <div class="row-actions">
          <select
            v-model="logKind"
            class="sel"
          >
            <option value="uvicorn">uvicorn</option>
            <option value="celery">celery</option>
          </select>
          <button
            type="button"
            class="btn btn--primary"
            @click="loadLogs"
          >
            拉取
          </button>
        </div>
      </div>
      <div
        v-if="logOut"
        class="panel__bd"
      >
        <pre class="pre-block">{{ logOut }}</pre>
      </div>
    </div>
  </div>
</template>
