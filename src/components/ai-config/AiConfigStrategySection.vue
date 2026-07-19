<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import type { PluginConfigField, PluginConfigFieldGroup } from "@/api/pallasTypes";
import DynamicConfigPanel from "@/components/config/DynamicConfigPanel.vue";
import PluginConfigFieldDialog from "@/components/config/PluginConfigFieldDialog.vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { llmBotFieldGroupsForMode } from "@/config/configFieldLabels";
import { useCommonConfigSection } from "@/composables/useCommonConfigSection";
import { useAiConfigExpertMode } from "@/composables/useAiConfigExpertMode";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const panelNavIcon = usePanelNavIcon();
const advancedExpanded = ref(false);
const fieldDialog = ref<{ open: boolean; mode: "help" | "edit"; name: string | null }>({
  open: false,
  mode: "help",
  name: null,
});

const { isSimpleMode } = useAiConfigExpertMode();
const { err, data, fieldValues, saving, setFieldValue, save, canSave } = useCommonConfigSection({
  sectionId: "llm",
  savedMessage: "Bot 对话配置已保存",
});

const fieldByName = computed(() => {
  const map = new Map<string, PluginConfigField>();
  for (const f of data.value?.fields ?? []) map.set(f.name, f);
  return map;
});

const modeGroups = computed(() => llmBotFieldGroupsForMode(isSimpleMode.value));

const essentialDefs = computed(() => modeGroups.value.filter((group) => group.tier === "essential"));
const advancedDefs = computed(() => modeGroups.value.filter((group) => group.tier === "advanced"));

function fieldsForDefs(defs: typeof modeGroups.value): PluginConfigField[] {
  const out: PluginConfigField[] = [];
  const seen = new Set<string>();
  for (const group of defs) {
    for (const key of group.keys) {
      const field = fieldByName.value.get(key);
      if (!field || seen.has(field.name)) continue;
      seen.add(field.name);
      out.push(field);
    }
  }
  return out;
}

function groupsForDefs(defs: typeof modeGroups.value): PluginConfigFieldGroup[] {
  return defs.map((group, index) => ({
    id: group.anchorId || `llm-${group.tier}-${index}`,
    title: group.title,
    field_names: [...group.keys],
    plugin_config_path: "llm",
  }));
}

const essentialFields = computed(() => fieldsForDefs(essentialDefs.value));
const essentialGroups = computed(() => groupsForDefs(essentialDefs.value));
const advancedFields = computed(() => fieldsForDefs(advancedDefs.value));
const advancedGroups = computed(() => groupsForDefs(advancedDefs.value));

const HIDDEN_LLM_FIELDS = new Set(["ai_server_host", "ai_server_port"]);

const restFields = computed(() => {
  if (isSimpleMode.value) return [] as PluginConfigField[];
  const used = new Set([
    ...essentialFields.value.map((f) => f.name),
    ...advancedFields.value.map((f) => f.name),
  ]);
  return (data.value?.fields ?? []).filter(
    (f) => !used.has(f.name) && !HIDDEN_LLM_FIELDS.has(f.name),
  );
});

const restGroups = computed((): PluginConfigFieldGroup[] =>
  restFields.value.length
    ? [{
        id: "llm-rest",
        title: "其他项",
        field_names: restFields.value.map((f) => f.name),
        plugin_config_path: "llm",
      }]
    : [],
);

const activeField = computed(() =>
  fieldDialog.value.name ? fieldByName.value.get(fieldDialog.value.name) ?? null : null,
);

const activeFieldValue = computed(() =>
  fieldDialog.value.name ? (fieldValues.value[fieldDialog.value.name] ?? "") : "",
);

function openFieldDialog(name: string, mode: "help" | "edit") {
  fieldDialog.value = { open: true, mode, name };
}

function closeFieldDialog() {
  fieldDialog.value = { open: false, mode: "help", name: null };
}

function onFieldValuesUpdate(next: Record<string, string>) {
  for (const [name, value] of Object.entries(next)) {
    if ((fieldValues.value[name] ?? "") !== value) setFieldValue(name, value);
  }
}

