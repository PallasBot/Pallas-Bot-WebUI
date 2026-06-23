<script setup lang="ts">
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import { computed, onActivated, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  fetchCommunityPluginStore,
  fetchOfficialExtensions,
  fetchPluginCapabilities,
  fetchPlugins,
  peekPluginsCache,
} from "@/api/consoleApi";
import type {
  CommunityPluginRow,
  OfficialExtensionRow,
  PluginCapabilitiesRow,
  PluginRow,
} from "@/api/pallasTypes";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import ConsoleHubSearch from "@/components/ConsoleHubSearch.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PluginCatalogCard from "@/components/PluginCatalogCard.vue";
import PluginConfigDialog from "@/components/PluginConfigDialog.vue";
import UiButton from "@/components/ui/UiButton.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { pluginFavoriteNames } from "@/utils/pluginFavorites";
import { buildPluginIconMap, resolvePluginIconForRow, shouldShowPluginAvatar } from "@/utils/pluginIconUrl";
import { catalogProcessHint } from "@/utils/pluginLoadRoleLabel";
import { reloadPolicyLabel } from "@/utils/reloadPolicyLabel";

const route = useRoute();
const router = useRouter();
const panelNavIcon = usePanelNavIcon();
const err = ref("");
const pageReady = ref(true);
const list = ref<PluginRow[]>([]);
{
  const warm = peekPluginsCache();
  if (warm?.length) list.value = warm;
}
const searchQuery = ref("");
const capabilities = ref<PluginCapabilitiesRow[]>([]);
const capabilitiesOverviewOpen = ref(false);
const iconByPlugin = ref<Record<string, string>>({});
const officialExtensions = ref<OfficialExtensionRow[]>([]);
const communityPlugins = ref<CommunityPluginRow[]>([]);
const configDialogOpen = ref(false);

const selectedPluginName = computed(() => String(route.params.name || "").trim());

const sortedPlugins = computed(() => {
  const rows = [...list.value];
  rows.sort((a, b) => {
    const fa = pluginFavoriteNames.value.has(a.name) ? 1 : 0;
    const fb = pluginFavoriteNames.value.has(b.name) ? 1 : 0;
    if (fa !== fb) return fb - fa;
    const na = (a.metadata?.name || a.name).toLowerCase();
    const nb = (b.metadata?.name || b.name).toLowerCase();
    return na.localeCompare(nb, "zh-CN");
  });
  return rows;
});

const filteredPlugins = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return sortedPlugins.value;
  return sortedPlugins.value.filter((p) => {
    const name = (p.metadata?.name || p.name).toLowerCase();
    const id = p.name.toLowerCase();
    const desc = (p.metadata?.description || "").toLowerCase();
    return name.includes(q) || id.includes(q) || desc.includes(q);
  });
});

function pluginIconUrl(name: string): string {
  const row = list.value.find((p) => p.name === name);
  if (!row) return "";
  return resolvePluginIconForRow(row, iconByPlugin.value);
}

function pluginAvatarUrl(name: string): string {
  const row = list.value.find((p) => p.name === name);
  if (!row) return "";
  const avatar = (row.avatar || "").trim();
  const icon = pluginIconUrl(name);
  return shouldShowPluginAvatar(icon, avatar) ? avatar : "";
}

const selectedPluginRow = computed(
  () => list.value.find((p) => p.name === selectedPluginName.value) ?? null,
);

function selectPlugin(name: string) {
  if (selectedPluginName.value === name && configDialogOpen.value) return;
  void router.push({ name: "plugins", params: { name } });
}

function closeConfigDialog() {
  configDialogOpen.value = false;
  if (selectedPluginName.value) {
    void router.replace({ name: "plugins" });
  }
}

const capabilitiesSorted = computed(() =>
  [...capabilities.value].sort((a, b) =>
    (a.title || a.plugin).localeCompare(b.title || b.plugin, "zh-CN"),
  ),
);

const catalogProcessRole = computed(
  () => list.value.find((p) => p.catalog_process_role)?.catalog_process_role,
);

function syncPluginDialogRoute() {
  if (route.name !== "plugins") return;
  if (!pageReady.value) return;
  const name = selectedPluginName.value;
  if (!name) {
    configDialogOpen.value = false;
    return;
  }
  const pool = filteredPlugins.value.length ? filteredPlugins.value : sortedPlugins.value;
  if (pool.some((p) => p.name === name)) {
    configDialogOpen.value = true;
    return;
  }
  configDialogOpen.value = false;
  void router.replace({ name: "plugins" });
}

onMounted(() => {
  void loadPluginsPage(true);
});

onActivated(() => {
  syncPluginDialogRoute();
  void loadPluginsPage(true);
});

async function loadPluginsPage(refreshCommunityIndex = false) {
  try {
    const [rows, caps, official, community] = await Promise.all([
      fetchPlugins(),
      fetchPluginCapabilities().catch(() => ({ plugins: [] })),
      fetchOfficialExtensions().catch(() => []),
      fetchCommunityPluginStore({ refresh: refreshCommunityIndex }).catch(() => null),
    ]);
    list.value = rows;
    capabilities.value = caps.plugins ?? [];
    officialExtensions.value = official;
    communityPlugins.value = community?.plugins ?? [];
    const indexUpdatedAt =
      community?.meta && typeof community.meta === "object"
        ? String((community.meta as { updated_at?: unknown }).updated_at ?? "").trim()
        : "";
    iconByPlugin.value = buildPluginIconMap(official, community?.plugins, { indexUpdatedAt });
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    pageReady.value = true;
  }
}

