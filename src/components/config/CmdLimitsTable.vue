<script setup lang="ts">
import type { CommandLimitsUiCommand, CommandLimitsUiPlugin } from "@/api/pallasTypes";
import NumberStepperInput from "@/components/config/NumberStepperInput.vue";

defineProps<{
  plugins: CommandLimitsUiPlugin[];
  selections: Record<string, string>;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  input: [commandId: string, value: string];
}>();

function showCommandId(cmd: CommandLimitsUiCommand): boolean {
  return cmd.label.trim() !== cmd.command_id.trim();
}

function commandTrigger(cmd: CommandLimitsUiCommand): string {
  return String(cmd.trigger_condition || "").trim();
}
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
            <code
              v-if="showCommandId(cmd)"
              class="cmd-limit-card__id"
            >{{ cmd.command_id }}</code>
          </div>
          <p
            v-if="commandTrigger(cmd)"
            class="cmd-limit-card__trigger muted"
          >
            触发：{{ commandTrigger(cmd) }}
          </p>
          <p class="cmd-limit-card__default muted">
            默认冷却 {{ cmd.default_cd_sec }} 秒
          </p>
        </div>
        <label class="cmd-limit-card__editor">
          <NumberStepperInput
            :model-value="selections[cmd.command_id] ?? ''"
            kind="int"
            :min="0"
            :disabled="disabled"
            :aria-label="`${cmd.label} 冷却秒数`"
            max-width="120px"
            class="cmd-limit-card__input"
            @update:model-value="emit('input', cmd.command_id, $event)"
          />
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
  padding: 12px 0;
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.08)) 94%, transparent);
  background: transparent;
}

.cmd-limit-list .cmd-limit-card:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.cmd-limit-list .cmd-limit-card:first-child {
  padding-top: 0;
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
  overflow-wrap: anywhere;
  word-break: break-word;
}

.cmd-limit-card__id {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.08)) 96%, transparent);
  font-size: 10px;
  word-break: break-all;
}

.cmd-limit-card__default {
  margin: 4px 0 0;
  font-size: 10px;
  line-height: 1.5;
}

.cmd-limit-card__trigger {
  margin: 4px 0 0;
  font-size: 10px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.cmd-limit-card__editor {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.cmd-limit-card__input {
  width: 120px;
}

.cmd-limit-card__suffix {
  white-space: nowrap;
}

@media (max-width: 560px) {
  .cmd-limit-card {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
    padding: 12px 0;
  }

  .cmd-limit-card__editor {
    width: 100%;
    justify-content: flex-start;
  }

  .cmd-limit-card__input {
    flex: 1 1 auto;
    width: auto;
    max-width: none;
  }
}
</style>
