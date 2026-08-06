import { describe, expect, it } from "vitest";
import { buildIngressHistoryView, DEFAULT_INGRESS_HISTORY_WINDOW_SEC, INGRESS_HISTORY_WINDOWS } from "@/utils/ingressDispatchHistory";

describe("buildIngressHistoryView", () => {
  it("defaults to one hour while retaining the seven-day review window", () => {
    expect(DEFAULT_INGRESS_HISTORY_WINDOW_SEC).toBe(60 * 60);
    expect(INGRESS_HISTORY_WINDOWS.map((window) => window.seconds)).toContain(7 * 24 * 60 * 60);
  });

  it("builds latency, learning, and pressure series from persisted buckets", () => {
    const view = buildIngressHistoryView({
      retention_sec: 604800,
      bucket_sec: 15,
      points: [
        {
          at: 100,
          ingress_p95_ms: 1200,
          scheduler_wait_p95_ms: 600,
          scheduler_pending: 5,
          scheduler_active: 4,
          scheduler_capacity: 8,
          work_pending: 2,
          work_leased: 1,
          group_messages: 20,
          learn_enqueued: 6,
          learn_persisted: 5,
          work_completed: 4,
        },
      ],
    });

    expect(view.latency).toEqual([
      { id: "ingress", label: "入站 P95", axis: "left", points: [{ at: 100, total: 1200 }] },
      { id: "scheduler", label: "调度等待 P95", axis: "left", points: [{ at: 100, total: 600 }] },
    ]);
    expect(view.learning.map((row) => row.points[0]?.total)).toEqual([6, 5, 4]);
    expect(view.pressure).toEqual([
      {
        at: 100,
        ingressP95: 1200,
        schedulerWaitP95: 600,
        queue: 5,
        concurrency: 50,
        learnEnqueued: 6,
        work: 2,
      },
    ]);
  });
});
