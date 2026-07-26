import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const committedPath = resolve(root, "src", "api", "generated", "pallasConsoleOpenapi.ts");
const defaultInput = resolve(root, "..", "Pallas-Bot", "openspec", "pallas-console-v1.json");
const cliPath = resolve(root, "node_modules", "openapi-typescript", "bin", "cli.js");

function readAllArgs(name) {
  const values = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === name && process.argv[i + 1]) {
      values.push(resolve(root, process.argv[i + 1]));
    }
  }
  return values;
}

async function pathExists(path) {
  try {
    await access(path, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
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
  const inputs = readAllArgs("--input");
  if (!inputs.length) {
    inputs.push(defaultInput);
  }

  const committed = await readFile(committedPath, "utf8");
  const tempDir = await mkdtemp(resolve(tmpdir(), "pallas-openapi-types-"));
  const tried = [];
  const missing = [];

  try {
    for (const inputPath of inputs) {
      if (!(await pathExists(inputPath))) {
        missing.push(inputPath);
        continue;
      }
      const tempOut = resolve(tempDir, `out-${tried.length}.ts`);
      await runCli(inputPath, tempOut);
      const generated = await readFile(tempOut, "utf8");
      tried.push(inputPath);
      if (committed === generated) {
        console.log(`[check-console-openapi-types] generated types match: ${inputPath}`);
        return;
      }
    }

    console.error("[check-console-openapi-types] drift detected");
    if (tried.length) {
      console.error("  checked openspec inputs (none matched committed types):");
      for (const path of tried) {
        console.error(`    - ${path}`);
      }
    }
    if (missing.length) {
      console.error("  missing openspec inputs:");
      for (const path of missing) {
        console.error(`    - ${path}`);
      }
    }
    console.error("  sync from the Bot branch you developed against, e.g.:");
    console.error("    PALLAS_BOT_ROOT=../Pallas-Bot npm run sync:console-openapi-types");
    console.error("  CI accepts a match against Bot main or Bot `dev` openspec.");
    process.exitCode = 1;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("[check-console-openapi-types] failed:", err);
  process.exitCode = 1;
});
