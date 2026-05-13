export function slicePage<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const size = Math.max(1, pageSize);
  const p = Math.min(Math.max(1, page), totalPages(items.length, size));
  const start = (p - 1) * size;
  return items.slice(start, start + size);
}

export function totalPages(total: number, pageSize: number): number {
  const size = Math.max(1, pageSize);
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}
