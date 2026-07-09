import { describe, expect, it } from "vitest";
import {
  applyGatewaysToFieldValues,
  parseGatewaysFromFieldValues,
  promoteFallbackToPrimary,
  type PallasImageGatewayRow,
} from "@/utils/pallasImageGateways";

function row(
  partial: Partial<PallasImageGatewayRow> & Pick<PallasImageGatewayRow, "id" | "role" | "base_url">,
): PallasImageGatewayRow {
  return {
    name: "",
    api_key: "key",
    model: "",
    omit_response_format: false,
    ...partial,
  };
}

describe("promoteFallbackToPrimary", () => {
  it("swaps selected fallback with primary and keeps other fallbacks", () => {
    const rows: PallasImageGatewayRow[] = [
      row({ id: "primary", role: "primary", name: "HoldAI", base_url: "https://primary.example/", api_key: "pk", model: "m1" }),
      row({ id: "fallback-0", role: "fallback", name: "SSY", base_url: "https://fb0.example/", api_key: "fk0", model: "m2" }),
      row({
        id: "fallback-1",
        role: "fallback",
        name: "Other",
        base_url: "https://fb1.example/",
        api_key: "fk1",
        omit_response_format: true,
      }),
    ];

    const next = promoteFallbackToPrimary(rows, "fallback-0");
    expect(next.map((r) => [r.role, r.base_url, r.api_key])).toEqual([
      ["primary", "https://fb0.example/", "fk0"],
      ["fallback", "https://primary.example/", "pk"],
      ["fallback", "https://fb1.example/", "fk1"],
    ]);
    expect(next[0]?.model).toBe("m2");
    expect(next[1]?.model).toBe("m1");
    expect(next[1]?.omit_response_format).toBe(false);
    expect(next[2]?.omit_response_format).toBe(true);

    const fv = applyGatewaysToFieldValues({}, next);
    expect(fv.pallas_image_base_url).toBe("https://fb0.example/");
    expect(fv.pallas_image_api_key).toBe("fk0");
    expect(fv.pallas_image_model).toBe("m2");
    const parsed = parseGatewaysFromFieldValues(fv);
    expect(parsed[0]?.base_url).toBe("https://fb0.example/");
    expect(parsed[1]?.base_url).toBe("https://primary.example/");
  });

  it("no-ops when id is missing or already primary", () => {
    const rows: PallasImageGatewayRow[] = [
      row({ id: "primary", role: "primary", base_url: "https://primary.example/" }),
      row({ id: "fallback-0", role: "fallback", base_url: "https://fb0.example/" }),
    ];
    expect(promoteFallbackToPrimary(rows, "primary")).toBe(rows);
    expect(promoteFallbackToPrimary(rows, "missing")).toBe(rows);
  });
});