onMounted(() => {
  const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
  if (hash === "learning-loop") {
    document.getElementById("learning-loop")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

defineExpose({ save, canSave, saving });
</script>

<template>
  <div class="ai-config-section ai-config-section--strategy plugin-config-page">
    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <UiCard
      v-if="data"
      tag="div"
      glass
      class="plugin-config-page__card"
    >
      <div class="plugin-config-page__hero">
        <div class="plugin-config-page__hero-main">
          <div class="plugin-config-page__hero-text">
            <h2 class="plugin-config-page__hero-title">
              <ConsoleNavIcon
                class="panel__title-ico"
                :name="panelNavIcon"
              />
              Bot 对话策略
            </h2>
            <p class="plugin-config-page__hero-desc">
              总开关、接话模式与限流；AI 服务地址请到「AI 服务」连接页（保存时同步 Bot），模型请到「接入」拉取/切换。
            </p>
            <p class="muted plugin-config-page__hero-meta">
              <RouterLink to="/ai/config/connection">AI 服务连接</RouterLink>
              ·
              <RouterLink to="/ai/config/provider">接入与模型</RouterLink>
            </p>
          </div>
        </div>
        <div class="row-actions plugin-config-page__hero-actions">
          <UiButton
            variant="primary"
            :disabled="saving"
            :busy="saving"
            title="Ctrl+S"
            @click="save"
          >
            {{ saving ? "保存中…" : "保存" }}
          </UiButton>
        </div>
      </div>

      <div
        class="plugin-config-page__divider"
        aria-hidden="true"
      />

      <div class="plugin-config-page__card-bd ai-config-strategy__body">
        <p
          v-if="essentialDefs.some((g) => g.anchorId === 'learning-loop')"
          class="ai-config-strategy__learning-link"
        >
          <RouterLink to="/ai/history?workspace=sessions">
            去 AI 历史维护学习闭环 →
          </RouterLink>
        </p>

        <div id="learning-loop">
          <DynamicConfigPanel
            :fields="essentialFields"
            :field-groups="essentialGroups"
            :model-value="fieldValues"
            @update:model-value="onFieldValuesUpdate"
            @help-click="(name) => openFieldDialog(name, 'help')"
            @edit-click="(name) => openFieldDialog(name, 'edit')"
          />
        </div>

        <details
          v-if="advancedFields.length"
          class="ai-config-strategy__advanced"
          :open="advancedExpanded"
          @toggle="advancedExpanded = ($event.target as HTMLDetailsElement).open"
        >
          <summary class="ai-config-strategy__advanced-summary">
            高级选项（记忆 / 过滤 / 限流）
          </summary>
          <DynamicConfigPanel
            :fields="advancedFields"
            :field-groups="advancedGroups"
            :model-value="fieldValues"
            @update:model-value="onFieldValuesUpdate"
            @help-click="(name) => openFieldDialog(name, 'help')"
            @edit-click="(name) => openFieldDialog(name, 'edit')"
          />
        </details>

        <DynamicConfigPanel
          v-if="restFields.length"
          :fields="restFields"
          :field-groups="restGroups"
          :model-value="fieldValues"
          @update:model-value="onFieldValuesUpdate"
          @help-click="(name) => openFieldDialog(name, 'help')"
          @edit-click="(name) => openFieldDialog(name, 'edit')"
        />
      </div>
    </UiCard>

    <PluginConfigFieldDialog
      :open="fieldDialog.open"
      :field="activeField"
      :mode="fieldDialog.mode"
      :model-value="activeFieldValue"
      :json-title="activeField ? `llm · ${activeField.name}（JSON）` : undefined"
      @close="closeFieldDialog"
      @edit-request="fieldDialog.mode = 'edit'"
      @update:model-value="(value) => fieldDialog.name && setFieldValue(fieldDialog.name, value)"
    />
  </div>
</template>

<style scoped>
.ai-config-section--strategy {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-config-strategy__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-config-strategy__learning-link {
  margin: 0;
  font-size: 0.8125rem;
}

.ai-config-strategy__learning-link a {
  color: var(--accent);
  text-decoration: none;
}

.ai-config-strategy__learning-link a:hover {
  text-decoration: underline;
}

.ai-config-strategy__advanced {
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: var(--hub-radius-shell, 12px);
  padding: 12px 14px;
  background: color-mix(in srgb, var(--text) 2%, transparent);
}

.ai-config-strategy__advanced-summary {
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 650;
  color: var(--text);
  margin-bottom: 0;
}

.ai-config-strategy__advanced[open] .ai-config-strategy__advanced-summary {
  margin-bottom: 12px;
}

.ai-config-strategy__advanced :deep(.plugin-config-groups) {
  gap: 12px;
}
</style>
