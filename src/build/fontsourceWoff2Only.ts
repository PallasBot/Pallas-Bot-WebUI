import postcss from "postcss";

function fontsourceCssId(id: string): boolean {
  const file = id.replaceAll("\\", "/").split("?", 1)[0];
  return /\/node_modules\/@fontsource\/[^/]+\/.+\.css$/i.test(file);
}

function fontSourceUrl(source: string, format: "woff" | "woff2"): string | null {
  const match = new RegExp(
    `^\\s*url\\(\\s*(?:(['"])(.*?)\\1|([^)\\s]+))\\s*\\)\\s*format\\(\\s*(?:(['"])${format}\\4|${format})\\s*\\)\\s*$`,
    "i",
  ).exec(source);
  return match?.[2] ?? match?.[3] ?? null;
}

export function fontsourceWoff2Only(code: string, id: string): string | null {
  if (!fontsourceCssId(id)) return null;

  const root = postcss.parse(code, { from: id });
  let changed = false;
  root.walkAtRules("font-face", (rule) => {
    rule.walkDecls("src", (decl) => {
      const sources = postcss.list.comma(decl.value);
      const woff2Urls = new Set(
        sources.flatMap((source) => {
          const url = fontSourceUrl(source, "woff2");
          return url && /\.woff2(?:[?#].*)?$/i.test(url)
            ? [url.replace(/\.woff2(?=[?#]|$)/i, (extension) => extension.slice(0, -1))]
            : [];
        }),
      );
      if (!woff2Urls.size) return;

      const kept = sources.filter((source) => {
        const url = fontSourceUrl(source, "woff");
        return !url || !/\.woff(?:[?#].*)?$/i.test(url) || !woff2Urls.has(url);
      });
      if (kept.length === sources.length) return;

      decl.value = kept.join(", ");
      changed = true;
    });
  });

  return changed ? root.toString() : null;
}
