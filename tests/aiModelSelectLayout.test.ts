import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const aiConfigField = readFileSync(resolve(process.cwd(), "src/components/ai/AiConfigField.tsx"), "utf8");

describe("模型发现浮层", () => {
  it("将刷新列表与模型输入框放在同一行", () => {
    const inputRow = aiConfigField.match(/<div className="ai-model-select__input-row[^>]*>[\s\S]*?<\/div>\n\s*<\/div>/)?.[0];

    expect(inputRow).toContain('className="h-9 flex-1"');
    expect(inputRow).toContain("刷新列表");
    expect(inputRow).toContain("onDiscover ? (");
  });
});
