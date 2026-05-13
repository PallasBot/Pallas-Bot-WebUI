<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { fetchHealth } from "@/api/health";
import type { HealthResponse } from "@/api/health";
import {
  fetchBots,
  fetchFriendList,
  fetchGroupList,
  fetchInstances,
  fetchMessageStats,
  fetchPluginRunStats,
  fetchSystem,
} from "@/api/consoleApi";
import type {
  BotRow,
  FriendListData,
  GroupListData,
  InstancesData,
  MessageStatsData,
  PluginRunStatsData,
  SystemData,
} from "@/api/pallasTypes";
import StatCard from "@/components/StatCard.vue";
import HomePluginRunCharts from "@/components/HomePluginRunCharts.vue";
import { accountHasNonebotBot } from "@/utils/botConnection";
import { botFavoriteAccounts } from "@/utils/botFavorites";
import { qqAvatarUrl } from "@/utils/botDisplay";
import { botHttpBaseFromSystem, consolePublicRoot, nonebotDriverHint } from "@/utils/protocolLinks";
import type { PluginRunSample } from "@/utils/pluginRunHistory";
import { pushPluginRunSample, readPluginRunSeries } from "@/utils/pluginRunHistory";

const err = ref("");
const health = ref<HealthResponse | null>(null);
const system = ref<SystemData | null>(null);
const stats = ref<MessageStatsData | null>(null);
const statsScoped = ref<MessageStatsData | null>(null);
const pluginRunStats = ref<PluginRunStatsData | null>(null);
const pluginRunStatsScoped = ref<PluginRunStatsData | null>(null);
const botCount = ref(0);
const bots = ref<BotRow[]>([]);
const instances = ref<InstancesData | null>(null);
const selectedAccount = ref<number | null>(null);
const friendSnap = ref<FriendListData | null>(null);
const groupSnap = ref<GroupListData | null>(null);
const socialBusy = ref(false);

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

function dbNick(account: number): string {
  return instances.value?.bot_profiles?.[String(account)]?.nickname?.trim() || "";
}

const sortedDbBots = computed(() => {
  const rows = [...(instances.value?.db_bot_configs ?? [])];
  rows.sort((a, b) => {
    const fa = botFavoriteAccounts.value.has(a.account) ? 1 : 0;
    const fb = botFavoriteAccounts.value.has(b.account) ? 1 : 0;
    if (fa !== fb) return fb - fa;
    const ca = accountHasNonebotBot(instances.value?.nonebot_bots, a.account) ? 1 : 0;
    const cb = accountHasNonebotBot(instances.value?.nonebot_bots, b.account) ? 1 : 0;
    if (ca !== cb) return cb - ca;
    const na = (dbNick(a.account) || "").toLowerCase();
    const nb = (dbNick(b.account) || "").toLowerCase();
    const cmp = na.localeCompare(nb, "zh-CN");
    if (cmp !== 0) return cmp;
    return a.account - b.account;
  });
  return rows;
});

function ensureSelectedAccount() {
  const rows = sortedDbBots.value;
  if (!rows.length) {
    selectedAccount.value = null;
    return;
  }
  if (selectedAccount.value != null && rows.some((r) => r.account === selectedAccount.value)) return;
  selectedAccount.value = rows[0]!.account;
}

const selectedConnected = computed(() => {
  const acc = selectedAccount.value;
  if (acc == null) return false;
  return accountHasNonebotBot(instances.value?.nonebot_bots, acc);
});

const msgMainStats = computed(() => statsScoped.value ?? stats.value);

const msgTotalStr = computed(() => {
  const s = msgMainStats.value;
  if (!s) return "—";
  return `${s.total_received} / ${s.total_sent}`;
});

const scopedBotStatsRow = computed(() => {
  const acc = selectedAccount.value;
  const st = msgMainStats.value;
  if (acc == null || !st?.bots?.length) return null;
  const sid = String(acc);
  return st.bots.find((b) => b.self_id === sid) ?? null;
});

const apiTodayTotalStr = computed(() => {
  const r = scopedBotStatsRow.value;
  if (!r || r.today_api_calls == null) return "—";
  return String(r.today_api_calls);
});

const apiTodayTopStr = computed(() => {
  const r = scopedBotStatsRow.value;
  if (!r) return "—";
  const name = r.today_top_api?.trim();
  if (!name) return "—";
  const c = r.today_top_api_count ?? 0;
  return `${name}（${c} 次）`;
});

function downsampleApiHist(pts: { at: number; total: number }[], maxBars: number): { at: number; total: number }[] {
  if (pts.length <= maxBars) return pts;
  const g = Math.ceil(pts.length / maxBars);
  const out: { at: number; total: number }[] = [];
  for (let i = 0; i < pts.length; i += g) {
    const chunk = pts.slice(i, i + g);
    const total = chunk.reduce((s, p) => s + p.total, 0);
    const at = chunk[0]!.at;
    out.push({ at, total });
  }
  return out;
}

