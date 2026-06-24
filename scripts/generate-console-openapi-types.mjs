import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultInput = resolve(root, "..", "Pallas-Bot", "openspec", "pallas-console-v1.json");
const defaultOutput = resolve(root, "src", "api", "generated", "pallasConsoleOpenapi.ts");
const cliPath = resolve(root, "node_modules", "openapi-typescript", "bin", "cli.js");

function readArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) {
    return resolve(root, process.argv[idx + 1]);
  }
  return fallback;
}

async function runCli(inputPath, outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
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
  const outputPath = readArg("--output", defaultOutput);
  await runCli(inputPath, outputPath);
  console.log(`[generate-console-openapi-types] ${inputPath} -> ${outputPath}`);
}

main().catch((err) => {
  console.error("[generate-console-openapi-types] failed:", err);
  process.exitCode = 1;
});
