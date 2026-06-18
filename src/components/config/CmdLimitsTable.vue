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
    style="margin-bottom: 20px"
  >
    <h3
      v-if="plugins.length > 1"
      style="font-size: 15px; margin: 0 0 10px; font-weight: 700"
    >
      {{ pg.title }}
    </h3>
    <div class="cmd-perm-table-wrap">
      <table class="cmd-perm-table cmd-limit-table">
        <thead>
          <tr>
            <th scope="col">命令</th>
            <th scope="col">默认冷却</th>
            <th scope="col">生效冷却</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="cmd in pg.commands"
            :key="cmd.command_id"
          >
            <th scope="row" class="cmd-perm-table__cmd">
              <span class="cmd-perm-table__label">{{ cmd.label }}</span>
              <span class="cmd-perm-table__id">{{ cmd.command_id }}</span>
            </th>
            <td class="cmd-limit-table__default">
              {{ cmd.default_cd_sec }} 秒
            </td>
            <td class="cmd-limit-table__input-cell">
              <input
                :value="selections[cmd.command_id]"
                class="inp cmd-limit-table__input"
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                :disabled="disabled"
                @input="emit('input', cmd.command_id, ($event.target as HTMLInputElement).value)"
              >
              <span class="cmd-limit-table__suffix muted">秒</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.cmd-perm-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
}

.cmd-perm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.cmd-perm-table th,
.cmd-perm-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  text-align: center;
  vertical-align: middle;
}

.cmd-perm-table thead th {
  font-weight: 600;
  background: var(--panel-hd-bg, rgba(0, 0, 0, 0.15));
  white-space: nowrap;
}

.cmd-perm-table tbody tr:last-child th,
.cmd-perm-table tbody tr:last-child td {
  border-bottom: none;
}

.cmd-perm-table__cmd {
  text-align: left !important;
  min-width: 160px;
}

.cmd-perm-table__label {
  display: block;
  font-weight: 600;
}

.cmd-perm-table__id {
  display: block;
  font-size: 11px;
  margin-top: 2px;
  word-break: break-all;
}

.cmd-limit-table__default {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.cmd-limit-table__input-cell {
  min-width: 180px;
}

.cmd-limit-table__input {
  width: 96px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.cmd-limit-table__suffix {
  margin-left: 8px;
  white-space: nowrap;
}

@media (max-width: 560px) {
  .cmd-perm-table-wrap {
    margin-inline: -2px;
    border-radius: var(--radius-md, 12px);
    -webkit-overflow-scrolling: touch;
  }

  .cmd-perm-table thead th:not(:first-child),
  .cmd-perm-table tbody td {
    min-width: 3rem;
    padding: 8px 6px;
  }

  .cmd-perm-table__cmd {
    min-width: 6.5rem;
    max-width: 8.5rem;
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--bg-card);
    box-shadow: 4px 0 8px -4px color-mix(in srgb, var(--text) 12%, transparent);
  }

  .cmd-perm-table thead th:first-child {
    position: sticky;
    left: 0;
    z-index: 2;
    background: var(--panel-hd-bg, rgba(0, 0, 0, 0.15));
  }

  .cmd-limit-table__input-cell {
    min-width: 8.5rem;
  }
}
</style>
