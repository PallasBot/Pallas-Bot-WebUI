<script setup lang="ts">
import { onMounted, ref } from "vue";
import { fetchHealth } from "@/api/health";
import type { HealthResponse } from "@/api/health";
import { fetchBots, fetchMessageStats, fetchSystem } from "@/api/consoleApi";
import type { MessageStatsData, SystemData } from "@/api/pallasTypes";
import StatCard from "@/components/StatCard.vue";

const err = ref("");
const health = ref<HealthResponse | null>(null);
const system = ref<SystemData | null>(null);
const stats = ref<MessageStatsData | null>(null);
const botCount = ref(0);

async function load() {
  err.value = "";
  try {
    const [h, s, m, bots] = await Promise.all([fetchHealth(), fetchSystem(), fetchMessageStats(), fetchBots()]);
    health.value = h;
    system.value = s;
    stats.value = m;
    botCount.value = bots.length;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

onMounted(load);
</script>

<template>
  <div>
    <header class="page-hero">
      <p class="page-hero__eyebrow">Dashboard</p>
      <h1 class="page-hero__title">运行态势</h1>
      <p class="page-hero__desc">
        与 Pallas-Bot 控制台 API 直连：健康检查、系统摘要与消息统计在一屏呈现。
      </p>
    </header>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <div class="grid-stats">
      <StatCard
        label="NoneBot2"
        :value="health?.nonebot2 ?? '—'"
        hint="GET /pallas/api/health"
      />
      <StatCard
        label="Pallas-Bot"
        :value="health?.pallas_bot ?? '—'"
      />
      <StatCard
        label="已加载插件"
        :value="system?.plugin_count ?? '—'"
      />
      <StatCard
        label="在线 Bot"
        :value="botCount"
        :hint="`配置内账号数：${system?.bot_count ?? '—'}`"
      />
      <StatCard
        label="消息 · 收 / 发"
        :value="stats ? `${stats.total_received} / ${stats.total_sent}` : '—'"
        :hint="
          stats?.today_received != null
            ? `今日 ${stats.today_received} / ${stats.today_sent ?? '—'}`
            : undefined
        "
      />
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">控制台版本</h2>
        <span
          v-if="health?.ok"
          class="badge badge--ok"
        >API 正常</span>
      </div>
      <div class="panel__bd muted">
        <p style="margin: 0 0 8px">
          静态资源：<strong style="color: var(--text)">{{ health?.console?.version ?? "—" }}</strong>
          <span v-if="health?.console?.commit">（{{ health.console.commit }}）</span>
        </p>
        <p style="margin: 0 0 8px">
          服务时间：<strong style="color: var(--text)">{{
            system?.server_time ? new Date(system.server_time * 1000).toLocaleString() : "—"
          }}</strong>
        </p>
        <p
          v-if="system?.runtime?.hostname"
          style="margin: 0"
        >
          主机 <code class="pre-block" style="display: inline; padding: 2px 8px; max-height: none">{{ system.runtime.hostname }}</code>
          · Python {{ system.runtime.python ?? "—" }}
        </p>
      </div>
    </div>

    <div class="row-actions">
      <button
        type="button"
        class="btn btn--primary"
        @click="load"
      >
        刷新数据
      </button>
    </div>
  </div>
</template>
