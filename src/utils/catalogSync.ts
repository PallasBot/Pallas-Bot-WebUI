import { ref } from "vue";

/** /instances 内存缓存更新时递增，供 keep-alive 页面同步本地 ref */
export const instancesCatalogEpoch = ref(0);

export function notifyInstancesCatalogUpdated(): void {
  instancesCatalogEpoch.value += 1;
}
