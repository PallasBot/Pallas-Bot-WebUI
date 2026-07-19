import { ref } from "vue";
import {
  fetchAiExtensionConfig,
  postAiExtensionTest,
  putAiExtensionConfig,
} from "@/api/consoleApi";
import type { AiExtensionConfig, AiExtensionTestData } from "@/api/pallasTypes";
import { AI_EXTENSION_DEFAULTS } from "@/config/aiConstants";
import { pushConsoleToast } from "@/utils/consoleToast";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";

export type AiExtensionBaseScheme = "http" | "https";

export function parseBaseUrlParts(raw: string): { scheme: AiExtensionBaseScheme; hostPort: string } {
  const s = (raw || "").trim();
  const m = s.match(/^(https?):\/\/([^/?#]+)/i);
  if (m) {
    const scheme = m[1].toLowerCase() === "https" ? "https" : "http";
    return { scheme, hostPort: m[2] };
  }
  const t = s.replace(/\/+$/, "");
  if (t && !/\s/.test(t)) {
    const hostPart = t.split("/")[0] ?? "";
    if (hostPart) return { scheme: "http", hostPort: hostPart };
  }
  return { scheme: "http", hostPort: AI_EXTENSION_DEFAULTS.hostPort };
}

export function buildBaseUrl(scheme: AiExtensionBaseScheme, hostPort: string): string {
  const hp = hostPort.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  if (!hp) return `${scheme}://${AI_EXTENSION_DEFAULTS.hostPort}`;
  return `${scheme}://${hp}`;
}

export function useAiExtensionConnection() {
  const err = ref("");
  const saving = ref(false);
  const testOut = ref<AiExtensionTestData | null>(null);

  const baseScheme = ref<AiExtensionBaseScheme>("http");
  const baseHostPort = ref<string>(AI_EXTENSION_DEFAULTS.hostPort);
  const apiPrefix = ref<string>(AI_EXTENSION_DEFAULTS.apiPrefix);
  const token = ref("");
  const healthPathsText = ref<string>(AI_EXTENSION_DEFAULTS.healthPaths.join("\n"));
  const uvicornLogFile = ref("");
  const celeryLogFile = ref("");
  const celeryMediaLogFile = ref("");
  const timeoutSec = ref<number>(AI_EXTENSION_DEFAULTS.timeoutSec);

  function hydrateFromConfig(c: AiExtensionConfig): void {
    const { scheme, hostPort } = parseBaseUrlParts(c.base_url);
    baseScheme.value = scheme;
    baseHostPort.value = hostPort;
    apiPrefix.value = c.api_prefix || AI_EXTENSION_DEFAULTS.apiPrefix;
    token.value = c.token || "";
    healthPathsText.value = (c.health_paths?.length ? c.health_paths : AI_EXTENSION_DEFAULTS.healthPaths).join("\n");
    uvicornLogFile.value = c.uvicorn_log_file || "";
    celeryLogFile.value = c.celery_log_file || "";
    celeryMediaLogFile.value = c.celery_media_log_file || "";
    timeoutSec.value = c.timeout_sec ?? AI_EXTENSION_DEFAULTS.timeoutSec;
  }

  function buildConfigPayload(): AiExtensionConfig {
    const paths = healthPathsText.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const ap = apiPrefix.value.trim();
    const api_prefix = ap.startsWith("/") ? ap : `/${ap}`;
    const t = Math.min(
      AI_EXTENSION_DEFAULTS.timeoutMax,
      Math.max(AI_EXTENSION_DEFAULTS.timeoutMin, Math.floor(Number(timeoutSec.value)) || AI_EXTENSION_DEFAULTS.timeoutSec),
    );
    return {
      base_url: buildBaseUrl(baseScheme.value, baseHostPort.value),
      api_prefix,
      token: token.value,
      health_paths: paths.length ? paths : [...AI_EXTENSION_DEFAULTS.healthPaths],
      uvicorn_log_file: uvicornLogFile.value.trim(),
      celery_log_file: celeryLogFile.value.trim(),
      celery_media_log_file: celeryMediaLogFile.value.trim(),
      timeout_sec: t,
    };
  }

  async function load() {
    err.value = "";
    try {
      const c = await fetchAiExtensionConfig();
      hydrateFromConfig(c);
    } catch (e) {
      err.value = e instanceof Error ? e.message : String(e);
    }
  }

  async function save(options: { quiet?: boolean } = {}) {
    err.value = "";
    saving.value = true;
    try {
      const c = await putAiExtensionConfig(buildConfigPayload());
      hydrateFromConfig(c);
      if (!options.quiet) toastSaveSuccess("连接配置已保存，并已同步 Bot 对话地址");
    } catch (e) {
      err.value = e instanceof Error ? e.message : String(e);
      toastApiError(e, "保存失败");
    } finally {
      saving.value = false;
    }
  }

  async function runTest(options: { quiet?: boolean } = {}) {
    err.value = "";
    testOut.value = null;
    try {
      const r = await postAiExtensionTest();
      testOut.value = r;
      if (!options.quiet) pushConsoleToast("连通测试完成", "ok");
    } catch (e) {
      err.value = e instanceof Error ? e.message : String(e);
      toastApiError(e, "连通测试失败");
    }
  }

  function canSave() {
    return !saving.value;
  }

  return {
    err,
    saving,
    testOut,
    baseScheme,
    baseHostPort,
    apiPrefix,
    token,
    healthPathsText,
    uvicornLogFile,
    celeryLogFile,
    celeryMediaLogFile,
    timeoutSec,
    parseBaseUrlParts,
    buildBaseUrl,
    hydrateFromConfig,
    buildConfigPayload,
    load,
    save,
    runTest,
    canSave,
  };
}
