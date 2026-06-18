<script setup lang="ts">
import { ref } from "vue";
import { fetchAiExtensionLogs } from "@/api/consoleApi";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const panelNavIcon = usePanelNavIcon();
const logKind = ref<"uvicorn" | "celery">("uvicorn");
const logOut = ref("");
const logErr = ref("");

async function loadLogs() {
  logErr.value = "";
  logOut.value = "";
  try {
    const r = await fetchAiExtensionLogs(logKind.value, 200);
    logOut.value = JSON.stringify(r, null, 2);
  } catch (e) {
    logErr.value = e instanceof Error ? e.message : String(e);
  }
}
</script>

<template>
  <UiCard
    tag="div"
    glass
    class="ai-config-section__panel"
  >
    <div class="panel__hd panel__hd--split">
      <h2 class="panel__title">
        <ConsoleNavIcon
          class="panel__title-ico"
          :name="panelNavIcon"
        />扩展日志
      </h2>
      <div class="row-actions">
        <select
          v-model="logKind"
          class="sel"
        >
          <option value="uvicorn">Web 服务（uvicorn）</option>
          <option value="celery">任务队列（celery）</option>
        </select>
        <UiButton
          variant="primary"
          @click="loadLogs"
        >
          拉取
        </UiButton>
      </div>
    </div>
    <div class="panel__bd">
      <p
        v-if="!logOut && !logErr"
        class="muted ai-config-section__intro"
      >
        选择日志类型后点「拉取」，读取扩展服务最近约 200 行日志（JSON）。路径在「扩展连接」配置。
      </p>
      <div
        v-if="logErr"
        class="alert alert--err"
        style="margin-bottom: 10px"
      >
        {{ logErr }}
      </div>
      <pre
        v-if="logOut"
        class="pre-block"
      >{{ logOut }}</pre>
    </div>
  </UiCard>
</template>
