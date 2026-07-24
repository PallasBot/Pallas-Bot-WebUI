import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const root = resolve(process.cwd());
const pkgPath = resolve(root, "package.json");
const distDir = resolve(root, "dist");
const outPath = resolve(distDir, "console-version.json");

async function runGit(args) {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd: root });
    return stdout.trim();
  } catch {
    return "";
  }
}

export async function resolveConsoleVersionMetadata({
  packageVersion,
  env = process.env,
  runGit: git = runGit,
}) {
  const configuredCommit = String(env.GIT_COMMIT || "").trim();
  const commit = configuredCommit || await git(["rev-parse", "HEAD"]) || "local";
  const explicitVersion = String(env.CONSOLE_VERSION || "").trim();
  if (explicitVersion) return { version: explicitVersion, commit };

  const tag = await git(["describe", "--tags", "--exact-match"]);
  if (tag) return { version: tag, commit };

  const suffix = commit === "local" ? "" : `+${commit.slice(0, 7)}`;
  return { version: `${packageVersion || "0.0.0"}-dev${suffix}`, commit };
}

async function main() {
  const pkgRaw = await readFile(pkgPath, "utf8");
  const pkg = JSON.parse(pkgRaw);

  const { version, commit } = await resolveConsoleVersionMetadata({ packageVersion: pkg.version });
  const buildTime = String(process.env.BUILD_TIME || "").trim() || new Date().toISOString();

  await mkdir(distDir, { recursive: true });
  await writeFile(
    outPath,
    `${JSON.stringify({ version, commit, build_time: buildTime }, null, 2)}\n`,
    "utf8",
  );
  console.log(`[write-console-version] ${outPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("[write-console-version] failed:", err);
    process.exitCode = 1;
  });
}
