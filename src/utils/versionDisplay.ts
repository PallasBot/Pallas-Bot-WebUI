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
