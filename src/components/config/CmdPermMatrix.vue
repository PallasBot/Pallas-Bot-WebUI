<script setup lang="ts">
import type { CommandPermUiLevel, CommandPermUiPlugin } from "@/api/pallasTypes";
import type { PluginGovernanceMenuItem } from "@/api/pallasTypes";

const props = defineProps<{
  levels: CommandPermUiLevel[];
  plugins: CommandPermUiPlugin[];
  selections: Record<string, string>;
  disabled?: boolean;
  /** 可选：提供命令→菜单项的映射，用于显示触发方式列 */
  commandMenuMap?: Map<string, PluginGovernanceMenuItem>;
}>();

const emit = defineEmits<{
  change: [commandId: string, newLevel: string];
}>();

function commandMenuItem(commandId: string): PluginGovernanceMenuItem | undefined {
  const direct = props.commandMenuMap?.get(commandId);
  if (direct) return direct;
  for (const item of props.commandMenuMap?.values() ?? []) {
    if (item.command_permission === commandId) return item;
    if ((item.command_permissions ?? []).includes(commandId)) return item;
  }
  return undefined;
}

function commandBrief(commandId: string): string {
  const item = commandMenuItem(commandId);
  return String(item?.brief_des || "").trim();
}

function commandTrigger(commandId: string): string {
  const item = commandMenuItem(commandId);
  return String(item?.trigger_condition || "").trim();
}
</script>

<template>
  <div
    v-for="pg in plugins"
    :key="pg.plugin"
    class="cmd-perm-section"
  >
    <h3
      v-if="plugins.length > 1"
      class="cmd-perm-section__title"
    >
      {{ pg.title }}
    </h3>
    <div class="cmd-perm-list">
      <section
        v-for="cmd in pg.commands"
        :key="cmd.command_id"
        class="cmd-perm-card"
      >
        <div class="cmd-perm-card__main">
          <div class="cmd-perm-card__head">
            <span class="cmd-perm-card__label">{{ cmd.label }}</span>
          </div>
          <p
            v-if="commandBrief(cmd.command_id)"
            class="cmd-perm-card__desc"
          >
            {{ commandBrief(cmd.command_id) }}
          </p>
          <p v-if="commandMenuMap" class="cmd-perm-card__trigger muted">
            {{ commandTrigger(cmd.command_id) || "—" }}
          </p>
        </div>
        <div class="cmd-perm-card__choices" role="radiogroup" :aria-label="`${cmd.label} 权限`">
          <label
            v-for="lv in levels"
            :key="lv.id"
            class="cmd-perm-choice"
            :class="{ 'cmd-perm-choice--active': selections[cmd.command_id] === lv.id }"
          >
            <input
              :checked="selections[cmd.command_id] === lv.id"
              type="radio"
              class="cmd-perm-choice__input"
              :name="'cmdperm-' + cmd.command_id"
              :value="lv.id"
              :disabled="disabled"
              @change="emit('change', cmd.command_id, lv.id)"
            >
            <span class="cmd-perm-choice__label">{{ lv.label }}</span>
          </label>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.cmd-perm-section {
  margin-bottom: 16px;
}

.cmd-perm-section__title {
  font-size: 14px;
  margin: 0 0 8px;
  font-weight: 700;
}

.cmd-perm-list {
  display: grid;
  gap: 8px;
}

.cmd-perm-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.08)) 88%, transparent);
  background: color-mix(in srgb, var(--surface-1, rgba(255, 255, 255, 0.016)) 99%, transparent);
}

.cmd-perm-card__main {
  min-width: 0;
  flex: 1 1 auto;
}

.cmd-perm-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.cmd-perm-card__label {
  font-weight: 600;
  font-size: 13px;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.cmd-perm-card__trigger {
  margin: 4px 0 0;
  font-size: 10px;
  line-height: 1.5;
}

.cmd-perm-card__desc {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.55;
  color: var(--text-muted, rgba(255, 255, 255, 0.76));
}

.cmd-perm-card__choices {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  flex: 0 0 auto;
  max-width: 26rem;
}

.cmd-perm-choice {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.08)) 88%, transparent);
  background: color-mix(in srgb, var(--surface-2, rgba(255, 255, 255, 0.02)) 98%, transparent);
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease;
}

.cmd-perm-choice--active {
  border-color: color-mix(in srgb, var(--accent, #ec4899) 16%, transparent);
  background: color-mix(in srgb, var(--accent, #ec4899) 6%, transparent);
  color: color-mix(in srgb, var(--accent, #ec4899) 84%, var(--text, #fff) 10%);
}

.cmd-perm-choice__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.cmd-perm-choice__label {
  font-size: 11px;
  font-weight: 600;
}

@media (max-width: 560px) {
  .cmd-perm-card {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }

  .cmd-perm-card__choices {
    width: 100%;
    max-width: none;
    justify-content: flex-start;
  }

  .cmd-perm-choice {
    flex: 1 1 calc(50% - 3px);
    justify-content: center;
    min-width: 0;
  }
}
</style>
