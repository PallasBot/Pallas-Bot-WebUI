<script setup lang="ts">
import type { ConsoleDailyStatRow } from "@/api/pallasTypes";
import GsDualAxisTrendChart from "@/components/GsDualAxisTrendChart.vue";

withDefaults(
  defineProps<{
    rows: ConsoleDailyStatRow[];
    emptyText?: string;
    busy?: boolean;
  }>(),
  {
    emptyText: "所选月份暂无持久化数据，请保持 Bot 运行并跨日写入。",
    busy: false,
  },
);
</script>

<template>
  <GsDualAxisTrendChart
    chart-uid="charts-monthly-cmd"
    class="charts-monthly-cmd"
    :rows="rows"
    :empty-text="emptyText"
    :busy="busy"
    :show-summary="true"
  />
</template>
