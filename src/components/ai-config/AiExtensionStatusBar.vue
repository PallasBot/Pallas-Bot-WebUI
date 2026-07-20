<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import {
  useAiExtensionConnection,
  type AiExtensionConnectionApi,
} from "@/composables/useAiExtensionConnection";

type StatusTone = "online" | "unreachable" | "unknown";

const props = withDefaults(
  defineProps<{
    /** 与「媒体服务」页共享同一连接状态，避免同页双实例。 */
    connection?: AiExtensionConnectionApi;
    /** 挂载时是否自动测通；同页已有「连接诊断」时可关。 */
    autoTest?: boolean;
  }>(),
  { autoTest: true },
);

const ownConnection = useAiExtensionConnection();
const connection = props.connection ?? ownConnection;
const {
  err,
  saving,
  testOut,
  baseScheme,
  baseHostPort,
  token,
  buildConfigPayload,
  load,
  save,
  runTest,
} = connection;

const expanded = ref(false);
const testing = ref(false);
const baseline = ref("");

const currentPayload = computed(() => JSON.stringify(buildConfigPayload()));
const isDirty = computed(() => baseline.value !== "" && currentPayload.value !== baseline.value);
const isReachable = computed(() => testOut.value?.ok === true);
const tone = computed<StatusTone>(() => {
  if (testOut.value?.ok === true) return "online";
  if (testOut.value?.ok === false || err.value) return "unreachable";
  return "unknown";
});
const statusLabel = computed(() => {
  if (tone.value === "online") return "AI Runtime 在线";
  if (tone.value === "unreachable") return "AI Runtime 不可达";
  return "AI Runtime 状态未知";
});
const statusDetail = computed(() => {
  if (tone.value === "online") return "媒体任务（唱歌/TTS 等）可走此扩展；默认 LLM 聊天不依赖此项。";
  if (err.value) return `检测失败：${err.value}`;
  if (testOut.value?.error) return `检测失败：${testOut.value.error}`;
  if (tone.value === "unreachable") return "请检查地址、端口或访问令牌；仅影响媒体与遗留 ai_service 聊天。";
  return "正在读取连接配置。";
});

function markClean() {
  baseline.value = currentPayload.value;
}

async function saveIfDirty(options: { quiet?: boolean } = {}) {
  if (!isDirty.value) return;
  await save(options);
  markClean();
}

async function testConnection(options: { quiet?: boolean } = {}) {
  testing.value = true;
  try {
    await saveIfDirty(options);
    await runTest(options);
    expanded.value = !isReachable.value;
  } finally {
    testing.value = false;
  }
}

defineExpose({
  save: saveIfDirty,
  runTest: testConnection,
  isDirty,
  isReachable,
  saving,
  testing,
});

onMounted(async () => {
  // 共享 connection 时由父页负责 load，避免重复请求。
  if (!props.connection) {
    await load();
    markClean();
  } else {
    markClean();
  }
  if (props.autoTest) {
    await testConnection({ quiet: true });
  }
});
</script>

<template>
  <UiCard
    tag="section"
    glass
    class="ai-extension-status"
    :class="`ai-extension-status--${tone}`"
  >
    <div class="ai-extension-status__summary">
      <div class="ai-extension-status__main">
        <span
          class="ai-extension-status__dot"
          aria-hidden="true"
        />
        <div>
          <h2 class="panel__title ai-extension-status__title">
            {{ statusLabel }}
          </h2>
          <p class="muted ai-extension-status__detail">
            {{ statusDetail }}
          </p>
        </div>
      </div>
      <div class="row-actions ai-extension-status__actions">
        <UiButton
          variant="outline"
          size="sm"
          :disabled="saving || testing"
          @click="expanded = !expanded"
        >
          {{ expanded ? "收起连接" : "展开连接" }}
        </UiButton>
        <UiButton
          variant="primary"
          size="sm"
          :busy="testing || saving"
          :disabled="testing || saving"
          @click="testConnection()"
        >
          测通 AI Runtime
        </UiButton>
      </div>
    </div>

    <div
      v-if="expanded"
      class="ai-extension-status__form"
    >
      <label class="form-field ai-extension-status__scheme">
        <span class="form-field__label">协议</span>
        <select
          v-model="baseScheme"
          class="inp"
          :disabled="saving || testing"
        >
          <option value="http">http</option>
          <option value="https">https</option>
        </select>
      </label>
      <label class="form-field">
        <span class="form-field__label">主机与端口</span>
        <input
          v-model="baseHostPort"
          class="inp"
          placeholder="127.0.0.1:9099"
          :disabled="saving || testing"
        >
      </label>
      <label class="form-field">
        <span class="form-field__label">访问令牌（可选）</span>
        <input
          v-model="token"
          class="inp"
          type="password"
          autocomplete="off"
          placeholder="未设置则留空"
          :disabled="saving || testing"
        >
      </label>
    </div>
  </UiCard>
</template>

<style scoped>
.ai-extension-status {
  border-color: color-mix(in srgb, var(--text) 8%, transparent);
  /* UiCard 默认 overflow:hidden，大圆角会裁掉右侧按钮 */
  overflow: visible;
}

.ai-extension-status :deep(.ui-card__content) {
  padding: 16px 18px;
}

.ai-extension-status__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-width: 0;
}

.ai-extension-status__main {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
  flex: 1 1 auto;
}

.ai-extension-status__dot {
  width: 10px;
  height: 10px;
  margin-top: 7px;
  border-radius: 999px;
  background: var(--text-muted, #64748b);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--text-muted, #64748b) 14%, transparent);
  flex-shrink: 0;
}

.ai-extension-status--online .ai-extension-status__dot {
  background: var(--ok, #3d9a5c);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ok, #3d9a5c) 16%, transparent);
}

.ai-extension-status--unreachable .ai-extension-status__dot {
  background: var(--warn, #c9a227);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--warn, #c9a227) 18%, transparent);
}

.ai-extension-status__title {
  margin: 0;
}

.ai-extension-status__detail {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.5;
}

.ai-extension-status__actions {
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-extension-status__form {
  display: grid;
  grid-template-columns: 120px minmax(180px, 1fr) minmax(180px, 1fr);
  gap: 12px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
}

@media (max-width: 560px) {
  .ai-extension-status__summary {
    flex-direction: column;
    align-items: stretch;
  }

  .ai-extension-status__actions {
    width: 100%;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: stretch;
  }

  .ai-extension-status__actions :deep(.ui-btn) {
    width: auto;
    flex: 1 1 0;
    min-width: 0;
    justify-content: center;
  }

  .ai-extension-status__form {
    grid-template-columns: 1fr;
  }
}
</style>
