/** 与 Bot `plugin_matrix.OFFICIAL_EXTENSION_*` 对齐，供 API 未升级时前端兜底。 */

export const OFFICIAL_EXTENSION_REPO_OWNER = "TogetsuDo";

export const OFFICIAL_EXTENSION_TITLES: Record<string, string> = {
  "pallas-plugin-duel": "牛牛决斗",
  "pallas-plugin-draw": "牛牛画画",
  "pallas-plugin-dream": "牛牛做梦",
  "pallas-plugin-maa": "MAA 远控",
  "pallas-plugin-protocol": "协议端管理",
  "pallas-plugin-who-is-spy": "谁是卧底",
  "pallas-plugin-ai-media": "牛牛唱歌",
  "pallas-plugin-bot-status": "牛牛状态",
};

export const OFFICIAL_EXTENSION_DESCRIPTIONS: Record<string, string> = {
  "pallas-plugin-duel": "牛牛决斗。",
  "pallas-plugin-draw": "牛牛画画（直连生图网关）。",
  "pallas-plugin-dream": "牛牛做梦（群内旁路、分片漂移）。",
  "pallas-plugin-maa": "MAA 远控（含 worker 插件 pallas_plugin_maa 与分片 hub 入口 pallas_plugin_maa_hub）。",
  "pallas-plugin-protocol": "协议端管理（NapCat / SnowLuma）与 牛牛重新上号（含分片 worker 转发）。",
  "pallas-plugin-who-is-spy": "谁是卧底。",
  "pallas-plugin-ai-media": "牛牛唱歌（翻唱 / 点歌）。",
  "pallas-plugin-bot-status": "牛牛状态（在吗、报数、离线邮件）。",
};

/** Matcher / 运行统计里的模块名 → 官方扩展包名（与 Bot EXTRA_PACKAGE_MODULES 对齐） */
export const OFFICIAL_EXTENSION_MODULE_PACKAGES: Record<string, string> = {
  pallas_plugin_protocol: "pallas-plugin-protocol",
  pallas_plugin_relogin_bot: "pallas-plugin-protocol",
  pallas_plugin_relogin_forward: "pallas-plugin-protocol",
  pallas_plugin_duel: "pallas-plugin-duel",
  pallas_plugin_maa: "pallas-plugin-maa",
  pallas_plugin_maa_hub: "pallas-plugin-maa",
  pallas_plugin_who_is_spy: "pallas-plugin-who-is-spy",
  pallas_plugin_dream: "pallas-plugin-dream",
  pallas_plugin_draw: "pallas-plugin-draw",
  pallas_plugin_sing: "pallas-plugin-ai-media",
  pallas_plugin_bot_status: "pallas-plugin-bot-status",
};

const BOT_README_COVER = "/pallas/official-extensions/covers/pallas-readme-cover.webp";
const AI_README_COVER = "/pallas/official-extensions/covers/pallas-ai-readme-cover.webp";

export const OFFICIAL_EXTENSION_COVER_REMOTE: Record<"bot" | "ai", string> = {
  bot: "https://user-images.githubusercontent.com/18511905/195892994-c1a231ec-147a-4f98-ba75-137d89578247.png",
  ai: "https://github.com/user-attachments/assets/fe654813-bf37-4e5f-9c7d-98d867016618",
};

function isOfficialIconSvg(url: string): boolean {
  return /\/official-extensions\/pallas-plugin-[^/]+\.svg(?:\?|$)/i.test(url.trim());
}

export function officialExtensionDescription(packageName: string): string {
  return OFFICIAL_EXTENSION_DESCRIPTIONS[(packageName || "").trim()] || "";
}

export function officialExtensionTitle(packageName: string): string {
  return OFFICIAL_EXTENSION_TITLES[(packageName || "").trim()] || "";
}

/** Matcher 统计键（模块名 / 包名）→ 官方中文标题；无映射返回空串 */
export function officialExtensionTitleForMatcherKey(key: string): string {
  const raw = (key || "").trim();
  if (!raw) return "";
  if (OFFICIAL_EXTENSION_TITLES[raw]) return OFFICIAL_EXTENSION_TITLES[raw];
  const pkg = OFFICIAL_EXTENSION_MODULE_PACKAGES[raw];
  if (pkg) return officialExtensionTitle(pkg);
  // pallas_plugin_foo_bar → pallas-plugin-foo-bar
  if (raw.startsWith("pallas_plugin_")) {
    const guessed = `pallas-plugin-${raw.slice("pallas_plugin_".length).replace(/_/g, "-")}`;
    return officialExtensionTitle(guessed);
  }
  return "";
}

export function officialExtensionPackageShortName(packageName: string): string {
  const pkg = (packageName || "").trim();
  return pkg.replace(/^pallas-plugin-/, "") || pkg;
}

export function resolveOfficialExtensionTitle(
  packageName: string,
  displayName?: string | null,
): string {
  const fromApi = (displayName || "").trim();
  if (fromApi) return fromApi;
  const fallback = officialExtensionTitle(packageName);
  if (fallback) return fallback;
  return officialExtensionPackageShortName(packageName);
}

export function resolveOfficialExtensionSubtitle(
  packageName: string,
  displayName?: string | null,
): string {
  const short = officialExtensionPackageShortName(packageName);
  const title = resolveOfficialExtensionTitle(packageName, displayName);
  if (short && short !== title) return short;
  return "";
}

export function officialExtensionCoverPath(packageName: string): string {
  const pkg = (packageName || "").trim();
  return pkg === "pallas-plugin-ai-media" ? AI_README_COVER : BOT_README_COVER;
}

export function officialExtensionCoverRemote(packageName: string): string {
  return packageName.trim() === "pallas-plugin-ai-media"
    ? OFFICIAL_EXTENSION_COVER_REMOTE.ai
    : OFFICIAL_EXTENSION_COVER_REMOTE.bot;
}

export function resolveOfficialExtensionCover(
  packageName: string,
  cover?: string | null,
): string {
  const raw = (cover || "").trim();
  if (raw && !isOfficialIconSvg(raw)) return raw;
  return officialExtensionCoverPath(packageName);
}

export function officialExtensionCoverFallbacks(packageName: string, cover?: string | null): string[] {
  const primary = resolveOfficialExtensionCover(packageName, cover);
  const remote = officialExtensionCoverRemote(packageName);
  const list = [primary, remote];
  const seen = new Set<string>();
  return list.filter((url) => {
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

export function resolveOfficialExtensionAvatar(avatar?: string | null): string {
  return (avatar || "").trim();
}

export function resolveOfficialExtensionDescription(
  packageName: string,
  description?: string | null,
): string {
  return (description || "").trim() || officialExtensionDescription(packageName);
}
