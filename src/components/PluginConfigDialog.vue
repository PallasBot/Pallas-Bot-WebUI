<script setup lang="ts">
import { computed, ref } from "vue";
import type { CommunityPluginRow, OfficialExtensionRow, PluginRow } from "@/api/pallasTypes";
import PluginConfigWorkspace from "@/components/PluginConfigWorkspace.vue";
import PluginIcon from "@/components/PluginIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";
import { AI_ENTRY_PLUGIN_CONFIG_CHECK } from "@/config/aiEntrySemantics";
import { aiConfigSectionPath } from "@/config/aiConfigSections";
import { resolvePluginReadmeTarget } from "@/utils/pluginReadmeTarget";
import { RouterLink } from "vue-router";

const props = defineProps<{
  open: boolean;
  pluginName: string;
  pluginRow: PluginRow | null;
  iconUrl?: string | null;
  officialExtensions: OfficialExtensionRow[];
  communityPlugins: CommunityPluginRow[];
}>();

const emit = defineEmits<{ close: [] }>();

const workspaceRef = ref<InstanceType<typeof PluginConfigWorkspace> | null>(null);

const displayTitle = computed(
  () => props.pluginRow?.metadata?.name || props.pluginName,
);

const pluginResolvedId = computed(
  () => (props.pluginRow?.resolved_plugin_id || props.pluginName).trim(),
);

const readmeTarget = computed(() => {
  if (!props.pluginRow) return null;
  return resolvePluginReadmeTarget(
    props.pluginRow,
    props.officialExtensions,
    props.communityPlugins,
  );
});

const canSave = computed(
  () =>
    Boolean(workspaceRef.value?.data) &&
    !workspaceRef.value?.loading &&
    !workspaceRef.value?.saving &&
    !workspaceRef.value?.checking,
);

const showDrawAiConfigHint = computed(() => pluginResolvedId.value === "draw");

function requestClose() {
  emit("close");
}
</script>

<template>
  <UiDialog
    :open="open && Boolean(pluginName)"
    title-id="plugin-config-dialog-title"
    panel-class="plugin-config-dialog"
    body-class="plugin-config-dialog__bd"
    @close="requestClose"
  >
    <template #header>
      <div class="console-modal__head-text plugin-config-dialog__head">
        <PluginIcon
          class="plugin-config-dialog__icon"
          :plugin-id="pluginResolvedId"
          :label="displayTitle"
          :icon-url="iconUrl"
          size="md"
        />
        <div class="plugin-config-dialog__head-text">
          <h2
            id="plugin-config-dialog-title"
            class="console-modal__title"
          >
            {{ displayTitle }}
          </h2>
          <p class="console-modal__subtitle">
            <code>{{ pluginResolvedId }}</code>
          </p>
        </div>
      </div>
      <button
        type="button"
        class="console-modal__close"
        aria-label="关闭"
        @click="requestClose"
      >
        ×
      </button>
    </template>

    <p
      v-if="showDrawAiConfigHint"
      class="muted plugin-config-dialog__ai-hint"
    >
      推荐在
      <RouterLink :to="aiConfigSectionPath('draw')">AI 配置 · 画画</RouterLink>
      管理网关；本页为兼容入口，配置键相同。
    </p>

    <PluginConfigWorkspace
      v-if="pluginName"
      :key="pluginName"
      ref="workspaceRef"
      presentation="dialog"
      :plugin-name="pluginName"
      :icon-url="iconUrl"
      :initial-plugin-row="pluginRow"
      :readme-target="readmeTarget"
    />

    <template #footer>
      <div class="plugin-config-dialog__foot row-actions">
        <UiButton
          v-if="workspaceRef?.supportsConfigCheck"
          variant="outline"
          :disabled="!canSave"
          :busy="workspaceRef?.checking"
          @click="workspaceRef?.runConfigCheck()"
        >
          {{ workspaceRef?.checking ? "检测中…" : AI_ENTRY_PLUGIN_CONFIG_CHECK.label }}
        </UiButton>
        <UiButton
          variant="primary"
          :disabled="!canSave"
          :busy="workspaceRef?.saving"
          title="Ctrl+S"
          @click="workspaceRef?.save()"
        >
          {{ workspaceRef?.saving ? "保存中…" : "保存" }}
        </UiButton>
      </div>
    </template>
  </UiDialog>
</template>

<style scoped>
.plugin-config-dialog__ai-hint {
  margin: 0 16px 12px;
  font-size: 0.8125rem;
}
</style>
