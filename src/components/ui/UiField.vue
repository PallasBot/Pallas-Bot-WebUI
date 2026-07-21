<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string;
    required?: boolean;
    secret?: boolean;
    /** 无 label 时仍可渲染控件 */
    hideLabel?: boolean;
  }>(),
  {
    required: false,
    secret: false,
    hideLabel: false,
  },
);
</script>

<template>
  <div class="ui-field">
    <div
      v-if="!hideLabel && (label || $slots['label-end'] || $slots.meta)"
      class="ui-field__label-row"
    >
      <div class="ui-field__label">
        <div class="ui-field__title">
          <span
            v-if="label"
            class="ui-field__label-text"
            :title="label"
          >{{ label }}</span>
          <slot name="label-end" />
        </div>
        <span
          v-if="required"
          class="ui-field__required"
          aria-hidden="true"
        >*</span>
        <span
          v-if="secret"
          class="ui-field__secret"
        >密钥</span>
      </div>
      <div
        v-if="$slots.meta"
        class="ui-field__meta"
      >
        <slot name="meta" />
      </div>
    </div>
    <div class="ui-field__control">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.ui-field {
  display: grid;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  align-content: start;
  overflow: hidden;
}

.ui-field__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  min-height: 20px;
  max-width: 100%;
  overflow: hidden;
}

.ui-field__label {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.35;
  font-weight: 500;
}

/* 标题 + ? 成组贴齐；勿让文字 flex 撑开把帮助钮推到行尾 */
.ui-field__title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  flex: 0 1 auto;
}

.ui-field__label-text {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-field__required {
  color: color-mix(in srgb, var(--danger, #ef4444) 80%, var(--text) 10%);
  font-size: 12px;
  line-height: 1;
  flex-shrink: 0;
}

.ui-field__secret {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, #f59e0b 42%, transparent);
  background: color-mix(in srgb, #f59e0b 8%, transparent);
  color: color-mix(in srgb, #f59e0b 84%, var(--text) 8%);
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  flex-shrink: 0;
}

.ui-field__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  max-width: 42%;
  min-width: 0;
  overflow: hidden;
  transition: opacity 0.15s ease;
}

.ui-field__control {
  min-width: 0;
  max-width: 100%;
}

@media (hover: hover) and (pointer: fine) {
  .ui-field__meta {
    opacity: 0;
  }

  .ui-field:hover .ui-field__meta,
  .ui-field:focus-within .ui-field__meta {
    opacity: 1;
  }
}

@media (max-width: 560px) {
  .ui-field__label-row {
    flex-wrap: wrap;
    row-gap: 4px;
  }

  .ui-field__label {
    flex: 1 1 auto;
    max-width: 100%;
  }

  .ui-field__meta {
    opacity: 1;
    max-width: 100%;
    flex: 1 1 auto;
  }
}
</style>
