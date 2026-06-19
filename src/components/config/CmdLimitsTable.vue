<script setup lang="ts">
import type { CommandLimitsUiPlugin } from "@/api/pallasTypes";

defineProps<{
  plugins: CommandLimitsUiPlugin[];
  selections: Record<string, string>;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  input: [commandId: string, value: string];
}>();
</script>

<template>
  <div
    v-for="pg in plugins"
    :key="pg.plugin"
    class="cmd-limit-section"
  >
    <h3
      v-if="plugins.length > 1"
      class="cmd-limit-section__title"
    >
      {{ pg.title }}
    </h3>
    <div class="cmd-limit-list">
      <section
        v-for="cmd in pg.commands"
        :key="cmd.command_id"
        class="cmd-limit-card"
      >
        <div class="cmd-limit-card__main">
          <div class="cmd-limit-card__head">
            <span class="cmd-limit-card__label">{{ cmd.label }}</span>
            <code class="cmd-limit-card__id">{{ cmd.command_id }}</code>
          </div>
          <p class="cmd-limit-card__default muted">
            默认冷却 {{ cmd.default_cd_sec }} 秒
          </p>
        </div>
        <label class="cmd-limit-card__editor">
          <input
            :value="selections[cmd.command_id]"
            class="inp cmd-limit-card__input"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            :disabled="disabled"
            @input="emit('input', cmd.command_id, ($event.target as HTMLInputElement).value)"
          >
          <span class="cmd-limit-card__suffix muted">秒</span>
        </label>
      </section>
    </div>
  </div>
</template>

<style scoped>
.cmd-limit-section {
  margin-bottom: 16px;
}

.cmd-limit-section__title {
  font-size: 14px;
  margin: 0 0 8px;
  font-weight: 700;
}

.cmd-limit-list {
  display: grid;
  gap: 8px;
}

.cmd-limit-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.08)) 88%, transparent);
  background: color-mix(in srgb, var(--surface-1, rgba(255, 255, 255, 0.016)) 99%, transparent);
}

.cmd-limit-card__main {
  min-width: 0;
  flex: 1 1 auto;
}

.cmd-limit-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.cmd-limit-card__label {
  font-weight: 600;
  font-size: 13px;
}

.cmd-limit-card__id {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.08)) 86%, transparent);
  font-size: 10px;
  word-break: break-all;
}

.cmd-limit-card__default {
  margin: 4px 0 0;
  font-size: 10px;
  line-height: 1.5;
}

.cmd-limit-card__editor {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.cmd-limit-card__input {
  width: 82px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.cmd-limit-card__suffix {
  white-space: nowrap;
}

@media (max-width: 560px) {
  .cmd-limit-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .cmd-limit-card__editor {
    width: 100%;
  }

  .cmd-limit-card__input {
    width: 100%;
  }
}
</style>
