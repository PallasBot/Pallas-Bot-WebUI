import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("LLM provider rename", () => {
  it("keeps the config name editable while editing an existing provider", () => {
    const form = readSource("src/pages/ai/LlmProvidersForm.tsx");

    const input = form.match(/<Input\s+id="llm-provider-id"[\s\S]*?\/>/);
    expect(input).toBeTruthy();
    expect(input![0]).not.toContain("disabled={editIndex !== null}");
    expect(form).toContain("editOriginalId");
    expect(form).toContain("保存后路由与引用会一并改为新名称。");
  });

  it("routes renamed providers through the rename API before upsert", () => {
    const form = readSource("src/pages/ai/LlmProvidersForm.tsx");

    expect(form).toContain("renameLlmProvider");
    expect(form).toContain("const renamed = !wasNew && Boolean(originalId) && id !== originalId");
    expect(form).toContain("if (renamed) {");
    expect(form).toContain("await renameLlmProvider(originalId, id)");
  });

  it("exposes a rename endpoint helper with cascade semantics on the backend", () => {
    const api = readSource("src/api/console.ts");

    expect(api).toContain("export async function renameLlmProvider");
    expect(api).toContain("/rename");
    expect(api).toContain("new_id: to");
  });

  it("keeps preset switching from overwriting the name while editing", () => {
    const form = readSource("src/pages/ai/LlmProvidersForm.tsx");

    expect(form).toContain("只有新建时预设才覆盖配置名称；编辑中不覆盖，避免干扰改名");
  });
});
