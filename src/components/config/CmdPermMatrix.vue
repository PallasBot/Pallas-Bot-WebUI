<script setup lang="ts">
import type { CommandPermUiLevel, CommandPermUiPlugin } from "@/api/pallasTypes";
import type { PluginGovernanceMenuItem } from "@/api/pallasTypes";

defineProps<{
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
      <table class="cmd-perm-table">
        <thead>
          <tr>
            <th scope="col">命令</th>
            <th
              v-if="commandMenuMap"
              scope="col"
            >
              触发方式
            </th>
            <th
              v-for="lv in levels"
              :key="lv.id"
              scope="col"
            >
              {{ lv.label }}
            </th>
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
            <td
              v-if="commandMenuMap"
              class="muted cmd-perm-table__trigger"
            >
              {{ commandMenuMap.get(cmd.command_id)?.trigger_condition ?? '—' }}
            </td>
            <td
              v-for="lv in levels"
              :key="lv.id"
              class="cmd-perm-table__cell"
            >
              <input
                :checked="selections[cmd.command_id] === lv.id"
                type="radio"
                class="cmd-perm-radio"
                :name="'cmdperm-' + cmd.command_id"
                :value="lv.id"
                :disabled="disabled"
                @change="emit('change', cmd.command_id, lv.id)"
              >
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

.cmd-perm-table__trigger {
  text-align: left !important;
  font-size: 12px;
  max-width: 200px;
  white-space: normal;
  word-break: break-word;
}

.cmd-perm-radio {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent, #7289da);
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

  .cmd-perm-table__trigger {
    display: none;
  }
}
</style>
