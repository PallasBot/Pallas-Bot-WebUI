import { computed, onMounted, ref } from "vue";
import { fetchInstances, fetchSystem } from "@/api/consoleApi";
import { isProtocolExtensionInstalled } from "@/utils/protocolExtension";
import { protocolMountAbsoluteUrl, protocolSnapshot } from "@/utils/protocolLinks";

export function useProtocolMount() {
  const err = ref("");
  const pageReady = ref(false);
  const mountUrl = ref<string | null>(null);
  const instances = ref<Awaited<ReturnType<typeof fetchInstances>> | null>(null);
  const system = ref<Awaited<ReturnType<typeof fetchSystem>> | null>(null);
  const protocolExtensionInstalled = computed(() =>
    isProtocolExtensionInstalled(instances.value),
  );
  const protocolNotInstalled = computed(() => !protocolExtensionInstalled.value);

  async function loadMount() {
    err.value = "";
    try {
      const [s, i] = await Promise.all([fetchSystem(), fetchInstances()]);
      system.value = s;
      instances.value = i;
      mountUrl.value = protocolMountAbsoluteUrl(s, protocolSnapshot(i));
      if (!mountUrl.value && !protocolNotInstalled.value) {
        err.value = "无法解析协议端挂载地址（请检查 webui_enabled 与 webui_path）";
      }
    } catch (e) {
      err.value = e instanceof Error ? e.message : String(e);
    } finally {
      pageReady.value = true;
    }
  }

  onMounted(() => {
    void loadMount();
  });

  return {
    err,
    pageReady,
    mountUrl,
    protocolExtensionInstalled,
    protocolNotInstalled,
    instances,
    system,
    reload: loadMount,
  };
}
