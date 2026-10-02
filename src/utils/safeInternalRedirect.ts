export function safeInternalRedirect(raw: string | null, origin: string): string {
  if (!raw?.startsWith("/") || raw.includes("\\")) return "/";
  try {
    const base = new URL(origin);
    const target = new URL(raw, base);
    const decodedPath = decodeURIComponent(target.pathname);
    if (
      target.origin !== base.origin ||
      decodedPath.startsWith("//") ||
      decodedPath.includes("\\")
    ) {
      return "/";
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}
