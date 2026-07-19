<script setup lang="ts">
defineProps<{
  title: string;
  open: boolean;
  fieldCount?: number;
  grid?: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <section class="config-field-group">
    <div class="config-field-group__hd">
      <h3 class="config-field-group__title">
        {{ title }}
        <span
          v-if="fieldCount != null"
          class="config-field-group__count muted"
        >{{ fieldCount }} 项</span>
      </h3>
      <button
        type="button"
        class="btn panel-hd-collapse-btn"
        :aria-expanded="open"
        @click="emit('toggle')"
      >
        {{ open ? "收起" : "展开" }}
      </button>
    </div>
    <div
      v-show="open"
      class="config-field-group__bd"
      :class="{ 'config-field-group__bd--grid': grid }"
    >
      <slot />
    </div>
  </section>
</template>
