<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import { AI_ENTRY_RUNTIME, AI_ENTRY_SITE_GATEWAY_CHECK } from "@/config/aiEntrySemantics";
import { useRoute, useRouter } from "vue-router";
import { useSaveHotkey } from "@/composables/useSaveHotkey";
import {
  fetchCommonConfig,
  fetchCommonConfigRaw,
  fetchCommonConfigSections,
  postServiceGatewaysConnectivityCheck,
  putCommonConfig,
  putCommonConfigRaw,
} from "@/api/consoleApi";
import type {
  CommonConfigSectionMeta,
  PluginConfigData,
  PluginConfigCheckResult,
  PluginConfigField,
  PluginConfigFieldGroup,
} from "@/api/pallasTypes";
import { SERVICE_GATEWAYS_SECTION_ID, CORPUS_FEDERATION_SECTION_ID, COMMUNITY_STATS_SECTION_ID } from "@/api/pallasTypes";
import ConfigFieldRenderer from "@/components/config/ConfigFieldRenderer.vue";
import DynamicConfigPanel from "@/components/config/DynamicConfigPanel.vue";
import PluginConfigFieldDialog from "@/components/config/PluginConfigFieldDialog.vue";
import PluginConfigFieldShell from "@/components/config/PluginConfigFieldShell.vue";
import PallasImageGatewaysEditor from "@/components/PallasImageGatewaysEditor.vue";
import AiRuntimeSummaryPanel from "@/components/ai-config/AiRuntimeSummaryPanel.vue";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import RuntimeCheckResults from "@/components/config/RuntimeCheckResults.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { usePluginConfigFieldPopover } from "@/composables/usePluginConfigFieldPopover";
import { axiosErrorDetail } from "@/api/http";
import { PALLAS_IMAGE_GATEWAY_FIELD_NAMES } from "@/utils/pallasImageGateways";
import { pluginConfigRouteFromPath } from "@/utils/pluginConfigRoute";
import { toastApiError, toastProbeLines, toastSaveSuccess } from "@/utils/consoleToastFeedback";
import {
  buildAiRuntimeOverview,
  groupAiRuntimeSnapshot,
  resolveAiRuntimeSnapshot,
} from "@/utils/aiRuntimeResolver";
import {
  fieldValuesFromConfig,
  parsePluginConfigField,
} from "@/utils/pluginConfigFieldModel";
import { commonConfigSectionRedirectTarget } from "@/utils/commonConfigRedirects";

const route = useRoute();
const router = useRouter();
const panelNavIcon = usePanelNavIcon();
const err = ref("");
const pageReady = ref(false);
const sections = ref<CommonConfigSectionMeta[]>([]);
const currentId = ref("");
const data = ref<PluginConfigData | null>(null);
const saving = ref(false);
const checking = ref(false);
const checkLines = ref<string[]>([]);
const checkResults = ref<PluginConfigCheckResult["results"]>([]);
const checkErr = ref("");
const fieldValues = ref<Record<string, string>>({});

const CONTROL_PLANE_SECTION_ID = "control_plane";
const LLM_SECTION_ID = "llm";
const ARKNIGHTS_KB_SECTION_ID = "arknights_kb";
const AI_MANAGED_SECTION_IDS = new Set([LLM_SECTION_ID, ARKNIGHTS_KB_SECTION_ID]);
const SHELL_FIELD_SECTION_IDS = new Set([
  SERVICE_GATEWAYS_SECTION_ID,
  CORPUS_FEDERATION_SECTION_ID,
  COMMUNITY_STATS_SECTION_ID,
]);

