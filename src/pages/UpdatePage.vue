<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  fetchBotUpdateCheck,
  fetchUpdateCheck,
  postBotUpdateApply,
  postUpdateApply,
} from "@/api/consoleApi";
import type { BotUpdateCheckData, UpdateCheckData } from "@/api/pallasTypes";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";

const err = ref("");
const pageReady = ref(false);
const web = ref<UpdateCheckData | null>(null);
const bot = ref<BotUpdateCheckData | null>(null);
const busy = ref(false);
const msg = ref("");

async function load() {
  err.value = "";
  msg.value = "";
  try {
    web.value = await fetchUpdateCheck();
    bot.value = await fetchBotUpdateCheck();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    pageReady.value = true;
  }
}

async function applyWeb() {
  if (!web.value?.latest_tag) return;
  if (!confirm(`将 WebUI 更新到 ${web.value.latest_tag}？`)) return;
  busy.value = true;
  try {
    const r = await postUpdateApply();
    msg.value = r.message || "已触发。";
    await load();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

async function applyBot() {
  if (!bot.value?.latest_tag) return;
  if (!confirm(`将 Bot 更新到 ${bot.value.latest_tag}？`)) return;
  busy.value = true;
  try {
    const r = await postBotUpdateApply();
    msg.value = r.message || "已触发。";
    await load();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <header class="page-hero">
      <p class="page-hero__eyebrow">Release</p>
      <h1 class="page-hero__title">更新</h1>
      <p class="page-hero__desc">检查上游发行说明并在维护窗口内执行升级；具体步骤与回滚策略由运行手册规定。</p>
    </header>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>
    <div
      v-if="msg"
      class="alert alert--ok"
    >
      {{ msg }}
    </div>

    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="2"
    />
    <template v-else>
    <div class="row-actions" style="margin-bottom: 24px">
      <button
        type="button"
        class="btn btn--primary"
        :disabled="busy"
        @click="load"
      >
        重新检查
      </button>
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">WebUI</h2>
        <span
          v-if="web?.has_update"
          class="badge badge--warn"
        >有更新</span>
        <span
          v-else
          class="badge badge--ok"
        >已是最新或不可比对</span>
      </div>
      <div class="panel__bd muted">
        <p>当前：<strong style="color: var(--text)">{{ web?.current_tag }}</strong></p>
        <p>远端：<strong style="color: var(--text)">{{ web?.latest_tag ?? "—" }}</strong></p>
        <p v-if="web?.error">错误：{{ web.error }}</p>
        <button
          type="button"
          class="btn btn--primary"
          style="margin-top: 12px"
          :disabled="busy || !web?.has_update || !web?.latest_tag"
          @click="applyWeb"
        >
          应用 WebUI 更新
        </button>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">Bot 本体</h2>
        <span
          v-if="bot?.has_update"
          class="badge badge--warn"
        >有更新</span>
        <span
          v-else
          class="badge badge--ok"
        >已是最新或不可比对</span>
      </div>
      <div class="panel__bd muted">
        <p>当前 tag：<strong style="color: var(--text)">{{ bot?.current_tag }}</strong> · commit {{ bot?.current_commit }}</p>
        <p>远端 tag：<strong style="color: var(--text)">{{ bot?.latest_tag ?? "—" }}</strong></p>
        <p v-if="bot?.error">错误：{{ bot.error }}</p>
        <button
          type="button"
          class="btn btn--primary"
          style="margin-top: 12px"
          :disabled="busy || !bot?.has_update || !bot?.latest_tag"
          @click="applyBot"
        >
          应用 Bot 更新
        </button>
      </div>
    </div>
    </template>
  </div>
</template>
