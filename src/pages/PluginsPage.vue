<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  fetchPluginConfig,
  fetchPlugins,
  fetchPluginsGlobalDisable,
  peekPluginsCache,
  putPluginsGlobalDisable,
} from "@/api/consoleApi";
import type { PluginConfigData, PluginRow, PluginSourceKind } from "@/api/pallasTypes";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { pluginFavoriteNames, toggleFavoritePlugin } from "@/utils/pluginFavorites";
import { hasPluginSource, pluginSourceDir, pluginSourceLabel } from "@/utils/pluginSourceLabel";
import {
  catalogProcessHint,
  hasPluginLoadWhere,
  pluginCountsAsCatalogLoadProblem,
  pluginCountsAsLoadedInCatalog,
  pluginLoadBadgeText,
  pluginLoadWhere,
} from "@/utils/pluginLoadRoleLabel";

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const pageReady = ref(true);
const list = ref<PluginRow[]>([]);
{
  const warm = peekPluginsCache();
  if (warm?.length) list.value = warm;
}
const open = ref<string | null>(null);
const preview = ref<Record<string, PluginConfigData | "loading" | null>>({});
type SourceFilter = "all" | PluginSourceKind;
const sourceFilter = ref<SourceFilter>("all");
const loadFilter = ref<"all" | "loaded" | "problem">("all");
const globalDisabled = ref<string[]>([]);
const globalDisableProtected = ref<string[]>([]);
const globalDisableBusy = ref(false);
const globalDisableErr = ref("");

const catalogProcessRole = computed(
  () => list.value.find((p) => p.catalog_process_role)?.catalog_process_role,
);

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
  let rows = sortedPlugins.value;
  if (sourceFilter.value !== "all") {
    rows = rows.filter((p) => p.plugin_source === sourceFilter.value);
  }
  if (loadFilter.value === "loaded") {
    rows = rows.filter((p) => pluginCountsAsLoadedInCatalog(p));
  } else if (loadFilter.value === "problem") {
    rows = rows.filter((p) => pluginCountsAsCatalogLoadProblem(p));
  }
  return rows;
});

const sourceCounts = computed(() => {
  const counts: Record<SourceFilter, number> = {
    all: list.value.length,
    main: 0,
    local: 0,
    pip: 0,
  };
  for (const p of list.value) {
    const src = p.plugin_source;
    if (src === "main" || src === "local" || src === "pip") {
      counts[src] += 1;
    }
  }
  return counts;
});

function isPluginFavorite(name: string): boolean {
  return pluginFavoriteNames.value.has(name);
}

function isGloballyDisabled(name: string): boolean {
  return globalDisabled.value.includes(name);
}

function isGlobalDisableProtected(p: PluginRow): boolean {
  return Boolean(p.global_disable_protected);
}

async function loadGlobalDisable() {
  globalDisableErr.value = "";
  try {
    const data = await fetchPluginsGlobalDisable();
    globalDisabled.value = [...data.disabled_plugins];
    globalDisableProtected.value = [...data.protected_plugins];
  } catch (e) {
    globalDisableErr.value = e instanceof Error ? e.message : String(e);
  }
}

async function toggleGlobalDisable(name: string, wantDisabled: boolean) {
  if (globalDisableBusy.value) return;
  const p = list.value.find((row) => row.name === name);
  if (p && isGlobalDisableProtected(p)) return;
  globalDisableBusy.value = true;
  globalDisableErr.value = "";
  const set = new Set(globalDisabled.value);
  if (wantDisabled) set.add(name);
  else set.delete(name);
  try {
    const out = await putPluginsGlobalDisable([...set].sort((a, b) => a.localeCompare(b)));
    globalDisabled.value = [...out.disabled_plugins];
    globalDisableProtected.value = [...out.protected_plugins];
    list.value = list.value.map((row) => ({
      ...row,
      globally_disabled: out.disabled_plugins.includes(row.name),
    }));
  } catch (e) {
    globalDisableErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    globalDisableBusy.value = false;
  }
}

