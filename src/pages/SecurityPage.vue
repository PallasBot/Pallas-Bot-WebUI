<script setup lang="ts">
import { ref } from "vue";
import { changeConsoleLogin } from "@/api/consoleApi";

const err = ref("");
const ok = ref("");
const p1 = ref("");
const p2 = ref("");
const busy = ref(false);

async function submit() {
  err.value = "";
  ok.value = "";
  if (p1.value.length < 8) {
    err.value = "新口令至少 8 位。";
    return;
  }
  if (p1.value !== p2.value) {
    err.value = "两次输入不一致。";
    return;
  }
  busy.value = true;
  try {
    const r = await changeConsoleLogin(p1.value);
    ok.value = r.message || "已更新。";
    p1.value = "";
    p2.value = "";
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <header class="page-hero">
      <p class="page-hero__eyebrow">Security</p>
      <h1 class="page-hero__title">控制台口令</h1>
      <p class="page-hero__desc">调用后端 <code>/pallas/api/security/console-login</code> 更新登录密码。</p>
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
        <h2 class="panel__title">修改密码</h2>
      </div>
      <div class="panel__bd">
        <div style="margin-bottom: 14px">
          <label class="muted" style="display: block; margin-bottom: 6px">新口令</label>
          <input
            v-model="p1"
            class="inp"
            type="password"
            autocomplete="new-password"
            style="max-width: 400px; width: 100%"
          >
        </div>
        <div style="margin-bottom: 18px">
          <label class="muted" style="display: block; margin-bottom: 6px">确认</label>
          <input
            v-model="p2"
            class="inp"
            type="password"
            autocomplete="new-password"
            style="max-width: 400px; width: 100%"
          >
        </div>
        <button
          type="button"
          class="btn btn--primary"
          :disabled="busy"
          @click="submit"
        >
          {{ busy ? "提交中…" : "保存" }}
        </button>
      </div>
    </div>
  </div>
</template>
