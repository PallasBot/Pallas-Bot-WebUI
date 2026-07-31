import { fetchHomeOverview } from "@/api/consoleApi";
import { fetchHealth } from "@/api/health";
import type { QueryClient } from "@tanstack/react-query";

/** 壳层挂载时并行预取，缩短总览/连接态等待 */
export function prefetchConsoleShell(qc: QueryClient): void {
  void qc.prefetchQuery({
    queryKey: ["health"],
    queryFn: () => fetchHealth(),
    staleTime: 10_000,
  });
  void qc.prefetchQuery({
    queryKey: ["home-overview"],
    queryFn: () => fetchHomeOverview(),
    staleTime: 10_000,
  });
}
