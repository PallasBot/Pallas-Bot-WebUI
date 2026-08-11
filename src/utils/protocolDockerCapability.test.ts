import { describe, expect, it } from "vitest";
import { dockerCapabilityHint } from "./protocolDockerPull";

describe("dockerCapabilityHint", () => {
  it.each([
    ["cli_missing", "Docker CLI"],
    ["socket_missing", "docker.sock"],
    ["permission_denied", "权限"],
    ["daemon_unreachable", "daemon"],
  ])("maps %s to actionable guidance", (status, expected) => {
    expect(
      dockerCapabilityHint({ status, ready: false, message: `backend: ${expected}` }),
    ).toContain(expected);
  });

  it("shows the connected server version", () => {
    expect(
      dockerCapabilityHint({
        status: "ready",
        ready: true,
        message: "Docker daemon 可用",
        server_version: "28.3.3",
      }),
    ).toContain("28.3.3");
  });
});
