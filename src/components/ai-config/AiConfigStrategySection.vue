<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import type { PluginConfigField } from "@/api/pallasTypes";
import AiConfigLayerLinks from "@/components/ai-config/AiConfigLayerLinks.vue";
import AiObservationLinks from "@/components/ai-config/AiObservationLinks.vue";
import ConfigFieldRenderer from "@/components/config/ConfigFieldRenderer.vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { LLM_BOT_FIELD_GROUPS } from "@/config/configFieldLabels";
import { useCommonConfigSection } from "@/composables/useCommonConfigSection";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const panelNavIcon = usePanelNavIcon();
const advancedExpanded = ref(false);
const { err, data, fieldValues, saving, setFieldValue, save, canSave } = useCommonConfigSection({
  sectionId: "llm",
  savedMessage: "Bot 对话配置已保存",
});

const fieldByName = computed(() => {
  const map = new Map<string, PluginConfigField>();
  for (const f of data.value?.fields ?? []) map.set(f.name, f);
  return map;
});

const groupedFieldViews = computed(() => {
  const used = new Set<string>();
  const essential = LLM_BOT_FIELD_GROUPS.filter((group) => group.tier === "essential")
    .map((group) => {
      const fields = group.keys
        .map((key) => fieldByName.value.get(key))
        .filter((f): f is PluginConfigField => Boolean(f));
      for (const f of fields) used.add(f.name);
      return { ...group, fields };
    })
    .filter((group) => group.fields.length > 0);
  const advanced = LLM_BOT_FIELD_GROUPS.filter((group) => group.tier === "advanced")
    .map((group) => {
      const fields = group.keys
        .map((key) => fieldByName.value.get(key))
        .filter((f): f is PluginConfigField => Boolean(f));
      for (const f of fields) used.add(f.name);
      return { ...group, fields };
    })
    .filter((group) => group.fields.length > 0);
  const rest = (data.value?.fields ?? []).filter((f) => !used.has(f.name));
  return { essential, advanced, rest };
});

onMounted(() => {
  const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
  if (hash === "learning-loop") {
    document.getElementById("learning-loop")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

defineExpose({ save, canSave, saving });
</script>

<template>
  <div class="ai-config-section ai-config-section--strategy">
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
      class="ai-config-section__panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <ConsoleNavIcon
            class="panel__title-ico"
            :name="panelNavIcon"
          />Bot 对话策略
        </h2>
        <div class="row-actions">
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
      <div class="panel__bd ai-config-strategy-fields">
        <p class="muted ai-config-section__intro">
          本页只管 Bot 侧总开关、接话模式与限流；模型与路由见下方「对话链路」快捷入口。
        </p>
        <div class="ai-config-strategy-fields__links">
          <AiConfigLayerLinks active="strategy" />
          <AiObservationLinks />
        </div>
        <section
          v-for="group in groupedFieldViews.essential"
          :id="group.anchorId || undefined"
          :key="group.title"
          class="ai-config-strategy-fields__group"
        >
          <div class="ai-config-strategy-fields__group-head">
            <h3 class="ai-config-strategy-fields__group-title">
              {{ group.title }}
            </h3>
            <RouterLink
              v-if="group.anchorId === 'learning-loop'"
              to="/ai/history?workspace=sessions"
              class="ai-config-strategy-fields__group-link"
            >
              去 AI 历史维护
            </RouterLink>
          </div>
          <p v-if="group.hint" class="muted ai-config-strategy-fields__group-hint">
            {{ group.hint }}
          </p>
          <ConfigFieldRenderer
            v-for="f in group.fields"
            :key="f.name"
            :field="f"
            :model-value="fieldValues[f.name] ?? ''"
            :show-meta="false"
            :json-title="`llm · ${f.name}（JSON）`"
            @update:model-value="(v) => setFieldValue(f.name, v)"
          />
        </section>
        <details
          v-if="groupedFieldViews.advanced.length"
          class="ai-config-strategy-fields__advanced"
          :open="advancedExpanded"
          @toggle="advancedExpanded = ($event.target as HTMLDetailsElement).open"
        >
          <summary class="ai-config-strategy-fields__advanced-summary">
            高级选项（记忆 / 过滤 / 限流）
          </summary>
          <section
            v-for="group in groupedFieldViews.advanced"
            :key="group.title"
            class="ai-config-strategy-fields__group"
          >
            <h3 class="ai-config-strategy-fields__group-title">
              {{ group.title }}
            </h3>
            <p v-if="group.hint" class="muted ai-config-strategy-fields__group-hint">
              {{ group.hint }}
            </p>
            <ConfigFieldRenderer
              v-for="f in group.fields"
              :key="f.name"
              :field="f"
              :model-value="fieldValues[f.name] ?? ''"
              :show-meta="false"
              :json-title="`llm · ${f.name}（JSON）`"
              @update:model-value="(v) => setFieldValue(f.name, v)"
            />
          </section>
        </details>
        <ConfigFieldRenderer
          v-for="f in groupedFieldViews.rest"
          :key="f.name"
          :field="f"
          :model-value="fieldValues[f.name] ?? ''"
          :show-meta="false"
          :json-title="`llm · ${f.name}（JSON）`"
          @update:model-value="(v) => setFieldValue(f.name, v)"
        />
      </div>
    </UiCard>
  </div>
</template>

<style scoped>
.ai-config-section--strategy {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-config-strategy-fields {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.ai-config-strategy-fields__group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-config-strategy-fields__links {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-config-strategy-fields__group-title {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--text-muted, #94a3b8);
}

.ai-config-strategy-fields__group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ai-config-strategy-fields__group-link {
  font-size: 0.78rem;
  color: var(--accent);
  text-decoration: none;
  white-space: nowrap;
}

.ai-config-strategy-fields__group-link:hover {
  text-decoration: underline;
}

.ai-config-strategy-fields__group-hint {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.4;
}

.ai-config-strategy-fields__advanced {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
}

.ai-config-strategy-fields__advanced-summary {
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--text);
}
</style>
