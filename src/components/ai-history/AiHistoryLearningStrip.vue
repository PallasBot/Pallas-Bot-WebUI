<script setup lang="ts">
import { RouterLink } from "vue-router";
import UiButton from "@/components/ui/UiButton.vue";

withDefaults(
  defineProps<{
    showBanner?: boolean;
    hint?: string;
    strategyPath: string;
    showVerify?: boolean;
    showOpenConfig?: boolean;
  }>(),
  {
    showBanner: false,
    hint: "",
    showVerify: false,
    showOpenConfig: false,
  },
);

const emit = defineEmits<{
  openConfig: [];
  dismiss: [];
  verify: [];
}>();
</script>

<template>
  <section
    class="ai-history-page__learning-strip"
    :class="{ 'is-warn': showBanner }"
  >
    <div class="ai-history-page__learning-strip-main">
      <strong>{{ showBanner ? "学习闭环未接通" : "学习状态" }}</strong>
      <p class="muted ai-history-page__learning-strip-text">{{ hint }}</p>
      <ol
        v-if="showBanner"
        class="ai-history-page__learning-steps"
      >
        <li>在「会话」里对坏回复点「排除」，或填写「期望回复」做校正写回</li>
        <li>
          到
          <RouterLink :to="strategyPath">AI 配置 → Bot 对话策略</RouterLink>
          开启「让闲聊软反馈参与接话弱打分」
        </li>
        <li>（可选）开启写回语料，把好样本审进接话库</li>
      </ol>
    </div>
    <div class="row-actions ai-history-page__learning-strip-actions">
      <UiButton
        v-if="showBanner"
        size="sm"
        variant="primary"
        @click="emit('openConfig')"
      >
        去开启加权
      </UiButton>
      <UiButton
        v-if="showBanner"
        size="sm"
        variant="ghost"
        @click="emit('dismiss')"
      >
        知道了
      </UiButton>
      <UiButton
        v-else-if="showVerify"
        size="sm"
        variant="outline"
        @click="emit('verify')"
      >
        已在维护？去验证
      </UiButton>
      <UiButton
        v-else-if="showOpenConfig"
        size="sm"
        variant="outline"
        @click="emit('openConfig')"
      >
        开启学习闭环
      </UiButton>
    </div>
  </section>
</template>
