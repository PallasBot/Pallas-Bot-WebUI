<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { fetchInstances, fetchSystem, peekInstancesCache } from "@/api/consoleApi";
import type { InstancesData, NapcatAccountRow, SystemData } from "@/api/pallasTypes";
import ConsolePagerBar from "@/components/ConsolePagerBar.vue";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { accountWebUiHref, protocolDashboardUrl, protocolSnapshot } from "@/utils/protocolLinks";
import { protocolDisp, type ProtocolDisp } from "@/utils/protocolUi";
import { slicePage } from "@/utils/paginate";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const pageReady = ref(false);
const system = ref<SystemData | null>(null);
const instances = ref<InstancesData | null>(null);
{
  const warmInst = peekInstancesCache();
  if (warmInst) instances.value = warmInst;
}

const snap = computed(() => protocolSnapshot(instances.value));
const dashUrl = computed(() => protocolDashboardUrl(system.value, snap.value));

const tablePageSize = computed({
  get: () => Math.min(80, Math.max(4, consolePrefs.tablePageSize ?? 12)),
  set(v: number) {
    const n = Math.min(80, Math.max(4, Math.floor(Number(v)) || 12));
    if (n !== consolePrefs.tablePageSize) setConsolePrefs({ tablePageSize: n });
  },
});

const protoAccPage = ref(1);
const expProtocolAccounts = ref(true);
const loadBusy = ref(false);

const webuiEnabledDisp = computed(() => protocolDisp(snap.value?.webui_enabled, "已启用", "未启用"));
const consoleAuthDisp = computed(() =>
  protocolDisp(snap.value?.console_auth_configured, "已配置", "未配置"),
);

const protocolAccountsSorted = computed(() => {
  const list = [...(snap.value?.accounts ?? [])];
  list.sort((a, b) => {
    const ca = a.connected === true ? 1 : 0;
    const cb = b.connected === true ? 1 : 0;
    if (ca !== cb) return cb - ca;
    const na = profileNick(a).toLowerCase();
    const nb = profileNick(b).toLowerCase();
    const cmp = na.localeCompare(nb, "zh-CN");
    if (cmp !== 0) return cmp;
    return String(a.qq ?? a.id ?? "").localeCompare(String(b.qq ?? b.id ?? ""), "zh-CN", { numeric: true });
  });
  return list;
});

const pagedProtocolAccounts = computed(() =>
  slicePage(protocolAccountsSorted.value, protoAccPage.value, tablePageSize.value),
);

const protocolConnectedCount = computed(
  () => protocolAccountsSorted.value.filter((a) => a.connected === true).length,
);

watch(
  () => consolePrefs.tablePageSize,
  () => {
    protoAccPage.value = 1;
  },
);

watch([snap, () => snap.value?.accounts?.length], () => {
  protoAccPage.value = 1;
});

function profileNick(a: NapcatAccountRow): string {
  const q = parseInt(String(a.qq ?? a.id ?? "").replace(/\s/g, ""), 10);
  const nick = instances.value?.bot_profiles?.[String(q)]?.nickname?.trim();
  if (Number.isFinite(q) && nick) return nick;
  return String(a.display_name ?? "").trim();
}

function webUiHref(a: NapcatAccountRow): string | null {
  return accountWebUiHref(a, system.value);
}

function primaryTitle(a: NapcatAccountRow): string {
  const nick = profileNick(a);
  if (nick) return nick;
  return String(a.qq ?? a.id ?? "—");
}

function boolPillClass(on: boolean): string {
  return on ? "data-pill data-pill--on" : "data-pill data-pill--off";
}

function runningPill(a: NapcatAccountRow): ProtocolDisp {
  return protocolDisp(a.process_running ?? a.running, "运行中", "未运行");
}

function connectedPill(a: NapcatAccountRow): ProtocolDisp {
  return protocolDisp(a.connected, "已连接", "未连接");
}

function pillLabel(d: ProtocolDisp): string {
  return d.kind === "pill" ? (d.on ? d.onLabel : d.offLabel) : d.text;
}

function pillOn(d: ProtocolDisp): boolean {
  return d.kind === "pill" && d.on;
}

async function load() {
  err.value = "";
  loadBusy.value = true;
  try {
    const [s, i] = await Promise.all([fetchSystem(), fetchInstances()]);
    system.value = s;
    instances.value = i;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    loadBusy.value = false;
  }
}

onMounted(async () => {
  try {
    await load();
  } finally {
    pageReady.value = true;
  }
});
</script>

