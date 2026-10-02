import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchInstances, fetchSystem, refreshInstancesCatalogGlobal } from "@/api/fullConsole";
import type { InstancesData, SystemData } from "@/api/pallasTypes";
import { isProtocolExtensionInstalled } from "@/utils/protocolExtension";
import { resolveProtocolMountUrl } from "@/utils/protocolMount";

export function useProtocolMount() {
  const queryClient = useQueryClient();
  const [reloadError, setReloadError] = useState<unknown>(null);
  const systemQ = useQuery({ queryKey: ["system"], queryFn: fetchSystem });
  const instQ = useQuery({ queryKey: ["instances"], queryFn: () => fetchInstances() });

  const instances = (instQ.data ?? null) as InstancesData | null;
  const system = (systemQ.data ?? null) as SystemData | null;
  const snap = instances?.pallas_protocol ?? instances?.napcat ?? null;
  const mountUrl = useMemo(
    () => resolveProtocolMountUrl(system, snap as Parameters<typeof resolveProtocolMountUrl>[1]),
    [system, snap],
  );
  const protocolExtensionInstalled = isProtocolExtensionInstalled(instances);
  const protoActionsEnabled = Boolean(mountUrl && snap?.webui_enabled);

  const pageReady = !systemQ.isLoading && !instQ.isLoading;
  const loadErr = reloadError || systemQ.error || instQ.error;
  const mountErr =
    pageReady && snap?.webui_enabled === true && !mountUrl
      ? "无法解析协议端挂载地址（请检查 webui_enabled 与 webui_path）"
      : null;

  async function reload() {
    setReloadError(null);
    try {
      const [systemResult, refreshedInstances] = await Promise.all([
        systemQ.refetch(),
        refreshInstancesCatalogGlobal(),
      ]);
      queryClient.setQueryData(["instances"], refreshedInstances);
      if (systemResult.isError) throw systemResult.error;
      await queryClient.invalidateQueries({ queryKey: ["home-overview"] });
    } catch (error) {
      setReloadError(error);
    }
  }

  return {
    pageReady,
    err: loadErr ? (loadErr instanceof Error ? loadErr.message : String(loadErr)) : mountErr,
    mountUrl,
    snap,
    system,
    instances,
    protocolExtensionInstalled,
    protoActionsEnabled,
    reload,
    isFetching: systemQ.isFetching || instQ.isFetching,
  };
}
