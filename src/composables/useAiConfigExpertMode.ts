import { computed, ref, watch } from "vue";

export const AI_CONFIG_EXPERT_MODE_KEY = "pallas.aiConfig.expertMode";

function readExpertMode(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(AI_CONFIG_EXPERT_MODE_KEY) === "1";
}

export function useAiConfigExpertMode() {
  const expertMode = ref(readExpertMode());

  watch(expertMode, (value) => {
    if (typeof localStorage === "undefined") return;
    if (value) localStorage.setItem(AI_CONFIG_EXPERT_MODE_KEY, "1");
    else localStorage.removeItem(AI_CONFIG_EXPERT_MODE_KEY);
  });

  function setExpertMode(value: boolean) {
    expertMode.value = value;
  }

  const isSimpleMode = computed(() => !expertMode.value);

  return {
    expertMode,
    isSimpleMode,
    setExpertMode,
  };
}
