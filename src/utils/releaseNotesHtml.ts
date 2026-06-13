import DOMPurify from "dompurify";
import { marked } from "marked";

const COMMIT_PATH_RE = /^\/[^/]+\/[^/]+\/commit\/[0-9a-f]{7,40}$/i;

function sanitizeGithubCommitUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (u.hostname.toLowerCase() !== "github.com") return null;
    const p = u.pathname.replace(/\/$/, "");
    if (!COMMIT_PATH_RE.test(p)) return null;
    u.pathname = p;
    u.hash = "";
    u.search = "";
    return u.toString();
  } catch {
    return null;
  }
}

function sanitizeHttpUrl(raw: string): string | null {
  let t = raw.replace(/&amp;/gi, "&").trim();
  for (let i = 0; i < 4; i++) {
    t = t.replace(/[.,;!?]+$/g, "");
    if (t.endsWith(")") && !t.includes("(")) t = t.slice(0, -1);
    else break;
  }
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function commitShortLabel(href: string, fallbackText: string): string {
  const safe = sanitizeGithubCommitUrl(href);
  if (!safe) return fallbackText;
  const m = safe.match(/\/commit\/([0-9a-f]{7,40})$/i);
  const h = (m?.[1] ?? fallbackText).replace(/[^0-9a-f]/gi, "").slice(0, 40);
  if (!h) return fallbackText;
  return h.length > 7 ? `${h.slice(0, 7)}…` : h;
}

function externalAnchor(href: string, labelHtml: string): string {
  const safe = sanitizeHttpUrl(href);
  if (!safe) return labelHtml;
  const he = escapeHtmlText(safe);
  return `<a class="update-page__commit-link" href="${he}" target="_blank" rel="noopener noreferrer">${labelHtml}</a>`;
}

marked.use({
  breaks: true,
  gfm: true,
  renderer: {
    link({ href, tokens }) {
      const rawHref = String(href ?? "").trim();
      const labelHtml = this.parser.parseInline(tokens);
      if (!rawHref) return labelHtml;
      if (sanitizeGithubCommitUrl(rawHref)) {
        const short = escapeHtmlText(commitShortLabel(rawHref, labelHtml.replace(/<[^>]+>/g, "")));
        return externalAnchor(rawHref, short);
      }
      return externalAnchor(rawHref, labelHtml);
    },
  },
});

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "h1",
    "h2",
    "h3",
    "h4",
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
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "class"],
  ALLOW_DATA_ATTR: false,
} as const;

export function releaseNotesToSafeHtml(markdown: string | null | undefined): string {
  const raw = (markdown ?? "").trim();
  if (!raw) return "";
  const parsed = marked.parse(raw) as string;
  return DOMPurify.sanitize(parsed, {
    ALLOWED_TAGS: [...PURIFY_CONFIG.ALLOWED_TAGS],
    ALLOWED_ATTR: [...PURIFY_CONFIG.ALLOWED_ATTR],
    ALLOW_DATA_ATTR: PURIFY_CONFIG.ALLOW_DATA_ATTR,
  });
}
