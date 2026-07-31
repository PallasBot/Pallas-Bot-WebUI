/** React Query：是否已有可用结论（含明确空数据），避免假终态闪现 */

export type QuerySettledLike = {
  isFetched: boolean;
  data?: unknown;
};

export function querySettled(q: QuerySettledLike): boolean {
  return q.isFetched || q.data != null;
}
