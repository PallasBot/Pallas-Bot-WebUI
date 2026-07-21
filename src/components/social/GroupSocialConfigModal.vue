<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { fetchGroupConfigById, fetchPlugins, putGroupConfig } from "@/api/consoleApi";
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";
import FormBoolSwitchField from "@/components/config/FormBoolSwitchField.vue";
import { useSaveHotkey } from "@/composables/useSaveHotkey";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";
import type { GroupConfigPublic, PluginRow } from "@/api/pallasTypes";
import { pluginPickListFromRows } from "@/utils/pluginDisplay";
import {
  parseRouletteModeSelect,
  rouletteModeSelectOptions,
  rouletteModeSelectValue,
} from "@/utils/rouletteMode";

const open = defineModel<boolean>("open", { default: false });
const props = defineProps<{
  groupId: number | null;
  /** 群昵称（好友与群列表传入；数据库页无群名时可省略） */
  groupName?: string;
}>();

const subtitleGroupName = computed(() => props.groupName?.trim() ?? "");

const emit = defineEmits<{
  saved: [];
}>();

const groupCfg = ref<GroupConfigPublic | null>(null);
const groupDraft = ref<{
  roulette_mode: number;
  banned: boolean;
  disabled_plugins: string[];
  blocked_user_ids: number[];
} | null>(null);
const loadBusy = ref(false);
const saveBusy = ref(false);
const loadErr = ref("");
const saveErr = ref("");
const addBlockedUserInput = ref("");
const blockedUserAddHint = ref("");

const plugins = ref<PluginRow[]>([]);
const pluginLoadErr = ref("");
let pluginsLoaded = false;

const pluginPickList = computed(() => pluginPickListFromRows(plugins.value));

type SingProgressUi = {
  songId: string;
  complete: boolean;
  chunkIndex: number | null;
  key: number | null;
};

function singProgressModel(raw: unknown): SingProgressUi | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const hasShape = ["song_id", "complete", "chunk_index", "key"].some((k) => k in o);
  if (!hasShape) return null;
  let songId = "";
  if (typeof o.song_id === "string") songId = o.song_id;
  else if (typeof o.song_id === "number" && Number.isFinite(o.song_id)) songId = String(o.song_id);
  const complete = o.complete === true;
  const chunkIndex =
    typeof o.chunk_index === "number" && Number.isFinite(o.chunk_index) ? o.chunk_index : null;
  const key = typeof o.key === "number" && Number.isFinite(o.key) ? o.key : null;
  return { songId, complete, chunkIndex, key };
}

const groupSingProgressUi = computed(() =>
  groupCfg.value ? singProgressModel(groupCfg.value.sing_progress) : null,
);

const groupStyleSnapshot = computed(() => groupCfg.value?.style_profile_snapshot ?? null);

const groupStyleContaminationSkipped = computed(() => {
  const count = groupStyleSnapshot.value?.contamination_skipped_count;
  return typeof count === "number" && Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
});

function formatStyleUpdatedAt(ts: number | null | undefined): string {
  if (ts == null || !Number.isFinite(ts)) return "—";
  const ms = ts > 1e12 ? ts : ts * 1000;
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ts);
  }
}

function normalizeBlockedUserIdsForSave(ids: number[]): number[] {
  const next = [...new Set(ids.map((n) => Math.floor(Number(n))))].filter((n) => Number.isFinite(n) && n > 0);
  next.sort((a, b) => a - b);
  return next;
}

function syncGroupDraftFromConfig(g: GroupConfigPublic) {
  groupCfg.value = g;
  const blocked = normalizeBlockedUserIdsForSave(g.blocked_user_ids ?? []);
  groupDraft.value = {
    roulette_mode: g.roulette_mode,
    banned: g.banned,
    disabled_plugins: [...(g.disabled_plugins ?? [])].sort((a, b) => a.localeCompare(b)),
    blocked_user_ids: blocked,
  };
  saveErr.value = "";
  addBlockedUserInput.value = "";
  blockedUserAddHint.value = "";
}

function resetState() {
  groupCfg.value = null;
  groupDraft.value = null;
  loadErr.value = "";
  saveErr.value = "";
  addBlockedUserInput.value = "";
  blockedUserAddHint.value = "";
}

function close() {
  open.value = false;
}

const rouletteModeOptions = computed(() =>
  groupDraft.value ? rouletteModeSelectOptions(groupDraft.value.roulette_mode) : rouletteModeSelectOptions(),
);

