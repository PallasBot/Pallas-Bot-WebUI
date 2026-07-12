import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBaseUrl,
  parseBaseUrlParts,
  useAiExtensionConnection,
} from "../src/composables/useAiExtensionConnection";

const mocks = vi.hoisted(() => ({
  postAiExtensionTest: vi.fn(),
  pushConsoleToast: vi.fn(),
}));

vi.mock("../src/api/consoleApi", () => ({
  fetchAiExtensionConfig: vi.fn(),
  postAiExtensionTest: mocks.postAiExtensionTest,
  putAiExtensionConfig: vi.fn(),
}));

vi.mock("../src/utils/consoleToast", () => ({
  pushConsoleToast: mocks.pushConsoleToast,
}));

vi.mock("../src/utils/consoleToastFeedback", () => ({
  toastApiError: vi.fn(),
  toastSaveSuccess: vi.fn(),
}));

describe("ai extension connection helpers", () => {
  beforeEach(() => {
    mocks.postAiExtensionTest.mockReset();
    mocks.pushConsoleToast.mockReset();
  });

  it("parses a full https base url into scheme and host", () => {
    expect(parseBaseUrlParts("https://ai.example.com:9443/api")).toEqual({
      scheme: "https",
      hostPort: "ai.example.com:9443",
    });
  });

  it("falls back to http when only a host and port are provided", () => {
    expect(parseBaseUrlParts("127.0.0.1:9099/status")).toEqual({
      scheme: "http",
      hostPort: "127.0.0.1:9099",
    });
  });

  it("uses the default host when building an empty base url", () => {
    expect(buildBaseUrl("http", "  ")).toBe("http://127.0.0.1:9099");
  });

  it("can run a silent status test without success toast", async () => {
    mocks.postAiExtensionTest.mockResolvedValueOnce({ reachable: true, latency_ms: 18 });
    const connection = useAiExtensionConnection();

    await connection.runTest({ quiet: true });

    expect(connection.testOut.value).toEqual({ reachable: true, latency_ms: 18 });
    expect(mocks.pushConsoleToast).not.toHaveBeenCalled();
  });
});
