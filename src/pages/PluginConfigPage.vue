<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  fetchPluginConfig,
  fetchPlugins,
  fetchPluginsHelpMenuVisibility,
  putPluginConfig,
  putPluginsHelpMenuVisibility,
} from "@/api/consoleApi";
import type { PluginConfigData, PluginConfigField, PluginRow } from "@/api/pallasTypes";
import JsonTextareaField from "@/components/JsonTextareaField.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const route = useRoute();
const panelNavIcon = usePanelNavIcon();
const err = ref("");
const loading = ref(false);
const saving = ref(false);
const data = ref<PluginConfigData | null>(null);
const pluginRow = ref<PluginRow | null>(null);
const helpMenuHiddenList = ref<string[]>([]);
const helpMenuIgnoredList = ref<string[]>([]);
const helpMenuBusy = ref(false);
const helpMenuErr = ref("");
const saveFeedbackRef = ref<HTMLElement | null>(null);
const saveSuccessOpen = ref(false);

watch(saveSuccessOpen, (open) => {
  if (typeof document === "undefined") return;
  document.body.style.overflow = open ? "hidden" : "";
});

onUnmounted(() => {
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
});

function closeSaveSuccessModal() {
  saveSuccessOpen.value = false;
}

const showInHelpMenu = computed(() => {
  if (!pluginRow.value) return false;
  if (pluginRow.value.help_ignored) return false;
  return Boolean(pluginRow.value.help_visible ?? !pluginRow.value.help_hidden);
});

async function loadHelpMenuState() {
  const name = pluginName.value;
  if (!name) return;
  helpMenuBusy.value = true;
  helpMenuErr.value = "";
  try {
    const [rows, vis] = await Promise.all([fetchPlugins(), fetchPluginsHelpMenuVisibility()]);
    pluginRow.value = rows.find((r) => r.name === name) ?? null;
    helpMenuHiddenList.value = [...vis.hidden_plugins];
    helpMenuIgnoredList.value = [...vis.ignored_plugins];
  } catch (e) {
    helpMenuErr.value = e instanceof Error ? e.message : String(e);
    pluginRow.value = null;
  } finally {
    helpMenuBusy.value = false;
  }
}

async function toggleHelpMenuVisible(wantVisible: boolean) {
  const name = pluginName.value;
  if (!name || !pluginRow.value?.name) return;
  if (pluginRow.value.help_ignored) return;
  helpMenuBusy.value = true;
  helpMenuErr.value = "";
  try {
    const set = new Set(helpMenuHiddenList.value);
    if (wantVisible) set.delete(name);
    else set.add(name);
    const out = await putPluginsHelpMenuVisibility([...set]);
    helpMenuHiddenList.value = [...out.hidden_plugins];
    const rows = await fetchPlugins({ bypassCache: true });
    pluginRow.value = rows.find((r) => r.name === name) ?? null;
  } catch (e) {
    helpMenuErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    helpMenuBusy.value = false;
  }
}

const pluginName = computed(() => String(route.params.name || ""));

async function load() {
  loading.value = true;
  err.value = "";
  try {
    data.value = await fetchPluginConfig(pluginName.value);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    data.value = null;
  } finally {
    loading.value = false;
  }
  void loadHelpMenuState();
}

watch(
  () => route.params.name,
  () => {
    void load();
  },
);

onMounted(load);

function fieldModel(f: PluginConfigField): string {
  const v = f.current;
  if (f.kind === "json") return JSON.stringify(v ?? null, null, 2);
  if (typeof v === "boolean") return v ? "true" : "false";
  return v === null || v === undefined ? "" : String(v);
}

function parseField(f: PluginConfigField, raw: string): unknown {
  if (f.kind === "bool") return raw === "true" || raw === "1";
  if (f.kind === "int") return parseInt(raw, 10);
  if (f.kind === "float") return parseFloat(raw);
  if (f.kind === "json") return JSON.parse(raw) as unknown;
  return raw;
}

const fieldValues = ref<Record<string, string>>({});

watch(
  data,
  (d) => {
    fieldValues.value = {};
    if (!d) return;
    for (const f of d.fields) {
      fieldValues.value[f.name] = fieldModel(f);
    }
  },
  { immediate: true },
);

