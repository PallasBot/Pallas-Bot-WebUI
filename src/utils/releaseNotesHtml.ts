/**
 * 将 GitHub Release 说明转为可安全用于 v-html 的片段：
 * - commit 引用：`([7–40位hex](https://github.com/owner/repo/commit/fullhex))`
 * - Markdown 链接：`[标签](https://...)`（标签与 URL 均经转义 / 校验）
 * - 裸露 http(s) 链接：常见于「文档：」「完整变更：」等；避免匹配 `href="...` 内的地址
 */

const COMMIT_MD_LINK_RE =
  /\(\[([0-9a-f]{7,40})\]\((https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/commit\/[0-9a-f]{7,40})\)\)/gi;

const MD_LINK_RE = /\[([^\]]*)\]\((https?:\/\/[^)\s<>]+)\)/gi;

/** 裸露 URL：前接行首、空白或常见中文标点，且前一位不是 = " '，避免匹配属性值 */
const BARE_URL_RE = /(^|[^"'=A-Za-z0-9/\\])(https?:\/\/[^\s<]+)/gi;

function sanitizeGithubCommitUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (u.hostname.toLowerCase() !== "github.com") return null;
    const p = u.pathname.replace(/\/$/, "");
    if (!/^\/[^/]+\/[^/]+\/commit\/[0-9a-f]{7,40}$/i.test(p)) return null;
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

/** display 须为已 HTML 转义的纯文本片段（与全串 escape 后截取一致），避免 & 等被二次转义 */
function externalAnchor(href: string, displayHtmlEscaped: string): string {
  const safe = sanitizeHttpUrl(href);
  if (!safe) return displayHtmlEscaped;
  const he = escapeHtmlText(safe);
  return `<a class="update-page__commit-link" href="${he}" target="_blank" rel="noopener noreferrer">${displayHtmlEscaped}</a>`;
}

export function releaseNotesToSafeHtml(markdown: string | null | undefined): string {
  const raw = (markdown ?? "").trim();
  if (!raw) return "";

  let s = escapeHtmlText(raw);

  s = s.replace(COMMIT_MD_LINK_RE, (_m, hash: string, url: string) => {
    const safeUrl = sanitizeGithubCommitUrl(url);
    if (!safeUrl) return "";
    const h = String(hash).replace(/[^0-9a-f]/gi, "").slice(0, 40);
    const short = h.length > 7 ? `${h.slice(0, 7)}…` : h;
    const href = escapeHtmlText(safeUrl);
    return `<a class="update-page__commit-link" href="${href}" target="_blank" rel="noopener noreferrer">${short}</a>`;
  });

  s = s.replace(MD_LINK_RE, (full, label: string, url: string) => {
    const safe = sanitizeHttpUrl(url);
    if (!safe) return full;
    const lab = String(label ?? "").trim() || escapeHtmlText(safe);
    return externalAnchor(safe, lab);
  });

  s = s.replace(BARE_URL_RE, (full, pre: string, url: string) => {
    const safe = sanitizeHttpUrl(url);
    if (!safe) return full;
    return pre + externalAnchor(safe, escapeHtmlText(safe));
  });

  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.replace(/\n/g, "<br>\n");
  return s;
}
