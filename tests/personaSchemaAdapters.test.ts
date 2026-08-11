import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("persona schema adapters", () => {
  it("锁定账号四轴与群表达字段边界", () => {
    const source = readFileSync(resolve(process.cwd(), "src/api/pallasTypes.ts"), "utf8");
    for (const field of ["energy", "warmth", "mischief", "restraint", "source"]) {
      expect(source).toContain(`${field}:`);
    }
    for (const field of ["aggregate", "examples_summary", "reply_shape"]) {
      expect(source).toContain(`${field}:`);
    }
    for (const field of ["sample_count", "direct_example_count", "bubble_count_p50"]) {
      expect(source).toContain(`${field}:`);
    }
    expect(source).toContain("message_length?: MessageLengthDistribution");
    const lengthStart = source.indexOf("export interface MessageLengthDistribution");
    const lengthBlock = source.slice(lengthStart, source.indexOf("}", lengthStart));
    expect(lengthBlock).toContain("average: number");
    expect(lengthBlock).not.toContain("avg?: number");
    expect(source).toContain("interface LegacyGroupStyleProfile");
  });
});
