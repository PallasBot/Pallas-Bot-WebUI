<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>

<template>
  <div class="plugin-config-page__hero ai-history-page__workspace-hero">
    <div class="plugin-config-page__hero-text">
      <h2 class="plugin-config-page__hero-title">{{ title }}</h2>
      <p class="plugin-config-page__hero-desc">{{ description }}</p>
    </div>
  </div>
</template>
