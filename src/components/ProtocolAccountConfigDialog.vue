<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { SystemData } from "@/api/pallasTypes";
import ProtocolAccountWorkspace, {
  type ProtocolAccountTab,
} from "@/components/ProtocolAccountWorkspace.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";

const props = defineProps<{
  open: boolean;
  accountId: string;
  mountUrl: string | null;
  system: SystemData | null;
  initialTab?: ProtocolAccountTab;
}>();

const emit = defineEmits<{
  close: [];
  deleted: [];
}>();

const workspaceRef = ref<InstanceType<typeof ProtocolAccountWorkspace> | null>(null);
const activeTab = ref<ProtocolAccountTab>("overview");

const displayTitle = computed(
  () => workspaceRef.value?.pageTitle ?? (props.accountId ? `账号 ${props.accountId}` : "协议账号"),
);

const statusLine = computed(() => workspaceRef.value?.statusLine ?? "");

const canSave = computed(
  () =>
    activeTab.value === "settings" &&
    Boolean(props.mountUrl && props.accountId) &&
    !workspaceRef.value?.loadBusy &&
    !workspaceRef.value?.saveBusy,
);

watch(
  () => [props.open, props.accountId, props.initialTab] as const,
  ([open, , tab]) => {
    if (!open) return;
    activeTab.value = tab === "settings" ? "settings" : "overview";
  },
  { immediate: true },
);

function requestClose() {
  emit("close");
}

function onDeleted() {
  emit("deleted");
  requestClose();
}
</script>

<template>
  <UiDialog
    :open="open && Boolean(accountId)"
    title-id="protocol-account-config-dialog-title"
    panel-class="plugin-config-dialog protocol-account-config-dialog"
    body-class="plugin-config-dialog__bd protocol-account-config-dialog__bd"
    @close="requestClose"
  >
    <template #header>
      <div class="console-modal__head-text protocol-account-config-dialog__head">
        <div class="protocol-account-config-dialog__head-text">
          <h2
            id="protocol-account-config-dialog-title"
            class="console-modal__title"
          >
            {{ displayTitle }}
          </h2>
          <p
            v-if="statusLine"
            class="console-modal__subtitle muted"
          >
            {{ statusLine }}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="console-modal__close"
        aria-label="关闭"
        @click="requestClose"
      >
        ×
      </button>
    </template>

    <ProtocolAccountWorkspace
      v-if="open && accountId"
      :key="accountId"
      ref="workspaceRef"
      presentation="dialog"
      :account-id="accountId"
      :mount-url="mountUrl"
      :system="system"
      :active-tab="activeTab"
      @update:active-tab="activeTab = $event"
      @deleted="onDeleted"
    />

    <template #footer>
      <div class="plugin-config-dialog__foot row-actions">
        <UiButton
          v-if="activeTab === 'settings'"
          variant="primary"
          :disabled="!canSave"
          :busy="workspaceRef?.saveBusy"
          title="Ctrl+S"
          @click="workspaceRef?.saveSettings()"
        >
          {{ workspaceRef?.saveBusy ? "保存中…" : "保存并重启" }}
        </UiButton>
      </div>
    </template>
  </UiDialog>
</template>

<style scoped>
.protocol-account-config-dialog__head {
  min-width: 0;
}

.protocol-account-config-dialog__head-text {
  min-width: 0;
}
</style>
