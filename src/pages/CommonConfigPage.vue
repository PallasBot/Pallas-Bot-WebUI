<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { fetchCommonConfig, fetchCommonConfigSections, putCommonConfig } from "@/api/consoleApi";
import type { CommonConfigSectionMeta, PluginConfigData, PluginConfigField } from "@/api/pallasTypes";
import JsonTextareaField from "@/components/JsonTextareaField.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";

const err = ref("");
const pageReady = ref(false);
const ok = ref("");
const sections = ref<CommonConfigSectionMeta[]>([]);
const currentId = ref("");
const data = ref<PluginConfigData | null>(null);
const saving = ref(false);
const fieldValues = ref<Record<string, string>>({});

function fieldModel(f: PluginConfigField): string {
  const v = f.current;
  if (f.kind === "json") return JSON.stringify(v ?? null, null, 2);
  if (typeof v === "boolean") return v ? "true" : "false";
  return v === null || v === undefined ? "" : String(v);
}

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

async function loadSections() {
  try {
    sections.value = await fetchCommonConfigSections();
    if (!currentId.value && sections.value.length) {
      currentId.value = sections.value[0].id;
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function loadSection() {
  if (!currentId.value) return;
  err.value = "";
  try {
    data.value = await fetchCommonConfig(currentId.value);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    data.value = null;
  }
}

watch(currentId, () => {
  void loadSection();
});

onMounted(async () => {
  try {
    await loadSections();
    await loadSection();
  } finally {
    pageReady.value = true;
  }
});

function parseField(f: PluginConfigField, raw: string): unknown {
  if (f.kind === "bool") return raw === "true" || raw === "1";
  if (f.kind === "int") return parseInt(raw, 10);
  if (f.kind === "float") return parseFloat(raw);
  if (f.kind === "json") return JSON.parse(raw) as unknown;
  return raw;
}

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
    data.value = await putCommonConfig(currentId.value, values);
    ok.value = "已写入 .env 对应项。";
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
      <p class="page-hero__eyebrow">Environment</p>
      <h1 class="page-hero__title">通用配置</h1>
      <p class="page-hero__desc">分区维护跨模块公共项；保存后立即由后端生效，请以实际运行结果为准。</p>
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

    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="2"
    />
    <div v-else>
    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">分区</h2>
        <div class="row-actions">
          <select
            v-model="currentId"
            class="sel"
          >
            <option
              v-for="s in sections"
              :key="s.id"
              :value="s.id"
            >
              {{ s.title }}
            </option>
          </select>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="saving || !data"
            @click="save"
          >
            {{ saving ? "保存中…" : "保存到 .env" }}
          </button>
        </div>
      </div>
      <div
        v-if="data"
        class="panel__bd"
      >
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
            :title="`${currentId} · ${f.name}（JSON）`"
            :rows="5"
          />
          <input
            v-else
            v-model="fieldValues[f.name]"
            class="inp"
            style="max-width: 520px; width: 100%"
            :type="f.kind === 'int' || f.kind === 'float' ? 'number' : 'text'"
          >
        </div>
      </div>
    </div>
    </div>
  </div>
</template>
