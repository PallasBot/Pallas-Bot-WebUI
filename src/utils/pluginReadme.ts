import DOMPurify from "dompurify";
import { marked } from "marked";

marked.use({ breaks: true, gfm: true });

const README_PURIFY = {
  ALLOWED_TAGS: [
    "div",
    "span",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "b",
    "i",
    "code",
    "pre",
    "blockquote",
    "a",
    "br",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "img",
    "details",
    "summary",
    "kbd",
  ],
  ALLOWED_ATTR: [
    "href",
    "target",
    "rel",
    "class",
    "src",
    "alt",
    "title",
    "align",
    "width",
    "height",
  ],
  ALLOW_DATA_ATTR: false,
} as const;

export function parseGithubRepo(url: string): { owner: string; repo: string } | null {
  const raw = (url || "").trim();
  const match = raw.match(/github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?(?:\/|$)/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

function readmeRawUrls(owner: string, repo: string): string[] {
  const bases = [
    `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/main/README.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/master/README.md`,
  ];
  return bases;
}

export async function fetchGithubReadme(repositoryUrl: string): Promise<string> {
  const parsed = parseGithubRepo(repositoryUrl);
  if (!parsed) {
    throw new Error("无法解析 GitHub 仓库地址");
  }
  const { owner, repo } = parsed;
  for (const url of readmeRawUrls(owner, repo)) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        return await resp.text();
      }
    } catch {
      continue;
    }
  }
  throw new Error("未找到 README.md");
}

function readmeRawAssetUrl(owner: string, repo: string, path: string, branch: "main" | "master"): string {
  const clean = path.replace(/^\.\//, "");
  return `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${branch}/${clean}`;
}

function readmeBlobAssetUrl(owner: string, repo: string, path: string, branch: "main" | "master"): string {
  const clean = path.replace(/^\.\//, "");
  return `https://github.com/${owner}/${repo}/blob/${branch}/${clean}`;
}

function isRelativeReadmeUrl(value: string): boolean {
  return Boolean(value) && !/^(?:[a-z]+:|#|\/\/)/i.test(value);
}

function rewriteHtmlAssetUrls(html: string, repositoryUrl: string): string {
  const parsed = parseGithubRepo(repositoryUrl);
  if (!parsed || typeof DOMParser === "undefined") return html;
  const { owner, repo } = parsed;
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const img of doc.querySelectorAll("img")) {
    const rawSrc = (img.getAttribute("src") || "").trim();
    if (!isRelativeReadmeUrl(rawSrc)) continue;
    img.setAttribute("src", readmeRawAssetUrl(owner, repo, rawSrc, "main"));
  }
  for (const link of doc.querySelectorAll("a")) {
    const rawHref = (link.getAttribute("href") || "").trim();
    if (!isRelativeReadmeUrl(rawHref)) continue;
    link.setAttribute("href", readmeBlobAssetUrl(owner, repo, rawHref, "main"));
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noreferrer");
  }
  return doc.body.innerHTML;
}

export function resolveReadmeMarkdownAssets(markdown: string, repositoryUrl: string): string {
  const parsed = parseGithubRepo(repositoryUrl);
  if (!parsed) return markdown;
  const { owner, repo } = parsed;
  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    const value = String(src || "").trim();
    if (!value || /^(https?:|data:)/i.test(value)) return match;
    return `![${alt}](${readmeRawAssetUrl(owner, repo, value, "main")})`;
  });
}

export function readmeMarkdownToSafeHtml(markdown: string, repositoryUrl?: string | null): string {
  let raw = (markdown || "").trim();
  if (!raw) return "";
  if (repositoryUrl) {
    raw = resolveReadmeMarkdownAssets(raw, repositoryUrl);
  }
  let parsed = marked.parse(raw) as string;
  if (repositoryUrl) {
    parsed = rewriteHtmlAssetUrls(parsed, repositoryUrl);
  }
  return DOMPurify.sanitize(parsed, {
    ALLOWED_TAGS: [...README_PURIFY.ALLOWED_TAGS],
    ALLOWED_ATTR: [...README_PURIFY.ALLOWED_ATTR],
    ALLOW_DATA_ATTR: README_PURIFY.ALLOW_DATA_ATTR,
  });
}

export function pluginCoverHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}
