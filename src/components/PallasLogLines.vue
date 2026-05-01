<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    lines: string[];
    emptyText?: string;
  }>(),
  { emptyText: "（暂无输出）" },
);

/** 与后端 bot_web 环缓冲中的「| LEVEL |」片段对齐，用于着色 */
function lineClass(line: string): string {
  const u = line.toUpperCase();
  const pipeLevel = (lvl: string) => u.includes(`| ${lvl} |`);
  if (pipeLevel("TRACE")) return "log-line log-line--trace";
  if (pipeLevel("DEBUG")) return "log-line log-line--debug";
  if (pipeLevel("SUCCESS")) return "log-line log-line--success";
  if (pipeLevel("INFO")) return "log-line log-line--info";
  if (pipeLevel("WARNING")) return "log-line log-line--warn";
  if (pipeLevel("ERROR") || pipeLevel("CRITICAL")) return "log-line log-line--error";
  return "log-line log-line--plain";
}
</script>

<template>
  <div class="pallas-log-lines">
    <template v-if="props.lines.length">
      <div v-for="(line, i) in props.lines" :key="i" :class="lineClass(line)">
        {{ line }}
      </div>
    </template>
    <div v-else class="log-line log-line--empty">
      {{ props.emptyText }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.pallas-log-lines {
  margin: 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, Consolas, monospace;
}
.log-line {
  margin: 0;
  padding: 0;
}
.log-line--trace,
.log-line--debug {
  color: var(--el-text-color-secondary);
}
.log-line--info {
  color: var(--el-text-color-regular);
}
.log-line--success {
  color: var(--el-color-success);
}
.log-line--warn {
  color: var(--el-color-warning);
}
.log-line--error {
  color: var(--el-color-danger);
  font-weight: 600;
}
.log-line--plain {
  color: var(--el-text-color-regular);
}
.log-line--empty {
  color: var(--el-text-color-placeholder);
}
</style>
