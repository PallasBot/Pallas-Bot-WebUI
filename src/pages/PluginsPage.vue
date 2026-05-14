<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  fetchPluginConfig,
  fetchPlugins,
  fetchPluginsHelpMenuVisibility,
  putPluginsHelpMenuVisibility,
} from "@/api/consoleApi";
import type { PluginConfigData, PluginRow } from "@/api/pallasTypes";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const pageReady = ref(false);
const list = ref<PluginRow[]>([]);
const helpMenuHidden = ref<string[]>([]);
const helpToggleBusy = ref<string | null>(null);
const open = ref<string | null>(null);
const preview = ref<Record<string, PluginConfigData | "loading" | null>>({});

function pluginHelpShown(p: PluginRow): boolean {
  if (p.help_ignored) return false;
  return Boolean(p.help_visible ?? !p.help_hidden);
}

async function togglePluginHelpMenu(p: PluginRow, wantShown: boolean) {
  const name = p.name;
  if (!name || p.help_ignored || helpToggleBusy.value) return;
  helpToggleBusy.value = name;
  try {
    const set = new Set(helpMenuHidden.value);
    if (wantShown) set.delete(name);
    else set.add(name);
    const out = await putPluginsHelpMenuVisibility([...set]);
    helpMenuHidden.value = [...out.hidden_plugins];
    list.value = await fetchPlugins();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    helpToggleBusy.value = null;
  }
}

onMounted(async () => {
  try {
    const [rows, vis] = await Promise.all([fetchPlugins(), fetchPluginsHelpMenuVisibility()]);
    list.value = rows;
    helpMenuHidden.value = [...vis.hidden_plugins];
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
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>插件目录
        </h2>
        <PanelSidebarAdd main-path="/plugins" />
      </div>
      <div
        class="grid-stats plugins-page__plugin-grid"
      >
        <div
          v-for="p in list"
          :key="p.name"
          class="plugin-card"
        >
          <div class="plugin-card__top">
            <RouterLink
              class="plugin-card__link"
              :to="{ name: 'plugin-config', params: { name: p.name } }"
            >
              <div class="plugin-card__title-line">
                {{ p.metadata?.name || p.name }}
              </div>
              <div class="muted plugin-card__desc-line">
                {{ p.metadata?.description || p.module }}
              </div>
              <div class="plugin-card__enter-hint">进入配置编辑 →</div>
            </RouterLink>
            <div
              class="plugin-card__help-panel"
              @click.stop
            >
              <div class="plugin-card__help-head">
                <div class="plugin-card__help-text">
                  <div class="plugin-card__help-title">
                    帮助菜单
                  </div>
                  <p class="plugin-card__help-desc muted">
                    在「牛牛帮助」总列表中展示该插件；关闭后命令仍可用，仅不出现在帮助索引。
                  </p>
                  <p
                    v-if="p.help_ignored"
                    class="plugin-card__help-note muted"
                  >
                    该插件在帮助插件的 ignored_plugins 中，无法出现在帮助菜单。
                  </p>
                </div>
                <button
                  type="button"
                  class="plugin-switch"
                  role="switch"
                  :aria-checked="pluginHelpShown(p) ? 'true' : 'false'"
                  :aria-busy="helpToggleBusy === p.name ? 'true' : 'false'"
                  :aria-label="pluginHelpShown(p) ? '关闭帮助菜单展示' : '开启帮助菜单展示'"
                  :disabled="Boolean(p.help_ignored) || helpToggleBusy === p.name"
                  :class="{
                    'plugin-switch--on': pluginHelpShown(p),
                    'plugin-switch--busy': helpToggleBusy === p.name,
                  }"
                  @click="void togglePluginHelpMenu(p, !pluginHelpShown(p))"
                />
              </div>
            </div>
          </div>
          <div class="plugin-card__actions">
            <button
              type="button"
              class="btn"
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
                <table class="data">
                  <thead>
                    <tr>
                      <th>字段</th>
                      <th>类型</th>
                      <th>必填</th>
                      <th>env_key</th>
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
