<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";
import UiButton from "@/components/ui/UiButton.vue";
import {
  AI_CONFIG_WIZARD_PATH,
  AI_SETUP_GUIDE_DISMISS_KEY,
  AI_SETUP_GUIDE_PATHS,
} from "@/config/aiSetupGuide";

const dismissed = ref(localStorage.getItem(AI_SETUP_GUIDE_DISMISS_KEY) === "1");

function dismissGuide() {
  dismissed.value = true;
  localStorage.setItem(AI_SETUP_GUIDE_DISMISS_KEY, "1");
}

function restoreGuide() {
  dismissed.value = false;
  localStorage.removeItem(AI_SETUP_GUIDE_DISMISS_KEY);
}

defineExpose({ restoreGuide, dismissed });
</script>

<template>
  <section
    v-if="!dismissed"
    class="ai-config-setup-guide"
    aria-label="AI 配置入门引导"
  >
    <div class="ai-config-setup-guide__head">
      <div>
        <h3 class="ai-config-setup-guide__title">从哪里开始？</h3>
        <p class="muted ai-config-setup-guide__lead">
          配置项按链路分层；先选你的目标，再按步骤跳转，不必一次看完所有分区。
        </p>
      </div>
      <div class="row-actions ai-config-setup-guide__head-actions">
        <RouterLink :to="AI_CONFIG_WIZARD_PATH">
          <UiButton size="sm" variant="outline">一键体检</UiButton>
        </RouterLink>
        <UiButton size="sm" variant="ghost" @click="dismissGuide">
          收起引导
        </UiButton>
      </div>
    </div>
    <div class="ai-config-setup-guide__paths">
      <article
        v-for="path in AI_SETUP_GUIDE_PATHS"
        :key="path.id"
        class="ai-config-setup-guide__path"
      >
        <h4 class="ai-config-setup-guide__path-title">{{ path.title }}</h4>
        <p class="muted ai-config-setup-guide__path-lead">{{ path.lead }}</p>
        <ol class="ai-config-setup-guide__steps">
          <li
            v-for="step in path.steps"
            :key="`${path.id}-${step.label}`"
            class="ai-config-setup-guide__step"
          >
            <RouterLink :to="step.to" class="ai-config-setup-guide__step-link">
              {{ step.label }}
            </RouterLink>
            <span class="muted ai-config-setup-guide__step-detail">{{ step.detail }}</span>
          </li>
        </ol>
      </article>
    </div>
  </section>
  <p v-else class="muted ai-config-setup-guide__collapsed">
    已收起入门引导。
    <button type="button" class="ai-config-setup-guide__restore" @click="restoreGuide">
      再次显示
    </button>
  </p>
</template>

<style scoped>
.ai-config-setup-guide {
  display: grid;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  border-radius: 14px;
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.ai-config-setup-guide__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ai-config-setup-guide__title {
  margin: 0 0 4px;
  font-size: 1rem;
}

.ai-config-setup-guide__lead {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.45;
}

.ai-config-setup-guide__paths {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.ai-config-setup-guide__path {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--text) 3.5%, transparent);
  border: 1px solid var(--border);
}

.ai-config-setup-guide__path-title {
  margin: 0;
  font-size: 0.92rem;
}

.ai-config-setup-guide__path-lead {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.4;
}

.ai-config-setup-guide__steps {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 8px;
}

.ai-config-setup-guide__step {
  display: grid;
  gap: 2px;
}

.ai-config-setup-guide__step-link {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--accent);
  text-decoration: none;
}

.ai-config-setup-guide__step-link:hover {
  text-decoration: underline;
}

.ai-config-setup-guide__step-detail {
  font-size: 0.76rem;
  line-height: 1.35;
}

.ai-config-setup-guide__collapsed {
  margin: 0;
  font-size: 0.82rem;
}

.ai-config-setup-guide__restore {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  cursor: pointer;
  font: inherit;
}

@media (max-width: 560px) {
  .ai-config-setup-guide__head {
    flex-direction: column;
  }

  .ai-config-setup-guide__head-actions {
    width: 100%;
  }

  .ai-config-setup-guide__head-actions :deep(.btn) {
    flex: 1 1 auto;
  }

  .ai-config-setup-guide__paths {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
