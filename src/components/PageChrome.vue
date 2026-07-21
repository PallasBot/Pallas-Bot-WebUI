<script setup lang="ts">
import { computed, useSlots } from "vue";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import type { ConsoleNavIconId } from "@/config/consoleNavIcons";

const props = withDefaults(
  defineProps<{
    /** 页面标题；也可用 `#title` 槽覆盖 */
    title?: string;
    /** 副文案；也可用 `#lead` 槽覆盖 */
    lead?: string;
    icon?: ConsoleNavIconId | string;
    /** 附加到 masthead 根节点（窄屏布局等） */
    chromeClass?: string;
  }>(),
  {
    title: "",
    lead: "",
    icon: undefined,
    chromeClass: "",
  },
);

const slots = useSlots();

const showLead = computed(() => Boolean(props.lead) || Boolean(slots.lead));
const showActions = computed(() => Boolean(slots.actions));
const showExtra = computed(() => Boolean(slots.extra));
</script>

<template>
  <ConsoleHubMasthead
    :icon="icon"
    :class="['page-chrome', chromeClass]"
  >
    <template #title>
      <slot name="title">{{ title }}</slot>
    </template>
    <template
      v-if="showLead"
      #lead
    >
      <slot name="lead">{{ lead }}</slot>
    </template>
    <template
      v-if="showExtra"
      #extra
    >
      <slot name="extra" />
    </template>
    <template
      v-if="showActions"
      #actions
    >
      <slot name="actions" />
    </template>
  </ConsoleHubMasthead>
</template>