const isCorpusFederationSection = computed(() => currentId.value === CORPUS_FEDERATION_SECTION_ID);
const isCommunityStatsSection = computed(() => currentId.value === COMMUNITY_STATS_SECTION_ID);
const isControlPlaneSection = computed(() => currentId.value === CONTROL_PLANE_SECTION_ID);
const isServiceGateways = computed(() => currentId.value === SERVICE_GATEWAYS_SECTION_ID);
const showHotReloadHint = computed(() => Boolean(data.value?.hot_reload));
const showGatewayEditor = computed(() => Boolean(data.value?.gateway_editor));
const supportsConnectivityCheck = computed(() => Boolean(data.value?.supports_connectivity_check));
const isMessageScrubSection = computed(() => currentId.value === "message_scrub");
const useShellFieldLayout = computed(() => SHELL_FIELD_SECTION_IDS.has(currentId.value));
const gatewayFieldNameSet = computed(() => new Set<string>(PALLAS_IMAGE_GATEWAY_FIELD_NAMES));

const fieldGroups = computed((): PluginConfigFieldGroup[] => data.value?.field_groups ?? []);
const gatewayRuntimeItems = computed(() =>
  resolveAiRuntimeSnapshot({
    gatewayResults: checkResults.value,
    extensionTest: null,
  }),
);
const gatewayRuntimeGroups = computed(() => groupAiRuntimeSnapshot(gatewayRuntimeItems.value));
const gatewayRuntimeOverview = computed(() => buildAiRuntimeOverview(gatewayRuntimeItems.value));

const genericFields = computed(() => {
  if (!data.value || fieldGroups.value.length) return [];
  return data.value.fields;
});

function fieldsInGroup(group: PluginConfigFieldGroup): PluginConfigField[] {
  if (!data.value) return [];
  const names = new Set(group.field_names);
  return data.value.fields.filter((f) => names.has(f.name));
}

function isFieldHiddenInGroup(f: PluginConfigField, group: PluginConfigFieldGroup): boolean {
  if (group.id === "draw" && showGatewayEditor.value && gatewayFieldNameSet.value.has(f.name)) {
    return true;
  }
  return false;
}

function visibleFieldsInGroup(group: PluginConfigFieldGroup): PluginConfigField[] {
  return fieldsInGroup(group).filter((f) => !isFieldHiddenInGroup(f, group));
}

const visibleGenericFields = computed(() => genericFields.value);

type ConfigEditMode = "form" | "raw";

const configEditMode = ref<ConfigEditMode>("form");
const rawToml = ref("");
const savedRawToml = ref("");

const supportsRawToml = computed(
  () =>
    Boolean(data.value?.fields?.length) &&
    !isServiceGateways.value &&
    !isCorpusFederationSection.value &&
    !isCommunityStatsSection.value &&
    !isControlPlaneSection.value,
);

function savedFormFingerprint(): string {
  if (!data.value) return "";
  const vals: Record<string, unknown> = {};
  for (const f of data.value.fields) {
    vals[f.name] = f.current;
  }
  return JSON.stringify(vals);
}

const configDirty = computed(() => {
  if (!data.value) return false;
  if (configEditMode.value === "raw") {
    return rawToml.value !== savedRawToml.value;
  }
  return JSON.stringify(collectValues()) !== savedFormFingerprint();
});

async function ensureRawTomlLoaded() {
  if (!currentId.value) return;
  const text = await fetchCommonConfigRaw(currentId.value);
  rawToml.value = text;
  savedRawToml.value = text;
}

async function switchConfigEditMode(mode: ConfigEditMode) {
  if (mode === configEditMode.value) return;
  if (configDirty.value) {
    const ok = window.confirm("当前有未保存的修改，切换编辑模式将丢弃这些更改。继续？");
    if (!ok) return;
  }
  configEditMode.value = mode;
  if (mode === "raw") {
    await ensureRawTomlLoaded();
    return;
  }
  if (data.value) {
    fieldValues.value = fieldValuesFromConfig(data.value.fields);
  }
}

function onConfigBeforeUnload(ev: BeforeUnloadEvent) {
  if (!configDirty.value) return;
  ev.preventDefault();
  ev.returnValue = "";
}

