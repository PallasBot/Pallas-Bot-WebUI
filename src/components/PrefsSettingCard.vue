<script setup lang="ts">
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import type { ConsoleNavIconId } from "@/config/consoleNavIcons";

withDefaults(
  defineProps<{
    icon?: ConsoleNavIconId | string;
    title: string;
    lead?: string;
    wide?: boolean;
    cardId?: string;
  }>(),
  {
    icon: "dashboard",
    lead: "",
    wide: false,
    cardId: "",
  },
);
</script>

<template>
  <section
    :id="cardId || undefined"
    class="prefs-setting-card panel"
    :class="{ 'prefs-setting-card--wide': wide }"
  >
    <header class="prefs-setting-card__hd">
      <div class="prefs-setting-card__head-text">
        <h3 class="panel__title prefs-setting-card__title">
          <ConsoleNavIcon
            class="panel__title-ico"
            :name="icon"
          />{{ title }}
        </h3>
        <p
          v-if="lead"
          class="prefs-setting-card__lead muted"
        >
          {{ lead }}
        </p>
      </div>
    </header>
    <div class="prefs-setting-card__bd">
      <slot />
    </div>
  </section>
</template>
