import { describe, expect, it, vi } from "vitest";
import { waitForInstallJob } from "@/utils/installJobStream";

describe("waitForInstallJob", () => {
  it("resolves on complete event", async () => {
    let messageHandler: ((ev: MessageEvent) => void) | undefined;
    const openStream = vi.fn(() => {
      const source = {
        close: vi.fn(),
        set onmessage(fn: (ev: MessageEvent) => void) {
          messageHandler = fn;
        },
        set onerror(_fn: () => void) {},
      };
      queueMicrotask(() => {
        messageHandler?.({
          data: JSON.stringify({
            type: "complete",
            phase: "done",
            message: "ok",
            result: { message: "ok" },
          }),
        } as MessageEvent);
      });
      return source as unknown as EventSource;
    });

    await expect(waitForInstallJob("job-1", openStream)).resolves.toMatchObject({
      type: "complete",
      phase: "done",
    });
  });
});
