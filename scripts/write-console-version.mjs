import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const pkgPath = resolve(root, "package.json");
const distDir = resolve(root, "dist");
const outPath = resolve(distDir, "console-version.json");

async function main() {
  const pkgRaw = await readFile(pkgPath, "utf8");
  const pkg = JSON.parse(pkgRaw);

  const version = String(process.env.CONSOLE_VERSION || pkg.version || "0.0.0");
  const commit = String(process.env.GIT_COMMIT || "").trim() || "local";
  const buildTime = String(process.env.BUILD_TIME || "").trim() || new Date().toISOString();

  await mkdir(distDir, { recursive: true });
  await writeFile(
    outPath,
    `${JSON.stringify({ version, commit, build_time: buildTime }, null, 2)}\n`,
    "utf8",
  );
  console.log(`[write-console-version] ${outPath}`);
}

main().catch((err) => {
  console.error("[write-console-version] failed:", err);
  process.exitCode = 1;
});
