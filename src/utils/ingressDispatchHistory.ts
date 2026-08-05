import type { IngressDispatchHistoryData } from "@/api/pallasTypes";
import type { NamedSeriesInput } from "@/utils/namedSeriesTrend";

export type IngressPressurePoint = { at: number; queue: number; concurrency: number; work: number };

export function buildIngressHistoryView(history: IngressDispatchHistoryData | undefined): {
  latency: NamedSeriesInput[];
  learning: NamedSeriesInput[];
  pressure: IngressPressurePoint[];
} {
  const points = history?.points ?? [];
  return {
    latency: [
      { id: "ingress", label: "入站 P95", axis: "left", points: points.map((p) => ({ at: p.at, total: p.ingress_p95_ms })) },
      { id: "scheduler", label: "调度等待 P95", axis: "left", points: points.map((p) => ({ at: p.at, total: p.scheduler_wait_p95_ms })) },
    ],
    learning: [
      { id: "enqueued", label: "入队", points: points.map((p) => ({ at: p.at, total: p.learn_enqueued })) },
      { id: "persisted", label: "落库", points: points.map((p) => ({ at: p.at, total: p.learn_persisted })) },
      { id: "completed", label: "完成", points: points.map((p) => ({ at: p.at, total: p.work_completed })) },
    ],
    pressure: points.map((p) => ({
      at: p.at,
      queue: p.scheduler_pending,
      concurrency: p.scheduler_capacity > 0 ? Math.round((p.scheduler_active / p.scheduler_capacity) * 100) : 0,
      work: p.work_pending,
    })),
  };
}
