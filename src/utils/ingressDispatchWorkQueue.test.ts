import { describe, expect, it } from "vitest";

import { ingressPassiveMetrics } from "./ingressDispatchWorkQueue";

describe("ingressPassiveMetrics", () => {
  it("maps passive pool diagnostics and preserves zero defaults", () => {
    expect(
      ingressPassiveMetrics({
        active: 3,
        run_ms_p95: 1250.5,
        active_oldest_ms: 4200,
      }),
    ).toEqual({ active: 3, runP95Ms: 1250.5, activeOldestMs: 4200 });

    expect(ingressPassiveMetrics(undefined)).toEqual({
      active: 0,
      runP95Ms: 0,
      activeOldestMs: 0,
    });
  });
});