const scopedApiHistBars = computed(() => {
  const raw = scopedBotStatsRow.value?.api_calls_history ?? [];
  const pts = downsampleApiHist(raw, 96);
  if (!pts.length) return [] as { pct: number; tooltip: string }[];
  const max = Math.max(...pts.map((p) => p.total), 1);
  return pts.map((p) => ({
    pct: p.total <= 0 ? 4 : Math.max(10, Math.round((p.total / max) * 100)),
    tooltip: `${new Date(p.at * 1000).toLocaleString()} · ${p.total} 次`,
  }));
});

const apiHistBucketLabel = computed(() => {
  const sec = msgMainStats.value?.api_calls_history_bucket_sec ?? 300;
  if (sec >= 3600 && sec % 3600 === 0) return `${sec / 3600} 小时`;
  if (sec >= 60 && sec % 60 === 0) return `${sec / 60} 分钟`;
  return `${sec} 秒`;
});

const apiHistAria = computed(() => {
  const raw = scopedBotStatsRow.value?.api_calls_history ?? [];
  if (!raw.length) return "";
  const max = Math.max(...raw.map((p) => p.total), 0);
  return `近 24 小时协议 API 成功调用，桶宽 ${apiHistBucketLabel.value}，峰值 ${max} 次`;
});

const pluginRunMain = computed(() => pluginRunStatsScoped.value ?? pluginRunStats.value);

const scopedPluginRunRow = computed(() => {
  const acc = selectedAccount.value;
  const pr = pluginRunMain.value;
  if (acc == null || !pr?.bots?.length) return null;
  const sid = String(acc);
  return pr.bots.find((b) => b.self_id === sid) ?? null;
});

const scopedPluginPlugins = computed(() => scopedPluginRunRow.value?.plugins ?? []);

const pluginRunTimeSamples = ref<PluginRunSample[]>([]);

function syncPluginRunSeriesFromStorage() {
  const acc = selectedAccount.value;
  pluginRunTimeSamples.value = acc != null ? readPluginRunSeries(String(acc)) : [];
}

const msgCapacityHint = computed(() => {
  const s = msgMainStats.value;
  if (!s || (s.today_received == null && s.today_sent == null)) return "全部账号合计";
  return `本日收 ${s.today_received ?? "—"} / 发 ${s.today_sent ?? "—"}（合计）`;
});

const friendCount = computed(() => friendSnap.value?.friends?.length ?? null);
const groupCount = computed(() => groupSnap.value?.groups?.length ?? null);

async function refreshSelectedBotDetails() {
  const acc = selectedAccount.value;
  if (acc == null) {
    statsScoped.value = null;
    pluginRunStatsScoped.value = null;
    friendSnap.value = null;
    groupSnap.value = null;
    return;
  }
  socialBusy.value = true;
  try {
    const [ms, prs, fl, gl] = await Promise.all([
      fetchMessageStats(acc),
      fetchPluginRunStats(acc),
      fetchFriendList(acc),
      fetchGroupList(acc),
    ]);
    statsScoped.value = ms;
    pluginRunStatsScoped.value = prs;
    friendSnap.value = fl;
    groupSnap.value = gl;
  } catch {
    statsScoped.value = null;
    pluginRunStatsScoped.value = null;
    friendSnap.value = null;
    groupSnap.value = null;
  } finally {
    socialBusy.value = false;
  }
}

watch(selectedAccount, () => {
  syncPluginRunSeriesFromStorage();
  void refreshSelectedBotDetails();
});

watch([scopedPluginRunRow, selectedAccount, socialBusy], ([row, acc, busy]) => {
  if (busy || acc == null || !row) return;
  pushPluginRunSample(String(acc), row.runs_today, row.plugins ?? []);
  syncPluginRunSeriesFromStorage();
});

watch(sortedDbBots, () => {
  ensureSelectedAccount();
});

