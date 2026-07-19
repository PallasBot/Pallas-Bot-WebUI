<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { fetchHelpPreviewBlob, fetchPlugins } from "@/api/consoleApi";
import type { PluginRow } from "@/api/pallasTypes";
import { axiosErrorDetail } from "@/api/http";
import {
  listHelpPreviewFunctionOptions,
  listHelpPreviewPluginOptions,
  pickDefaultHelpPreviewFunction,
} from "@/utils/helpPreviewOptions";

const { embedded = false, defaultPlugin = "help" } = defineProps<{
  embedded?: boolean;
  defaultPlugin?: string;
}>();

const level = ref<"menu" | "plugin" | "function">("menu");
const page = ref(1);
const plugin = ref(defaultPlugin.trim() || "help");
const functionName = ref("1");
const cacheBust = ref(0);
const previewUrl = ref<string | null>(null);
const previewLoading = ref(false);
const previewErr = ref("");
const pluginRows = ref<PluginRow[]>([]);
const pluginsLoading = ref(false);
const pluginsErr = ref("");

const showPageNav = computed(() => level.value === "menu");
const showPluginPicker = computed(() => level.value === "plugin" || level.value === "function");
const showFunctionPicker = computed(() => level.value === "function");

const pluginOptions = computed(() => listHelpPreviewPluginOptions(pluginRows.value));

const selectedPluginRow = computed(
  () => pluginRows.value.find((row) => row.name === plugin.value) ?? null,
);

const functionOptions = computed(() => listHelpPreviewFunctionOptions(selectedPluginRow.value));

function syncFunctionSelection() {
  if (level.value !== "function") return;
  functionName.value = pickDefaultHelpPreviewFunction(functionOptions.value, functionName.value);
}

function syncPluginSelection() {
  if (!pluginOptions.value.length) return;
  if (!pluginOptions.value.some((item) => item.value === plugin.value)) {
    const preferred = (defaultPlugin.trim() || "help");
    plugin.value = pluginOptions.value.some((item) => item.value === preferred)
      ? preferred
      : pluginOptions.value[0].value;
  }
}

async function loadPluginOptions() {
  pluginsLoading.value = true;
  pluginsErr.value = "";
  try {
    pluginRows.value = await fetchPlugins();
    syncPluginSelection();
    syncFunctionSelection();
  } catch (e) {
    pluginsErr.value = axiosErrorDetail(e);
  } finally {
    pluginsLoading.value = false;
  }
}

function revokePreviewUrl() {
  if (previewUrl.value?.startsWith("blob:")) {
    URL.revokeObjectURL(previewUrl.value);
  }
  previewUrl.value = null;
}

async function loadPreview() {
  previewLoading.value = true;
  previewErr.value = "";
  revokePreviewUrl();
  try {
    const blob = await fetchHelpPreviewBlob({
      level: level.value,
      page: level.value === "menu" ? page.value : undefined,
      plugin: level.value !== "menu" ? plugin.value : undefined,
      function: level.value === "function" ? functionName.value : undefined,
    });
    if (!blob.type.startsWith("image/")) {
      const text = await blob.text();
      try {
        const parsed = JSON.parse(text) as { detail?: string };
        previewErr.value = parsed.detail || text || "预览返回非图片";
      } catch {
        previewErr.value = text || "预览返回非图片";
      }
      return;
    }
    previewUrl.value = URL.createObjectURL(blob);
  } catch (e) {
    previewErr.value = axiosErrorDetail(e);
  } finally {
    previewLoading.value = false;
  }
}

watch([level, page, plugin, functionName, cacheBust], () => void loadPreview(), { immediate: true });

watch(level, (next) => {
  if (next === "function") syncFunctionSelection();
});

watch(plugin, () => syncFunctionSelection());

watch(functionOptions, () => syncFunctionSelection());

function refreshPreview() {
  page.value = Math.max(1, page.value);
  cacheBust.value = Date.now();
}

onMounted(() => void loadPluginOptions());

onBeforeUnmount(revokePreviewUrl);
</script>

