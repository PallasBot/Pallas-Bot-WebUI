<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { fetchUserConfigById, putUserConfig } from "@/api/consoleApi";
import type { UserConfigPublic } from "@/api/pallasTypes";
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";
import FormBoolSwitchField from "@/components/config/FormBoolSwitchField.vue";
import { useSaveHotkey } from "@/composables/useSaveHotkey";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";

const open = defineModel<boolean>("open", { default: false });
const props = defineProps<{
  userId: number | null;
  /** 好友昵称（好友列表传入；数据库页无昵称时可省略） */
  userNickname?: string;
  /** 打开弹窗时封禁下拉默认选「是」（数据库页添加封禁用户） */
  defaultBanned?: boolean;
}>();

const subtitleUserNickname = computed(() => props.userNickname?.trim() ?? "");

const emit = defineEmits<{
  saved: [];
}>();

const userCfg = ref<UserConfigPublic | null>(null);
const userDraft = ref<{ banned: boolean } | null>(null);
const loadBusy = ref(false);
const saveBusy = ref(false);
const loadErr = ref("");
const saveErr = ref("");

function resetState() {
  userCfg.value = null;
  userDraft.value = null;
  loadErr.value = "";
  saveErr.value = "";
}

function close() {
  open.value = false;
}

async function loadConfig() {
  const uid = props.userId;
  if (uid == null || !Number.isFinite(uid) || uid < 1) {
    loadErr.value = "无效用户 QQ。";
    return;
  }
  loadBusy.value = true;
  loadErr.value = "";
  resetState();
  try {
    const u = await fetchUserConfigById(uid);
    userCfg.value = u;
    userDraft.value = { banned: props.defaultBanned ? true : u.banned };
    saveErr.value = "";
  } catch (e) {
    loadErr.value = e instanceof Error ? e.message : String(e);
    userCfg.value = null;
    userDraft.value = null;
  } finally {
    loadBusy.value = false;
  }
}

async function save() {
  if (!userCfg.value || !userDraft.value) return;
  saveBusy.value = true;
  saveErr.value = "";
  try {
    const u = await putUserConfig(userCfg.value.user_id, { banned: userDraft.value.banned });
    userCfg.value = u;
    userDraft.value = { banned: u.banned };
    emit("saved");
    close();
    toastSaveSuccess("用户配置已保存");
  } catch (e) {
    saveErr.value = e instanceof Error ? e.message : String(e);
    toastApiError(e, "保存失败");
  } finally {
    saveBusy.value = false;
  }
}

useSaveHotkey(
  () => open.value && Boolean(userDraft.value) && !saveBusy.value && !loadBusy.value,
  () => save(),
  { lifecycle: "mount" },
);

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) void loadConfig();
    else resetState();
  },
);

watch(
  () => props.userId,
  () => {
    if (open.value) void loadConfig();
  },
);
</script>

<template>
  <UiDialog
    :open="open"
    title-id="user-policy-modal-title"
    @close="close"
  >
    <template #header>
      <div class="console-modal__head-text">
        <h2
          id="user-policy-modal-title"
          class="console-modal__title"
        >
          {{ defaultBanned ? "添加用户封禁" : "编辑用户颗粒配置" }}
        </h2>
        <p class="console-modal__subtitle">
          <span
            v-if="userCfg"
            class="console-modal__subtitle-strong"
          >QQ {{ userCfg.user_id }}</span>
          <span
            v-else-if="userId"
            class="console-modal__subtitle-strong"
          >QQ {{ userId }}</span>
          <span
            v-if="subtitleUserNickname"
            class="muted"
          > · {{ subtitleUserNickname }}</span>
        </p>
      </div>
      <button
        type="button"
        class="console-modal__close"
        aria-label="关闭"
        @click="close"
      >
        ×
      </button>
    </template>
          <p
            v-if="loadBusy"
            class="muted"
            style="margin: 0"
          >
            加载中…
          </p>
          <p
            v-else-if="loadErr"
            class="alert alert--err"
          >
            {{ loadErr }}
          </p>
          <div
            v-else-if="userCfg && userDraft"
            class="bot-config-edit bot-config-edit--modal"
          >
            <p
              v-if="saveErr"
              class="alert alert--err"
              style="margin-bottom: 12px"
            >
              {{ saveErr }}
            </p>
            <FormBoolSwitchField
              label="封禁"
              label-style="yesno"
              :model-value="userDraft.banned"
              @update:model-value="userDraft.banned = $event"
            />
            <div class="row-actions">
              <UiButton
                variant="primary"
                :busy="saveBusy"
                @click="save"
              >
                保存
              </UiButton>
              <UiButton
                variant="outline"
                :disabled="saveBusy"
                @click="close"
              >
                取消
              </UiButton>
            </div>
          </div>
  </UiDialog>
</template>
