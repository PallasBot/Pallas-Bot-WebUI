import { describe, expect, it, vi } from "vitest";

vi.mock("./consoleOpenapiClient", () => ({
  consoleOpenapiDelete: vi.fn(),
  consoleOpenapiGet: vi.fn(),
  consoleOpenapiPatch: vi.fn(),
  consoleOpenapiPost: vi.fn(),
  consoleOpenapiPut: vi.fn(),
}));

import { consoleOpenapiGet } from "./consoleOpenapiClient";
import { fetchIngressDispatch } from "./consoleApi";

describe("fetchIngressDispatch", () => {
  it("loads ingress dispatch metrics from the console endpoint", async () => {
    const payload = {
      group_messages: 12,
      command_traffic: 4,
      chatter_traffic: 8,
    };
    vi.mocked(consoleOpenapiGet).mockResolvedValueOnce(payload);

    await expect(fetchIngressDispatch()).resolves.toEqual(payload);
    expect(consoleOpenapiGet).toHaveBeenCalledWith("/ingress-dispatch");
  });
});
