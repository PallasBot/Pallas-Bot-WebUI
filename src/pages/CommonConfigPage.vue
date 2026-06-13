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
import { SERVICE_GATEWAYS_SECTION_ID, PALLAS_WEBUI_SECTION_ID, CORPUS_FEDERATION_SECTION_ID, COMMUNITY_STATS_SECTION_ID } from "@/api/pallasTypes";
import JsonTextareaField from "@/components/JsonTextareaField.vue";
import PallasImageGatewaysEditor from "@/components/PallasImageGatewaysEditor.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { axiosErrorDetail } from "@/api/http";
import { PALLAS_IMAGE_GATEWAY_FIELD_NAMES } from "@/utils/pallasImageGateways";
import { pluginConfigRouteFromPath } from "@/utils/pluginConfigRoute";
import { toastApiError, toastProbeLines, toastSaveSuccess } from "@/utils/consoleToastFeedback";
import { enumChoiceLabel, fieldDisplayTitle } from "@/utils/configFieldDisplay";

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
const CONTROL_PLANE_SECTION_ID = "control_plane";

const isCorpusFederationSection = computed(() => currentId.value === CORPUS_FEDERATION_SECTION_ID);
const isCommunityStatsSection = computed(() => currentId.value === COMMUNITY_STATS_SECTION_ID);
const isControlPlaneSection = computed(() => currentId.value === CONTROL_PLANE_SECTION_ID);
const isServiceGateways = computed(() => currentId.value === SERVICE_GATEWAYS_SECTION_ID);
const isPallasWebuiSection = computed(() => currentId.value === PALLAS_WEBUI_SECTION_ID);
const showDevModeHotReloadHint = computed(() => Boolean(data.value?.dev_mode_hot_reload));
const showHotReloadHint = computed(
  () => Boolean(data.value?.dev_mode_hot_reload || data.value?.hot_reload),
);
const showGatewayEditor = computed(() => Boolean(data.value?.gateway_editor));
const supportsConnectivityCheck = computed(() => Boolean(data.value?.supports_connectivity_check));
const showCmdPermMatrix = computed(
  () => currentId.value === CMD_PERM_SECTION_ID && Boolean(data.value?.command_perm_ui),
);
const isCmdPermSection = computed(() => currentId.value === CMD_PERM_SECTION_ID);
const isMessageScrubSection = computed(() => currentId.value === "message_scrub");
const gatewayFieldNameSet = computed(() => new Set<string>(PALLAS_IMAGE_GATEWAY_FIELD_NAMES));

const fieldGroups = computed((): PluginConfigFieldGroup[] => data.value?.field_groups ?? []);

