<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { fetchHelpPreviewBlob } from "@/api/consoleApi";
import { axiosErrorDetail } from "@/api/http";

const { embedded } = withDefaults(
  defineProps<{
    embedded?: boolean;
  }>(),
  {
    embedded: false,
  },
);

const level = ref<"menu" | "plugin" | "function">("menu");
const page = ref(1);
const plugin = ref("help");
const functionName = ref("");
const cacheBust = ref(0);
const previewUrl = ref<string | null>(null);
const previewLoading = ref(false);
const previewErr = ref("");

const showPageNav = computed(() => level.value === "menu");
const showPluginPicker = computed(() => level.value === "plugin" || level.value === "function");
const showFunctionPicker = computed(() => level.value === "function");

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

function refreshPreview() {
  page.value = Math.max(1, page.value);
  cacheBust.value = Date.now();
}

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
      <div class="help-image-preview__actions">
        <label
          v-if="showPageNav"
          class="help-image-preview__field"
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
          <input
            v-model="plugin"
            type="text"
            class="input help-image-preview__input"
            placeholder="插件 ID"
          >
        </label>
        <label
          v-if="showFunctionPicker"
          class="help-image-preview__field"
        >
          <span class="help-image-preview__label">功能</span>
          <input
            v-model="functionName"
            type="text"
            class="input help-image-preview__input"
            placeholder="命令或功能 ID"
          >
        </label>
        <button
          type="button"
          class="btn btn--sm"
          :disabled="previewLoading"
          @click="refreshPreview"
        >
          {{ previewLoading ? "加载中…" : "刷新预览" }}
        </button>
      </div>
    </div>
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
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.help-image-preview__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
}

.help-image-preview__field {
  display: grid;
  gap: 4px;
  min-width: min(100%, 180px);
}

.help-image-preview__label {
  font-size: 0.85rem;
  color: var(--text-muted, var(--muted-foreground));
}

.help-image-preview__input {
  min-width: 0;
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
  gap: 10px;
}

@media (max-width: 560px) {
  .help-image-preview__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .help-image-preview__level-toggle :deep(button) {
    flex: 1 1 auto;
  }

  .help-image-preview__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .help-image-preview__field {
    width: 100%;
  }
}
</style>
