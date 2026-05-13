<script setup lang="ts">
import { onMounted, ref } from "vue";
import { fetchPlugins } from "@/api/consoleApi";
import type { PluginRow } from "@/api/pallasTypes";

const err = ref("");
const list = ref<PluginRow[]>([]);

onMounted(async () => {
  try {
    list.value = await fetchPlugins();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <div>
    <header class="page-hero">
      <p class="page-hero__eyebrow">Plugins</p>
      <h1 class="page-hero__title">插件目录</h1>
      <p class="page-hero__desc">选择插件进入基于 API 字段说明的配置编辑。</p>
    </header>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <div
      class="grid-stats"
      style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))"
    >
      <RouterLink
        v-for="p in list"
        :key="p.name"
        :to="{ name: 'plugin-config', params: { name: p.name } }"
        class="card"
        style="text-decoration: none; color: inherit"
      >
        <div class="card__body">
          <div style="font-weight: 800; font-size: 1.05rem; letter-spacing: -0.02em; margin-bottom: 6px">
            {{ p.metadata?.name || p.name }}
          </div>
          <div class="muted" style="font-size: 13px; line-height: 1.45">
            {{ p.metadata?.description || p.module }}
          </div>
          <div style="margin-top: 12px; font-size: 12px; color: var(--accent)">配置 →</div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
