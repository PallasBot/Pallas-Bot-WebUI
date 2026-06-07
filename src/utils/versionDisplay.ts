import type { BotUpdateCheckData, UpdateCheckData } from "@/api/pallasTypes";
import type { HealthResponse } from "@/api/health";

/** 运行环境展示用：去掉常见 git 哈希片段（短/长 hex、+g…、尾段 ` · abcd123` 等） */
export function displayVersionWithoutSha(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  let s = raw;
  s = s.replace(/\s*·\s*[0-9a-f]{4,40}\b/gi, "");
  s = s.replace(/\s+git\s+[0-9a-f]{4,40}\s*$/i, "");
  s = s.replace(/\+g[0-9a-f]{4,40}/gi, "");
  s = s.replace(/\[[0-9a-f]{4,40}\]/gi, "");
  s = s.replace(/\s*\(\s*[0-9a-f]{7,40}\s*\)\s*$/gi, "");
  return s.trim();
}

function pickCleanVersion(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  const cleaned = displayVersionWithoutSha(raw);
  return cleaned || raw;
}

export type ConsoleResourceVersionOptions = {
  /** 构建时 package.json 版本（__WEBUI_VERSION__） */
  webuiBuildVersion?: string;
  /** 显式 dev 模式；缺省时读 health.console.pallas_webui_dev_mode */
  devMode?: boolean;
};

/** 侧栏/首页统一的控制台资源版本展示 */
export function consoleResourceVersionLabel(
  health: HealthResponse | null | undefined,
  webUpdate?: UpdateCheckData | null,
  options?: ConsoleResourceVersionOptions,
): string {
  const buildVer = (options?.webuiBuildVersion ?? "").trim();
  const devMode =
    options?.devMode ?? Boolean(health?.console?.pallas_webui_dev_mode);

  if (devMode && buildVer) {
    return pickCleanVersion(buildVer);
  }

  const fromHealth = pickCleanVersion(health?.console?.version);
  if (fromHealth) return fromHealth;

  const fromWeb = pickCleanVersion(webUpdate?.current_tag);
  if (fromWeb) return fromWeb;

  if (buildVer) return pickCleanVersion(buildVer);

  return "—";
}

/** 更新页「当前」展示：与检查接口 current_tag 对齐并统一清洗 */
export function updateCheckCurrentTagLabel(tag: string | null | undefined): string {
  const cleaned = pickCleanVersion(tag);
  return cleaned || "—";
}

/** 侧栏/首页统一的 Pallas-Bot 版本展示（优先 update check 的 current_tag） */
export function pallasBotVersionLabel(
  health: HealthResponse | null | undefined,
  botUpdate: BotUpdateCheckData | null | undefined,
): string {
  const tag = (botUpdate?.current_tag ?? "").trim();
  if (tag) {
    const cleaned = displayVersionWithoutSha(tag);
    return cleaned || tag;
  }
  const pb = (health?.pallas_bot ?? "").trim();
  const cleaned = displayVersionWithoutSha(pb);
  return cleaned || pb || "—";
}
