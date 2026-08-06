import { describe, expect, it } from "vitest";
import { ingressCapacityMetrics, ingressSchedulerMetrics, ingressWorkAuxMetrics, ingressWorkQueueMetrics } from "@/utils/ingressDispatchWorkQueue";

describe("ingressWorkQueueMetrics", () => {
  it("reads buffered learning queue counters from ingress hotpath metrics", () => {
    expect(
      ingressWorkQueueMetrics({
        learn_enqueued: 124,
        learn_buffered: 120,
        learn_persisted: 96,
        learn_skipped_full: 3,
        learn_dropped_shutdown: 2,
      }),
    ).toEqual({ enqueued: 124, buffered: 120, persisted: 96, droppedFull: 3, droppedShutdown: 2 });
  });

  it("uses zero for an unavailable hotpath payload", () => {
    expect(ingressWorkQueueMetrics(undefined)).toEqual({ enqueued: 0, buffered: 0, persisted: 0, droppedFull: 0, droppedShutdown: 0 });
  });
});

describe("ingressWorkAuxMetrics", () => {
  it("reads shared work aux status", () => {
    expect(
      ingressWorkAuxMetrics({
        pending: 4,
        leased: 2,
        oldest_pending_age_sec: 18.5,
        consumers: 3,
        heartbeat_age_sec: 2.1,
        completed_since_start: 96,
        failed_since_start: 2,
        retried_since_start: 2,
        dead_lettered_since_start: 1,
      }),
    ).toEqual({
      pending: 4,
      leased: 2,
      oldestPendingAgeSec: 18.5,
      consumers: 3,
      heartbeatAgeSec: 2.1,
      completedSinceStart: 96,
      failedSinceStart: 2,
      retriedSinceStart: 2,
      deadLetteredSinceStart: 1,
    });
  });
});

describe("ingressSchedulerMetrics", () => {
  it("reads current and peak scheduler pressure", () => {
    expect(
      ingressSchedulerMetrics({
        pending: 2,
        pending_peak: 20,
        active: 4,
        active_peak: 8,
        ready_peak: 6,
        wait_ms_p95: 451.2,
        backpressure_waits: 3,
      }),
    ).toEqual({ pending: 2, pendingPeak: 20, active: 4, activePeak: 8, readyPeak: 6, waitP95Ms: 451.2, backpressureWaits: 3 });
  });
});

describe("ingressCapacityMetrics", () => {
  it("reports actual matcher completion and chat lane occupancy", () => {
    expect(
      ingressCapacityMetrics({ chat: { limit: 8, in_use: 6 } }, { selected: 100, completed: 92, laneBusy: 3 }),
    ).toEqual({ completionRate: 0.92, completed: 92, selected: 100, laneBusy: 3, chatInUse: 6, chatLimit: 8 });
  });

  it("keeps unavailable completion rate distinct from zero", () => {
    expect(ingressCapacityMetrics(undefined, { selected: 0, completed: 0, laneBusy: 0 }).completionRate).toBeNull();
  });
});
