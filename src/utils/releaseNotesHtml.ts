/**
 * 将 GitHub Release 说明中的 commit 引用从 Markdown 形式转为可点击链接，
 * 并对其余内容做 HTML 转义（避免 v-html 注入）。不引入 Markdown 解析依赖。
 *
 * 匹配：`([7–40位hex](https://github.com/owner/repo/commit/fullhex))`
 */

const COMMIT_MD_LINK_RE =
  /\(\[([0-9a-f]{7,40})\]\((https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/commit\/[0-9a-f]{7,40})\)\)/gi;

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

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.replace(/\n/g, "<br>\n");
  return s;
}
