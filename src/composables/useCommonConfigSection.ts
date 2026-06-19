import { onMounted, ref, watch } from "vue";
import { fetchCommonConfig, putCommonConfig } from "@/api/consoleApi";
import type { PluginConfigData } from "@/api/pallasTypes";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";
import {
  fieldValuesFromConfig,
  parsePluginConfigField,
} from "@/utils/pluginConfigFieldModel";

export interface UseCommonConfigSectionOptions {
  /** 通用配置段 id（如 "llm" / "arknights_kb"）。 */
  sectionId: string;
  /** 保存成功提示文案。 */
  savedMessage: string;
  /** 是否在 onMounted 时自动加载，默认 true。 */
  autoLoad?: boolean;
}

/**
 * 收敛通用配置段的 load / save / parse 样板。
 *
 * 此前 AiConfigModelSection、AiConfigKnowledgeSection 各自手写了一份
 * 「fetch → fieldValuesFromConfig → 编辑 → 逐字段 parse → put」的逻辑，
 * 仅段 id 和提示文案不同。抽到这里，section 只需渲染字段。
 */
export function useCommonConfigSection(options: UseCommonConfigSectionOptions) {
  const { sectionId, savedMessage, autoLoad = true } = options;

  const err = ref("");
  const data = ref<PluginConfigData | null>(null);
  const fieldValues = ref<Record<string, string>>({});
  const saving = ref(false);

  watch(data, (d) => {
    if (d) fieldValues.value = fieldValuesFromConfig(d.fields);
  });

  function setFieldValue(name: string, value: string) {
    fieldValues.value = { ...fieldValues.value, [name]: value };
  }

  async function load() {
    err.value = "";
    try {
      data.value = await fetchCommonConfig(sectionId);
    } catch (e) {
      err.value = e instanceof Error ? e.message : String(e);
      data.value = null;
    }
  }

  async function save() {
    if (!data.value) return;
    saving.value = true;
    err.value = "";
    try {
      const values: Record<string, unknown> = {};
      for (const f of data.value.fields) {
        const raw = fieldValues.value[f.name] ?? "";
        values[f.name] = parsePluginConfigField(f, raw);
      }
      data.value = await putCommonConfig(sectionId, values);
      toastSaveSuccess(savedMessage);
    } catch (e) {
      err.value = e instanceof Error ? e.message : String(e);
      toastApiError(e, "保存失败");
    } finally {
      saving.value = false;
    }
  }

  function canSave() {
    return Boolean(data.value) && !saving.value;
  }

  if (autoLoad) {
    onMounted(() => {
      void load();
    });
  }

  return { err, data, fieldValues, saving, setFieldValue, load, save, canSave };
}
