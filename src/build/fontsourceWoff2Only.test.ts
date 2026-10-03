import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { fontsourceWoff2Only } from "./fontsourceWoff2Only";

const fontFiles = [
  ...[400, 500, 600, 700].map((weight) => [`poppins/${weight}.css`, "poppins"] as const),
  ...[400, 500, 600, 700].map((weight) => [`noto-sans-sc/${weight}.css`, "noto-sans-sc"] as const),
  ...[400, 500, 700].map((weight) => [`jetbrains-mono/${weight}.css`, "jetbrains-mono"] as const),
];

function parseFaces(css: string) {
  const faces: Array<Record<string, string>> = [];
  postcss.parse(css).walkAtRules("font-face", (rule) => {
    const declarations = Object.fromEntries(
      rule.nodes
        ?.filter((node): node is postcss.Declaration => node.type === "decl")
        .map(({ prop, value }) => [prop.toLowerCase(), value]) ?? [],
    );
    faces.push(declarations);
  });
  return faces;
}

function woff2Sources(src: string | undefined): string[] {
  return postcss
    .list.comma(src ?? "")
    .filter((source) => /\.woff2(?:[?#][^)]*)?\s*\)/i.test(source) && /format\(\s*["']?woff2["']?\s*\)/i.test(source));
}

function hasWoffSource(css: string): boolean {
  return parseFaces(css).some((face) =>
    postcss
      .list.comma(face.src ?? "")
      .some((source) => /url\(\s*(?:["'][^"']*\.woff(?:[?#][^"']*)?["']|[^)\s]*\.woff(?:[?#][^)]*)?)\s*\)\s*format\(\s*["']?woff["']?\s*\)/i.test(source)),
  );
}

function fontsourceId(path: string): string {
  return resolve(process.cwd(), "node_modules/@fontsource", path);
}

describe("Fontsource WOFF2-only CSS", () => {
  it("preserves every imported face and WOFF2 subset while removing WOFF fallbacks", () => {
    for (const [file, packageName] of fontFiles) {
      const id = fontsourceId(`${packageName}/${file.split("/").at(-1)}`);
      const original = readFileSync(resolve(process.cwd(), "node_modules/@fontsource", file), "utf8");
      const transformed = fontsourceWoff2Only(original, id) ?? original;
      const before = parseFaces(original);
      const after = parseFaces(transformed);

      expect(before.length, file).toBeGreaterThan(0);
      expect(hasWoffSource(original), file).toBe(true);
      expect(hasWoffSource(transformed), file).toBe(false);
      expect(after.map(({ src: _src, ...face }) => face), file).toEqual(
        before.map(({ src: _src, ...face }) => face),
      );
      expect(after.map((face) => woff2Sources(face.src)), file).toEqual(
        before.map((face) => woff2Sources(face.src)),
      );
      expect(after.every((face) => face["font-display"] === "swap"), file).toBe(true);
    }
  });

  it("only changes matching Fontsource face src entries and keeps local/multi-source fallbacks intact", () => {
    const id = fontsourceId("poppins/boundary.css");
    const css = `@font-face {
  font-family: "Poppins";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: local("Poppins"), url("./poppins.woff2") format("woff2"), url("./poppins.woff") format("woff");
  unicode-range: U+0000-00FF;
}
@font-face { font-family: "Poppins"; src: url("./only.woff") format("woff"); }
@font-face { font-family: "Poppins"; src: url("./unknown.woff") format("truetype"); }
.icon { background-image: url("./asset.woff"); }`;
    const transformed = fontsourceWoff2Only(css, id) ?? css;
    const faces = parseFaces(transformed);

    expect(faces[0]?.src).toContain('local("Poppins")');
    expect(faces[0]?.src).toContain('url("./poppins.woff2") format("woff2")');
    expect(faces[0]?.src).not.toContain('url("./poppins.woff")');
    expect(faces[1]?.src).toBe('url("./only.woff") format("woff")');
    expect(faces[2]?.src).toBe('url("./unknown.woff") format("truetype")');
    expect(transformed).toContain('background-image: url("./asset.woff")');
    expect(fontsourceWoff2Only(css, resolve(process.cwd(), "src/styles/unrelated.css"))).toBeNull();
  });

  it("is idempotent", () => {
    const id = fontsourceId("jetbrains-mono/400.css");
    const original = readFileSync(resolve(process.cwd(), "node_modules/@fontsource/jetbrains-mono/400.css"), "utf8");
    const once = fontsourceWoff2Only(original, id) ?? original;
    const twice = fontsourceWoff2Only(once, id) ?? once;

    expect(twice).toBe(once);
  });

  it("retains WOFF sources without a matching WOFF2 asset", () => {
    const id = fontsourceId("poppins/paired.css");
    const css = '@font-face { src: url("./primary.woff2?v=1") format("woff2"), url("./primary.woff?v=1") format("woff"), url("./fallback.woff") format("woff"); }';
    const transformed = fontsourceWoff2Only(css, id) ?? css;
    expect(transformed).toContain('url("./fallback.woff") format("woff")');
    expect(transformed).not.toContain('url("./primary.woff?v=1")');
    const unpaired = '@font-face { src: url("./primary.woff2") format("woff2"), url("./fallback.woff") format("woff"); }';
    expect(fontsourceWoff2Only(unpaired, id)).toBeNull();
  });
});
