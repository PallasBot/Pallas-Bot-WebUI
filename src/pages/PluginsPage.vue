<script setup lang="ts">
import { onMounted, ref } from "vue";
import { fetchPluginConfig, fetchPlugins } from "@/api/consoleApi";
import type { PluginConfigData, PluginRow } from "@/api/pallasTypes";

const err = ref("");
const list = ref<PluginRow[]>([]);
const open = ref<string | null>(null);
const preview = ref<Record<string, PluginConfigData | "loading" | null>>({});

onMounted(async () => {
  try {
    list.value = await fetchPlugins();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
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
    <header class="page-hero">
      <p class="page-hero__eyebrow">Plugins</p>
      <h1 class="page-hero__title">插件目录</h1>
      <p class="page-hero__desc">
        进入配置页会请求 <code>GET /plugins/&lt;name&gt;/config</code>，响应体中的
        <code>fields</code> 数组描述每个可配置项（名称、类型、env 键、默认值与当前值）。下方可展开预览字段列表，无需进入详情页。
      </p>
    </header>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <div
      class="grid-stats"
      style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))"
    >
      <div
        v-for="p in list"
        :key="p.name"
        class="plugin-card"
      >
        <RouterLink
          class="plugin-card__link"
          :to="{ name: 'plugin-config', params: { name: p.name } }"
        >
          <div style="font-weight: 800; font-size: 1.05rem; letter-spacing: -0.02em; margin-bottom: 6px">
            {{ p.metadata?.name || p.name }}
          </div>
          <div class="muted" style="font-size: 13px; line-height: 1.45">
            {{ p.metadata?.description || p.module }}
          </div>
          <div style="margin-top: 12px; font-size: 12px; color: var(--accent)">进入配置编辑 →</div>
        </RouterLink>
        <div class="plugin-card__actions">
          <button
            type="button"
            class="btn"
            @click.stop="togglePreview(p.name)"
          >
            {{ open === p.name ? "收起字段" : "预览 fields" }}
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
</template>
