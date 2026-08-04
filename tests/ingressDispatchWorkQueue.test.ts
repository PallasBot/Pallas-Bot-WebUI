import { describe, expect, it } from "vitest";
import { ingressWorkAuxMetrics, ingressWorkQueueMetrics } from "@/utils/ingressDispatchWorkQueue";

describe("ingressWorkQueueMetrics", () => {
  it("reads buffered learning queue counters from ingress hotpath metrics", () => {
    expect(
      ingressWorkQueueMetrics({
        learn_buffered: 120,
        learn_persisted: 96,
        learn_skipped_full: 3,
        learn_dropped_shutdown: 2,
      }),
    ).toEqual({ buffered: 120, persisted: 96, droppedFull: 3, droppedShutdown: 2 });
  });

  it("uses zero for an unavailable hotpath payload", () => {
    expect(ingressWorkQueueMetrics(undefined)).toEqual({ buffered: 0, persisted: 0, droppedFull: 0, droppedShutdown: 0 });
  });
});

describe("ingressWorkAuxMetrics", () => {
  it("reads shared work aux status", () => {
    expect(ingressWorkAuxMetrics({ pending: 4, leased: 2, oldest_pending_age_sec: 18.5, consumers: 3, heartbeat_age_sec: 2.1 })).toEqual({ pending: 4, leased: 2, oldestPendingAgeSec: 18.5, consumers: 3, heartbeatAgeSec: 2.1 });
  });
});
