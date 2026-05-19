<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useSaveHotkey } from "@/composables/useSaveHotkey";
import {
  fetchCommonConfig,
  fetchCommonConfigSections,
  postServiceGatewaysConnectivityCheck,
  putCommonConfig,
} from "@/api/consoleApi";
import type {
  CommonConfigSectionMeta,
  PluginConfigData,
  PluginConfigField,
  PluginConfigFieldGroup,
} from "@/api/pallasTypes";
import { SERVICE_GATEWAYS_SECTION_ID } from "@/api/pallasTypes";
import JsonTextareaField from "@/components/JsonTextareaField.vue";
import PallasImageGatewaysEditor from "@/components/PallasImageGatewaysEditor.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { axiosErrorDetail } from "@/api/http";
import { PALLAS_IMAGE_GATEWAY_FIELD_NAMES } from "@/utils/pallasImageGateways";
import { toastApiError, toastProbeLines, toastSaveSuccess } from "@/utils/consoleToastFeedback";

const route = useRoute();
const panelNavIcon = usePanelNavIcon();
const err = ref("");
const pageReady = ref(false);
const sections = ref<CommonConfigSectionMeta[]>([]);
const currentId = ref("");
const data = ref<PluginConfigData | null>(null);
const saving = ref(false);
const checking = ref(false);
const checkLines = ref<string[]>([]);
const checkErr = ref("");
const fieldValues = ref<Record<string, string>>({});
const permSelections = ref<Record<string, string>>({});

const CMD_PERM_SECTION_ID = "cmd_perm";

const isServiceGateways = computed(() => currentId.value === SERVICE_GATEWAYS_SECTION_ID);
const showGatewayEditor = computed(() => Boolean(data.value?.gateway_editor));
const supportsConnectivityCheck = computed(() => Boolean(data.value?.supports_connectivity_check));
const showCmdPermMatrix = computed(
  () => currentId.value === CMD_PERM_SECTION_ID && Boolean(data.value?.command_perm_ui),
);
const gatewayFieldNameSet = computed(() => new Set<string>(PALLAS_IMAGE_GATEWAY_FIELD_NAMES));

const fieldGroups = computed((): PluginConfigFieldGroup[] => data.value?.field_groups ?? []);

const genericFields = computed(() => {
  if (!data.value || fieldGroups.value.length) return [];
  return data.value.fields;
});

function sortSectionsCmdPermFirst(list: CommonConfigSectionMeta[]): CommonConfigSectionMeta[] {
  const i = list.findIndex((s) => s.id === CMD_PERM_SECTION_ID);
  if (i <= 0) return [...list];
  const next = [...list];
  const [picked] = next.splice(i, 1);
  next.unshift(picked);
  return next;
}

function fieldModel(f: PluginConfigField): string {
  const v = f.current;
  if (f.kind === "json") return JSON.stringify(v ?? null, null, 2);
  if (typeof v === "boolean") return v ? "true" : "false";
  return v === null || v === undefined ? "" : String(v);
}

function fieldsInGroup(group: PluginConfigFieldGroup): PluginConfigField[] {
  if (!data.value) return [];
  const names = new Set(group.field_names);
  return data.value.fields.filter((f) => names.has(f.name));
}

function onGatewayFieldValues(next: Record<string, string>) {
  fieldValues.value = { ...fieldValues.value, ...next };
}

watch(
  data,
  (d) => {
    fieldValues.value = {};
    permSelections.value = {};
    if (!d) return;
    for (const f of d.fields) {
      fieldValues.value[f.name] = fieldModel(f);
    }
    const ui = d.command_perm_ui;
    if (ui) {
      const next: Record<string, string> = {};
      for (const p of ui.plugins) {
        for (const c of p.commands) {
          next[c.command_id] = c.effective_level;
        }
      }
      permSelections.value = next;
    }
  },
  { immediate: true },
);

