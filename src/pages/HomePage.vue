<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
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

const runtime = computed(() => system.value?.runtime ?? null);

function fmtBytes(n: number | null | undefined): string {
  if (n == null || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  const decimals = u === 0 ? 0 : u >= 3 ? 2 : 1;
  return `${v.toFixed(decimals)} ${units[u]}`;
}

function uptimeFromBoot(boot: number | null | undefined): string {
  if (boot == null) return "—";
  const nowSec = Date.now() / 1000;
  let s = Math.max(0, nowSec - boot);
  const d = Math.floor(s / 86400);
  s %= 86400;
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  if (d > 0) return `${d} 天 ${h} 小时`;
  if (h > 0) return `${h} 小时 ${m} 分`;
  return `${m} 分`;
}

function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

const perfSampled = computed(() => {
  const r = runtime.value;
  if (!r) return false;
  return (
    r.cpu_percent != null ||
    r.memory?.percent != null ||
    (r.memory?.used != null && r.memory?.total != null) ||
    r.disk?.percent != null ||
    (r.disk?.used != null && r.disk?.total != null) ||
    r.boot_time != null
  );
});

const cpuDisplay = computed(() => pct(runtime.value?.cpu_percent ?? null));
const memDisplay = computed(() => {
  const m = runtime.value?.memory;
  if (m?.percent != null) return pct(m.percent);
  if (m?.used != null && m?.total != null && m.total > 0) return pct((m.used / m.total) * 100);
  return "—";
});
const memHint = computed(() => {
  const m = runtime.value?.memory;
  if (!m) return undefined;
  return `${fmtBytes(m.used)} / ${fmtBytes(m.total)}`;
});
const diskDisplay = computed(() => {
  const d = runtime.value?.disk;
  if (d?.percent != null) return pct(d.percent);
  if (d?.used != null && d?.total != null && d.total > 0) return pct((d.used / d.total) * 100);
  return "—";
});
const diskHint = computed(() => {
  const d = runtime.value?.disk;
  if (!d) return undefined;
  return `${fmtBytes(d.used)} / ${fmtBytes(d.total)} · 可用 ${fmtBytes(d.free)}`;
});
const uptimeDisplay = computed(() => uptimeFromBoot(runtime.value?.boot_time ?? null));
const uptimeHint = computed(() => runtime.value?.platform || undefined);

function barPct(
  direct: number | null | undefined,
  used: number | null | undefined,
  total: number | null | undefined,
): number | null {
  if (direct != null && !Number.isNaN(direct)) return Math.min(100, Math.max(0, direct));
  if (used != null && total != null && total > 0) return Math.min(100, Math.max(0, (used / total) * 100));
  return null;
}

const cpuBarPct = computed(() => barPct(runtime.value?.cpu_percent ?? null, null, null));
const memBarPct = computed(() =>
  barPct(runtime.value?.memory?.percent ?? null, runtime.value?.memory?.used ?? null, runtime.value?.memory?.total ?? null),
);
const diskBarPct = computed(() =>
  barPct(runtime.value?.disk?.percent ?? null, runtime.value?.disk?.used ?? null, runtime.value?.disk?.total ?? null),
);

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
  <div class="home-page">
    <header class="page-hero page-hero--with-actions">
      <div class="page-hero__main">
        <p class="page-hero__eyebrow">Dashboard</p>
        <h1 class="page-hero__title">运行态势</h1>
        <p class="page-hero__desc">
          面向生产运维的一屏摘要：编排器与业务进程状态、消息吞吐、已登记账号及常用接入入口。协议进程级状态请在「实例与连接」核对。
        </p>
      </div>
      <div class="page-hero__actions">
        <button
          type="button"
          class="btn btn--primary"
          @click="load"
        >
          刷新
        </button>
      </div>
    </header>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <div class="home-dashboard">
      <section class="home-dashboard__accounts">
        <div class="panel home-page__panel">
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
      </section>

      <section class="home-dashboard__perf">
        <div class="panel home-page__panel">
          <div class="panel__hd">
            <h2 class="panel__title">系统性能</h2>
            <span class="home-page__panel-tag">节点采样</span>
          </div>
          <div class="panel__bd">
            <p
              v-if="!perfSampled"
              class="muted home-page__empty"
            >
              当前未上报 CPU/内存/磁盘等指标。请确认后端已启用系统快照并刷新。
            </p>
            <div
              v-else
              class="home-metric-grid"
            >
              <div class="home-metric">
                <div class="home-metric__row">
                  <span class="home-metric__label">CPU</span>
                  <span class="home-metric__val">{{ cpuDisplay }}</span>
                </div>
                <div
                  v-if="cpuBarPct != null"
                  class="home-metric__bar"
                  aria-hidden="true"
                >
                  <span :style="{ width: `${cpuBarPct}%` }" />
                </div>
              </div>
              <div class="home-metric">
                <div class="home-metric__row">
                  <span class="home-metric__label">内存</span>
                  <span class="home-metric__val">{{ memDisplay }}</span>
                </div>
                <div
                  v-if="memBarPct != null"
                  class="home-metric__bar"
                  aria-hidden="true"
                >
                  <span :style="{ width: `${memBarPct}%` }" />
                </div>
                <p
                  v-if="memHint"
                  class="home-metric__hint"
                >
                  {{ memHint }}
                </p>
              </div>
              <div class="home-metric">
                <div class="home-metric__row">
                  <span class="home-metric__label">磁盘</span>
                  <span class="home-metric__val">{{ diskDisplay }}</span>
                </div>
                <div
                  v-if="diskBarPct != null"
                  class="home-metric__bar"
                  aria-hidden="true"
                >
                  <span :style="{ width: `${diskBarPct}%` }" />
                </div>
                <p
                  v-if="diskHint"
                  class="home-metric__hint"
                >
                  {{ diskHint }}
                </p>
              </div>
              <div class="home-metric home-metric--plain">
                <div class="home-metric__row">
                  <span class="home-metric__label">运行时长</span>
                  <span class="home-metric__val home-metric__val--sm">{{ uptimeDisplay }}</span>
                </div>
                <p
                  v-if="uptimeHint"
                  class="home-metric__hint"
                >
                  {{ uptimeHint }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="home-dashboard__capacity">
        <div class="grid-stats home-page__capacity-grid">
          <StatCard
            dense
            label="已加载插件"
            :value="system?.plugin_count ?? '—'"
            hint="进程内模块"
          />
          <StatCard
            dense
            label="在线 Bot"
            :value="botCount"
            :hint="`登记账号 ${system?.bot_count ?? '—'}`"
          />
          <StatCard
            dense
            label="消息 收/发"
            :value="stats ? `${stats.total_received} / ${stats.total_sent}` : '—'"
            :hint="
              stats?.today_received != null
                ? `本日 ${stats.today_received} / ${stats.today_sent ?? '—'}`
                : undefined
            "
          />
        </div>
      </section>
    </div>

    <div class="panel home-page__panel">
      <div class="panel__hd">
        <h2 class="panel__title">接入与基址</h2>
        <RouterLink
          class="link-quiet"
          to="/instances"
          style="font-size: 13px"
        >实例与连接 →</RouterLink>
      </div>
      <div class="panel__bd">
        <div class="link-grid home-page__link-grid">
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
            <span class="link-card__title">牛牛对外基址</span>
            <span class="link-card__meta">{{ botBase }}</span>
          </a>
          <div
            v-else
            class="link-card"
          >
            <span class="link-card__label">HTTP</span>
            <span class="link-card__title">牛牛对外基址</span>
            <span class="link-card__meta muted">未下发 console.http_base，请检查后端配置</span>
          </div>
          <div class="link-card">
            <span class="link-card__label">Driver</span>
            <span class="link-card__title">监听地址（参考）</span>
            <span class="link-card__meta">{{ driverHint ?? "—" }}</span>
          </div>
        </div>

        <div class="row-actions">
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

    <div class="panel home-page__panel">
      <div class="panel__hd">
        <h2 class="panel__title">版本与运行环境</h2>
        <span
          v-if="health?.ok"
          class="badge badge--ok"
        >API 可用</span>
      </div>
      <div class="panel__bd muted home-page__version">
        <dl class="home-dl">
          <dt>NoneBot2</dt>
          <dd>{{ health?.nonebot2 ?? "—" }} <span class="home-dl__sub">编排器</span></dd>
          <dt>Pallas-Bot</dt>
          <dd>{{ health?.pallas_bot ?? "—" }} <span class="home-dl__sub">业务进程</span></dd>
          <dt>控制台资源</dt>
          <dd>
            <strong style="color: var(--text)">{{ health?.console?.version ?? "—" }}</strong>
            <span v-if="health?.console?.commit" class="home-dl__sub">{{ health.console.commit }}</span>
          </dd>
          <dt>服务时间</dt>
          <dd>{{ system?.server_time ? new Date(system.server_time * 1000).toLocaleString() : "—" }}</dd>
          <template v-if="system?.runtime?.hostname">
            <dt>主机 / Python</dt>
            <dd>
              <code class="home-dl__code">{{ system.runtime.hostname }}</code>
              <span class="home-dl__sub">{{ system.runtime.python ?? "—" }}</span>
            </dd>
          </template>
        </dl>
      </div>
    </div>
  </div>
</template>
