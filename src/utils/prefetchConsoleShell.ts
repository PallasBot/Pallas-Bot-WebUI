import { fetchHomeOverview } from "@/api/consoleApi";
import { fetchCommunityStats, fetchCorpusStatus } from "@/api/fullConsole";
import { fetchHealth } from "@/api/health";
import type { QueryClient } from "@tanstack/react-query";

/** 壳层挂载时并行预取，缩短总览/连接态/社区页等待 */
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
  // 统计与语料默认区依赖；与 overview 内 community_stats 同 Bot 缓存键，可互相命中
  void qc.prefetchQuery({
    queryKey: ["community-stats"],
    queryFn: () => fetchCommunityStats({}),
    staleTime: 30_000,
  });
  void qc.prefetchQuery({
    queryKey: ["corpus-status"],
    queryFn: fetchCorpusStatus,
    staleTime: 15_000,
  });
}
