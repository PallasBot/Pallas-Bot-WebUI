import { describe, expect, it } from "vitest";
import {
  buildSvcBackendIdList,
  buildSvcBackendSelectOptions,
  svcBackendLabel,
} from "./svcBackendOptions";

describe("svcBackendOptions", () => {
  it("labels known backends including rvc", () => {
    expect(svcBackendLabel("rvc")).toBe("RVC");
    expect(svcBackendLabel("ddsp_6.2")).toBe("DDSP-SVC 6.2");
  });

  it("always includes rvc even when API omits it", () => {
    const opts = buildSvcBackendSelectOptions([
      { id: "ddsp_6.2", enabled: true, script_present: true },
    ]);
    expect(opts.map((o) => o.value)).toContain("rvc");
    const rvc = opts.find((o) => o.value === "rvc");
    expect(rvc?.label).toBe("RVC");
    expect(rvc?.description).toMatch(/需 AI Runtime 支持/);
  });

  it("prefers speaker-compatible backends first", () => {
    const opts = buildSvcBackendSelectOptions(
      [
        { id: "ddsp_6.2", script_present: true },
        { id: "rvc", script_present: true, arg_style: "rvc" },
      ],
      ["rvc"],
    );
    expect(opts[0]?.value).toBe("rvc");
    expect(opts[0]?.description).toMatch(/该音色可用/);
  });

  it("buildSvcBackendIdList mirrors select values", () => {
    expect(buildSvcBackendIdList([{ id: "rvc" }])).toContain("rvc");
    expect(buildSvcBackendIdList([{ id: "rvc" }])).toContain("ddsp_6.2");
  });
});
