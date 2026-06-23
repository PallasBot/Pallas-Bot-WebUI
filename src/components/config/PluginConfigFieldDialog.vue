<script setup lang="ts">
import { computed } from "vue";
import type { PluginConfigField } from "@/api/pallasTypes";
import ConfigFieldRenderer from "@/components/config/ConfigFieldRenderer.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";
import {
  fieldDisplayName,
  fieldHelpDefaultValue,
  fieldTypeLabel,
} from "@/utils/pluginConfigWorkspaceModel";

const props = defineProps<{
  open: boolean;
  field: PluginConfigField | null;
  mode: "help" | "edit";
  modelValue: string;
  jsonTitle?: string;
}>();

const emit = defineEmits<{
  close: [];
  "edit-request": [];
  "update:modelValue": [value: string];
}>();

const dialogTitle = computed(() => {
  if (!props.field) return "配置项";
  return fieldDisplayName(props.field);
});

const dialogSubtitle = computed(() => {
  if (props.mode === "edit") {
    return "在详情层中修改当前草稿；改完后仍需点击页面上的“保存配置”。";
  }
  return "查看说明、默认值与环境键；如需修改可继续进入编辑。";
});
</script>

<template>
  <UiDialog
    :open="open && !!field"
    :title="dialogTitle"
    :subtitle="dialogSubtitle"
    panel-class="plugin-config-field-dialog"
    root-class="plugin-config-field-dialog-root"
    body-class="plugin-config-field-dialog__body"
    @close="emit('close')"
  >
    <template v-if="field">
      <div class="plugin-config-field-dialog__stack">
        <section class="plugin-config-field-dialog__info">
          <div class="plugin-config-field-dialog__eyebrow">配置说明</div>
          <p
            v-if="field.description"
            class="plugin-config-field-dialog__desc"
          >
            {{ field.description }}
          </p>
          <p
            v-else
            class="plugin-config-field-dialog__desc plugin-config-field-dialog__desc--muted"
          >
            暂无详细说明。
          </p>
          <dl class="plugin-config-field-dialog__meta">
            <div>
              <dt>类型</dt>
              <dd>{{ fieldTypeLabel(field) }}</dd>
            </div>
            <div>
              <dt>默认值</dt>
              <dd><code>{{ fieldHelpDefaultValue(field) }}</code></dd>
            </div>
            <div>
              <dt>环境键</dt>
              <dd><code>{{ field.env_key }}</code></dd>
            </div>
          </dl>
        </section>

        <section
          v-if="mode === 'edit'"
          class="plugin-config-field-dialog__editor"
        >
          <div class="plugin-config-field-dialog__editor-head">
            <div class="plugin-config-field-dialog__eyebrow">编辑当前值</div>
            <p class="plugin-config-field-dialog__editor-tip muted">
              此处修改的是当前草稿，关闭弹层不会自动保存到后端。
            </p>
          </div>
          <ConfigFieldRenderer
            :field="field"
            :model-value="modelValue"
            :show-label="false"
            :show-meta="false"
            :show-description="false"
            :show-json-expand-button="false"
            :json-title="jsonTitle"
            input-max-width="100%"
            @update:model-value="emit('update:modelValue', $event)"
          />
        </section>
      </div>
    </template>

    <template #footer>
      <div class="plugin-config-field-dialog__footer">
        <UiButton
          variant="outline"
          @click="emit('close')"
        >
          {{ mode === "edit" ? "完成" : "关闭" }}
        </UiButton>
        <UiButton
          v-if="field && mode === 'help'"
          variant="primary"
          @click="emit('edit-request')"
        >
          编辑此项
        </UiButton>
      </div>
    </template>
  </UiDialog>
</template>

<style scoped>
.plugin-config-field-dialog__stack {
  display: grid;
  gap: 16px;
}

.plugin-config-field-dialog__info,
.plugin-config-field-dialog__editor {
  display: grid;
  gap: 10px;
}

.plugin-config-field-dialog__eyebrow {
  font-size: 10px;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted, rgba(255, 255, 255, 0.62));
}

.plugin-config-field-dialog__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.plugin-config-field-dialog__desc--muted {
  color: var(--text-muted, rgba(255, 255, 255, 0.7));
}

.plugin-config-field-dialog__meta {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 12px 0 0;
  border-top: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.08)) 86%, transparent);
}

.plugin-config-field-dialog__meta > div {
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: 10px;
}

.plugin-config-field-dialog__meta dt {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted, rgba(255, 255, 255, 0.64));
}

.plugin-config-field-dialog__meta dd {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  word-break: break-word;
}

.plugin-config-field-dialog__editor-head {
  display: grid;
  gap: 6px;
}

.plugin-config-field-dialog__editor-tip {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
}

.plugin-config-field-dialog__footer {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.plugin-config-field-dialog__body :deep(.config-field-renderer),
.plugin-config-field-dialog__body :deep(.json-textarea-field),
.plugin-config-field-dialog__body :deep(.config-field-renderer__number),
.plugin-config-field-dialog__body :deep(.config-field-renderer__secret) {
  max-width: none;
}

.plugin-config-field-dialog__body :deep(.json-textarea-field__peek) {
  min-height: 180px;
}

:deep(.plugin-config-field-dialog) {
  width: min(760px, calc(100vw - 32px));
}

@media (max-width: 560px) {
  :deep(.plugin-config-field-dialog-root) {
    align-items: flex-end;
  }

  :deep(.plugin-config-field-dialog) {
    width: calc(100vw - 12px);
    max-width: none;
    margin: 0 6px 6px;
    border-radius: 18px 18px 12px 12px;
  }

  .plugin-config-field-dialog__meta > div {
    grid-template-columns: 50px 1fr;
    gap: 8px;
  }

  .plugin-config-field-dialog__footer {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .plugin-config-field-dialog__body :deep(.json-textarea-field__peek) {
    min-height: 156px;
  }
}
</style>