function buildOverridesFromMatrix(): Record<string, string> {
  const ui = data.value?.command_perm_ui;
  if (!ui) return {};
  const out: Record<string, string> = {};
  for (const p of ui.plugins) {
    for (const c of p.commands) {
      const sel = permSelections.value[c.command_id] ?? c.effective_level;
      if (sel !== c.default_level) {
        out[c.command_id] = sel;
      }
    }
  }
  return out;
}

async function loadSections() {
  try {
    const raw = await fetchCommonConfigSections();
    sections.value = sortSectionsCmdPermFirst(raw);
    const q = route.query.section;
    if (typeof q === "string" && q.trim()) {
      currentId.value = q.trim();
    } else if (!currentId.value && sections.value.length) {
      currentId.value =
        sections.value.find((s) => s.id === CMD_PERM_SECTION_ID)?.id ?? sections.value[0].id;
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function loadSection() {
  if (!currentId.value) return;
  err.value = "";
  checkLines.value = [];
  checkErr.value = "";
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

useSaveHotkey(
  () => Boolean(data.value) && !saving.value && !checking.value,
  () => save(),
);

function parseField(f: PluginConfigField, raw: string): unknown {
  if (f.kind === "bool") return raw === "true" || raw === "1";
  if (f.kind === "int") return parseInt(raw, 10);
  if (f.kind === "float") return parseFloat(raw);
  if (f.kind === "json") return JSON.parse(raw) as unknown;
  return raw;
}

function collectValues(): Record<string, unknown> {
  if (!data.value) return {};
  const values: Record<string, unknown> = {};
  for (const f of data.value.fields) {
    if (showCmdPermMatrix.value && f.name === "command_permission_overrides") {
      values[f.name] = buildOverridesFromMatrix();
      continue;
    }
    const raw = fieldValues.value[f.name] ?? "";
    if (f.kind === "json" && raw.trim() === "") {
      values[f.name] = null;
    } else {
      values[f.name] = parseField(f, raw);
    }
  }
  return values;
}

async function save() {
  if (!data.value) return;
  saving.value = true;
  err.value = "";
  try {
    data.value = await putCommonConfig(currentId.value, collectValues());
    toastSaveSuccess("已保存到 .env");
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    toastApiError(e, "保存失败");
  } finally {
    saving.value = false;
  }
}

async function runConnectivityCheck() {
  if (!supportsConnectivityCheck.value) return;
  checking.value = true;
  checkErr.value = "";
  checkLines.value = [];
  try {
    const r = await postServiceGatewaysConnectivityCheck(collectValues());
    checkLines.value = r.lines;
    toastProbeLines(r.lines);
  } catch (e) {
    checkErr.value = axiosErrorDetail(e);
    toastApiError(e, "检测失败");
  } finally {
    checking.value = false;
  }
}

function showFieldInGenericList(f: PluginConfigField): boolean {
  if (!(showCmdPermMatrix.value && f.name === "command_permission_overrides")) return true;
  return false;
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
      :panels="2"
    />
    <div
      v-else
      class="common-config-page"
    >
      <div class="panel">
        <div class="panel__hd panel__hd--split">
          <h2 class="panel__title">
            <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>分区
          </h2>
          <div class="row-actions">
            <PanelSidebarAdd main-path="/common-config" />
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
              v-if="supportsConnectivityCheck"
              type="button"
              class="btn"
              :disabled="checking || saving || !data"
              :aria-busy="checking || undefined"
              @click="runConnectivityCheck"
            >
              {{ checking ? "检测中…" : "检测连通" }}
            </button>
            <button
              type="button"
              class="btn btn--primary"
              :disabled="saving || checking || !data"
              title="Ctrl+S"
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
          <p
            v-if="isServiceGateways"
            class="muted"
            style="font-size: 13px; margin: 0 0 20px; line-height: 1.55"
          >
            集中配置画画主/备网关、MAA 对外端点与点歌服务地址；保存后写入各插件对应
            <code>.env</code> 键并热重载。完整参数仍可在各
            <router-link to="/plugins/pallas_image">插件配置</router-link> 页编辑；画画插件页另提供<strong>仅网关</strong>检测。
          </p>
          <div
            v-if="supportsConnectivityCheck && (checkLines.length || checkErr)"
            class="plugin-config-page__check-feedback"
            style="margin-bottom: 20px"
            role="status"
            aria-live="polite"
          >
            <div
              v-if="checkErr"
              class="alert alert--err"
            >
              {{ checkErr }}
            </div>
            <pre
              v-else-if="checkLines.length"
              class="plugin-config-page__check-output"
            >{{ checkLines.join("\n") }}</pre>
          </div>
          <div
            v-if="showCmdPermMatrix && data.command_perm_ui"
            class="cmd-perm-matrix"
            style="margin-bottom: 28px"
          >
            <p class="muted" style="font-size: 13px; margin-bottom: 14px; line-height: 1.5">
              下列为各命令当前生效权限（单选）。仅当所选等级与插件声明的默认不同时，会写入
              <code>PALLAS_COMMAND_PERMISSION_OVERRIDES</code>。
            </p>
            <div
              v-for="pg in data.command_perm_ui.plugins"
              :key="pg.plugin"
              style="margin-bottom: 20px"
            >
              <h3 style="font-size: 15px; margin: 0 0 10px; font-weight: 700">
                {{ pg.title }}
              </h3>
              <div class="cmd-perm-table-wrap">
                <table class="cmd-perm-table">
                  <thead>
                    <tr>
                      <th scope="col">命令</th>
                      <th
                        v-for="lv in data.command_perm_ui.levels"
                        :key="lv.id"
                        scope="col"
                      >
                        {{ lv.label }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in pg.commands"
                      :key="row.command_id"
                    >
                      <th scope="row" class="cmd-perm-table__cmd">
                        <span class="cmd-perm-table__label">{{ row.label }}</span>
                        <span class="muted cmd-perm-table__id">{{ row.command_id }}</span>
                      </th>
                      <td
                        v-for="lv in data.command_perm_ui.levels"
                        :key="row.command_id + lv.id"
                        class="cmd-perm-table__cell"
                      >
                        <input
                          v-model="permSelections[row.command_id]"
                          type="radio"
                          class="cmd-perm-radio"
                          :name="'cmdperm-' + row.command_id"
                          :value="lv.id"
                        >
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <template v-if="fieldGroups.length">
            <section
              v-for="group in fieldGroups"
              :key="group.id"
              style="margin-bottom: 32px"
            >
              <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px">
                <h3 style="font-size: 15px; margin: 0; font-weight: 700">
                  {{ group.title }}
                </h3>
                <router-link
                  :to="group.plugin_config_path"
                  class="muted"
                  style="font-size: 13px"
                >
                  插件完整配置 →
                </router-link>
              </div>
              <PallasImageGatewaysEditor
                v-if="group.id === 'pallas_image' && showGatewayEditor"
                :field-values="fieldValues"
                @update:field-values="onGatewayFieldValues"
              />
              <div
                v-for="f in fieldsInGroup(group)"
                v-show="!(group.id === 'pallas_image' && showGatewayEditor && gatewayFieldNameSet.has(f.name))"
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
            </section>
          </template>
          <div
            v-for="f in genericFields"
            v-show="showFieldInGenericList(f)"
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

<style scoped>
.cmd-perm-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
}

.cmd-perm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.cmd-perm-table th,
.cmd-perm-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  text-align: center;
  vertical-align: middle;
}

.cmd-perm-table thead th {
  font-weight: 600;
  background: var(--panel-hd-bg, rgba(0, 0, 0, 0.15));
  white-space: nowrap;
}

.cmd-perm-table tbody tr:last-child th,
.cmd-perm-table tbody tr:last-child td {
  border-bottom: none;
}

.cmd-perm-table__cmd {
  text-align: left !important;
  min-width: 160px;
}

.cmd-perm-table__label {
  display: block;
  font-weight: 600;
}

.cmd-perm-table__id {
  display: block;
  font-size: 11px;
  margin-top: 2px;
  word-break: break-all;
}

.cmd-perm-radio {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.plugin-config-page__check-output {
  margin: 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--panel-hd-bg, rgba(0, 0, 0, 0.2));
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