const {
  fieldPopoverHost,
  activeFieldPopoverName,
  activeFieldPopover,
  activeFieldDialog,
  activeFieldDialogMode,
  fieldPopoverStyle,
  fieldDisplayName,
  fieldHelpDefaultValue,
  fieldTypeLabel,
  onFieldHelpClick,
  onFieldHelpHover,
  onFieldEditClick,
  onHelpHoverLeave,
  onPopoverEnter,
  onFieldDialogEditRequest,
  closeFieldDialog,
  closeFieldInteraction,
} = usePluginConfigFieldPopover(() => data.value?.fields ?? []);

function fieldGroupPluginRoute(group: PluginConfigFieldGroup) {
  return pluginConfigRouteFromPath(group.plugin_config_path);
}

function onGatewayFieldValues(next: Record<string, string>) {
  fieldValues.value = { ...fieldValues.value, ...next };
}

function updateFieldValue(name: string, value: string) {
  fieldValues.value = { ...fieldValues.value, [name]: value };
}

watch(
  data,
  (d) => {
    if (!d?.fields?.length) {
      fieldValues.value = {};
      return;
    }
    try {
      fieldValues.value = fieldValuesFromConfig(d.fields);
    } catch {
      const next: Record<string, string> = {};
      for (const f of d.fields) {
        next[f.name] = f.kind === "bool" ? "false" : "";
      }
      fieldValues.value = next;
    }
  },
  { immediate: true },
);

