<script setup lang="ts">
import { onMounted, ref } from "vue";
import { fetchHealth } from "@/api/health";
import type { HealthResponse } from "@/api/health";
import { fetchBots, fetchMessageStats, fetchSystem } from "@/api/consoleApi";
import type { BotRow, MessageStatsData, SystemData } from "@/api/pallasTypes";
import StatCard from "@/components/StatCard.vue";
import { botHttpBaseFromSystem, consolePublicRoot, nonebotDriverHint } from "@/utils/protocolLinks";

const err = ref("");
const health = ref<HealthResponse | null>(null);
const system = ref<SystemData | null>(null);
const stats = ref<MessageStatsData | null>(null);
const botCount = ref(0);
const bots = ref<BotRow[]>([]);

const consoleRoot = consolePublicRoot();
const botBase = ref<string | null>(null);
const driverHint = ref<string | null>(null);

async function load() {
  err.value = "";
  try {
    const [h, s, m, botList] = await Promise.all([
      fetchHealth(),
      fetchSystem(),
      fetchMessageStats(),
      fetchBots(),
    ]);
    health.value = h;
    system.value = s;
    stats.value = m;
    bots.value = botList;
    botCount.value = botList.length;
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
        面向生产运维的一屏摘要：编排器与业务进程状态、消息吞吐、已登记账号及常用接入入口。协议进程级状态请在「实例与连接」核对。
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
        hint="编排器就绪探活"
      />
      <StatCard
        label="Pallas-Bot"
        :value="health?.pallas_bot ?? '—'"
        hint="业务进程状态"
      />
      <StatCard
        label="已加载插件"
        :value="system?.plugin_count ?? '—'"
        hint="当前进程内模块数"
      />
      <StatCard
        label="在线 Bot"
        :value="botCount"
        :hint="`配置登记账号数：${system?.bot_count ?? '—'}`"
      />
      <StatCard
        label="消息 · 收 / 发"
        :value="stats ? `${stats.total_received} / ${stats.total_sent}` : '—'"
        :hint="
          stats?.today_received != null
            ? `本日累计 ${stats.today_received} / ${stats.today_sent ?? '—'}`
            : undefined
        "
      />
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">账户信息</h2>
        <RouterLink
          class="link-quiet"
          to="/instances"
          style="font-size: 13px"
        >连接详情 →</RouterLink>
      </div>
      <div class="panel__bd">
        <p
          v-if="!bots.length"
          class="muted"
          style="margin: 0"
        >
          当前无已登记在线账号。请在后端核对 Bot 配置与适配器连接后刷新。
        </p>
        <div
          v-else
          class="table-wrap"
        >
          <table class="data">
            <thead>
              <tr>
                <th>账号标识</th>
                <th>适配器</th>
                <th>连接键</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(b, idx) in bots"
                :key="`${b.connection_key}-${idx}`"
              >
                <td style="font-weight: 600">{{ b.self_id }}</td>
                <td class="muted">{{ b.adapter }}</td>
                <td class="muted" style="font-size: 12px; word-break: break-all">{{ b.connection_key }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">接入与基址</h2>
        <RouterLink
          class="link-quiet"
          to="/instances"
          style="font-size: 13px"
        >实例与连接 →</RouterLink>
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
            <span class="link-card__title">机器人对外基址</span>
            <span class="link-card__meta">{{ botBase }}</span>
          </a>
          <div
            v-else
            class="link-card"
          >
            <span class="link-card__label">HTTP</span>
            <span class="link-card__title">机器人对外基址</span>
            <span class="link-card__meta muted">未下发 console.http_base，请检查后端配置</span>
          </div>
          <div class="link-card">
            <span class="link-card__label">Driver</span>
            <span class="link-card__title">监听地址（参考）</span>
            <span class="link-card__meta">{{ driverHint ?? "—" }}</span>
          </div>
        </div>

        <div
          class="row-actions"
          style="margin-top: 16px"
        >
          <RouterLink
            class="btn btn--primary"
            to="/protocol"
          >协议端管理</RouterLink>
          <RouterLink
            class="btn"
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
        <h2 class="panel__title">版本与运行环境</h2>
        <span
          v-if="health?.ok"
          class="badge badge--ok"
        >API 可用</span>
      </div>
      <div class="panel__bd muted">
        <p style="margin: 0 0 8px">
          控制台静态资源：<strong style="color: var(--text)">{{ health?.console?.version ?? "—" }}</strong>
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
        刷新
      </button>
    </div>
  </div>
</template>
