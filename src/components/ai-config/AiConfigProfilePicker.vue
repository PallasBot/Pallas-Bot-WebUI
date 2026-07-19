<script setup lang="ts">
import { ref } from "vue";
import { fetchCommonConfig, putCommonConfig } from "@/api/consoleApi";
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";
import { AI_CONFIG_PROFILES, type AiConfigProfileDef } from "@/config/aiConfigProfiles";
import { fieldValuesFromConfig, parsePluginConfigField } from "@/utils/pluginConfigFieldModel";
import { pushConsoleToast } from "@/utils/consoleToast";

const applyingId = ref("");
const confirmProfile = ref<AiConfigProfileDef | null>(null);
const confirmOpen = ref(false);

function askApply(profile: AiConfigProfileDef) {
  confirmProfile.value = profile;
  confirmOpen.value = true;
}

async function applyProfile() {
  const profile = confirmProfile.value;
  if (!profile) return;
  applyingId.value = profile.id;
  confirmOpen.value = false;
  try {
    const data = await fetchCommonConfig("llm");
    const merged = { ...fieldValuesFromConfig(data.fields) };
    for (const [key, value] of Object.entries(profile.patches)) {
      merged[key] = value;
    }
    const values: Record<string, unknown> = {};
    for (const field of data.fields) {
      const raw = merged[field.name] ?? "";
      values[field.name] = parsePluginConfigField(field, raw);
    }
    await putCommonConfig("llm", values);
    pushConsoleToast(`已应用预设「${profile.title}」`, "ok");
  } catch (e) {
    pushConsoleToast(e instanceof Error ? e.message : "应用预设失败", "err");
  } finally {
    applyingId.value = "";
    confirmProfile.value = null;
  }
}
</script>

<template>
  <section class="ai-config-profile-picker" aria-label="Bot 对话策略预设">
    <div class="ai-config-profile-picker__head">
      <h3 class="ai-config-profile-picker__title">一键预设（Bot 对话策略）</h3>
      <p class="muted ai-config-profile-picker__lead">
        不确定怎么配时先选场景；会写入「Bot 对话策略」相关开关，可随时再微调。
      </p>
    </div>
    <div class="ai-config-profile-picker__grid">
      <article
        v-for="profile in AI_CONFIG_PROFILES"
        :key="profile.id"
        class="ai-config-profile-picker__card"
      >
        <h4 class="ai-config-profile-picker__card-title">{{ profile.title }}</h4>
        <p class="muted ai-config-profile-picker__card-lead">{{ profile.lead }}</p>
        <UiButton
          size="sm"
          variant="outline"
          :busy="applyingId === profile.id"
          @click="askApply(profile)"
        >
          应用
        </UiButton>
      </article>
    </div>
    <UiDialog
      :open="confirmOpen"
      title="应用对话策略预设"
      @close="confirmOpen = false"
    >
      <p v-if="confirmProfile">
        将应用「{{ confirmProfile.title }}」到 Bot 对话策略，覆盖接话与学习相关开关。继续？
      </p>
      <template #footer>
        <div class="row-actions">
          <UiButton variant="ghost" @click="confirmOpen = false">取消</UiButton>
          <UiButton variant="primary" :busy="!!applyingId" @click="applyProfile">确认应用</UiButton>
        </div>
      </template>
    </UiDialog>
  </section>
</template>

<style scoped>
.ai-config-profile-picker {
  display: grid;
  gap: 10px;
}

.ai-config-profile-picker__title {
  margin: 0 0 4px;
  font-size: 0.92rem;
}

.ai-config-profile-picker__lead {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.4;
}

.ai-config-profile-picker__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.ai-config-profile-picker__card {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--text) 2.5%, transparent);
}

.ai-config-profile-picker__card-title {
  margin: 0;
  font-size: 0.86rem;
}

.ai-config-profile-picker__card-lead {
  margin: 0;
  font-size: 0.74rem;
  line-height: 1.35;
  flex: 1 1 auto;
}

@media (max-width: 560px) {
  .ai-config-profile-picker__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