function onRouletteModeSelect(raw: string) {
  if (!groupDraft.value) return;
  groupDraft.value.roulette_mode = parseRouletteModeSelect(raw, groupDraft.value.roulette_mode);
}

function addBlockedUserFromInput() {
  if (!groupDraft.value) return;
  blockedUserAddHint.value = "";
  const raw = addBlockedUserInput.value.trim();
  if (!raw) return;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    blockedUserAddHint.value = "请输入有效的 QQ 号。";
    return;
  }
  if (groupDraft.value.blocked_user_ids.includes(n)) {
    blockedUserAddHint.value = "该号码已在列表中。";
    return;
  }
  groupDraft.value.blocked_user_ids = [...groupDraft.value.blocked_user_ids, n].sort((a, b) => a - b);
  addBlockedUserInput.value = "";
}

function removeBlockedUserFromDraft(id: number) {
  if (!groupDraft.value) return;
  groupDraft.value.blocked_user_ids = groupDraft.value.blocked_user_ids.filter((x) => x !== id);
}

function toggleGroupPluginDisabled(name: string, checked: boolean) {
  if (!groupDraft.value) return;
  const set = new Set(groupDraft.value.disabled_plugins);
  if (checked) set.add(name);
  else set.delete(name);
  groupDraft.value.disabled_plugins = [...set].sort((a, b) => a.localeCompare(b));
}

async function ensurePlugins() {
  if (pluginsLoaded) return;
  pluginsLoaded = true;
  try {
    plugins.value = await fetchPlugins();
  } catch (e) {
    pluginLoadErr.value = e instanceof Error ? e.message : String(e);
    plugins.value = [];
  }
}

async function loadConfig() {
  const gid = props.groupId;
  if (gid == null || !Number.isFinite(gid) || gid < 1) {
    loadErr.value = "无效群号。";
    return;
  }
  loadBusy.value = true;
  loadErr.value = "";
  resetState();
  try {
    await ensurePlugins();
    const g = await fetchGroupConfigById(gid);
    syncGroupDraftFromConfig(g);
  } catch (e) {
    loadErr.value = e instanceof Error ? e.message : String(e);
    groupCfg.value = null;
    groupDraft.value = null;
  } finally {
    loadBusy.value = false;
  }
}

async function save() {
  if (!groupCfg.value || !groupDraft.value) return;
  saveBusy.value = true;
  saveErr.value = "";
  try {
    const g = await putGroupConfig(groupCfg.value.group_id, {
      roulette_mode: groupDraft.value.roulette_mode,
      banned: groupDraft.value.banned,
      disabled_plugins: groupDraft.value.disabled_plugins,
      blocked_user_ids: normalizeBlockedUserIdsForSave(groupDraft.value.blocked_user_ids),
    });
    syncGroupDraftFromConfig(g);
    emit("saved");
    close();
    toastSaveSuccess("群配置已保存");
  } catch (e) {
    saveErr.value = e instanceof Error ? e.message : String(e);
    toastApiError(e, "保存失败");
  } finally {
    saveBusy.value = false;
  }
}

useSaveHotkey(
  () => open.value && Boolean(groupDraft.value) && !saveBusy.value && !loadBusy.value,
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
  () => props.groupId,
  () => {
    if (open.value) void loadConfig();
  },
);
</script>

