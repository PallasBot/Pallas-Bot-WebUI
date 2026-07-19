import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const committedPath = resolve(root, "src", "api", "generated", "pallasConsoleOpenapi.ts");
const defaultInput = resolve(root, "..", "Pallas-Bot", "openspec", "pallas-console-v1.json");
const cliPath = resolve(root, "node_modules", "openapi-typescript", "bin", "cli.js");

function readArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) {
    return resolve(root, process.argv[idx + 1]);
  }
  return fallback;
}

async function runCli(inputPath, outputPath) {
  await import("node:fs/promises").then((fs) => fs.mkdir(dirname(outputPath), { recursive: true }));
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [cliPath, inputPath, "-o", outputPath], {
      cwd: root,
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(new Error(`openapi-typescript exited with code ${code ?? "unknown"}`));
    });
    child.on("error", rejectRun);
  });
}

async function main() {
  const inputPath = readArg("--input", defaultInput);
  const tempDir = await mkdtemp(resolve(tmpdir(), "pallas-openapi-types-"));
  const tempOut = resolve(tempDir, "pallasConsoleOpenapi.ts");
  try {
    await runCli(inputPath, tempOut);
    const [committed, generated] = await Promise.all([
      readFile(committedPath, "utf8"),
      readFile(tempOut, "utf8"),
    ]);
    if (committed !== generated) {
      console.error("[check-console-openapi-types] drift detected");
      console.error("  npm run gen:console-openapi-types");
      process.exitCode = 1;
      return;
    }
    console.log("[check-console-openapi-types] generated types are up to date");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("[check-console-openapi-types] failed:", err);
  process.exitCode = 1;
});