async function save() {
  if (!data.value) return;
  saving.value = true;
  err.value = "";
  const values: Record<string, unknown> = {};
  try {
    for (const f of data.value.fields) {
      const raw = fieldValues.value[f.name] ?? "";
      if (f.kind === "json" && raw.trim() === "") {
        values[f.name] = null;
      } else {
        values[f.name] = parseField(f, raw);
      }
    }
    data.value = await putPluginConfig(pluginName.value, values);
    saveSuccessOpen.value = true;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    await nextTick();
    saveFeedbackRef.value?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="plugin-config-page">
    <p
      v-if="pluginName"
      class="muted"
      style="margin: 0 0 12px; font-size: 13px"
    >
      <RouterLink
        class="link-quiet"
        to="/plugins"
      >← 返回目录</RouterLink>
      <span v-if="data?.module"> · {{ data.module }}</span>
    </p>

    <div
      v-if="err && !data"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <ConsolePageSkeleton
      v-if="loading"
      :panels="2"
    />
    <template v-else>
    <div
      v-if="pluginName"
      class="panel"
      style="margin-bottom: 16px"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>帮助菜单
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/plugins" />
        </div>
      </div>
      <div class="panel__bd">
        <p
          v-if="helpMenuBusy && !pluginRow"
          class="muted"
        >
          加载帮助菜单状态…
        </p>
        <div
          v-else-if="helpMenuErr"
          class="alert alert--err"
        >
          {{ helpMenuErr }}
        </div>
        <template v-else-if="pluginRow">
          <label
            class="plugin-help-menu-label"
            :class="{ 'plugin-help-menu-label--disabled': pluginRow.help_ignored || helpMenuBusy }"
          >
            <input
              type="checkbox"
              :checked="showInHelpMenu"
              :disabled="helpMenuBusy || Boolean(pluginRow.help_ignored)"
              @click.prevent="void toggleHelpMenuVisible(!showInHelpMenu)"
            >
            <span>在「牛牛帮助」总列表中显示该插件</span>
          </label>
          <p
            v-if="pluginRow.help_ignored"
            class="muted"
            style="margin: 10px 0 0; line-height: 1.55"
          >
            该插件在帮助插件的 ignored_plugins 中，无法出现在帮助菜单。
          </p>
          <p
            v-else
            class="muted"
            style="margin: 10px 0 0; line-height: 1.55"
          >
            变更立即写入服务端；下一条「牛牛帮助」即按新列表渲染。
          </p>
        </template>
      </div>
    </div>

    <div
      v-if="data && data.plugin === pluginName"
      class="panel"
      style="margin-bottom: 16px"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>配置项定义
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/plugins" />
        </div>
      </div>
      <div class="panel__bd">
        <p class="muted" style="margin: 0; line-height: 1.55">
          本页展示该插件已发布的 <strong style="color: var(--text)">{{ data.fields.length }}</strong> 个可配置项；表单与保存行为由服务端校验与落库。若列表为空，表示该模块未暴露可调参数或未注册 schema。
        </p>
      </div>
    </div>

    <div
      v-if="data"
      class="panel plugin-config-page__fields-panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>字段
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/plugins" />
          <button
            type="button"
            class="btn btn--primary"
            :disabled="saving"
            :aria-busy="saving || undefined"
            @click="save"
          >
            {{ saving ? "保存中…" : "保存" }}
          </button>
        </div>
      </div>
      <div class="panel__bd">
        <div
          v-if="err"
          ref="saveFeedbackRef"
          class="plugin-config-page__save-feedback"
          role="alert"
          aria-live="assertive"
        >
          <div class="alert alert--err">
            {{ err }}
          </div>
        </div>
        <div
          v-for="f in data.fields"
          :key="f.name"
          style="margin-bottom: 22px"
        >
          <div style="font-weight: 700; margin-bottom: 6px">
            {{ f.name }}
            <span class="muted" style="font-weight: 500">（{{ f.kind }}）</span>
          </div>
          <div class="muted" style="font-size: 13px; margin-bottom: 8px">
            {{ f.description }}
          </div>
          <div class="muted" style="font-size: 12px; margin-bottom: 8px">
            env: <code>{{ f.env_key }}</code>
            · 默认：{{ JSON.stringify(f.default) }}
          </div>
          <select
            v-if="f.kind === 'bool'"
            v-model="fieldValues[f.name]"
            class="sel"
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
          <JsonTextareaField
            v-else-if="f.kind === 'json'"
            v-model="fieldValues[f.name]"
            :title="`${data.plugin} · ${f.name}（JSON）`"
            :rows="6"
          />
          <input
            v-else
            v-model="fieldValues[f.name]"
            class="inp"
            style="max-width: 480px; width: 100%"
            :type="f.kind === 'int' || f.kind === 'float' ? 'number' : 'text'"
          >
        </div>
      </div>
    </div>
    </template>

    <Teleport to="body">
      <div
        v-if="saveSuccessOpen"
        class="console-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plugin-save-success-title"
      >
        <div
          class="console-modal__backdrop"
          aria-hidden="true"
          @click="closeSaveSuccessModal"
        />
        <div
          class="console-modal__dialog"
          @click.stop
        >
          <div class="console-modal__hd">
            <div class="console-modal__head-text">
              <h2
                id="plugin-save-success-title"
                class="console-modal__title"
              >
                保存成功
              </h2>
            </div>
            <button
              type="button"
              class="console-modal__close"
              aria-label="关闭"
              @click="closeSaveSuccessModal"
            >
              ×
            </button>
          </div>
          <div
            class="console-modal__bd"
            style="padding-top: 0"
          >
            <div
              class="row-actions"
              style="margin: 0; justify-content: flex-end"
            >
              <button
                type="button"
                class="btn btn--primary"
                @click="closeSaveSuccessModal"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.plugin-help-menu-label {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  cursor: pointer;
  font-weight: 600;
}
.plugin-help-menu-label--disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.plugin-config-page__save-feedback {
  margin-bottom: 16px;
}

.plugin-config-page__save-feedback .alert {
  margin: 0;
}
</style>
