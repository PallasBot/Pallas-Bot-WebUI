import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { botRestartPhaseLabel, waitForBotRestartOnline } from "@/utils/botRestartProgress";
import { normalizeBundledReadmeMarkdown } from "@/utils/pluginReadme";

vi.mock("@/api/health", () => ({
  fetchHealth: vi.fn(),
}));

import { fetchHealth } from "@/api/health";

const fetchHealthMock = vi.mocked(fetchHealth);

describe("botRestartPhaseLabel", () => {
  it("describes reconnecting phase", () => {
    expect(botRestartPhaseLabel("reconnecting")).toContain("探测");
  });
});

describe("waitForBotRestartOnline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchHealthMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ignores health ok until bot went offline once", async () => {
    const phases: string[] = [];
    fetchHealthMock
      .mockResolvedValueOnce({ ok: true } as never)
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({ ok: true } as never);

    const promise = waitForBotRestartOnline({
      pollMs: 1000,
      onPhase: (phase) => phases.push(phase),
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).resolves.toBe(true);
    expect(phases).toContain("scheduled");
    expect(phases).toContain("disconnecting");
    expect(phases).toContain("online");
    expect(phases.indexOf("online")).toBeGreaterThan(phases.indexOf("disconnecting"));
  });
});

describe("normalizeBundledReadmeMarkdown", () => {
  it("rewrites bundled asset paths to console static", () => {
    expect(normalizeBundledReadmeMarkdown('<img src="../assets/brand-avatar.png">')).toContain(
      "/pallas/assets/brand-avatar.png",
    );
  });
});
