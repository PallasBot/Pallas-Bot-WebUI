<script setup lang="ts">
/**
 * 历史「会话」Fill 工作台：双栏内滚，由父页注入列表与详情。
 */
import PageFill from "@/components/PageFill.vue";
</script>

<template>
  <div class="ai-history-page__workspace ai-history-page__workspace--sessions ai-history-page__workspace--fill">
    <PageFill class="ai-history-page__sessions-fill">
      <section class="ai-history-split ai-hub-panel">
        <slot name="list" />
        <slot name="detail" />
      </section>
    </PageFill>
  </div>
</template>
