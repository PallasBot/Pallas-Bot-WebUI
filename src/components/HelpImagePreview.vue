<script setup lang="ts">
import { computed, ref } from "vue";
import { buildHelpPreviewUrl } from "@/api/consoleApi";

type PreviewLevel = "menu" | "plugin" | "function";

const level = ref<PreviewLevel>("menu");
const page = ref(1);
const plugin = ref("help");
const functionName = ref("1");

const previewUrl = computed(() =>
  buildHelpPreviewUrl({
    level: level.value,
    page: page.value,
    plugin: plugin.value,
    function: functionName.value,
    cacheBust: Date.now(),
  }),
);

const levels: Array<{ id: PreviewLevel; label: string }> = [
  { id: "menu", label: "总览" },
  { id: "plugin", label: "插件页" },
  { id: "function", label: "功能详情" },
];

function refreshPreview() {
  page.value = Math.max(1, page.value);
}
</script>

<template>
  <section class="panel help-image-preview">
    <div class="panel__hd help-image-preview__hd">
      <div>
        <h3 class="help-image-preview__title">帮助图预览</h3>
        <p class="muted help-image-preview__desc">与群内「牛牛帮助」成图同步，保存配置后可点刷新查看。</p>
      </div>
      <button
        type="button"
        class="btn btn--ghost"
        @click="refreshPreview"
      >
        刷新
      </button>
    </div>

    <div
      class="console-view-toggle help-image-preview__levels"
      role="tablist"
      aria-label="帮助图层级"
    >
      <button
        v-for="item in levels"
        :key="item.id"
        type="button"
        role="tab"
        class="console-view-toggle__btn"
        :class="{ 'is-on': level === item.id }"
        :aria-selected="level === item.id"
        @click="level = item.id"
      >
        {{ item.label }}
      </button>
    </div>

    <div
      v-if="level === 'menu'"
      class="help-image-preview__controls row-actions"
    >
      <label class="help-image-preview__field">
        <span class="muted">页码</span>
        <input
          v-model.number="page"
          class="input"
          type="number"
          min="1"
          @change="refreshPreview"
        >
      </label>
    </div>

    <div
      v-else-if="level === 'plugin'"
      class="help-image-preview__controls row-actions"
    >
      <label class="help-image-preview__field">
        <span class="muted">插件 ID / 展示名</span>
        <input
          v-model="plugin"
          class="input"
          type="text"
          @change="refreshPreview"
        >
      </label>
    </div>

    <div
      v-else
      class="help-image-preview__controls help-image-preview__controls--stack"
    >
      <label class="help-image-preview__field">
        <span class="muted">插件</span>
        <input
          v-model="plugin"
          class="input"
          type="text"
          @change="refreshPreview"
        >
      </label>
      <label class="help-image-preview__field">
        <span class="muted">功能序号或名称</span>
        <input
          v-model="functionName"
          class="input"
          type="text"
          @change="refreshPreview"
        >
      </label>
    </div>

    <div class="table-wrap help-image-preview__frame">
      <img
        :key="previewUrl"
        :src="previewUrl"
        alt="牛牛帮助预览图"
        class="help-image-preview__img"
        loading="lazy"
      >
    </div>
  </section>
</template>

<style scoped>
.help-image-preview__hd {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.help-image-preview__title {
  margin: 0;
  font-size: 1.05rem;
}

.help-image-preview__desc {
  margin: 6px 0 0;
  font-size: 0.92rem;
}

.help-image-preview__levels {
  margin: 14px 0 12px;
}

.help-image-preview__controls {
  margin-bottom: 12px;
  gap: 10px;
  flex-wrap: wrap;
}

.help-image-preview__controls--stack {
  display: grid;
  gap: 10px;
}

.help-image-preview__field {
  display: grid;
  gap: 4px;
  min-width: min(100%, 220px);
}

.help-image-preview__frame {
  border-radius: 12px;
  background: var(--panel-bg, #faf7f3);
}

.help-image-preview__img {
  display: block;
  width: 100%;
  max-width: 920px;
  height: auto;
}

@media (max-width: 560px) {
  .help-image-preview__hd {
    flex-direction: column;
  }

  .help-image-preview__levels :deep(button) {
    flex: 1 1 auto;
  }

  .help-image-preview__field {
    width: 100%;
  }
}
</style>
