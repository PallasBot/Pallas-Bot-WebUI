#!/usr/bin/env node
/**
 * 从同级（或 PALLAS_BOT_ROOT）Bot 仓 openspec 生成控制台 TS 类型。
 * --pre-commit：类型有改动时 exit 1，便于重新 stage。
 */
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const typesPath = resolve(root, "src", "api", "generated", "pallasConsoleOpenapi.ts");
const genScript = resolve(root, "scripts", "generate-console-openapi-types.mjs");

function hasFlag(name) {
  return process.argv.includes(name);
}

function readArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return "";
}

function resolveBotRoot() {
  const explicit = (readArg("--bot-root") || process.env.PALLAS_BOT_ROOT || "").trim();
  if (explicit) {
    return resolve(explicit);
  }
  return resolve(root, "..", "Pallas-Bot");
}

async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function runNode(scriptPath, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: root,
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(new Error(`generate exited with code ${code ?? "unknown"}`));
    });
    child.on("error", rejectRun);
  });
}

async function main() {
  const botRoot = resolveBotRoot();
  const inputPath = resolve(botRoot, "openspec", "pallas-console-v1.json");
  if (!(await pathExists(inputPath))) {
    console.error(`[sync-console-openapi-from-bot] missing openspec: ${inputPath}`);
    console.error("  clone Pallas-Bot as sibling, or set PALLAS_BOT_ROOT");
    process.exitCode = hasFlag("--pre-commit") ? 0 : 1;
    if (hasFlag("--require-bot")) {
      process.exitCode = 1;
    }
    return;
  }

  const before = (await pathExists(typesPath)) ? await readFile(typesPath, "utf8") : null;
  await runNode(genScript, ["--input", inputPath]);
  const after = await readFile(typesPath, "utf8");
  if (before === after) {
    console.log("[sync-console-openapi-from-bot] types unchanged");
    return;
  }

  console.log(`[sync-console-openapi-from-bot] types updated: ${typesPath}`);
  if (hasFlag("--pre-commit")) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[sync-console-openapi-from-bot] failed:", err);
  process.exitCode = 1;
});
