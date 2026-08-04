import { describe, expect, it } from "vitest";
import { ingressWorkQueueMetrics } from "@/utils/ingressDispatchWorkQueue";

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
