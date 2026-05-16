<script setup lang="ts">
import { ref, watch } from "vue";
import { fetchUserConfigById, putUserConfig } from "@/api/consoleApi";
import type { UserConfigPublic } from "@/api/pallasTypes";

const open = defineModel<boolean>("open", { default: false });
const props = defineProps<{
  userId: number | null;
}>();

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

function boolSelectVal(v: boolean): string {
  return v ? "1" : "0";
}

function onUserBannedSelect(raw: string) {
  if (!userDraft.value) return;
  userDraft.value.banned = raw === "1";
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
    userDraft.value = { banned: u.banned };
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
  } catch (e) {
    saveErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    saveBusy.value = false;
  }
}

watch(
  () => open.value,
  (isOpen) => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = isOpen ? "hidden" : "";
    }
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
  <Teleport to="body">
    <div
      v-if="open"
      class="console-modal"
      role="dialog"
      :aria-modal="true"
      aria-labelledby="user-policy-modal-title"
    >
      <div
        class="console-modal__backdrop"
        :aria-hidden="true"
        @click="close"
      />
      <div
        class="console-modal__dialog"
        @click.stop
      >
        <div class="console-modal__hd">
          <div class="console-modal__head-text">
            <h2
              id="user-policy-modal-title"
              class="console-modal__title"
            >
              编辑用户颗粒配置
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
              <span class="muted"> · banned</span>
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
        </div>
        <div class="console-modal__bd">
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
            <div class="bot-config-edit__field">
              <label>封禁（banned）</label>
              <select
                class="sel"
                style="width: 100%"
                :value="boolSelectVal(userDraft.banned)"
                @change="onUserBannedSelect(($event.target as HTMLSelectElement).value)"
              >
                <option value="1">是</option>
                <option value="0">否</option>
              </select>
            </div>
            <div class="row-actions">
              <button
                type="button"
                class="btn btn--primary"
                :disabled="saveBusy"
                @click="save"
              >
                {{ saveBusy ? "保存中…" : "保存" }}
              </button>
              <button
                type="button"
                class="btn"
                :disabled="saveBusy"
                @click="close"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
