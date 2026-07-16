import { describe, expect, it } from "vitest";

import {
  accountSnowlumaNovncHref,
  accountWebUiHref,
  consolePublicRoot,
} from "../src/utils/protocolLinks";

describe("协议实例控制台反代链接", () => {
  const consolePath = new URL(consolePublicRoot()).pathname.replace(/\/$/, "");

  it("为协议 WebUI 生成控制台实例路径", () => {
    const href = accountWebUiHref({ id: "napcat 1", webui_port: 16099 } as never, null);

    expect(new URL(href!).pathname).toBe(
      `${consolePath}/protocol/instances/napcat%201/webui/`,
    );
  });

  it("为 SnowLuma noVNC 生成控制台实例路径", () => {
    const href = accountSnowlumaNovncHref(
      {
        id: "snowluma-1",
        snowluma_docker_novnc: { host_port: 16081 },
      } as never,
      null,
    );

    expect(new URL(href!).pathname).toBe(
      `${consolePath}/protocol/instances/snowluma-1/novnc/`,
    );
  });
});
