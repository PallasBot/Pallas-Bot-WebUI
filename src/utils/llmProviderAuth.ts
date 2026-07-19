/** Provider 密钥展示用掩码（与 Pallas 图片网关一致风格）。 */
export function maskProviderApiKey(key: string): string {
  const text = key.trim();
  if (!text) return "";
  if (text.length <= 8) return "****";
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

export function providerAuthSummary(row: {
  api_key_set?: boolean;
  api_key_env?: string;
}): string {
  if (row.api_key_set) return "密钥已配置";
  const env = (row.api_key_env ?? "").trim();
  if (env) return `环境变量 ${env}`;
  return "未配置密钥";
}
