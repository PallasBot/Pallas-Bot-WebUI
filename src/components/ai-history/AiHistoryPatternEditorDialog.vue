<script setup lang="ts">
import type { LlmBehaviorPattern } from "@/api/pallasTypes";
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import { BEHAVIOR_ACTION_OPTIONS, BEHAVIOR_SCENE_OPTIONS } from "@/utils/aiHistoryLabels";

const open = defineModel<boolean>("open", { default: false });
const pattern = defineModel<LlmBehaviorPattern>("pattern", { required: true });

defineProps<{
  mode?: "create" | "edit";
  busy?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [];
}>();

function parseFilter(raw: string): number | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function parseLineList(raw: string): string[] {
  return String(raw || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function triggerText(value: LlmBehaviorPattern): string {
  return (value.trigger_features ?? []).join("\n");
}

function exampleText(value: LlmBehaviorPattern): string {
  return (value.reference_examples ?? []).join("\n");
}
</script>

<template>
  <UiDialog
    :open="open"
    :title="mode === 'edit' ? '编辑规则' : '新建规则'"
    subtitle="触发特征与参考示例按行输入"
    :busy="busy"
    panel-class="ai-history-page__pattern-dialog"
    @close="emit('close')"
  >
    <div class="ai-history-page__pattern-form">
      <label class="ai-history-page__filter ai-history-page__pattern-form-span">
        <span>规则 ID</span>
        <UiInput
          v-model="pattern.pattern_id"
          placeholder="例如 group-threading-001"
        />
      </label>
      <label class="ai-history-page__filter">
        <span>场景</span>
        <UiSelect v-model="pattern.scene">
          <option
            v-for="item in BEHAVIOR_SCENE_OPTIONS.filter((row) => row.value)"
            :key="`editor-scene-${item.value}`"
            :value="item.value"
          >
            {{ item.label }}
          </option>
        </UiSelect>
      </label>
      <label class="ai-history-page__filter">
        <span>动作</span>
        <UiSelect v-model="pattern.action">
          <option
            v-for="item in BEHAVIOR_ACTION_OPTIONS"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </option>
        </UiSelect>
      </label>
      <label class="ai-history-page__filter">
        <span>限定群号</span>
        <UiInput
          :model-value="pattern.scope_group_id == null ? '' : String(pattern.scope_group_id)"
          inputmode="numeric"
          placeholder="留空表示全局"
          @update:model-value="pattern.scope_group_id = parseFilter($event)"
        />
      </label>
      <label class="ai-history-page__filter">
        <span>自动分</span>
        <UiInput
          :model-value="String(pattern.success_score ?? 0)"
          inputmode="numeric"
          @update:model-value="pattern.success_score = Number($event || 0)"
        />
      </label>
      <label class="ai-history-page__filter">
        <span>人工分</span>
        <UiInput
          :model-value="String(pattern.manual_score ?? 0)"
          inputmode="numeric"
          @update:model-value="pattern.manual_score = Number($event || 0)"
        />
      </label>
      <label class="ai-history-page__filter ai-history-page__pattern-form-span">
        <span>人设倾向</span>
        <UiInput
          v-model="pattern.persona_affinity"
          placeholder="可留空"
        />
      </label>
      <label class="ai-history-page__filter ai-history-page__pattern-form-span">
        <span>触发特征</span>
        <textarea
          class="inp ai-history-page__pattern-textarea"
          :value="triggerText(pattern)"
          placeholder="每行一个特征"
          @input="pattern.trigger_features = parseLineList(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>
      <label class="ai-history-page__filter ai-history-page__pattern-form-span">
        <span>参考示例</span>
        <textarea
          class="inp ai-history-page__pattern-textarea"
          :value="exampleText(pattern)"
          placeholder="每行一个示例"
          @input="pattern.reference_examples = parseLineList(($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </label>
      <label class="ai-history-page__behavior-check">
        <input
          v-model="pattern.disabled"
          type="checkbox"
        >
        <span>保存为已禁用</span>
      </label>
    </div>
    <template #footer>
      <div class="row-actions ai-history-page__pattern-actions">
        <UiButton
          size="sm"
          :busy="busy"
          @click="emit('save')"
        >
          {{ mode === "edit" ? "保存修改" : "创建规则" }}
        </UiButton>
        <UiButton
          size="sm"
          variant="ghost"
          :disabled="busy"
          @click="emit('close')"
        >
          取消
        </UiButton>
      </div>
    </template>
  </UiDialog>
</template>
