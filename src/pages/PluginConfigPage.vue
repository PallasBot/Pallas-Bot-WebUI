<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { fetchPluginConfig, putPluginConfig } from "@/api/consoleApi";
import type { PluginConfigData, PluginConfigField } from "@/api/pallasTypes";
import JsonTextareaField from "@/components/JsonTextareaField.vue";

const route = useRoute();
const err = ref("");
const ok = ref("");
const loading = ref(false);
const saving = ref(false);
const data = ref<PluginConfigData | null>(null);

const pluginName = computed(() => String(route.params.name || ""));

async function load() {
  loading.value = true;
  err.value = "";
  ok.value = "";
  try {
    data.value = await fetchPluginConfig(pluginName.value);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    data.value = null;
  } finally {
    loading.value = false;
  }
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
  ok.value = "";
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
    ok.value = "已保存。";
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <header class="page-hero">
      <p class="page-hero__eyebrow">Plugin</p>
      <h1 class="page-hero__title">{{ data?.plugin || pluginName }}</h1>
      <p class="page-hero__desc">
        <RouterLink
          class="link-quiet"
          to="/plugins"
        >← 返回目录</RouterLink>
        <span class="muted"> · {{ data?.module }}</span>
      </p>
    </header>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>
    <div
      v-if="ok"
      class="alert alert--ok"
    >
      {{ ok }}
    </div>

    <div
      v-if="data && !loading && data.plugin === pluginName"
      class="panel"
      style="margin-bottom: 16px"
    >
      <div class="panel__hd">
        <h2 class="panel__title">配置项定义</h2>
      </div>
      <div class="panel__bd">
        <p class="muted" style="margin: 0; line-height: 1.55">
          本页展示该插件已发布的 <strong style="color: var(--text)">{{ data.fields.length }}</strong> 个可配置项；表单与保存行为由服务端校验与落库。若列表为空，表示该模块未暴露可调参数或未注册 schema。
        </p>
      </div>
    </div>

    <div
      v-if="loading"
      class="muted"
    >
      加载中…
    </div>

    <div
      v-else-if="data"
      class="panel"
    >
      <div class="panel__hd">
        <h2 class="panel__title">字段</h2>
        <button
          type="button"
          class="btn btn--primary"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? "保存中…" : "保存" }}
        </button>
      </div>
      <div class="panel__bd">
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
  </div>
</template>