watch([pageReady, sortedPlugins, filteredPlugins, selectedPluginName], syncPluginDialogRoute, {
  immediate: true,
});
</script>

<template>
  <div class="plugins-page console-hub-page">
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
    <div
      v-else
      class="plugins-page__body"
    >
      <ConsoleHubMasthead :icon="panelNavIcon">
        <template #title>
          插件管理
        </template>
        <template #lead>
          点击卡片「编辑配置」在弹窗中调整权限、冷却、运行开关与插件参数；README 可在弹窗分栏查看。
        </template>
        <template #extra>
          <p
            v-if="catalogProcessHint(catalogProcessRole)"
            class="muted console-hub-page__lead plugins-page__hero-note--shard"
          >
            {{ catalogProcessHint(catalogProcessRole) }}
          </p>
        </template>
      </ConsoleHubMasthead>

      <ConsoleHubSearch
        v-model="searchQuery"
        placeholder="搜索插件名、ID 或说明…"
      />

      <section
        class="plugins-page__catalog"
        aria-label="已加载插件"
      >
        <div class="plugins-page__catalog-hd">
          <h2 class="plugins-page__catalog-title">
            已加载插件
          </h2>
          <span class="muted plugins-page__catalog-count">
            共 {{ list.length }} 个
            <template v-if="filteredPlugins.length !== sortedPlugins.length">
              · 显示 {{ filteredPlugins.length }}
            </template>
          </span>
        </div>

        <p
          v-if="!filteredPlugins.length"
          class="muted plugins-page__empty"
        >
          {{ sortedPlugins.length ? "没有符合搜索条件的插件。" : "暂无已加载插件。" }}
        </p>
        <div
          v-else
          class="plugins-page__plugin-grid"
        >
          <PluginCatalogCard
            v-for="p in filteredPlugins"
            :key="p.name"
            :plugin="p"
            :icon-url="pluginIconUrl(p.name)"
            :avatar-url="pluginAvatarUrl(p.name)"
            :active="selectedPluginName === p.name && configDialogOpen"
            @select="selectPlugin(p.name)"
          />
        </div>
      </section>

      <div
        v-if="capabilitiesSorted.length"
        class="panel plugins-page__capabilities-overview"
      >
        <div class="panel__hd panel__hd--split plugins-page__capabilities-hd">
          <h2 class="panel__title">
            <ConsoleNavIcon
              class="panel__title-ico"
              name="plugin"
            />插件能力总览
          </h2>
          <div class="row-actions plugins-page__capabilities-hd-actions">
            <span class="muted plugins-page__catalog-count">
              {{ capabilitiesSorted.length }} 个插件
            </span>
            <UiButton
              variant="outline"
              @click="capabilitiesOverviewOpen = !capabilitiesOverviewOpen"
            >
              {{ capabilitiesOverviewOpen ? "收起" : "展开" }}
            </UiButton>
          </div>
        </div>
        <div
          v-show="capabilitiesOverviewOpen"
          class="panel__bd"
        >
          <p class="muted plugins-page__capabilities-note">
            聚合命令权限、冷却、LLM 工具与存储键声明；热重载策略对应 L1 配置 / L2 元数据 / L3 代码三级。
          </p>
          <div class="table-wrap plugins-page__capabilities-table-wrap">
            <table class="data console-data-table plugins-page__capabilities-table">
              <thead>
                <tr>
                  <th>插件</th>
                  <th>命令</th>
                  <th>LLM</th>
                  <th>存储</th>
                  <th>热重载</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in capabilitiesSorted"
                  :key="row.plugin"
                >
                  <td>
                    <div class="plugins-page__cap-plugin-title">
                      {{ row.title || row.plugin }}
                    </div>
                    <div class="muted plugins-page__cap-plugin-id">
                      {{ row.plugin }}
                    </div>
                  </td>
                  <td>{{ row.commands.length }}</td>
                  <td>{{ row.llm_tools.length }}</td>
                  <td>{{ row.storage_keys.length }}</td>
                  <td>{{ reloadPolicyLabel(row.reload_policy) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul class="plugins-page__capabilities-cards">
            <li
              v-for="row in capabilitiesSorted"
              :key="`card-${row.plugin}`"
              class="plugins-page__capabilities-card"
            >
              <div class="plugins-page__cap-plugin-title">
                {{ row.title || row.plugin }}
              </div>
              <div class="muted plugins-page__cap-plugin-id">
                {{ row.plugin }}
              </div>
              <dl class="plugins-page__capabilities-card-dl">
                <div>
                  <dt>命令</dt>
                  <dd>{{ row.commands.length }}</dd>
                </div>
                <div>
                  <dt>LLM</dt>
                  <dd>{{ row.llm_tools.length }}</dd>
                </div>
                <div>
                  <dt>存储</dt>
                  <dd>{{ row.storage_keys.length }}</dd>
                </div>
                <div>
                  <dt>热重载</dt>
                  <dd>{{ reloadPolicyLabel(row.reload_policy) }}</dd>
                </div>
              </dl>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <PluginConfigDialog
      :open="configDialogOpen"
      :plugin-name="selectedPluginName"
      :plugin-row="selectedPluginRow"
      :icon-url="selectedPluginName ? pluginIconUrl(selectedPluginName) : null"
      :official-extensions="officialExtensions"
      :community-plugins="communityPlugins"
      @close="closeConfigDialog"
    />
  </div>
</template>
