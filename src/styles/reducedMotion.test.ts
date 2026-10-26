import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const REDUCE_MARKER = "@media (prefers-reduced-motion: reduce)";

/**
 * Collect every `prefers-reduced-motion: reduce` media block from raw CSS text.
 * Each block is captured whole (from `@media` through its matching `}`) via a plain
 * brace counter, so ordinary CSS between/around blocks is never mistaken for reduced motion.
 * Naive string/comment handling is acceptable here; a full CSS parser is out of scope.
 */
function extractReducedMotionBlocks(source: string): string[] {
  const blocks: string[] = [];
  let from = 0;
  while (true) {
    const start = source.indexOf(REDUCE_MARKER, from);
    if (start === -1) break;
    const open = source.indexOf("{", start + REDUCE_MARKER.length);
    if (open === -1) break;
    let depth = 0;
    let end = -1;
    for (let i = open; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) break;
    blocks.push(source.slice(start, end + 1));
    from = end + 1;
  }
  return blocks;
}

it("disables spatial and looping motion without hiding pending or command selection state", () => {
  const stylesheet = fileURLToPath(new URL("../index.css", import.meta.url));
  const source = readFileSync(stylesheet, "utf8");
  const blocks = extractReducedMotionBlocks(source);
  expect(blocks.length, "index.css must define at least one prefers-reduced-motion block").toBeGreaterThan(0);
  const reducedMotion = blocks.join("\n");

  expect(reducedMotion).toContain(".seg-tabs__indicator");
  expect(reducedMotion).toContain(".command-list::before");
  expect(reducedMotion).toContain(".status-tone--pending");
  expect(reducedMotion).toContain(".shell-mobile-nav__panel");
  expect(reducedMotion).toMatch(
    /\.ui-btn__ico\[class\*="group-hover:"\],[\s\S]*?svg\[class\*="group-hover:translate"\],[\s\S]*?svg\[class\*="group-hover:scale"\],[\s\S]*?svg\[class\*="group-hover:rotate"\][\s\S]*?\{[^}]*scale:\s*none\s*!important;[^}]*transform:\s*none\s*!important;/,
  );
  expect(reducedMotion).toMatch(
    /button\[class\*="active:scale"\]:active\s*\{[^}]*scale:\s*none\s*!important;/,
  );
  expect(reducedMotion).not.toContain('[class*="group-hover:"] {');
  expect(reducedMotion).toContain("animation: none");
  expect(reducedMotion).toContain("transition: none");
});

it("extracts every reduced-motion block and excludes ordinary CSS around them", () => {
  const synthetic = [
    ".outside-before { color: red; }",
    "@media (prefers-reduced-motion: reduce) { .first { animation: none; } }",
    ".ordinary-in-between { color: blue; }",
    "@media (prefers-reduced-motion: reduce) { .second { transition: none; } }",
    ".outside-after { color: green; }",
  ].join("\n");

  const blocks = extractReducedMotionBlocks(synthetic);
  expect(blocks).toHaveLength(2);
  const joined = blocks.join("\n");
  expect(joined).toContain(".first");
  expect(joined).toContain(".second");
  expect(joined).not.toContain(".ordinary-in-between");
  expect(joined).not.toContain(".outside-before");
  expect(joined).not.toContain(".outside-after");

  expect(extractReducedMotionBlocks(".plain { color: red; }")).toHaveLength(0);
});
