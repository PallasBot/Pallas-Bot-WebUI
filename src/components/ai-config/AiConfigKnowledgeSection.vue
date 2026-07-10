<script setup lang="ts">
import { useRouter } from "vue-router";
import ConfigFieldRenderer from "@/components/config/ConfigFieldRenderer.vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { useCommonConfigSection } from "@/composables/useCommonConfigSection";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const panelNavIcon = usePanelNavIcon();
const router = useRouter();
const { err, data, fieldValues, saving, setFieldValue, save, canSave } = useCommonConfigSection({
  sectionId: "arknights_kb",
  savedMessage: "方舟知识库配置已保存",
});

defineExpose({ save, canSave, saving });
</script>

<template>
  <div class="ai-config-section ai-config-section--knowledge">
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
          />方舟知识库
        </h2>
        <div class="row-actions">
          <UiButton
            variant="primary"
            :disabled="saving || !data"
            :busy="saving"
            title="Ctrl+S"
            @click="save"
          >
            {{ saving ? "保存中…" : "保存" }}
          </UiButton>
        </div>
      </div>
      <div class="panel__bd">
        <p class="muted ai-config-section__intro">
          为 LLM 工具提供干员/敌人结构化查询；关闭后相关 tool 不可用。数据与决斗插件共用
          <code>resource/arknights/</code>，缺数据时可后台自动同步。
        </p>
        <div
          v-if="err"
          class="alert alert--err"
          style="margin-bottom: 12px"
        >
          {{ err }}
        </div>
        <template v-if="data">
          <ConfigFieldRenderer
            v-for="f in data.fields"
            :key="f.name"
            :field="f"
            :model-value="fieldValues[f.name] ?? ''"
            :show-meta="false"
            @update:model-value="(v) => setFieldValue(f.name, v)"
          />
        </template>
      </div>
    </UiCard>

    <UiCard
      tag="div"
      glass
      class="ai-config-section__panel"
    >
      <div class="panel__hd">
        <h2 class="panel__title">
          <ConsoleNavIcon
            class="panel__title-ico"
            name="globe"
          />接话语料与记忆
        </h2>
      </div>
      <div class="panel__bd">
        <p class="muted ai-config-section__intro">
          <strong>群记忆 RAG</strong>（「记住：…」）在「模型与对话」的 Bot 对话策略中配置。
          社区共享语料与回填策略见<strong>牛牛核心</strong>插件配置；热词与同步状态在「统计与语料」页查看。
        </p>
        <div class="row-actions ai-config-section__links">
          <UiButton
            variant="outline"
            @click="router.push({ name: 'plugins', params: { name: 'pb_core' } })"
          >
            接话语料（牛牛核心）
          </UiButton>
          <UiButton
            variant="outline"
            @click="router.push({ name: 'community' })"
          >
            统计与语料
          </UiButton>
        </div>
      </div>
    </UiCard>
  </div>
</template>
