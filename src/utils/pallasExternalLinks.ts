/** Pallas-Bot 主仓与在线文档站（WebUI 外链统一入口） */

export const PALLAS_BOT_DOCS = "https://PallasBot.github.io/Pallas-Bot-Docs/";
export const PALLAS_BOT_REPO = "https://github.com/PallasBot/Pallas-Bot";
export const PALLAS_BOT_RELEASES = `${PALLAS_BOT_REPO}/releases`;
export const PALLAS_WEBUI_RELEASES = "https://github.com/PallasBot/Pallas-Bot-WebUI/releases";

export function pallasDocsUrl(path = ""): string {
  const base = PALLAS_BOT_DOCS.replace(/\/$/, "");
  if (!path) return `${base}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export const PALLAS_BOT_DOC = {
  home: pallasDocsUrl(),
  siteCustomization: pallasDocsUrl("/architecture/site-customization-and-updates"),
  localReadme: `${PALLAS_BOT_REPO}/blob/main/local/README.md`,
  deployment: pallasDocsUrl("/deploy/deployment"),
  dockerDeployment: pallasDocsUrl("/deploy/docker"),
  faqUpdates: `${pallasDocsUrl("/deploy/faq")}#更新与版本`,
  settingsStorage: pallasDocsUrl("/architecture/settings-storage"),
} as const;

export const PALLAS_SHELL_EXTERNAL_LINKS = [
  { href: PALLAS_BOT_DOCS, label: "文档" },
  { href: PALLAS_BOT_REPO, label: "GitHub" },
] as const;
