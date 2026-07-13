export function moveFallbackIndex(ids: string[], index: number, dir: -1 | 1): string[] {
  const next = [...ids];
  const target = index + dir;
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function addFallbackId(ids: string[], id: string): string[] {
  const t = id.trim();
  if (!t || ids.includes(t)) return [...ids];
  return [...ids, t];
}

export function removeFallbackId(ids: string[], index: number): string[] {
  return ids.filter((_, i) => i !== index);
}
