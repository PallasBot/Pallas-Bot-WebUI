import type { AiProxyResult } from "@/api/pallasTypes";

/** 从 AiProxyResult.data 取出对象负载（非对象 / 数组时回退为空对象）。 */
export function proxyDataRecord(result: AiProxyResult | null | undefined): Record<string, unknown> {
  const d = result?.data;
  if (d && typeof d === "object" && !Array.isArray(d)) return d as Record<string, unknown>;
  return {};
}

/** 读取负载里的字符串字段（缺失 / 非字符串时回退默认值）。 */
export function proxyString(payload: Record<string, unknown>, key: string, fallback = ""): string {
  const v = payload[key];
  return typeof v === "string" ? v : fallback;
}

/** 判断负载里的 code 是否等于期望值（兼容数字与字符串）。 */
export function proxyCodeEquals(payload: Record<string, unknown>, expected: number): boolean {
  const v = payload.code;
  return v === expected || v === String(expected);
}
