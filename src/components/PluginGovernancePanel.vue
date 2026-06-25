<script setup lang="ts">
import type { PluginGovernanceData, PluginGovernanceMenuItem } from "@/api/pallasTypes";
import CmdLimitsTable from "@/components/config/CmdLimitsTable.vue";
import CmdPermMatrix from "@/components/config/CmdPermMatrix.vue";
import PluginRuntimeSwitchRow from "@/components/config/PluginRuntimeSwitchRow.vue";

defineProps<{
  governanceData: PluginGovernanceData | null;
  governanceLoading: boolean;
  governanceSaving: boolean;
  governanceErr: string;
  commandMenuMap: Map<string, PluginGovernanceMenuItem>;
  permSelections: Record<string, string>;
  limitSelections: Record<string, string>;
  globalDisable: boolean;
  showInHelpMenu: boolean;
  globalDisableProtected: boolean;
  helpIgnored: boolean;
}>();

const emit = defineEmits<{
  permChange: [commandId: string, newLevel: string];
  limitInput: [commandId: string, value: string];
  toggleGlobalDisable: [value: boolean];
  toggleHelpMenuVisible: [value: boolean];
}>();
</script>

<template>
  <section class="plugin-governance-panel">
    <header class="plugin-governance-panel__head">
      <div>
        <h3 class="plugin-governance-panel__title">治理面板</h3>
        <p class="muted plugin-governance-panel__desc">
          同屏调整运行开关、命令权限与命令冷却；改动会自动保存到治理接口。
        </p>
      </div>
      <div class="plugin-governance-panel__badges">
        <span v-if="governanceData?.reload_policy" class="plugin-governance-panel__badge">
          热重载：{{ governanceData.reload_policy }}
        </span>
        <span v-if="governanceData?.activation_policy" class="plugin-governance-panel__badge">
          生效方式：{{ governanceData.activation_policy }}
        </span>
      </div>
    </header>

    <p v-if="governanceLoading" class="muted">加载治理配置…</p>
    <div v-else-if="governanceErr" class="alert alert--err">{{ governanceErr }}</div>
    <p v-else-if="!governanceData" class="muted plugin-governance-panel__empty">
      该插件暂无治理配置。
    </p>
    <template v-else>
      <section class="plugin-governance-panel__group">
        <header class="plugin-governance-panel__group-head">
          <h4 class="plugin-governance-panel__group-title">运行控制</h4>
          <p class="muted plugin-governance-panel__group-desc">控制插件是否参与运行，以及是否出现在帮助菜单中。</p>
        </header>
        <div class="plugin-governance-panel__switches">
          <PluginRuntimeSwitchRow
            title="全实例禁用（所有牛牛、所有群）"
            :model-value="globalDisable"
            :disabled="governanceSaving || globalDisableProtected"
            @update:model-value="emit('toggleGlobalDisable', $event)"
          >
            <p v-if="globalDisableProtected">基础设施插件，不可全实例禁用。</p>
            <p v-else>开启后立即拦截该插件的 matcher，与实例级、群级禁用共同生效。</p>
          </PluginRuntimeSwitchRow>
          <PluginRuntimeSwitchRow
            title="在「牛牛帮助」总列表中显示该插件"
            :model-value="showInHelpMenu"
            :disabled="governanceSaving || helpIgnored"
            @update:model-value="emit('toggleHelpMenuVisible', $event)"
          >
            <p v-if="helpIgnored">该插件被帮助系统忽略，无法出现在帮助菜单。</p>
            <p v-else>关闭后会立即从帮助菜单隐藏，但不影响实际 matcher 运行。</p>
          </PluginRuntimeSwitchRow>
        </div>
      </section>

      <section class="plugin-governance-panel__group">
        <header class="plugin-governance-panel__group-head">
          <h4 class="plugin-governance-panel__group-title">命令权限</h4>
          <p class="muted plugin-governance-panel__group-desc">帮助图中的「何人可用」会随这里的配置同步变化。</p>
        </header>
        <CmdPermMatrix
          v-if="governanceData.perm_ui_filtered.plugins?.length"
          :levels="governanceData.perm_ui_filtered.levels ?? []"
          :plugins="governanceData.perm_ui_filtered.plugins"
          :selections="permSelections"
          :command-menu-map="commandMenuMap"
          :disabled="governanceSaving"
          @change="(cmdId, lv) => emit('permChange', cmdId, lv)"
        />
        <p v-else class="muted plugin-governance-panel__empty">该插件暂无命令权限声明。</p>
      </section>

      <section class="plugin-governance-panel__group">
        <header class="plugin-governance-panel__group-head">
          <h4 class="plugin-governance-panel__group-title">命令冷却</h4>
          <p class="muted plugin-governance-panel__group-desc">输入秒数后会自动保存；留空或设为默认值表示不覆盖默认冷却。</p>
        </header>
        <CmdLimitsTable
          v-if="governanceData.limits_ui_filtered.plugins?.length"
          :plugins="governanceData.limits_ui_filtered.plugins"
          :selections="limitSelections"
          :disabled="governanceSaving"
          @input="(cmdId, val) => emit('limitInput', cmdId, val)"
        />
        <p v-else class="muted plugin-governance-panel__empty">该插件暂无命令冷却声明。</p>
      </section>

      <p v-if="governanceSaving" class="muted plugin-governance-panel__saving">保存中…</p>
    </template>
  </section>
</template>

<style scoped>
.plugin-governance-panel {
  display: grid;
  gap: 14px;
}

.plugin-governance-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.plugin-governance-panel__title {
  margin: 0;
  font-size: 15px;
  line-height: 1.35;
  font-weight: 700;
}

.plugin-governance-panel__desc {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.55;
}

.plugin-governance-panel__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.plugin-governance-panel__badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  color: color-mix(in srgb, var(--accent, #38bdf8) 82%, var(--text, #fff) 10%);
  background: color-mix(in srgb, var(--accent, #38bdf8) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent, #38bdf8) 18%, transparent);
}

.plugin-governance-panel__group {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.08)) 88%, transparent);
  background: color-mix(in srgb, var(--surface-1, rgba(255, 255, 255, 0.02)) 98%, transparent);
}

.plugin-governance-panel__group-head {
  display: grid;
  gap: 4px;
}

.plugin-governance-panel__group-title {
  margin: 0;
  font-size: 14px;
  line-height: 1.35;
  font-weight: 700;
}

.plugin-governance-panel__group-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
}

.plugin-governance-panel__switches {
  display: grid;
  gap: 10px;
}

.plugin-governance-panel__empty,
.plugin-governance-panel__saving {
  font-size: 13px;
  line-height: 1.55;
}

@media (max-width: 560px) {
  .plugin-governance-panel__head {
    flex-direction: column;
  }

  .plugin-governance-panel__badges {
    width: 100%;
    justify-content: flex-start;
  }

  .plugin-governance-panel__group {
    padding: 12px;
    border-radius: 16px;
  }
}
</style>
