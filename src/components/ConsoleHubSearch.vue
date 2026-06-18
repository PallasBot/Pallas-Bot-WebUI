<script setup lang="ts">
const model = defineModel<string>({ default: "" });

withDefaults(
  defineProps<{
    placeholder?: string;
    ariaLabel?: string;
  }>(),
  {
    placeholder: "搜索…",
  },
);
</script>

<template>
  <div class="console-hub-page__search-card">
    <label class="console-hub-page__search">
      <span
        class="console-hub-page__search-ico"
        aria-hidden="true"
      >
        <svg
          class="console-hub-page__search-svg"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="7"
            cy="7"
            r="4.25"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M10.25 10.25L13.5 13.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </span>
      <input
        v-model="model"
        class="inp console-hub-page__search-input"
        type="search"
        :placeholder="placeholder"
        :aria-label="ariaLabel || placeholder"
        autocomplete="off"
      >
    </label>
  </div>
</template>
