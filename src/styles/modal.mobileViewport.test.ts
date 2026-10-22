// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const indexCss = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf8");
const appCss = readFileSync(fileURLToPath(new URL("./console/app.css", import.meta.url)), "utf8");
const workspace = readFileSync(fileURLToPath(new URL("../components/PluginConfigWorkspace.tsx", import.meta.url)), "utf8");

it("fills the mobile visual viewport for dialogs and the navigation drawer only", () => {
  const mobileModalRules = indexCss.match(/@media \(max-width: 560px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
  expect(mobileModalRules).toContain(".ui-surface-dialog[role=\"dialog\"]");
  expect(mobileModalRules).toContain(".ui-surface-dialog[role=\"alertdialog\"]");
  expect(mobileModalRules).toContain(".ui-dialog.console-modal");
  expect(mobileModalRules).toContain(".shell-command-nav__content");
  expect(mobileModalRules).toContain("var(--visual-viewport-height, 100dvh)");
  expect(mobileModalRules).toContain("--tw-translate-x: 0 !important");
  expect(mobileModalRules).toContain("--tw-translate-y: 0 !important");
  expect(mobileModalRules).toContain("env(safe-area-inset-bottom)");
  expect(mobileModalRules).not.toContain(".ui-surface-popover");
  expect(mobileModalRules).toContain('.ui-surface-dialog[role="dialog"].plugin-config-dialog');
  expect(mobileModalRules).toContain('.ui-surface-dialog[role="dialog"].bot-config-dialog');
  expect(mobileModalRules).toContain("top: calc(var(--visual-viewport-height, 100dvh) / 2);");
  expect(mobileModalRules).toContain("left: 50%;");
  expect(mobileModalRules).toContain("transform: translate(-50%, -50%);");
  expect(mobileModalRules).toContain("max-height: calc(var(--visual-viewport-height, 100dvh)");
  expect(mobileModalRules).toContain(".ui-surface-dialog__close {");
  expect(mobileModalRules).toContain("overflow-y: auto;");
  expect(mobileModalRules).not.toContain('.ui-surface-dialog[role="dialog"].plugin-config-dialog {\n    inset: 0;');

  expect(appCss).toContain(".shell-mobile-nav__backdrop");
  expect(appCss).toContain(".shell-mobile-nav__panel");
  const mobileNavRules = appCss.match(/\.shell-mobile-nav__backdrop\s*\{([^}]+)\}/)?.[1] ?? "";
  expect(mobileNavRules).toContain("inset: 0;");
  expect(mobileNavRules).toContain("height: auto;");
  expect(mobileNavRules).not.toContain("height: var(--visual-viewport-height, 100dvh);");
  const mobileNavPanel = appCss.match(/\.shell-mobile-nav__panel\s*\{([^}]+)\}/)?.[1] ?? "";
  expect(mobileNavPanel).toContain("height: 100%;");
  expect(mobileNavPanel).toContain("max-height: 100%;");
  expect(appCss).not.toContain("height: var(--visual-viewport-height, 100dvh) !important;");
});

it("limits the config-dialog group control focus treatment to that modal", () => {
  expect(workspace).toContain('selectClassName={isDialog ? "plugin-config-dialog__help-tag-select" : undefined}');
  expect(indexCss).toContain(".plugin-config-dialog__help-tag-select:focus:not(:focus-visible)");
  expect(indexCss).toContain(".plugin-config-dialog__help-tag-select:focus-visible");
  expect(indexCss).toContain(".plugin-config-dialog .plugin-config-dialog__help-tag-select {");
  expect(indexCss).toContain("flex-direction: row;");
  expect(indexCss).toContain(".plugin-config-dialog .plugin-config-dialog__help-tag-select > span {");
  expect(indexCss).toContain(".plugin-config-dialog .plugin-config-dialog__help-tag-select > svg {");
  expect(indexCss).toContain("box-shadow: none;");
  expect(indexCss).toContain("--tw-ring-width: 0px;");
  expect(indexCss).toContain("outline: 2px solid var(--accent);");
});
