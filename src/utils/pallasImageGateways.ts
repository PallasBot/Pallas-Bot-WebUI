export const PALLAS_IMAGE_GATEWAY_FIELD_NAMES = [
  "pallas_image_primary_name",
  "pallas_image_base_url",
  "pallas_image_api_key",
  "pallas_image_model",
  "pallas_image_api_backends",
] as const;

export type PallasImageGatewayRole = "primary" | "fallback";

export type PallasImageGatewayRow = {
  id: string;
  role: PallasImageGatewayRole;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  omit_response_format: boolean;
};

export type PallasImageBackendEntry = {
  name?: string;
  base_url: string;
  api_key: string;
  model?: string;
  omit_response_format?: boolean;
};

function newId(): string {
  return `gw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseBackendsJson(raw: string): PallasImageBackendEntry[] {
  const t = raw.trim();
  if (!t) return [];
  const parsed = JSON.parse(t) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((x): x is PallasImageBackendEntry => typeof x === "object" && x !== null);
}

/** 旧环境仅写 api_backends、主站三字段为空时，将首条备选提升为主网关（与 Bot 端 migrate 一致）。 */
export function migrateLegacyGatewayFieldValues(
  fieldValues: Record<string, string>,
): Record<string, string> {
  const baseUrl = (fieldValues.pallas_image_base_url ?? "").trim();
  const apiKey = (fieldValues.pallas_image_api_key ?? "").trim();
  if (baseUrl && apiKey) return fieldValues;

  let backends: PallasImageBackendEntry[] = [];
  try {
    backends = parseBackendsJson(fieldValues.pallas_image_api_backends ?? "[]");
  } catch {
    return fieldValues;
  }
  if (!backends.length) return fieldValues;

  const first = backends[0];
  const firstUrl = String(first.base_url ?? "").trim();
  const firstKey = String(first.api_key ?? "").trim();
  if (!firstUrl || !firstKey) return fieldValues;

  const firstName = String(first.name ?? "").trim();
  const firstModel = String(first.model ?? "").trim();
  const globalModel = (fieldValues.pallas_image_model ?? "").trim();
  const next: Record<string, string> = {
    ...fieldValues,
    pallas_image_base_url: firstUrl,
    pallas_image_api_key: firstKey,
    pallas_image_api_backends: JSON.stringify(backends.slice(1), null, 2),
    pallas_image_model: firstModel || globalModel,
  };
  if (!(fieldValues.pallas_image_primary_name ?? "").trim() && firstName) {
    next.pallas_image_primary_name = firstName;
  }
  return next;
}

export function parseGatewaysFromFieldValues(fieldValues: Record<string, string>): PallasImageGatewayRow[] {
  const fv = migrateLegacyGatewayFieldValues(fieldValues);
  const rows: PallasImageGatewayRow[] = [
    {
      id: "primary",
      role: "primary",
      name: (fv.pallas_image_primary_name ?? "").trim(),
      base_url: (fv.pallas_image_base_url ?? "").trim(),
      api_key: (fv.pallas_image_api_key ?? "").trim(),
      model: (fv.pallas_image_model ?? "").trim(),
      omit_response_format: false,
    },
  ];
  let backends: PallasImageBackendEntry[] = [];
  try {
    backends = parseBackendsJson(fv.pallas_image_api_backends ?? "[]");
  } catch {
    backends = [];
  }
  for (const entry of backends) {
    const base_url = String(entry.base_url ?? "").trim();
    const api_key = String(entry.api_key ?? "").trim();
    if (!base_url && !api_key) continue;
    rows.push({
      id: newId(),
      role: "fallback",
      name: String(entry.name ?? "").trim(),
      base_url,
      api_key,
      model: String(entry.model ?? "").trim(),
      omit_response_format: Boolean(entry.omit_response_format),
    });
  }
  return rows;
}

export function applyGatewaysToFieldValues(
  fieldValues: Record<string, string>,
  rows: PallasImageGatewayRow[],
): Record<string, string> {
  const next = { ...fieldValues };
  const primary = rows.find((r) => r.role === "primary") ?? rows[0];
  if (primary) {
    next.pallas_image_primary_name = primary.name.trim();
    next.pallas_image_base_url = primary.base_url.trim();
    next.pallas_image_api_key = primary.api_key.trim();
    next.pallas_image_model = primary.model.trim();
  } else {
    next.pallas_image_primary_name = "";
    next.pallas_image_base_url = "";
    next.pallas_image_api_key = "";
    next.pallas_image_model = "";
  }
  const fallbacks = rows
    .filter((r) => r.role === "fallback")
    .map((r) => {
      const item: PallasImageBackendEntry = {
        base_url: r.base_url.trim(),
        api_key: r.api_key.trim(),
      };
      const name = r.name.trim();
      const model = r.model.trim();
      if (name) item.name = name;
      if (model) item.model = model;
      if (r.omit_response_format) item.omit_response_format = true;
      return item;
    })
    .filter((x) => x.base_url && x.api_key);
  next.pallas_image_api_backends = JSON.stringify(fallbacks, null, 2);
  return next;
}

export function maskApiKey(key: string): string {
  const t = key.trim();
  if (!t) return "未设置";
  if (t.length <= 8) return "••••••••";
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

export function defaultGatewayDisplayName(row: PallasImageGatewayRow, fallbackIndex: number): string {
  const custom = row.name.trim();
  if (custom) return custom;
  if (row.role === "primary") return "主网关";
  return `备线${fallbackIndex}`;
}
