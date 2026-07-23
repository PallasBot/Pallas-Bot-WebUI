import type { InstancesData } from "@/api/pallasTypes";

/** 官方扩展 pallas-plugin-protocol 是否已安装并可加载 */
export function isProtocolExtensionInstalled(
  data: InstancesData | null | undefined,
): boolean {
  return data?.protocol_extension?.installed === true;
}