<template>
  <UiDialog
    :open="open"
    title-id="group-policy-modal-title"
    @close="close"
  >
    <template #header>
      <div class="console-modal__head-text">
        <h2
          id="group-policy-modal-title"
          class="console-modal__title"
        >
          编辑群颗粒配置
        </h2>
        <p class="console-modal__subtitle">
          <span
            v-if="groupCfg"
            class="console-modal__subtitle-strong"
          >群 {{ groupCfg.group_id }}</span>
          <span
            v-else-if="groupId"
            class="console-modal__subtitle-strong"
          >群 {{ groupId }}</span>
          <span
            v-if="subtitleGroupName"
            class="muted"
          > · {{ subtitleGroupName }}</span>
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
            v-else-if="groupCfg && groupDraft"
            class="bot-config-edit bot-config-edit--modal"
          >
            <p
              v-if="pluginLoadErr"
              class="muted"
              style="margin: 0 0 10px; font-size: 12px"
            >
              插件列表加载失败，禁用插件勾选不可用：{{ pluginLoadErr }}
            </p>
            <p
              v-if="saveErr"
              class="alert alert--err"
              style="margin-bottom: 12px"
            >
              {{ saveErr }}
            </p>
            <div class="bot-config-edit__grid bot-config-edit__grid--pair">
              <div class="bot-config-edit__field">
                <label>轮盘模式</label>
                <select
                  class="sel"
                  style="width: 100%"
                  :value="rouletteModeSelectValue(groupDraft.roulette_mode)"
                  @change="onRouletteModeSelect(($event.target as HTMLSelectElement).value)"
                >
                  <option
                    v-for="opt in rouletteModeOptions"
                    :key="`roulette-${opt.value}`"
                    :value="String(opt.value)"
                  >
                    {{ opt.label }}
                  </option>
                </select>
              </div>
              <FormBoolSwitchField
                label="封禁"
                label-style="yesno"
                :model-value="groupDraft.banned"
                @update:model-value="groupDraft.banned = $event"
              />
            </div>
            <div class="bot-config-edit__field">
              <label>本群拉黑 QQ（<code>blocked_user_ids</code>）</label>
              <p
                class="muted"
                style="margin: 0 0 8px; font-size: 12px"
              >
                与群内「牛牛拉黑」写入同一字段。输入号码后点击添加；每个号码右上角 × 可移除。保存时会去重、排序。
              </p>
              <div
                class="row-actions"
                style="margin-bottom: 4px; flex-wrap: wrap; gap: 8px"
              >
                <input
                  v-model="addBlockedUserInput"
                  class="inp"
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  placeholder="QQ 号"
                  style="max-width: 200px; min-width: 0; flex: 1 1 140px"
                  @keydown.enter.prevent="addBlockedUserFromInput"
                >
                <UiButton
                  variant="outline"
                  size="sm"
                  @click="addBlockedUserFromInput"
                >
                  添加
                </UiButton>
              </div>
              <p
                v-if="blockedUserAddHint"
                class="alert alert--err"
                style="margin: 0 0 8px; padding: 8px 10px; font-size: 12px"
              >
                {{ blockedUserAddHint }}
              </p>
              <div
                v-if="groupDraft.blocked_user_ids.length"
                class="admin-chip-list"
              >
                <div
                  v-for="id in groupDraft.blocked_user_ids"
                  :key="`blk-${groupCfg.group_id}-${id}`"
                  class="admin-chip"
                >
                  <span class="admin-chip__id">{{ id }}</span>
                  <button
                    type="button"
                    class="admin-chip__rm"
                    :aria-label="`移除拉黑 ${id}`"
                    title="移除"
                    @click="removeBlockedUserFromDraft(id)"
                  >
                    ×
                  </button>
                </div>
              </div>
              <p
                v-else
                class="muted"
                style="margin: 4px 0 0; font-size: 12px"
              >
                尚未添加本群拉黑号码。
              </p>
            </div>
            <div class="bot-config-edit__field">
              <label>禁用插件（勾选表示禁用）</label>
              <p
                v-if="!pluginPickList.length"
                class="muted"
                style="margin: 0 0 8px; font-size: 12px"
              >
                无插件清单，无法勾选禁用项。
              </p>
              <div
                v-else
                class="plugin-check-grid"
              >
                <label
                  v-for="p in pluginPickList"
                  :key="`gpl-${groupCfg.group_id}-${p.name}`"
                >
                  <input
                    type="checkbox"
                    :checked="groupDraft.disabled_plugins.includes(p.name)"
                    @change="
                      toggleGroupPluginDisabled(p.name, ($event.target as HTMLInputElement).checked)
                    "
                  >
                  <span>{{ p.label }}</span>
                </label>
              </div>
            </div>
            <div class="bot-config-edit__field">
              <label>群风格画像（只读）</label>
              <p
                class="muted"
                style="margin: 0 0 8px; font-size: 12px"
              >
                由群消息统计自动生成，驱动复读接话与智能对话语气/句长；不可在此编辑。
              </p>
              <div
                v-if="groupStyleSnapshot"
                class="style-profile-card"
              >
                <div class="style-profile-card__header">
                  <span class="muted style-profile-card__eyebrow">style_profile</span>
                  <span
                    class="badge"
                    :class="groupStyleSnapshot.ready ? 'badge--ok' : 'badge--warn'"
                  >{{ groupStyleSnapshot.ready ? "可用" : "样本不足" }}</span>
                </div>
                <p
                  v-if="groupStyleSnapshot.hints?.length"
                  class="style-profile-card__hints"
                >
                  {{ groupStyleSnapshot.hints.join("；") }}
                </p>
                <p
                  v-else
                  class="muted"
                  style="margin: 0; font-size: 12px"
                >
                  尚无显著特征摘要。
                </p>
                <p
                  v-if="groupStyleContaminationSkipped > 0"
                  class="style-profile-card__contamination muted"
                >
                  画像计算时已跳过污染样本 {{ groupStyleContaminationSkipped }} 条（庆典腔、客服腔等）。
                </p>
                <dl
                  v-if="groupStyleSnapshot.ready && groupStyleSnapshot.signals"
                  class="style-profile-card__dl"
                >
                  <div>
                    <dt>长度偏好</dt>
                    <dd>{{ groupStyleSnapshot.signals.length_pref ?? "—" }}</dd>
                  </div>
                  <div>
                    <dt>接话倍率</dt>
                    <dd>{{ groupStyleSnapshot.signals.reply_bias_mul ?? "—" }}</dd>
                  </div>
                  <div>
                    <dt>混沌</dt>
                    <dd>{{ groupStyleSnapshot.signals.chaos_bias ?? "—" }}</dd>
                  </div>
                  <div>
                    <dt>更新</dt>
                    <dd>{{ formatStyleUpdatedAt(groupStyleSnapshot.updated_at) }}</dd>
                  </div>
                </dl>
              </div>
              <p
                v-else
                class="muted"
                style="margin: 0; font-size: 12px"
              >
                暂无画像数据。
              </p>
            </div>
            <div class="bot-config-edit__field">
              <label>sing_progress（只读）</label>
              <div
                v-if="groupSingProgressUi"
                class="sing-progress-card"
              >
                <div class="sing-progress-card__header">
                  <span class="muted sing-progress-card__eyebrow">演唱进度</span>
                  <span
                    class="badge"
                    :class="groupSingProgressUi.complete ? 'badge--ok' : 'badge--warn'"
                  >{{ groupSingProgressUi.complete ? "已完成" : "进行中" }}</span>
                </div>
                <dl class="sing-progress-card__dl">
                  <div v-if="groupSingProgressUi.songId">
                    <dt>歌曲 ID</dt>
                    <dd class="sing-progress-card__mono">{{ groupSingProgressUi.songId }}</dd>
                  </div>
                  <div v-if="groupSingProgressUi.chunkIndex != null">
                    <dt>当前片段</dt>
                    <dd>#{{ groupSingProgressUi.chunkIndex }}</dd>
                  </div>
                  <div v-if="groupSingProgressUi.key != null">
                    <dt>会话键</dt>
                    <dd class="sing-progress-card__mono">{{ groupSingProgressUi.key }}</dd>
                  </div>
                </dl>
                <div
                  v-if="!groupSingProgressUi.complete"
                  class="sing-progress-card__bar"
                  role="progressbar"
                  aria-valuemin="0"
                  :aria-valuenow="groupSingProgressUi.chunkIndex ?? 0"
                  aria-valuetext="进行中"
                >
                  <span class="sing-progress-card__bar-fill" />
                </div>
              </div>
              <pre
                v-else
                class="pre-block"
                style="max-height: 200px; overflow: auto; margin: 0"
              >{{ JSON.stringify(groupCfg.sing_progress, null, 2) }}</pre>
            </div>
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