<template>
  <section
    class="help-image-preview"
    :class="{ 'help-image-preview--embedded': embedded }"
    aria-label="帮助图预览"
  >
    <div class="help-image-preview__toolbar">
      <div
        class="help-image-preview__level-toggle console-view-toggle"
        role="tablist"
        aria-label="帮助图预览级别"
      >
        <button
          type="button"
          role="tab"
          :class="{ 'is-on': level === 'menu' }"
          :aria-selected="level === 'menu'"
          @click="level = 'menu'"
        >
          菜单
        </button>
        <button
          type="button"
          role="tab"
          :class="{ 'is-on': level === 'plugin' }"
          :aria-selected="level === 'plugin'"
          @click="level = 'plugin'"
        >
          插件
        </button>
        <button
          type="button"
          role="tab"
          :class="{ 'is-on': level === 'function' }"
          :aria-selected="level === 'function'"
          @click="level = 'function'"
        >
          功能
        </button>
      </div>
      <label
        v-if="showPageNav"
        class="help-image-preview__field help-image-preview__field--page"
      >
        <span class="help-image-preview__label">页码</span>
        <input
          v-model.number="page"
          type="number"
          min="1"
          class="input help-image-preview__input"
        >
      </label>
      <label
        v-if="showPluginPicker"
        class="help-image-preview__field"
      >
        <span class="help-image-preview__label">插件</span>
        <select
          v-model="plugin"
          class="input help-image-preview__input help-image-preview__select"
          :disabled="pluginsLoading || !pluginOptions.length"
        >
          <option
            v-if="pluginsLoading"
            value=""
            disabled
          >
            加载插件列表…
          </option>
          <option
            v-for="item in pluginOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </option>
        </select>
      </label>
      <label
        v-if="showFunctionPicker"
        class="help-image-preview__field"
      >
        <span class="help-image-preview__label">功能</span>
        <select
          v-model="functionName"
          class="input help-image-preview__input help-image-preview__select"
          :disabled="!functionOptions.length"
        >
          <option
            v-if="!functionOptions.length"
            value="1"
            disabled
          >
            该插件暂无功能项
          </option>
          <option
            v-for="item in functionOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </option>
        </select>
      </label>
      <button
        type="button"
        class="btn btn--sm help-image-preview__refresh"
        :disabled="previewLoading"
        @click="refreshPreview"
      >
        {{ previewLoading ? "加载中…" : "刷新预览" }}
      </button>
    </div>
    <p
      v-if="pluginsErr"
      class="help-image-preview__plugins-err muted"
      role="status"
    >
      插件列表加载失败：{{ pluginsErr }}
    </p>
    <div class="help-image-preview__frame">
      <p
        v-if="previewLoading && !previewUrl"
        class="muted help-image-preview__placeholder"
      >
        正在生成预览…
      </p>
      <p
        v-else-if="previewErr"
        class="help-image-preview__placeholder help-image-preview__placeholder--err"
        role="alert"
      >
        {{ previewErr }}
      </p>
      <img
        v-else-if="previewUrl"
        :src="previewUrl"
        alt="帮助图预览"
        class="help-image-preview__img"
      >
      <p
        v-else
        class="muted help-image-preview__placeholder"
      >
        暂无预览
      </p>
    </div>
  </section>
</template>

<style scoped>
.help-image-preview__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: 12px;
}

.help-image-preview__level-toggle {
  flex: 0 0 auto;
}

.help-image-preview__field {
  display: grid;
  gap: 4px;
  flex: 0 1 auto;
  min-width: 0;
}

.help-image-preview__field--page {
  width: 72px;
}

.help-image-preview__label {
  font-size: 0.85rem;
  color: var(--text-muted, var(--muted-foreground));
}

.help-image-preview__input {
  min-width: 0;
  width: 100%;
}

.help-image-preview__select {
  width: min(220px, 100%);
  min-width: 140px;
}

.help-image-preview__refresh {
  flex: 0 0 auto;
  align-self: flex-end;
}

.help-image-preview__plugins-err {
  margin: -4px 0 12px;
  font-size: 0.85rem;
}

.help-image-preview__frame {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel-bg, var(--bg-muted));
  padding: 12px;
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.help-image-preview__placeholder {
  margin: 0;
  text-align: center;
  padding: 24px 12px;
}

.help-image-preview__placeholder--err {
  color: var(--danger, #dc2626);
}

.help-image-preview__img {
  display: block;
  width: 100%;
  max-width: 920px;
  height: auto;
}

.help-image-preview--embedded .help-image-preview__toolbar {
  gap: 8px;
}

@media (max-width: 560px) {
  .help-image-preview__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .help-image-preview__level-toggle :deep(button) {
    flex: 1 1 auto;
  }

  .help-image-preview__field,
  .help-image-preview__field--page {
    width: 100%;
  }

  .help-image-preview__select {
    width: 100%;
    min-width: 0;
  }

  .help-image-preview__refresh {
    width: 100%;
  }
}
</style>
