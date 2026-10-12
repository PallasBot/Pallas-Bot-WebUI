// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const observationCss = readFileSync(fileURLToPath(new URL("./console/console-hub.css", import.meta.url)), "utf8");
const governanceCss = readFileSync(fileURLToPath(new URL("../pages/ai/governance/AiGovernancePage.css", import.meta.url)), "utf8");
const parityCss = readFileSync(fileURLToPath(new URL("./react-parity-pass.css", import.meta.url)), "utf8");

it("shows a muted rail on the three scoped tab groups", () => {
  const rail = "color-mix(in srgb, var(--foreground) 4%, var(--background))";
  expect(observationCss).toMatch(/\.ai-observation-statistics-tabs \.tabs__list\s*\{[^}]*background:/);
  expect(observationCss).toContain(rail);
  expect(governanceCss).toContain(rail);
  expect(governanceCss).toContain(".ai-governance-page__tabs .ai-memory-page__tabs-scroll");
  expect(governanceCss).toContain("width: max-content;");
  expect(governanceCss).toContain("max-width: 100%;");
  expect(governanceCss).toContain("flex: 0 0 auto;");
  expect(parityCss).toMatch(/\.plugin-config-workspace__mode-tabs \.tabs__list\s*\{[^}]*background:/);
  expect(parityCss).toContain(rail);
});
