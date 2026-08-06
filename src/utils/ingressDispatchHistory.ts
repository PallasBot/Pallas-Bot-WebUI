import type { IngressDispatchHistoryData } from "@/api/pallasTypes";
import type { NamedSeriesInput } from "@/utils/namedSeriesTrend";

export type IngressPressurePoint = {
  at: number;
  ingressP95: number;
  schedulerWaitP95: number;
  queue: number;
  concurrency: number;
  learnEnqueued: number;
  work: number;
};

export const INGRESS_HISTORY_WINDOWS = [
  { label: "15 分钟", seconds: 15 * 60 },
  { label: "1 小时", seconds: 60 * 60 },
  { label: "6 小时", seconds: 6 * 60 * 60 },
  { label: "24 小时", seconds: 24 * 60 * 60 },
  { label: "7 天", seconds: 7 * 24 * 60 * 60 },
] as const;

export const DEFAULT_INGRESS_HISTORY_WINDOW_SEC = 60 * 60;

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
      ingressP95: p.ingress_p95_ms,
      schedulerWaitP95: p.scheduler_wait_p95_ms,
      queue: p.scheduler_pending,
      concurrency: p.scheduler_capacity > 0 ? Math.round((p.scheduler_active / p.scheduler_capacity) * 100) : 0,
      learnEnqueued: p.learn_enqueued,
      work: p.work_pending,
    })),
  };
}
