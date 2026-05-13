<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { fetchHealth } from "@/api/health";
import type { HealthResponse } from "@/api/health";
import {
  fetchBots,
  fetchBotUpdateCheck,
  fetchFriendList,
  fetchGroupList,
  fetchInstances,
  fetchMessageStats,
  fetchPluginRunStats,
  fetchPlugins,
  fetchSystem,
} from "@/api/consoleApi";
import type {
  BotRow,
  BotUpdateCheckData,
  FriendListData,
  GroupListData,
  InstancesData,
  MessageStatsData,
  NapcatAccountRow,
  PluginRow,
  PluginRunStatsData,
  SystemData,
} from "@/api/pallasTypes";
import StatCard from "@/components/StatCard.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import HomePluginRunCharts from "@/components/HomePluginRunCharts.vue";
import { accountHasNonebotBot } from "@/utils/botConnection";
import { botFavoriteAccounts } from "@/utils/botFavorites";
import { qqAvatarUrl } from "@/utils/botDisplay";
import { protocolSnapshot, accountWebUiHref, protocolDashboardUrl } from "@/utils/protocolLinks";
import type { PluginRunSample } from "@/utils/pluginRunHistory";
import { pushPluginRunSample, readPluginRunSeries } from "@/utils/pluginRunHistory";

const err = ref("");
const health = ref<HealthResponse | null>(null);
const botUpdateCheck = ref<BotUpdateCheckData | null>(null);
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
/** 首屏主内容区：与全站骨架一致，数据就绪后再渲染 */
const pageReady = ref(false);

const pluginsList = ref<PluginRow[]>([]);

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

const pallasBotVersionDisplay = computed(() => {
  const b = botUpdateCheck.value;
  const tag = (b?.current_tag || "").trim();
  const commitFull = (b?.current_commit || "").trim();
  const short = commitFull.length >= 7 ? commitFull.slice(0, 7) : commitFull;
  if (tag) {
    return short && short !== tag ? `${tag} · ${short}` : tag;
  }
  if (short) {
    return `git ${short}`;
  }
  return health.value?.pallas_bot ?? "—";
});

const versionServerTimeStr = computed(() => {
  const t = system.value?.server_time;
  if (t == null) return "—";
  return new Date(t * 1000).toLocaleString();
});

function napcatAccountMatchesBot(row: NapcatAccountRow, account: number): boolean {
  const sid = String(account);
  const q = row.qq != null ? String(row.qq).trim() : "";
  if (q && q === sid) return true;
  const id = row.id != null ? String(row.id).trim() : "";
  return id === sid;
}

const napcatSnap = computed(() => protocolSnapshot(instances.value));

const matchedNapcatRow = computed((): NapcatAccountRow | null => {
  const acc = selectedAccount.value;
  if (acc == null) return null;
  const rows = napcatSnap.value?.accounts ?? [];
  return rows.find((r) => napcatAccountMatchesBot(r, acc)) ?? null;
});

const accountAdapterDisplay = computed(() => {
  const acc = selectedAccount.value;
  if (acc == null) return "—";
  const raw = instances.value?.bot_profiles?.[String(acc)]?.adapter;
  const ad = raw != null ? String(raw).trim() : "";
  return ad || "—";
});

const nativeProtocolWebUiHref = computed(() => {
  const row = matchedNapcatRow.value;
  if (!row) return null;
  return accountWebUiHref(row, system.value);
});

const protocolBuiltInManageHref = computed(() => protocolDashboardUrl(system.value, napcatSnap.value));

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

const selectedBotConfig = computed(() => {
  const acc = selectedAccount.value;
  if (acc == null) return null;
  return sortedDbBots.value.find((r) => r.account === acc) ?? null;
});

