// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const indexCss = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf8");
const appCss = readFileSync(fileURLToPath(new URL("./console/app.css", import.meta.url)), "utf8");

it("keeps HeroUI dropdown triggers inline and scopes Bot config spacing", () => {
  expect(indexCss).toMatch(/\.button\.dropdown__trigger\s*\{\s*display:\s*inline-flex;/);
  expect(appCss).toMatch(/\.ui-surface-dialog\.bot-config-dialog\s*\{[^}]*width:\s*min\(720px,/);
  expect(appCss).toMatch(/\.bot-config-dialog \.plugin-config-dialog__bd\s*\{\s*padding:\s*12px 16px;/);
  expect(appCss).toMatch(/@media \(max-width: 560px\)\s*\{[\s\S]*?\.bot-config-dialog \.plugin-config-dialog__bd\s*\{\s*padding:\s*0;/);
});
