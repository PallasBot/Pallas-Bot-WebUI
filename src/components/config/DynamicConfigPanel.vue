<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { PluginConfigField, PluginConfigFieldGroup, PluginConfigUnexpectedKey } from "@/api/pallasTypes";
import PluginConfigFieldShell from "@/components/config/PluginConfigFieldShell.vue";
import { buildDynamicConfigGroups } from "@/utils/dynamicConfigPanelModel";
import { buildGroupSummary } from "@/utils/pluginConfigWorkspaceModel";

const props = withDefaults(
  defineProps<{
    fields: PluginConfigField[];
    fieldGroups?: PluginConfigFieldGroup[];
    unexpectedKeys?: PluginConfigUnexpectedKey[];
    modelValue: Record<string, string>;
    disabled?: boolean;
    activeFieldPopoverName?: string | null;
  }>(),
  {
    fieldGroups: undefined,
    unexpectedKeys: () => [],
    disabled: false,
    activeFieldPopoverName: null,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: Record<string, string>];
  "help-click": [name: string, event: MouseEvent];
  "help-hover": [name: string, event: MouseEvent];
  "help-hover-leave": [];
  "edit-click": [name: string];
}>();

const groups = computed(() => buildDynamicConfigGroups(props.fields, props.fieldGroups));

const groupOpen = ref<Record<string, boolean>>({});

watch(
  groups,
  (next) => {
    const state = { ...groupOpen.value };
    for (const group of next) {
      if (state[group.id] === undefined) {
        state[group.id] = !group.advanced;
      }
    }
    groupOpen.value = state;
  },
  { immediate: true },
);

const groupViewModels = computed(() =>
  groups.value.map((group) => ({
    ...group,
    summary: buildGroupSummary(group.fields, props.modelValue),
  })),
);

function toggleGroup(id: string) {
  groupOpen.value = { ...groupOpen.value, [id]: !groupOpen.value[id] };
}

function updateField(name: string, value: string) {
  emit("update:modelValue", { ...props.modelValue, [name]: value });
}
</script>

<template>
  <section class="plugin-config-groups dynamic-config-panel">
    <section
      v-for="group in groupViewModels"
      :key="group.id"
      class="plugin-config-group-card"
      :class="{ 'plugin-config-group-card--advanced': group.advanced }"
    >
      <header class="plugin-config-group-card__hero">
        <div class="plugin-config-group-card__hero-main">
          <div class="plugin-config-group-card__hero-text">
            <div class="plugin-config-group-card__title-row">
              <h4 class="plugin-config-group-card__title">{{ group.title }}</h4>
              <span class="plugin-config-group-card__chip">
                {{ group.summary.filled ? "已配置" : "待配置" }}
              </span>
              <span
                v-if="group.summary.required"
                class="plugin-config-group-card__chip plugin-config-group-card__chip--soft"
              >
                必填 {{ group.summary.requiredFilled }}/{{ group.summary.required }}
              </span>
            </div>
            <p class="plugin-config-group-card__desc">
              共 {{ group.summary.total }} 项，已填写 {{ group.summary.filled }} 项
            </p>
          </div>
        </div>
        <button
          type="button"
          class="btn panel-hd-collapse-btn plugin-config-group-card__collapse"
          :aria-expanded="groupOpen[group.id] ?? true"
          :aria-label="`${(groupOpen[group.id] ?? true) ? '收起' : '展开'}${group.title}`"
          @click="toggleGroup(group.id)"
        >
          {{ (groupOpen[group.id] ?? true) ? "收起" : "展开" }}
        </button>
      </header>

      <div v-show="groupOpen[group.id] ?? true" class="plugin-config-form-grid">
        <PluginConfigFieldShell
          v-for="f in group.fields"
          :key="f.name"
          :field="f"
          :model-value="modelValue[f.name] ?? ''"
          :help-expanded="activeFieldPopoverName === f.name"
          @update:model-value="updateField(f.name, $event)"
          @help-click="emit('help-click', f.name, $event)"
          @help-hover="emit('help-hover', f.name, $event)"
          @help-hover-leave="emit('help-hover-leave')"
          @edit-click="emit('edit-click', f.name)"
        />
      </div>
    </section>

    <section
      v-if="unexpectedKeys?.length"
      class="plugin-config-group-card dynamic-config-panel__unexpected"
    >
      <header class="dynamic-config-panel__unexpected-head">
        <h4 class="plugin-config-group-card__title">未声明的环境键</h4>
        <p class="muted dynamic-config-panel__unexpected-desc">
          以下键存在于 webui.json，但当前插件 config 未声明。表单保存不会修改它们；请使用 Raw TOML 模式编辑。
        </p>
      </header>
      <ul class="dynamic-config-panel__unexpected-list">
        <li
          v-for="row in unexpectedKeys"
          :key="row.env_key"
        >
          <code>{{ row.env_key }}</code>
          <span class="muted">{{ row.value_preview }}</span>
        </li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.dynamic-config-panel__unexpected {
  margin-top: 12px;
}

.dynamic-config-panel__unexpected-head {
  padding: 14px 16px 0;
}

.dynamic-config-panel__unexpected-desc {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.5;
}

.dynamic-config-panel__unexpected-list {
  margin: 0;
  padding: 12px 16px 16px;
  list-style: none;
  display: grid;
  gap: 8px;
}

.dynamic-config-panel__unexpected-list li {
  display: grid;
  gap: 4px;
  font-size: 13px;
}

.plugin-config-group-card--advanced .plugin-config-group-card__title {
  color: var(--pallas-muted, #94a3b8);
}
</style>
