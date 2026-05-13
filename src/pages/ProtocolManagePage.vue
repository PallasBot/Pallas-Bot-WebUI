<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { fetchInstances, fetchSystem } from "@/api/consoleApi";
import type { InstancesData, NapcatAccountRow, SystemData } from "@/api/pallasTypes";
import ConsolePagerBar from "@/components/ConsolePagerBar.vue";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { accountWebUiHref, protocolDashboardUrl, protocolSnapshot, yn } from "@/utils/protocolLinks";
import { slicePage } from "@/utils/paginate";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const pageReady = ref(false);
const system = ref<SystemData | null>(null);
const instances = ref<InstancesData | null>(null);

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

function webUiHref(a: NapcatAccountRow): string | null {
  return accountWebUiHref(a, system.value);
}

function primaryTitle(a: NapcatAccountRow): string {
  const nick = profileNick(a);
  if (nick) return nick;
  return String(a.qq ?? a.id ?? "—");
}

async function load() {
  err.value = "";
  try {
    const [s, i] = await Promise.all([fetchSystem(), fetchInstances()]);
    system.value = s;
    instances.value = i;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
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
  <div>
    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="3"
    />
    <div v-else>
    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>入口
        </h2>
      </div>
      <div class="panel__bd">
        <p class="muted" style="margin: 0 0 10px">
          内置 WebUI：<strong style="color: var(--text)">{{ snap?.webui_enabled ? "已启用" : "未启用" }}</strong>
          <span v-if="snap?.webui_path"> · 路径 <code>{{ snap.webui_path }}</code></span>
        </p>
        <p class="muted" style="margin: 0 0 14px">
          控制台鉴权已配置：<strong style="color: var(--text)">{{ snap?.console_auth_configured ? "是" : "否" }}</strong>
        </p>
        <div class="row-actions">
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
      <div class="panel__hd">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>协议账号
        </h2>
      </div>
      <div class="panel__bd">
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>昵称</th>
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
                <td>{{ yn(a.process_running ?? a.running) }}</td>
                <td>{{ yn(a.connected) }}</td>
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
  </div>
</template>