<template>
  <div
    v-if="err"
    class="alert alert--err"
  >
    {{ err }}
  </div>

  <ConsolePageSkeleton
    v-if="!pageReady"
    :panels="2"
  />
  <template v-else>
    <div class="panel">
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span
            class="panel__title-ico"
            aria-hidden="true"
          >{{ panelNavIcon }}</span>协议端入口
          <RefreshIconButton
            :busy="loadBusy"
            label="刷新协议端数据"
            @click="load"
          />
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/protocol" />
        </div>
      </div>
      <div class="panel__bd">
        <div class="protocol-page__meta">
          <div class="protocol-page__meta-row">
            <span class="protocol-page__meta-label">内置 WebUI</span>
            <span
              v-if="webuiEnabledDisp.kind === 'pill'"
              :class="boolPillClass(pillOn(webuiEnabledDisp))"
            >{{ pillLabel(webuiEnabledDisp) }}</span>
            <span
              v-else
              class="muted"
            >{{ pillLabel(webuiEnabledDisp) }}</span>
          </div>
          <p
            v-if="snap?.webui_path"
            class="muted protocol-page__meta-path"
          >
            路径 <code>{{ snap.webui_path }}</code>
          </p>
          <div class="protocol-page__meta-row">
            <span class="protocol-page__meta-label">控制台鉴权</span>
            <span
              v-if="consoleAuthDisp.kind === 'pill'"
              :class="boolPillClass(pillOn(consoleAuthDisp))"
            >{{ pillLabel(consoleAuthDisp) }}</span>
            <span
              v-else
              class="muted"
            >{{ pillLabel(consoleAuthDisp) }}</span>
          </div>
        </div>
        <div class="row-actions protocol-page__actions">
          <a
            v-if="dashUrl"
            class="btn btn--primary"
            :href="dashUrl"
            target="_blank"
            rel="noopener noreferrer"
          >打开协议端管理</a>
          <span
            v-else
            class="muted"
          >当前无法拼接管理页 URL（请检查 http_base、webui_enabled 与 webui_path）。</span>
          <RouterLink
            class="btn"
            to="/instances"
          >实例与连接</RouterLink>
          <RouterLink
            class="btn"
            to="/"
          >返回总览</RouterLink>
        </div>
      </div>
    </div>

    <div
      v-if="(snap?.accounts?.length ?? 0) > 0"
      class="panel"
    >
      <div class="panel__hd panel__hd--split inst-db-panel__hd">
        <h2 class="panel__title">
          <span
            class="panel__title-ico"
            aria-hidden="true"
          >{{ panelNavIcon }}</span>协议账号
        </h2>
        <button
          type="button"
          class="btn panel-hd-collapse-btn"
          @click="expProtocolAccounts = !expProtocolAccounts"
        >
          {{ expProtocolAccounts ? "收起" : "展开" }}
        </button>
        <div class="inst-db-panel__actions">
          <PanelSidebarAdd main-path="/protocol" />
          <span class="inst-db-stat muted">
            已连接
            <strong class="inst-db-stat__num">{{ protocolConnectedCount }}</strong>
            / {{ protocolAccountsSorted.length }} 账号
          </span>
        </div>
      </div>
      <div
        v-show="expProtocolAccounts"
        class="panel__bd"
      >
        <div class="table-wrap">
          <table class="data console-data-table">
            <thead>
              <tr>
                <th>协议端昵称</th>
                <th>账号</th>
                <th>进程</th>
                <th>已连接</th>
                <th>WebUI 端口</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(a, i) in pagedProtocolAccounts"
                :key="i"
              >
                <td style="font-weight: 600">{{ primaryTitle(a) }}</td>
                <td class="muted">{{ a.qq ?? a.id ?? "—" }}</td>
                <td>
                  <span
                    v-if="runningPill(a).kind === 'pill'"
                    :class="boolPillClass(pillOn(runningPill(a)))"
                  >{{ pillLabel(runningPill(a)) }}</span>
                  <span
                    v-else
                    class="muted"
                  >{{ pillLabel(runningPill(a)) }}</span>
                </td>
                <td>
                  <span
                    v-if="connectedPill(a).kind === 'pill'"
                    :class="boolPillClass(pillOn(connectedPill(a)))"
                  >{{ pillLabel(connectedPill(a)) }}</span>
                  <span
                    v-else
                    class="muted"
                  >{{ pillLabel(connectedPill(a)) }}</span>
                </td>
                <td>
                  <a
                    v-if="webUiHref(a)"
                    class="link-quiet"
                    :href="webUiHref(a)!"
                    target="_blank"
                    rel="noopener noreferrer"
                  >{{ a.webui_port ?? "打开" }}</a>
                  <span
                    v-else
                    class="muted"
                  >{{ a.webui_port ?? "—" }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ConsolePagerBar
          v-model:page="protoAccPage"
          v-model:page-size="tablePageSize"
          :total="protocolAccountsSorted.length"
        />
      </div>
    </div>
  </template>
</template>

<style scoped>
.protocol-page__meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}
.protocol-page__meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.protocol-page__meta-label {
  font-size: 12px;
  font-weight: 650;
  color: var(--text-dim);
}
.protocol-page__meta-path {
  margin: 0;
  font-size: 12px;
}
.protocol-page__actions {
  margin-top: 4px;
}
</style>
