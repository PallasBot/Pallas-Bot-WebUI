import { describe, expect, it } from "vitest";
import {
  applyDrawGatewaysToFieldValues,
  moveDrawGatewayRow,
  normalizeDrawCostCurrency,
  parseDrawGatewaysFromFieldValues,
  promoteDrawFallbackToPrimary,
} from "@/utils/drawGateways";

const baseRow = {
  name: "",
  base_url: "",
  api_key: "",
  model: "",
  omit_response_format: false,
  cost_per_image: 0,
} as const;

describe("drawGateways", () => {
  it("parses primary provider inherit and fallbacks", () => {
    const rows = parseDrawGatewaysFromFieldValues({
      pallas_image_provider_id: "openai",
      pallas_image_primary_name: "主",
      pallas_image_model: "gpt-image-2",
      pallas_image_cost_per_image: "0.04",
      pallas_image_api_backends: JSON.stringify([
        { provider_id: "backup", name: "备", cost_per_image: 0.12 },
        { base_url: "https://b.example/", api_key: "sk-b", model: "m2" },
      ]),
    });
    expect(rows).toHaveLength(3);
    expect(rows[0].provider_id).toBe("openai");
    expect(rows[0].cost_per_image).toBe(0.04);
    expect(rows[1].provider_id).toBe("backup");
    expect(rows[1].cost_per_image).toBe(0.12);
    expect(rows[2].base_url).toBe("https://b.example/");
  });

  it("applies inherit primary and clears manual credentials", () => {
    const patch = applyDrawGatewaysToFieldValues(
      {},
      [
        {
          id: "primary",
          role: "primary",
          name: "主",
          provider_id: "openai",
          base_url: "https://should-clear/",
          api_key: "sk-clear",
          model: "img",
          omit_response_format: false,
          cost_per_image: 0.05,
        },
        {
          id: "fallback-0",
          role: "fallback",
          name: "",
          provider_id: "backup",
          base_url: "",
          api_key: "",
          model: "",
          omit_response_format: true,
          cost_per_image: 0.2,
        },
      ],
    );
    expect(patch.pallas_image_provider_id).toBe("openai");
    expect(patch.pallas_image_base_url).toBe("");
    expect(patch.pallas_image_api_key).toBe("");
    expect(patch.pallas_image_model).toBe("img");
    expect(patch.pallas_image_cost_per_image).toBe("0.05");
    const backends = JSON.parse(patch.pallas_image_api_backends) as Array<Record<string, unknown>>;
    expect(backends).toEqual([
      { provider_id: "backup", omit_response_format: true, cost_per_image: 0.2 },
    ]);
  });

  it("normalizes cost currency", () => {
    expect(normalizeDrawCostCurrency(" cny ")).toBe("CNY");
    expect(normalizeDrawCostCurrency("")).toBe("");
  });

  it("promotes fallback to primary", () => {
    const next = promoteDrawFallbackToPrimary(
      [
        {
          id: "primary",
          role: "primary",
          ...baseRow,
          name: "A",
          provider_id: "a",
          model: "m1",
        },
        {
          id: "fallback-0",
          role: "fallback",
          ...baseRow,
          name: "B",
          provider_id: "b",
          model: "m2",
        },
      ],
      "fallback-0",
    );
    expect(next[0].provider_id).toBe("b");
    expect(next[0].role).toBe("primary");
    expect(next[1].provider_id).toBe("a");
    expect(next[1].role).toBe("fallback");
  });

  it("moves chip order to redefine primary", () => {
    const next = moveDrawGatewayRow(
      [
        {
          id: "primary",
          role: "primary",
          ...baseRow,
          name: "A",
          provider_id: "a",
        },
        {
          id: "fallback-0",
          role: "fallback",
          ...baseRow,
          name: "B",
          provider_id: "b",
        },
        {
          id: "fallback-1",
          role: "fallback",
          ...baseRow,
          name: "C",
          provider_id: "c",
          omit_response_format: true,
        },
      ],
      2,
      0,
    );
    expect(next.map((r) => r.provider_id)).toEqual(["c", "a", "b"]);
    expect(next[0].role).toBe("primary");
    expect(next[0].omit_response_format).toBe(false);
    expect(next[1].role).toBe("fallback");
    expect(next[2].role).toBe("fallback");
  });
});
