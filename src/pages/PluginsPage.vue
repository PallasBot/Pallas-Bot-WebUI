<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchPluginConfig, fetchPlugins, peekPluginsCache } from "@/api/consoleApi";
import type { PluginConfigData, PluginLoadRole, PluginRow } from "@/api/pallasTypes";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { pluginFavoriteNames, toggleFavoritePlugin } from "@/utils/pluginFavorites";
import { hasPluginSource, pluginSourceDir, pluginSourceLabel } from "@/utils/pluginSourceLabel";

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

function isPluginFavorite(name: string): boolean {
  return pluginFavoriteNames.value.has(name);
}

const loadRoleLabel: Record<PluginLoadRole, string> = {
  hub: "Hub",
  worker: "Worker",
  both: "双端",
  infra: "基础设施",
  internal: "内部",
};

function pluginRoleText(p: PluginRow): string {
  const role = p.load_role;
  if (!role) return "";
  const base = loadRoleLabel[role] ?? role;
  if (p.loaded_in_process) return `${base} · 本进程已加载`;
  if (role === "worker") return `${base} · 仅 Worker`;
  if (role === "hub") return `${base} · 仅 Hub`;
  return base;
}
onMounted(async () => {
  try {
    list.value = await fetchPlugins();
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
            是否在「牛牛帮助」总列表中展示该插件，请在进入对应插件后的配置页顶部「帮助菜单」中设置。
          </p>
        </div>
        <PanelSidebarAdd main-path="/plugins" />
      </div>
      <div
        class="grid-stats plugins-page__plugin-grid"
      >
        <div
          v-for="p in sortedPlugins"
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
                  {{ p.metadata?.name || p.name }}
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
                  v-if="pluginRoleText(p)"
                  class="muted plugin-card__role-line"
                >
                  {{ pluginRoleText(p) }}
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
