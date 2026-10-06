import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("disables spatial and looping motion without hiding pending or command selection state", () => {
  const stylesheet = fileURLToPath(new URL("../index.css", import.meta.url));
  const source = readFileSync(stylesheet, "utf8");
  const marker = "@media (prefers-reduced-motion: reduce)";
  const reducedMotion = source.slice(source.lastIndexOf(marker));

  expect(reducedMotion).toContain(".seg-tabs__indicator");
  expect(reducedMotion).toContain(".command-list::before");
  expect(reducedMotion).toContain(".status-tone--pending");
  expect(reducedMotion).toContain(".shell-mobile-nav__panel");
  expect(reducedMotion).toMatch(
    /\.ui-btn__ico\[class\*="group-hover:"\],[\s\S]*?svg\[class\*="group-hover:translate"\],[\s\S]*?svg\[class\*="group-hover:scale"\],[\s\S]*?svg\[class\*="group-hover:rotate"\][\s\S]*?\{[^}]*transform:\s*none\s*!important;/,
  );
  expect(reducedMotion).toMatch(
    /button\[class\*="active:scale"\]:active\s*\{[^}]*--tw-scale-x:\s*1\s*!important;[^}]*--tw-scale-y:\s*1\s*!important;/,
  );
  expect(reducedMotion).not.toContain('[class*="group-hover:"] {');
  expect(reducedMotion).toContain("animation: none");
  expect(reducedMotion).toContain("transition: none");
});