async function loadSections() {
  try {
    const raw = await fetchCommonConfigSections();
    const q = route.query.section;
    if (typeof q === "string" && q.trim() === LLM_SECTION_ID) {
      await router.replace(aiConfigSectionPath("strategy"));
      return;
    }
    if (typeof q === "string" && q.trim() === ARKNIGHTS_KB_SECTION_ID) {
      await router.replace(aiConfigSectionPath("knowledge"));
      return;
    }
    if (typeof q === "string" && q.trim()) {
      const redirect = commonConfigSectionRedirectTarget(q.trim());
      if (redirect) {
        await router.replace(redirect);
        return;
      }
    }
    sections.value = [...raw.filter((s) => !AI_MANAGED_SECTION_IDS.has(s.id))];
    const metaSection = route.meta.defaultCommonConfigSection;
    if (typeof q === "string" && q.trim()) {
      const sid = q.trim();
      if (!AI_MANAGED_SECTION_IDS.has(sid) && sections.value.some((s) => s.id === sid)) {
        currentId.value = sid;
      }
    } else if (typeof metaSection === "string" && metaSection.trim()) {
      const sid = metaSection.trim();
      if (!AI_MANAGED_SECTION_IDS.has(sid)) currentId.value = sid;
    } else if (!currentId.value || AI_MANAGED_SECTION_IDS.has(currentId.value)) {
      currentId.value = sections.value[0]?.id ?? "";
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
  configEditMode.value = "form";
  rawToml.value = "";
  savedRawToml.value = "";
  closeFieldInteraction();
  void loadSection();
});

watch(
  () => route.query.section,
  (q) => {
    if (typeof q !== "string" || !q.trim()) return;
    const sid = q.trim();
    if (sid === LLM_SECTION_ID) {
      void router.replace(aiConfigSectionPath("strategy"));
      return;
    }
    if (sid === ARKNIGHTS_KB_SECTION_ID) {
      void router.replace(aiConfigSectionPath("knowledge"));
      return;
    }
    const redirect = commonConfigSectionRedirectTarget(sid);
    if (redirect) {
      void router.replace(redirect);
      return;
    }
    if (sid !== currentId.value && sections.value.some((s) => s.id === sid)) {
      currentId.value = sid;
    }
  },
);

onMounted(async () => {
  window.addEventListener("beforeunload", onConfigBeforeUnload);
  try {
    await loadSections();
    await loadSection();
  } finally {
    pageReady.value = true;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", onConfigBeforeUnload);
});

useSaveHotkey(
  () => Boolean(data.value) && !saving.value && !checking.value,
  () => save(),
);

function collectValues(): Record<string, unknown> {
  if (!data.value) return {};
  const values: Record<string, unknown> = {};
  for (const f of data.value.fields) {
    const raw = fieldValues.value[f.name] ?? "";
    if (f.kind === "json" && String(raw).trim() === "") {
      values[f.name] = null;
    } else {
      values[f.name] = parsePluginConfigField(f, raw);
    }
  }
  return values;
}

const BACKFILL_ENABLE_CONFIRM =
  "开启后将在后台分批把本机历史语料同步到社区共享池；需已开启「上传本机新回复」并完成语料登记。\n\n与接话无关，队列繁忙时会自动跳过。\n\n确定开启？";

async function save() {
  if (!data.value) return;
  if (configEditMode.value === "form" && isCorpusFederationSection.value) {
    const values = collectValues();
    const prev = data.value.fields.find((f) => f.name === "corpus_backfill_enabled")?.current === true;
    const next = values.corpus_backfill_enabled === true;
    if (!prev && next && !window.confirm(BACKFILL_ENABLE_CONFIRM)) return;
  }
  saving.value = true;
  err.value = "";
  try {
    const saved =
      configEditMode.value === "raw"
        ? await putCommonConfigRaw(currentId.value, rawToml.value)
        : await putCommonConfig(currentId.value, collectValues());
    if (!saved?.fields?.length) {
      throw new Error("保存响应缺少 fields，请刷新页面后重试");
    }
    data.value = saved;
    if (configEditMode.value === "raw") {
      savedRawToml.value = rawToml.value;
    }
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
  checkResults.value = [];
  try {
    const r = await postServiceGatewaysConnectivityCheck(collectValues());
    checkLines.value = r.lines;
    checkResults.value = r.results;
    toastProbeLines(r.lines);
  } catch (e) {
    checkErr.value = axiosErrorDetail(e);
    toastApiError(e, "检测失败");
  } finally {
    checking.value = false;
  }
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
      class="common-config-page console-hub-page"
    >
      <ConsoleHubMasthead :icon="panelNavIcon">
        <template #title>
          通用配置
        </template>
        <template #lead>
          按分区编辑站点级设置；保存后多数项可热载，无需重启。
        </template>
        <template #actions>
        </template>
      </ConsoleHubMasthead>

      <UiCard
        tag="div"
        glass
        class="common-config-page__card"
      >
        <div class="panel__hd panel__hd--split">
          <h2 class="panel__title">
            <ConsoleNavIcon class="panel__title-ico" :name="panelNavIcon" />分区
          </h2>
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
            <UiButton
              v-if="supportsConnectivityCheck"
              variant="outline"
              :disabled="checking || saving || !data"
              :busy="checking"
              @click="runConnectivityCheck"
            >
              {{ checking ? "检测中…" : "检测连通" }}
            </UiButton>
            <UiButton
              variant="primary"
              :disabled="saving || checking || !data"
              :busy="saving"
              title="Ctrl+S"
              @click="save"
            >
              {{ saving ? "保存中…" : "保存配置" }}
            </UiButton>
          </div>
        </div>
        <div
          v-if="data"
          class="panel__bd"
        >
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
            多套牛牛加入同一<strong>多机协同池</strong>时，可共用中心下发的配置，并对同一条群消息<strong>只让一套牛牛回复</strong>，避免重复抢答。
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
            下方「社区主站展示」可分别设置是否在主站气泡墙<strong>公开 QQ</strong>（默认关）或<strong>头像昵称</strong>（默认开）。
            也可在<strong>统计与语料</strong>页通过链接进入本页调整。
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
            <router-link to="/plugins/draw">插件配置</router-link> 页编辑。
            本页「连通性检测」属于<strong>{{ AI_ENTRY_SITE_GATEWAY_CHECK.label }}</strong>：{{ AI_ENTRY_SITE_GATEWAY_CHECK.shortLead }}
            {{ AI_ENTRY_RUNTIME.label }}见
            <router-link :to="AI_ENTRY_RUNTIME.path">AI 观测</router-link>。
          </p>
          <div
            v-if="supportsRawToml"
            class="plugin-config-page__mode-toggle console-view-toggle"
            role="tablist"
            aria-label="配置编辑模式"
          >
            <button
              type="button"
              role="tab"
              :class="{ 'is-on': configEditMode === 'form' }"
              :aria-selected="configEditMode === 'form'"
              @click="void switchConfigEditMode('form')"
            >
              表单
            </button>
            <button
              type="button"
              role="tab"
              :class="{ 'is-on': configEditMode === 'raw' }"
              :aria-selected="configEditMode === 'raw'"
              @click="void switchConfigEditMode('raw')"
            >
              Raw TOML
            </button>
          </div>
          <p
            v-if="supportsRawToml && configDirty"
            class="alert alert--warn plugin-config-page__dirty-hint"
          >
            有未保存的修改
          </p>
          <div
            v-if="supportsRawToml && configEditMode === 'raw'"
            class="plugin-config-page__raw-toml-wrap"
          >
            <textarea
              v-model="rawToml"
              class="inp textarea plugin-config-page__raw-toml"
              spellcheck="false"
              rows="16"
              :disabled="saving || checking"
            />
          </div>
          <template v-if="!supportsRawToml || configEditMode === 'form'">
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
            v-if="supportsConnectivityCheck && checkResults.length"
            style="margin-bottom: 20px"
          >
            <AiRuntimeSummaryPanel
              v-if="gatewayRuntimeItems.length"
              :overview="gatewayRuntimeOverview"
              :groups="gatewayRuntimeGroups"
              variant="compact"
              show-hub-link
              class="common-config-page__runtime-summary"
            />
            <RuntimeCheckResults :results="checkResults" />
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
                  v-if="group.plugin_config_path"
                  :to="fieldGroupPluginRoute(group)"
                  class="muted"
                  style="font-size: 13px"
                >
                  插件完整配置 →
                </router-link>
              </div>
              <PallasImageGatewaysEditor
                v-if="group.id === 'draw' && showGatewayEditor"
                :field-values="fieldValues"
                @update:field-values="onGatewayFieldValues"
              />
              <div
                v-if="useShellFieldLayout && visibleFieldsInGroup(group).length"
                class="plugin-config-form-grid"
              >
                <PluginConfigFieldShell
                  v-for="f in visibleFieldsInGroup(group)"
                  :key="f.name"
                  :field="f"
                  :model-value="fieldValues[f.name] ?? ''"
                  :help-expanded="activeFieldPopoverName === f.name"
                  :json-title="`${currentId} · ${f.name}（JSON）`"
                  @update:model-value="(v) => updateFieldValue(f.name, v)"
                  @help-click="onFieldHelpClick(f.name, $event)"
                  @help-hover="onFieldHelpHover(f.name, $event)"
                  @help-hover-leave="onHelpHoverLeave"
                  @edit-click="onFieldEditClick(f.name)"
                />
              </div>
              <template v-else>
                <ConfigFieldRenderer
                  v-for="f in fieldsInGroup(group)"
                  v-show="!isFieldHiddenInGroup(f, group)"
                  :key="f.name"
                  :field="f"
                  :model-value="fieldValues[f.name] ?? ''"
                  :show-meta="false"
                  :json-title="`${currentId} · ${f.name}（JSON）`"
                  @update:model-value="(v) => updateFieldValue(f.name, v)"
                />
              </template>
            </section>
          </template>
          <div
            v-if="useShellFieldLayout && visibleGenericFields.length"
            class="plugin-config-form-grid"
          >
            <PluginConfigFieldShell
              v-for="f in visibleGenericFields"
              :key="f.name"
              :field="f"
              :model-value="fieldValues[f.name] ?? ''"
              :help-expanded="activeFieldPopoverName === f.name"
              :json-title="`${currentId} · ${f.name}（JSON）`"
              @update:model-value="(v) => updateFieldValue(f.name, v)"
              @help-click="onFieldHelpClick(f.name, $event)"
              @help-hover="onFieldHelpHover(f.name, $event)"
              @help-hover-leave="onHelpHoverLeave"
              @edit-click="onFieldEditClick(f.name)"
            />
          </div>
          <DynamicConfigPanel
            v-else-if="visibleGenericFields.length"
            :fields="visibleGenericFields"
            :unexpected-keys="data?.unexpected_keys"
            :model-value="fieldValues"
            :active-field-popover-name="activeFieldPopoverName"
            @update:model-value="(v) => (fieldValues = v)"
            @help-click="onFieldHelpClick"
            @help-hover="onFieldHelpHover"
            @help-hover-leave="onHelpHoverLeave"
            @edit-click="onFieldEditClick"
          />
          </template>
        </div>
      </UiCard>
      <Teleport to="body">
        <div
          v-if="useShellFieldLayout && activeFieldPopover"
          ref="fieldPopoverHost"
          class="plugin-config-field-popover"
          :style="fieldPopoverStyle"
          @click.stop
          @mouseenter="onPopoverEnter"
          @mouseleave="onHelpHoverLeave"
        >
          <div class="plugin-config-field-popover__section">
            <div class="plugin-config-field-popover__eyebrow">配置说明</div>
            <h4 class="plugin-config-field-popover__title">{{ fieldDisplayName(activeFieldPopover) }}</h4>
            <p
              v-if="activeFieldPopover.description"
              class="plugin-config-field-popover__desc"
            >
              {{ activeFieldPopover.description }}
            </p>
            <p
              v-else
              class="plugin-config-field-popover__desc plugin-config-field-popover__desc--muted"
            >
              暂无详细说明。
            </p>
          </div>
          <dl class="plugin-config-field-popover__meta">
            <div>
              <dt>类型</dt>
              <dd>{{ fieldTypeLabel(activeFieldPopover) }}</dd>
            </div>
            <div>
              <dt>默认值</dt>
              <dd><code>{{ fieldHelpDefaultValue(activeFieldPopover) }}</code></dd>
            </div>
            <div>
              <dt>环境键</dt>
              <dd><code>{{ activeFieldPopover.env_key }}</code></dd>
            </div>
          </dl>
        </div>
      </Teleport>
      <PluginConfigFieldDialog
        v-if="useShellFieldLayout"
        :open="!!activeFieldDialog"
        :field="activeFieldDialog"
        :mode="activeFieldDialogMode"
        :model-value="activeFieldDialog ? (fieldValues[activeFieldDialog.name] ?? '') : ''"
        :json-title="activeFieldDialog ? `${currentId} · ${activeFieldDialog.name}（JSON）` : undefined"
        @close="closeFieldDialog"
        @edit-request="onFieldDialogEditRequest"
        @update:model-value="
          activeFieldDialog && updateFieldValue(activeFieldDialog.name, $event)
        "
      />
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

.common-config-page__runtime-summary {
  margin-bottom: 14px;
}

.plugin-config-form-grid {
  display: grid;
  gap: 18px 24px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}

@media (max-width: 920px) {
  .plugin-config-form-grid {
    grid-template-columns: 1fr;
  }
}

.plugin-config-field-popover {
  z-index: 1200;
  overflow: auto;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  background: var(--panel-bg, #1a1d24);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}

.plugin-config-field-popover__section {
  margin-bottom: 12px;
}

.plugin-config-field-popover__eyebrow {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted, #9aa3b2);
  margin-bottom: 4px;
}

.plugin-config-field-popover__title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 700;
}

.plugin-config-field-popover__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
}

.plugin-config-field-popover__desc--muted {
  color: var(--muted, #9aa3b2);
}

.plugin-config-field-popover__meta {
  display: grid;
  gap: 8px;
  margin: 0;
  font-size: 12px;
}

.plugin-config-field-popover__meta div {
  display: grid;
  grid-template-columns: 4.5em 1fr;
  gap: 8px;
  align-items: baseline;
}

.plugin-config-field-popover__meta dt {
  margin: 0;
  color: var(--muted, #9aa3b2);
}

.plugin-config-field-popover__meta dd {
  margin: 0;
  word-break: break-word;
}

.plugin-config-field-popover__meta code {
  font-size: 11px;
}
</style>