const genericFields = computed(() => {
  if (!data.value || fieldGroups.value.length) return [];
  if (isCmdPermSection.value && data.value.command_perm_ui) return [];
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
  if (f.kind === "bool") {
    if (typeof v === "boolean") return v ? "true" : "false";
    const text = String(v ?? "").trim().toLowerCase();
    return text === "true" || text === "1" || text === "yes" || text === "on" ? "true" : "false";
  }
  return v === null || v === undefined ? "" : String(v);
}

function fieldsInGroup(group: PluginConfigFieldGroup): PluginConfigField[] {
  if (!data.value) return [];
  const names = new Set(group.field_names);
  return data.value.fields.filter((f) => names.has(f.name));
}

function fieldGroupPluginRoute(group: PluginConfigFieldGroup) {
  const sectionPlugin = isPallasWebuiSection.value ? PALLAS_WEBUI_SECTION_ID : undefined;
  return pluginConfigRouteFromPath(group.plugin_config_path, sectionPlugin);
}

function onGatewayFieldValues(next: Record<string, string>) {
  fieldValues.value = { ...fieldValues.value, ...next };
}

watch(
  data,
  (d) => {
    permSelections.value = {};
    if (!d?.fields?.length) {
      fieldValues.value = {};
      return;
    }
    const next: Record<string, string> = {};
    for (const f of d.fields) {
      try {
        next[f.name] = fieldModel(f);
      } catch {
        next[f.name] = f.kind === "bool" ? "false" : "";
      }
    }
    fieldValues.value = next;
    const ui = d.command_perm_ui;
    if (ui) {
      const permNext: Record<string, string> = {};
      for (const p of ui.plugins) {
        for (const c of p.commands) {
          permNext[c.command_id] = c.effective_level;
        }
      }
      permSelections.value = permNext;
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
    const metaSection = route.meta.defaultCommonConfigSection;
    if (typeof q === "string" && q.trim()) {
      currentId.value = q.trim();
    } else if (typeof metaSection === "string" && metaSection.trim()) {
      currentId.value = metaSection.trim();
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

watch(
  () => route.query.section,
  (q) => {
    if (typeof q !== "string" || !q.trim()) return;
    const sid = q.trim();
    if (sid !== currentId.value && sections.value.some((s) => s.id === sid)) {
      currentId.value = sid;
    }
  },
);

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

function parseField(f: PluginConfigField, raw: unknown): unknown {
  const text = String(raw ?? "");
  if (f.kind === "bool") return text === "true" || text === "1";
  if (f.kind === "int") return parseInt(text.trim() || "0", 10);
  if (f.kind === "float") return parseFloat(text.trim() || "0");
  if (f.kind === "json") return JSON.parse(text) as unknown;
  return text;
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
    if (f.kind === "json" && String(raw).trim() === "") {
      values[f.name] = null;
    } else {
      values[f.name] = parseField(f, raw);
    }
  }
  return values;
}

function setBoolField(name: string, checked: boolean) {
  fieldValues.value = {
    ...fieldValues.value,
    [name]: checked ? "true" : "false",
  };
}

function onBoolFieldChange(name: string, ev: Event) {
  const el = ev.target as HTMLInputElement | null;
  if (!el) return;
  setBoolField(name, el.checked);
}

const BACKFILL_ENABLE_CONFIRM =
  "开启后将在后台分批把本机历史语料同步到社区共享池；需已开启「上传本机新回复」并完成语料登记。\n\n与接话无关，队列繁忙时会自动跳过。\n\n确定开启？";

const DEV_MODE_ENABLE_CONFIRM =
  "开启开发模式将跳过控制台 JSON API 与静态页登录鉴权，任何能访问该地址的人均可读写控制台。\n\n仅在受信任的本机/内网联调时使用，生产环境务必保持关闭。\n\n确定开启？";

async function save() {
  if (!data.value) return;
  if (isPallasWebuiSection.value) {
    const values = collectValues();
    const prev = data.value.fields.find((f) => f.name === "pallas_webui_dev_mode")?.current === true;
    const next = values.pallas_webui_dev_mode === true;
    if (!prev && next && !window.confirm(DEV_MODE_ENABLE_CONFIRM)) return;
  }
  if (isCorpusFederationSection.value) {
    const values = collectValues();
    const prev = data.value.fields.find((f) => f.name === "corpus_backfill_enabled")?.current === true;
    const next = values.corpus_backfill_enabled === true;
    if (!prev && next && !window.confirm(BACKFILL_ENABLE_CONFIRM)) return;
  }
  saving.value = true;
  err.value = "";
  try {
    const saved = await putCommonConfig(currentId.value, collectValues());
    if (!saved?.fields?.length) {
      throw new Error("保存响应缺少 fields，请刷新页面后重试");
    }
    data.value = saved;
    toastSaveSuccess("配置已保存");
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

function showConfigField(f: PluginConfigField): boolean {
  if (showCmdPermMatrix.value && f.name === "command_permission_overrides") return false;
  if (isPallasWebuiSection.value && f.name === "pallas_webui_dev_mode") return false;
  return true;
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
              {{ saving ? "保存中…" : "保存配置" }}
            </button>
          </div>
        </div>
        <div
          v-if="data"
          class="panel__bd"
        >
          <p
            v-if="isCmdPermSection"
            class="muted common-config-page__intro"
          >
            调整各口令<strong>谁可用</strong>（所有人、群管、号主等）。下方矩阵只显示中文命令名；保存后立即生效，一般无需重启。
          </p>
          <p
            v-if="isMessageScrubSection"
            class="muted common-config-page__intro"
          >
            复读<strong>学习</strong>与做梦<strong>采集</strong>前的入站过滤。不配任何项时与未启用时行为一致；保存后热重载。
          </p>
          <p
            v-if="isControlPlaneSection"
            class="muted common-config-page__intro"
          >
            多套牛牛加入同一<strong>社区联邦池</strong>时，可共用中心下发的配置，并对同一条群消息<strong>只让一套牛牛回复</strong>，避免重复抢答。
            入池密钥在<strong>统计与语料</strong>页复制；保存后写入 <code>webui.json</code> 并立即尝试向中心拉取最新配置。
          </p>
          <p
            v-if="isCorpusFederationSection"
            class="muted common-config-page__intro"
          >
            管理<strong>接话语料</strong>从哪读、是否接入<strong>社区共享池</strong>。
            共享语料默认关闭，需手动开启。保存后写入 <code>webui.json</code> 并<strong>热重载</strong>，一般无需重启牛牛。
          </p>
          <p
            v-if="isCommunityStatsSection"
            class="muted common-config-page__intro"
          >
            向社区中心<strong>上报在线统计</strong>（默认开启，不含消息内容）。
            下方可分别设置是否在主站气泡墙<strong>公开 QQ</strong>或<strong>头像昵称</strong>，默认均关闭。
          </p>
          <p
            v-if="isCorpusFederationSection && showHotReloadHint"
            class="muted common-config-page__intro"
          >
            关闭「使用共享语料」后，下一周期起不再访问共享池；其余项保存后立即生效。
          </p>
          <p
            v-if="isServiceGateways"
            class="muted common-config-page__intro"
          >
            集中配置画画主/备网关、MAA 对外端点与点歌服务地址；保存后写入运行配置并热重载。完整参数仍可在各
            <router-link to="/plugins/draw">插件配置</router-link> 页编辑；画画插件页另提供<strong>仅网关</strong>检测。
          </p>
          <p
            v-if="showDevModeHotReloadHint"
            class="muted common-config-page__intro"
          >
            <strong>开发模式</strong>可在顶栏快速开关：开启后跳过控制台登录校验，仅适合本机调试；公网务必关闭。
            「允许跨域访问」变更后需重启总机牛牛。
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
              为各命令选择「谁可用」。仅当所选等级与插件默认不同时才会保存覆盖项。
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
                  v-if="isPallasWebuiSection"
                  :to="{ name: 'plugin-config', params: { name: PALLAS_WEBUI_SECTION_ID } }"
                  class="muted"
                  style="font-size: 13px"
                >
                  插件完整配置 →
                </router-link>
                <router-link
                  v-else-if="group.plugin_config_path"
                  :to="fieldGroupPluginRoute(group)"
                  class="muted"
                  style="font-size: 13px"
                >
                  插件完整配置 →
                </router-link>
              </div>
              <p
                v-if="isPallasWebuiSection && group.id === 'security'"
                class="muted"
                style="font-size: 13px; margin: -6px 0 12px; line-height: 1.5"
              >
                开发模式开关在顶栏右侧，与连接状态、主题切换同一行。
              </p>
              <PallasImageGatewaysEditor
                v-if="group.id === 'draw' && showGatewayEditor"
                :field-values="fieldValues"
                @update:field-values="onGatewayFieldValues"
              />
              <div
                v-for="f in fieldsInGroup(group)"
                v-show="
                  showConfigField(f)
                    && !(group.id === 'draw' && showGatewayEditor && gatewayFieldNameSet.has(f.name))
                "
                :key="f.name"
                style="margin-bottom: 22px"
              >
                <div style="font-weight: 700; margin-bottom: 6px">
                  {{ fieldDisplayTitle(f) }}
                  <span
                    v-if="!f.label"
                    class="muted"
                    style="font-weight: 500"
                  >（{{ f.kind }}）</span>
                </div>
                <div class="muted common-config-field-desc" style="font-size: 13px; margin-bottom: 8px; white-space: pre-line">
                  {{ f.description }}
                </div>
                <label
                  v-if="f.kind === 'bool'"
                  class="console-bool-switch"
                  :class="{ 'console-bool-switch--on': fieldValues[f.name] === 'true' }"
                >
                  <input
                    type="checkbox"
                    class="console-bool-switch__input"
                    :checked="fieldValues[f.name] === 'true'"
                    @click.stop
                    @change="onBoolFieldChange(f.name, $event)"
                  >
                  <span class="console-bool-switch__track" aria-hidden="true">
                    <span class="console-bool-switch__thumb" />
                  </span>
                  <span class="console-bool-switch__label">{{ fieldValues[f.name] === "true" ? "开启" : "关闭" }}</span>
                </label>
                <select
                  v-else-if="f.kind === 'enum' && f.choices?.length"
                  v-model="fieldValues[f.name]"
                  class="sel"
                  style="max-width: 520px; width: 100%"
                >
                  <option
                    v-for="opt in f.choices"
                    :key="opt"
                    :value="opt"
                  >
                    {{ enumChoiceLabel(opt) }}
                  </option>
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
                  type="text"
                  :inputmode="f.kind === 'int' ? 'numeric' : f.kind === 'float' ? 'decimal' : undefined"
                >
              </div>
            </section>
          </template>
          <div
            v-for="f in genericFields"
            v-show="showConfigField(f)"
            :key="f.name"
            style="margin-bottom: 22px"
          >
            <div style="font-weight: 700; margin-bottom: 6px">
              {{ fieldDisplayTitle(f) }}
              <span
                v-if="!f.label"
                class="muted"
                style="font-weight: 500"
              >（{{ f.kind }}）</span>
            </div>
            <div class="muted common-config-field-desc" style="font-size: 13px; margin-bottom: 8px; white-space: pre-line">
              {{ f.description }}
            </div>
            <label
              v-if="f.kind === 'bool'"
              class="console-bool-switch"
              :class="{ 'console-bool-switch--on': fieldValues[f.name] === 'true' }"
            >
              <input
                type="checkbox"
                class="console-bool-switch__input"
                :checked="fieldValues[f.name] === 'true'"
                @click.stop
                @change="onBoolFieldChange(f.name, $event)"
              >
              <span class="console-bool-switch__track" aria-hidden="true">
                <span class="console-bool-switch__thumb" />
              </span>
              <span class="console-bool-switch__label">{{ fieldValues[f.name] === "true" ? "开启" : "关闭" }}</span>
            </label>
            <select
              v-else-if="f.kind === 'enum' && f.choices?.length"
              v-model="fieldValues[f.name]"
              class="sel"
              style="max-width: 520px; width: 100%"
            >
              <option
                v-for="opt in f.choices"
                :key="opt"
                :value="opt"
              >
                {{ enumChoiceLabel(opt) }}
              </option>
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
              type="text"
              :inputmode="f.kind === 'int' ? 'numeric' : f.kind === 'float' ? 'decimal' : undefined"
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.common-config-page__intro {
  font-size: 13px;
  margin: 0 0 16px;
  line-height: 1.6;
}

.common-config-page__intro + .common-config-page__intro {
  margin-top: -8px;
}

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
