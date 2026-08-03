import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const configModals = [
  "src/components/BotConfigModal.tsx",
  "src/components/social/GroupSocialConfigModal.tsx",
  "src/components/social/UserSocialConfigModal.tsx",
];

describe("configuration modal switches", () => {
  it("keeps checked-state color on the switch track instead of the outer label", () => {
    for (const path of configModals) {
      const source = readFileSync(resolve(root, path), "utf8");
      expect(source).not.toContain("data-[state=checked]:bg-[var(--accent)]");
    }
  });
});
