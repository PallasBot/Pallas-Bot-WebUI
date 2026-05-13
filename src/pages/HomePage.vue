<script setup lang="ts">
import { onMounted, ref } from "vue";
import { fetchHealth } from "@/api/health";
import type { HealthResponse } from "@/api/health";
import { fetchBots, fetchInstances, fetchMessageStats, fetchSystem } from "@/api/consoleApi";
import type { InstancesData, MessageStatsData, SystemData } from "@/api/pallasTypes";
import StatCard from "@/components/StatCard.vue";
import { botHttpBaseFromSystem, consolePublicRoot, nonebotDriverHint, protocolSnapshot } from "@/utils/protocolLinks";

const err = ref("");
const health = ref<HealthResponse | null>(null);
const system = ref<SystemData | null>(null);
const stats = ref<MessageStatsData | null>(null);
const botCount = ref(0);
const instances = ref<InstancesData | null>(null);

const consoleRoot = consolePublicRoot();
const botBase = ref<string | null>(null);
const driverHint = ref<string | null>(null);

function yn(v: unknown): string {
  if (v === true) return "是";
  if (v === false) return "否";
  return "—";
}

async function load() {
  err.value = "";
  try {
    const [h, s, m, bots, inst] = await Promise.all([
      fetchHealth(),
      fetchSystem(),
      fetchMessageStats(),
      fetchBots(),
      fetchInstances(),
    ]);
    health.value = h;
    system.value = s;
    stats.value = m;
    botCount.value = bots.length;
    instances.value = inst;
    botBase.value = botHttpBaseFromSystem(s);
    driverHint.value = nonebotDriverHint(s);
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
        与 Pallas-Bot 控制台 API 直连：健康检查、系统摘要与消息统计在一屏呈现；下方为常用入口与协议账号状态（不展示各账号原生 WebUI 地址）。
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
        <h2 class="panel__title">协议与外链</h2>
        <RouterLink
          class="link-quiet"
          to="/instances"
          style="font-size: 13px"
        >实例详情 →</RouterLink>
      </div>
      <div class="panel__bd">
        <div class="link-grid">
          <a
            class="link-card"
            :href="`${consoleRoot}/`"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="link-card__label">Console</span>
            <span class="link-card__title">本控制台</span>
            <span class="link-card__meta">{{ consoleRoot }}/</span>
          </a>
          <a
            v-if="botBase"
            class="link-card"
            :href="botBase"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="link-card__label">HTTP</span>
            <span class="link-card__title">机器人服务基址</span>
            <span class="link-card__meta">{{ botBase }}</span>
          </a>
          <div
            v-else
            class="link-card"
          >
            <span class="link-card__label">HTTP</span>
            <span class="link-card__title">机器人服务基址</span>
            <span class="link-card__meta muted">后端未返回 console.http_base</span>
          </div>
          <div class="link-card">
            <span class="link-card__label">Driver</span>
            <span class="link-card__title">NoneBot 监听（参考）</span>
            <span class="link-card__meta">{{ driverHint ?? "—" }}</span>
          </div>
        </div>

        <p
          v-if="(protocolSnapshot(instances)?.accounts?.length ?? 0) > 0"
          class="muted"
          style="margin: 18px 0 8px; font-weight: 600"
        >
          协议账号状态（不展示原生 WebUI）
        </p>
        <div
          v-if="(protocolSnapshot(instances)?.accounts?.length ?? 0) > 0"
          class="link-grid"
        >
          <div
            v-for="(a, idx) in protocolSnapshot(instances)?.accounts ?? []"
            :key="idx"
            class="link-card"
          >
            <span class="link-card__label">协议账号</span>
            <span class="link-card__title">{{ a.qq ?? a.id ?? "—" }}</span>
            <span class="link-card__meta muted">进程 {{ yn(a.process_running ?? a.running) }} · 已连接 {{ yn(a.connected) }}</span>
          </div>
        </div>
        <p
          v-else
          class="muted"
          style="margin: 12px 0 0"
        >
          当前实例快照中无协议账号（或未启用 pallas_protocol）。
        </p>
        <div
          class="row-actions"
          style="margin-top: 16px"
        >
          <RouterLink
            class="btn btn--primary"
            to="/bot-social-config"
          >好友/群颗粒配置</RouterLink>
          <RouterLink
            class="btn"
            to="/friends"
          >好友管理</RouterLink>
          <RouterLink
            class="btn"
            to="/groups"
          >群管理</RouterLink>
        </div>
      </div>
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