<style scoped>
.style-profile-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  background: var(--bg-elev);
}
.style-profile-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}
.style-profile-card__eyebrow {
  font-size: 12px;
  font-weight: 600;
}
.style-profile-card__hints {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.45;
}
.style-profile-card__contamination {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 1.45;
  word-break: break-word;
}
.style-profile-card__dl {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px 14px;
  margin: 0;
}
.style-profile-card__dl dt {
  margin: 0 0 2px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
}
.style-profile-card__dl dd {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.sing-progress-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  background: var(--bg-elev);
}
.sing-progress-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.sing-progress-card__eyebrow {
  font-size: 12px;
  font-weight: 600;
}
.sing-progress-card__dl {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px 14px;
  margin: 0;
}
.sing-progress-card__dl dt {
  margin: 0 0 2px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
}
.sing-progress-card__dl dd {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.sing-progress-card__mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 13px;
  font-weight: 600;
  word-break: break-all;
}
.sing-progress-card__bar {
  margin-top: 12px;
  height: 6px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}
.sing-progress-card__bar-fill {
  display: block;
  height: 100%;
  width: 100%;
  border-radius: inherit;
  background: var(--accent);
  transform-origin: left center;
  animation: sing-progress-pulse 1.2s ease-in-out infinite;
}
@keyframes sing-progress-pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scaleX(0.35);
  }
  50% {
    opacity: 1;
    transform: scaleX(1);
  }
}
</style>