onMounted(async () => {
  try {
    const [rows] = await Promise.all([fetchPlugins(), loadGlobalDisable()]);
    list.value = rows;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    pageReady.value = true;
  }
});

async function togglePreview(name: string) {
  if (open.value === name) {
    open.value = null;
    return;
  }
  open.value = name;
  if (preview.value[name] && preview.value[name] !== "loading") return;
  preview.value = { ...preview.value, [name]: "loading" };
  try {
    const cfg = await fetchPluginConfig(name);
    preview.value = { ...preview.value, [name]: cfg };
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    preview.value = { ...preview.value, [name]: null };
  }
}
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
    <div
      v-else
      class="plugins-page__body"
    >
      <div class="plugins-page__hero">
        <div class="plugins-page__hero-main">
          <h2 class="panel__title">
            <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>插件目录
          </h2>
          <p class="muted plugins-page__hero-note">
            「全实例禁用」对本站所有牛牛、所有群立即生效（无需重启）；帮助菜单展示请在各插件配置页设置。
          </p>
          <p
            v-if="globalDisableErr"
            class="alert alert--err plugins-page__hero-note"
          >
            {{ globalDisableErr }}
          </p>
          <p
            v-if="catalogProcessHint(catalogProcessRole)"
            class="muted plugins-page__hero-note plugins-page__hero-note--shard"
          >
            {{ catalogProcessHint(catalogProcessRole) }}
          </p>
        </div>
        <PanelSidebarAdd main-path="/plugins" />
      </div>
      <div class="plugins-page__filters row-actions">
        <label class="plugins-page__filter-label">
          <span class="muted">来源</span>
          <select
            v-model="sourceFilter"
            class="sel"
            aria-label="按插件来源筛选"
          >
            <option value="all">
              全部（{{ sourceCounts.all }}）
            </option>
            <option value="main">
              主仓（{{ sourceCounts.main }}）
            </option>
            <option value="local">
              站点 local（{{ sourceCounts.local }}）
            </option>
            <option value="pip">
              pip / 依赖（{{ sourceCounts.pip }}）
            </option>
          </select>
        </label>
        <label class="plugins-page__filter-label">
          <span class="muted">加载</span>
          <select
            v-model="loadFilter"
            class="sel"
            aria-label="按应在当前目录进程中的加载状态筛选"
          >
            <option value="all">
              全部
            </option>
            <option value="loaded">
              已就绪
            </option>
            <option value="problem">
              缺载异常
            </option>
          </select>
        </label>
        <span
          v-if="filteredPlugins.length !== sortedPlugins.length"
          class="muted plugins-page__filter-hint"
        >
          显示 {{ filteredPlugins.length }} / {{ sortedPlugins.length }}
        </span>
      </div>
      <div
        class="grid-stats plugins-page__plugin-grid"
      >
        <p
          v-if="!filteredPlugins.length"
          class="muted plugins-page__empty"
        >
          没有符合筛选条件的插件。
        </p>
        <div
          v-for="p in filteredPlugins"
          :key="p.name"
          class="plugin-card"
        >
          <div class="plugin-card__top">
            <div class="plugin-card__head-row">
              <RouterLink
                class="plugin-card__link"
                :to="{ name: 'plugin-config', params: { name: p.name } }"
              >
                <div class="plugin-card__title-line">
                  {{ p.metadata?.name || p.nb_plugin_name || p.name }}
                  <span
                    v-if="p.globally_disabled"
                    class="plugins-page__badge plugins-page__badge--muted"
                    title="全实例已禁用"
                  >已禁用</span>
                  <span
                    v-if="pluginLoadBadgeText(p)"
                    class="plugins-page__badge plugins-page__badge--warn"
                    :title="pluginLoadWhere(p)"
                  >{{ pluginLoadBadgeText(p) }}</span>
                </div>
                <div
                  v-if="p.nb_plugin_name && p.nb_plugin_name !== p.name && (p.metadata?.name || p.name) !== p.nb_plugin_name"
                  class="muted plugin-card__id-line"
                >
                  {{ p.nb_plugin_name }}
                </div>
                <div
                  class="muted plugin-card__desc-line"
                  :title="(p.metadata?.description || p.module) || undefined"
                >
                  {{ p.metadata?.description || p.module }}
                </div>
                <div
                  v-if="hasPluginSource(p)"
                  class="plugin-card__source-block"
                >
                  <div class="plugin-card__source-kind">
                    来源：{{ pluginSourceLabel(p.plugin_source) }}
                  </div>
                  <div
                    v-if="pluginSourceDir(p)"
                    class="plugin-card__source-path muted"
                  >
                    {{ pluginSourceDir(p) }}
                  </div>
                </div>
                <div
                  v-if="hasPluginLoadWhere(p)"
                  class="muted plugin-card__role-line"
                >
                  加载：{{ pluginLoadWhere(p) }}
                </div>
              </RouterLink>
              <button
                type="button"
                class="plugin-card__fav"
                :aria-pressed="isPluginFavorite(p.name)"
                :title="isPluginFavorite(p.name) ? '取消收藏' : '收藏'"
                :aria-label="isPluginFavorite(p.name) ? `取消收藏「${p.metadata?.name || p.name}」` : `收藏「${p.metadata?.name || p.name}」`"
                @click.stop="toggleFavoritePlugin(p.name)"
              >
                ★
              </button>
            </div>
          </div>
          <label
            class="plugin-global-disable-label"
            :class="{
              'plugin-global-disable-label--disabled': globalDisableBusy || isGlobalDisableProtected(p),
            }"
          >
            <input
              type="checkbox"
              :checked="isGloballyDisabled(p.name)"
              :disabled="globalDisableBusy || isGlobalDisableProtected(p)"
              @click.prevent="void toggleGlobalDisable(p.name, !isGloballyDisabled(p.name))"
            >
            <span>全实例禁用</span>
          </label>
          <p
            v-if="isGlobalDisableProtected(p)"
            class="muted plugin-global-disable-hint"
          >
            基础设施插件，不可全实例禁用。
          </p>
          <div class="plugin-card__actions plugin-card__actions--pair">
            <RouterLink
              class="btn btn--primary plugin-card__action-btn"
              :to="{ name: 'plugin-config', params: { name: p.name } }"
              @click.stop
            >
              编辑配置
            </RouterLink>
            <button
              type="button"
              class="btn plugin-card__action-btn"
              @click.stop="togglePreview(p.name)"
            >
              {{ open === p.name ? "收起预览" : "预览配置项" }}
            </button>
          </div>
          <div
            v-if="open === p.name"
            class="plugin-preview"
          >
            <div
              v-if="preview[p.name] === 'loading'"
              class="muted"
            >
              加载中…
            </div>
            <div
              v-else-if="preview[p.name] === null"
              class="muted"
            >
              加载失败。
            </div>
            <template v-else-if="preview[p.name]">
              <div class="muted">
                共 <strong style="color: var(--text)">{{ (preview[p.name] as PluginConfigData).fields.length }}</strong> 个字段
              </div>
              <div class="table-wrap">
                <table class="data console-data-table">
                  <thead>
                    <tr>
                      <th>字段</th>
                      <th>类型</th>
                      <th>必填</th>
                      <th>配置键</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="f in (preview[p.name] as PluginConfigData).fields"
                      :key="f.name"
                    >
                      <td style="font-weight: 600">{{ f.name }}</td>
                      <td class="muted">{{ f.kind }}</td>
                      <td>{{ f.required ? "是" : "否" }}</td>
                      <td class="muted" style="font-size: 11px">{{ f.env_key }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