async function load() {
  err.value = "";
  try {
    const [h, s, m, pr, botList, inst] = await Promise.all([
      fetchHealth(),
      fetchSystem(),
      fetchMessageStats(),
      fetchPluginRunStats(),
      fetchBots(),
      fetchInstances(),
    ]);
    health.value = h;
    system.value = s;
    stats.value = m;
    pluginRunStats.value = pr;
    bots.value = botList;
    instances.value = inst;
    botCount.value = botList.length;
    botBase.value = botHttpBaseFromSystem(s);
    driverHint.value = nonebotDriverHint(s);
    ensureSelectedAccount();
    await refreshSelectedBotDetails();
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
          <div class="panel__hd home-account-panel__hd">
            <div class="home-account-panel__hd-main">
              <h2 class="panel__title">账户信息</h2>
              <RouterLink
                class="link-quiet"
                to="/instances"
                style="font-size: 13px"
              >连接详情 →</RouterLink>
            </div>
            <div
              v-if="sortedDbBots.length"
              class="home-account-bot-pick"
            >
              <label
                class="visually-hidden"
                for="home-db-bot-sel"
              >选择数据库 Bot</label>
              <select
                id="home-db-bot-sel"
                v-model.number="selectedAccount"
                class="sel home-account-bot-pick__sel"
              >
                  <option
                    v-for="c in sortedDbBots"
                    :key="c.account"
                    :value="c.account"
                  >
                    {{ dbNick(c.account) || "BOT" }} · {{ c.account }}
                  </option>
              </select>
            </div>
          </div>
          <div class="panel__bd">
            <p
              v-if="!sortedDbBots.length"
              class="muted"
              style="margin: 0"
            >
              数据库中暂无 Bot 配置记录。请在后端创建 <code>bot_config</code> 后刷新。
            </p>
            <template v-else>
              <div
                v-if="selectedAccount != null"
                class="home-account-split-bd"
              >
                <div class="home-account-split-col">
                  <div class="home-account-hero">
                    <div class="home-account-hero__avatar">
                      <img
                        :src="qqAvatarUrl(selectedAccount)"
                        alt=""
                        width="72"
                        height="72"
                        decoding="async"
                        referrerpolicy="no-referrer"
                        @error="($event.target as HTMLImageElement).style.visibility = 'hidden'"
                      >
                    </div>
                    <div class="home-account-hero__main">
                      <div class="home-account-hero__title">
                        {{ dbNick(selectedAccount) || "BOT" }}
                        <span
                          :class="
                            selectedConnected
                              ? 'data-conn-capsule data-conn-capsule--on'
                              : 'data-conn-capsule data-conn-capsule--off'
                          "
                          style="margin-left: 8px; vertical-align: middle"
                        >{{ selectedConnected ? "已连接" : "未连接" }}</span>
                      </div>
                      <p class="home-account-hero__sub muted">账号 {{ selectedAccount }}</p>
                      <dl class="home-account-dl home-account-dl--tight">
                        <div>
                          <dt>好友数量</dt>
                          <dd>{{ socialBusy ? "…" : friendCount ?? "—" }}</dd>
                        </div>
                        <div>
                          <dt>群数量</dt>
                          <dd>{{ socialBusy ? "…" : groupCount ?? "—" }}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
                <div class="home-account-split-col home-account-split-col--calls">
                  <dl class="home-account-dl home-account-dl--calls">
                    <div>
                      <dt>消息 收/发</dt>
                      <dd>{{ msgTotalStr }}</dd>
                    </div>
                    <div>
                      <dt>今日 API 调用</dt>
                      <dd>{{ socialBusy ? "…" : apiTodayTotalStr }}</dd>
                    </div>
                    <div>
                      <dt>今日调用最多</dt>
                      <dd>{{ socialBusy ? "…" : apiTodayTopStr }}</dd>
                    </div>
                    <div v-if="(scopedPluginRunRow?.errors_today ?? 0) > 0">
                      <dt>Matcher 异常（今日）</dt>
                      <dd>{{ socialBusy ? "…" : (scopedPluginRunRow?.errors_today ?? 0) }}</dd>
                    </div>
                  </dl>
                  <div
                    v-if="scopedApiHistBars.length && !socialBusy"
                    class="home-api-hist"
                  >
                    <p class="muted home-api-hist__caption">
                      协议 API 成功调用（近 24h，{{ apiHistBucketLabel }} 桶）
                    </p>
                    <div
                      class="home-api-hist__bars"
                      role="img"
                      :aria-label="apiHistAria"
                    >
                      <div
                        v-for="(b, idx) in scopedApiHistBars"
                        :key="idx"
                        class="home-api-hist__barwrap"
                        :title="b.tooltip"
                      >
                        <div
                          class="home-api-hist__bar"
                          :style="{ height: `${b.pct}%` }"
                        />
                      </div>
                    </div>
                  </div>
                  <HomePluginRunCharts
                    :plugins="scopedPluginPlugins"
                    :series="pluginRunTimeSamples"
                    :busy="socialBusy"
                  />
                </div>
              </div>
            </template>
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
            :value="msgTotalStr"
            :hint="msgCapacityHint"
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
            to="/friends-groups"
          >好友与群</RouterLink>
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

<style scoped>
.home-api-hist {
  margin-top: 10px;
  padding-top: 4px;
  border-top: 1px solid var(--border, rgba(148, 163, 184, 0.25));
}
.home-api-hist__caption {
  margin: 0 0 6px;
  font-size: 12px;
}
.home-api-hist__bars {
  display: flex;
  align-items: flex-end;
  gap: 1px;
  height: 40px;
  overflow-x: auto;
  padding: 2px 0 4px;
}
.home-api-hist__barwrap {
  flex: 1 0 2px;
  min-width: 2px;
  max-width: 5px;
  height: 100%;
  display: flex;
  align-items: flex-end;
}
.home-api-hist__bar {
  width: 100%;
  min-height: 2px;
  background: color-mix(in srgb, var(--accent) 75%, transparent);
  border-radius: 2px 2px 0 0;
}
</style>