const selectedAdminsDisplay = computed(() => {
  const admins = selectedBotConfig.value?.admins;
  if (!admins?.length) return "—";
  return admins.map((id) => String(id)).join("、");
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

const msgRecvSentPair = computed(() => {
  const s = msgMainStats.value;
  if (!s) return { recv: "—", sent: "—" };
  return {
    recv: s.total_received != null ? String(s.total_received) : "—",
    sent: s.total_sent != null ? String(s.total_sent) : "—",
  };
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

function pluginModuleDisplayName(moduleName: string): string {
  const row = pluginsList.value.find((p) => p.name === moduleName);
  const t = row?.metadata?.name?.trim();
  return t || moduleName;
}

const pluginTodayTopStr = computed(() => {
  const row = scopedPluginRunRow.value;
  const plugins = row?.plugins ?? [];
  if (!plugins.length) return "—";
  const byToday = [...plugins].sort((a, b) => (b.runs_today ?? 0) - (a.runs_today ?? 0));
  const topT = byToday[0]!;
  const nt = topT.runs_today ?? 0;
  if (nt > 0) {
    return `${pluginModuleDisplayName(topT.name)}（${nt} 次）`;
  }
  const byRuns = [...plugins].sort((a, b) => (b.runs ?? 0) - (a.runs ?? 0));
  const topR = byRuns[0]!;
  const nr = topR.runs ?? 0;
  if (nr > 0) return `${pluginModuleDisplayName(topR.name)}（累计 ${nr}）`;
  return "—";
});

const scopedApiCallsByApi = computed(() => scopedBotStatsRow.value?.api_calls_history_by_api ?? []);

const pluginRunMain = computed(() => pluginRunStatsScoped.value ?? pluginRunStats.value);

const scopedPluginRunRow = computed(() => {
  const acc = selectedAccount.value;
  const pr = pluginRunMain.value;
  if (acc == null || !pr?.bots?.length) return null;
  const sid = String(acc);
  return pr.bots.find((b) => b.self_id === sid) ?? null;
});

const scopedPluginPlugins = computed(() => scopedPluginRunRow.value?.plugins ?? []);

const scopedMatcherRunsByPlugin = computed(() => scopedPluginRunRow.value?.matcher_runs_by_plugin ?? []);

const scopedMatcherErrorsByPlugin = computed(() => scopedPluginRunRow.value?.matcher_errors_by_plugin ?? []);

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
    const [h, s, m, pr, botList, inst, pl, botCh] = await Promise.all([
      fetchHealth(),
      fetchSystem(),
      fetchMessageStats(),
      fetchPluginRunStats(),
      fetchBots(),
      fetchInstances(),
      fetchPlugins(),
      fetchBotUpdateCheck().catch(() => null),
    ]);
    health.value = h;
    botUpdateCheck.value = (botCh as BotUpdateCheckData | null) ?? null;
    system.value = s;
    stats.value = m;
    pluginRunStats.value = pr;
    bots.value = botList;
    instances.value = inst;
    pluginsList.value = pl;
    botCount.value = botList.length;
    ensureSelectedAccount();
    await refreshSelectedBotDetails();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    pageReady.value = true;
  }
}

onMounted(load);
</script>

<template>
  <div class="home-page">
    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="4"
    />
    <div
      v-else
      class="home-page__body"
    >
    <div class="home-dashboard">
      <section class="home-dashboard__accounts">
        <div class="panel home-page__panel">
          <div class="panel__hd home-account-panel__hd">
            <div class="home-account-panel__hd-main">
              <h2 class="panel__title">
                <span class="panel__title-ico" aria-hidden="true">◎</span>账户信息
              </h2>
              <RouterLink
                class="home-instances-capsule"
                to="/instances"
              >实例与连接</RouterLink>
              <button
                type="button"
                class="home-instances-capsule home-instances-capsule--action"
                @click="load"
              >
                刷新
              </button>
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
                <div class="home-account-unified">
                  <div class="home-account-unified__col home-account-unified__col--hero">
                    <div class="home-account-hero home-account-hero--unified">
                      <div class="home-account-hero__lead">
                        <div class="home-account-hero__avatar">
                          <img
                            :src="qqAvatarUrl(selectedAccount)"
                            alt=""
                            width="64"
                            height="64"
                            decoding="async"
                            referrerpolicy="no-referrer"
                            @error="($event.target as HTMLImageElement).style.visibility = 'hidden'"
                          >
                        </div>
                        <div class="home-account-hero__main">
                          <div class="home-account-hero__title">
                            {{ dbNick(selectedAccount) || "BOT" }}
                            <span
                              class="home-account-conn"
                              :class="selectedConnected ? 'home-account-conn--on' : 'home-account-conn--off'"
                            >{{ selectedConnected ? "已连接" : "未连接" }}</span>
                          </div>
                          <p class="home-account-hero__sub muted">账号 {{ selectedAccount }}</p>
                          <p class="home-account-hero__proto muted">
                            协议 · {{ accountAdapterDisplay }}
                          </p>
                        </div>
                      </div>
                      <div class="home-account-hero__detail home-account-hero__detail--color">
                        <p class="home-account-hero__admin">
                          <span class="home-account-hero__admin-label">管理员</span>
                          <span class="home-account-hero__admin-values">{{ selectedAdminsDisplay }}</span>
                        </p>
                        <div class="home-account-hero__links">
                          <a
                            v-if="nativeProtocolWebUiHref"
                            class="home-account-hero__link"
                            :href="nativeProtocolWebUiHref"
                            target="_blank"
                            rel="noopener noreferrer"
                          >原生 WebUI</a>
                          <a
                            v-if="protocolBuiltInManageHref"
                            class="home-account-hero__link"
                            :href="protocolBuiltInManageHref"
                            target="_blank"
                            rel="noopener noreferrer"
                          >协议管理页</a>
                        </div>
                        <dl class="home-account-dl home-account-dl--tight home-account-dl--hero-foot">
                          <div>
                            <dt>好友</dt>
                            <dd>{{ socialBusy ? "…" : friendCount ?? "—" }}</dd>
                          </div>
                          <div>
                            <dt>群</dt>
                            <dd>{{ socialBusy ? "…" : groupCount ?? "—" }}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>
                  <div class="home-account-unified__col home-account-unified__col--metrics">
                    <div class="home-account-metrics home-account-metrics--color">
                      <div class="home-account-metrics__head">吞吐（累计）</div>
                      <div class="home-account-metrics__big">
                        <span class="home-account-metrics__recv">{{ socialBusy ? "…" : msgRecvSentPair.recv }}</span>
                        <span class="home-account-metrics__sep muted">/</span>
                        <span class="home-account-metrics__sent">{{ socialBusy ? "…" : msgRecvSentPair.sent }}</span>
                      </div>
                      <div class="home-account-metrics__stats">
                        <div class="home-account-metrics__today-row">
                          <span class="muted home-account-metrics__k">今日 API</span>
                          <span class="home-account-metrics__v">{{ socialBusy ? "…" : apiTodayTotalStr }}</span>
                        </div>
                        <div class="home-account-metrics__stat-block">
                          <div class="home-account-metrics__krow">
                            <span class="muted home-account-metrics__k">调用最多</span>
                            <span class="home-account-metrics__kind">插件</span>
                          </div>
                          <span
                            class="home-account-metrics__v home-account-metrics__v--clip"
                            :title="pluginTodayTopStr"
                          >{{ socialBusy ? "…" : pluginTodayTopStr }}</span>
                        </div>
                        <div class="home-account-metrics__stat-block">
                          <div class="home-account-metrics__krow">
                            <span class="muted home-account-metrics__k">调用最多</span>
                            <span class="home-account-metrics__kind">API</span>
                          </div>
                          <span
                            class="home-account-metrics__v home-account-metrics__v--clip"
                            :title="apiTodayTopStr"
                          >{{ socialBusy ? "…" : apiTodayTopStr }}</span>
                        </div>
                      </div>
                      <div
                        v-if="(scopedPluginRunRow?.errors_today ?? 0) > 0"
                        class="home-account-metrics__warn"
                      >
                        <span class="muted">Matcher 异常（今日）</span>
                        <span>{{ socialBusy ? "…" : (scopedPluginRunRow?.errors_today ?? 0) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="home-account-charts-span">
                  <HomePluginRunCharts
                    :plugins="scopedPluginPlugins"
                    :plugins-meta="pluginsList"
                    :series="pluginRunTimeSamples"
                    :busy="socialBusy"
                    :api-history-by-api="scopedApiCallsByApi"
                    :api-history-bucket-sec="msgMainStats?.api_calls_history_bucket_sec"
                    :matcher-runs-by-plugin="scopedMatcherRunsByPlugin"
                    :matcher-errors-by-plugin="scopedMatcherErrorsByPlugin"
                    :matcher-history-bucket-sec="pluginRunMain?.matcher_calls_history_bucket_sec"
                  />
                </div>
                <div class="home-account-msg-tools-span">
                  <div class="home-account-msg-tools">
                    <div class="home-account-msg-tools__hd">
                      <h3 class="home-account-msg-tools__title">
                        <span class="panel__title-ico panel__title-ico--sm" aria-hidden="true">≡</span>消息与过滤
                      </h3>
                      <p class="home-account-msg-tools__desc muted">
                        日志关键字过滤；好友/群策略见配置页。
                      </p>
                    </div>
                    <div class="home-account-msg-tools__links">
                      <RouterLink
                        class="btn btn--primary"
                        to="/logs"
                      >运行日志</RouterLink>
                      <RouterLink
                        class="btn"
                        to="/bot-social-config"
                      >好友/群颗粒配置</RouterLink>
                    </div>
                  </div>
                </div>
              </div>
            </template>
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

      <section class="home-dashboard__perf">
        <div class="panel home-page__panel">
          <div class="panel__hd">
            <h2 class="panel__title">
              <span class="panel__title-ico" aria-hidden="true">▤</span>系统性能
            </h2>
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
    </div>

    <div class="panel home-page__panel home-page__version-panel">
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">◇</span>版本与运行环境
        </h2>
        <span
          v-if="health?.ok"
          class="badge badge--ok"
        >API 可用</span>
      </div>
      <div class="panel__bd muted home-page__version home-page__version--grid">
        <dl class="home-dl home-dl--version-rows home-version-dl">
          <dt>NoneBot2</dt>
          <dd>
            <span class="home-dl__pill home-dl__pill--version">{{ health?.nonebot2 ?? "—" }}</span>
            <span class="home-dl__sub muted">框架</span>
          </dd>
          <dt>Pallas-Bot</dt>
          <dd>
            <span class="home-dl__pill home-dl__pill--version">{{ pallasBotVersionDisplay }}</span>
            <span class="home-dl__sub muted">业务</span>
          </dd>
          <dt>控制台资源</dt>
          <dd>
            <span class="home-dl__pill home-dl__pill--version">{{ health?.console?.version ?? "—" }}</span>
            <span
              v-if="(health?.console?.commit || '').trim()"
              class="home-version-commit"
              :title="health?.console?.commit || undefined"
            >{{ (health?.console?.commit || "").trim() }}</span>
          </dd>
          <dt>服务时间</dt>
          <dd>
            <span class="home-dl__pill home-dl__pill--version home-dl__pill--mono">{{ versionServerTimeStr }}</span>
          </dd>
          <dt>主机 / Python</dt>
          <dd>
            <span class="home-dl__pill home-dl__pill--version">{{ system?.runtime?.hostname ?? "—" }}</span>
            <span class="home-dl__pill home-dl__pill--version home-dl__pill--mono">{{ system?.runtime?.python ?? "—" }}</span>
          </dd>
        </dl>
      </div>
    </div>
    </div>
  </div>
</template>
