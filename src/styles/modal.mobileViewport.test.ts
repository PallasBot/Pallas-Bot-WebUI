// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const indexCss = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf8");
const appCss = readFileSync(fileURLToPath(new URL("./console/app.css", import.meta.url)), "utf8");

it("fills the mobile visual viewport for dialogs and the navigation drawer only", () => {
  const mobileModalRules = indexCss.match(/@media \(max-width: 560px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
  expect(mobileModalRules).toContain(".ui-surface-dialog[role=\"dialog\"]");
  expect(mobileModalRules).toContain(".ui-surface-dialog[role=\"alertdialog\"]");
  expect(mobileModalRules).toContain(".ui-dialog.console-modal");
  expect(mobileModalRules).toContain(".shell-command-nav__content");
  expect(mobileModalRules).toContain("var(--visual-viewport-height, 100dvh)");
  expect(mobileModalRules).toContain("env(safe-area-inset-bottom)");
  expect(mobileModalRules).not.toContain(".ui-surface-popover");

  expect(appCss).toContain(".shell-mobile-nav__backdrop");
  expect(appCss).toContain(".shell-mobile-nav__panel");
  expect(appCss).toContain("height: var(--visual-viewport-height, 100dvh)");
  expect(appCss).toContain("@media (max-width: 860px) {");
});
