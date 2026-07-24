/** 画画网关字段 ↔ 配置行模型（主线 + 备线）。 */

export const DRAW_GATEWAY_PANEL_FIELD_NAMES = [
  "pallas_image_provider_id",
  "pallas_image_primary_name",
  "pallas_image_base_url",
  "pallas_image_api_key",
  "pallas_image_model",
  "pallas_image_cost_per_image",
  "pallas_image_stats_cost_currency",
  "pallas_image_api_backends",
  // 已退役：旧 AI Runtime 后端选择，隐藏以免再出现在表单
  "pallas_image_runtime_mode",
  "pallas_image_ai_runtime_fallback_to_plugin",
  "pallas_image_ai_runtime_open_circuit_failures",
  "pallas_image_ai_runtime_circuit_cooldown_sec",
] as const;

export type DrawGatewayRole = "primary" | "fallback";

export type DrawGatewayRow = {
  id: string;
  role: DrawGatewayRole;
  name: string;
  provider_id: string;
  base_url: string;
  api_key: string;
  model: string;
  omit_response_format: boolean;
  /** 单张成功费用；0 表示不计费 */
  cost_per_image: number;
};

export type DrawGatewayBackendEntry = {
  name?: string;
  provider_id?: string;
  base_url?: string;
  api_key?: string;
  model?: string;
  omit_response_format?: boolean;
  cost_per_image?: number;
};

function parseBackendsJson(raw: string): DrawGatewayBackendEntry[] {
  const t = raw.trim();
  if (!t) return [];
  try {
    const parsed = JSON.parse(t) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is DrawGatewayBackendEntry => typeof x === "object" && x !== null);
  } catch {
    return [];
  }
}

function parseCostPerImage(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function rowConfigured(row: Pick<DrawGatewayRow, "provider_id" | "base_url" | "api_key">): boolean {
  if (row.provider_id.trim()) return true;
  return Boolean(row.base_url.trim() && row.api_key.trim());
}

export function parseDrawGatewaysFromFieldValues(fieldValues: Record<string, string>): DrawGatewayRow[] {
  const rows: DrawGatewayRow[] = [
    {
      id: "primary",
      role: "primary",
      name: (fieldValues.pallas_image_primary_name ?? "").trim(),
      provider_id: (fieldValues.pallas_image_provider_id ?? "").trim(),
      base_url: (fieldValues.pallas_image_base_url ?? "").trim(),
      api_key: (fieldValues.pallas_image_api_key ?? "").trim(),
      model: (fieldValues.pallas_image_model ?? "").trim(),
      omit_response_format: false,
      cost_per_image: parseCostPerImage(fieldValues.pallas_image_cost_per_image),
    },
  ];
  const backends = parseBackendsJson(fieldValues.pallas_image_api_backends ?? "[]");
  let i = 0;
  for (const entry of backends) {
    const provider_id = String(entry.provider_id ?? "").trim();
    const base_url = String(entry.base_url ?? "").trim();
    const api_key = String(entry.api_key ?? "").trim();
    if (!provider_id && !base_url && !api_key) continue;
    rows.push({
      id: `fallback-${i}`,
      role: "fallback",
      name: String(entry.name ?? "").trim(),
      provider_id,
      base_url,
      api_key,
      model: String(entry.model ?? "").trim(),
      omit_response_format: Boolean(entry.omit_response_format),
      cost_per_image: parseCostPerImage(entry.cost_per_image),
    });
    i += 1;
  }
  return rows;
}

export function applyDrawGatewaysToFieldValues(
  fieldValues: Record<string, string>,
  rows: DrawGatewayRow[],
): Record<string, string> {
  const next = { ...fieldValues };
  const primary = rows.find((r) => r.role === "primary") ?? rows[0];
  if (primary) {
    next.pallas_image_primary_name = primary.name.trim();
    next.pallas_image_provider_id = primary.provider_id.trim();
    next.pallas_image_base_url = primary.provider_id.trim() ? "" : primary.base_url.trim();
    next.pallas_image_api_key = primary.provider_id.trim() ? "" : primary.api_key.trim();
    next.pallas_image_model = primary.model.trim();
    next.pallas_image_cost_per_image =
      primary.cost_per_image > 0 ? String(primary.cost_per_image) : "0";
  } else {
    next.pallas_image_primary_name = "";
    next.pallas_image_provider_id = "";
    next.pallas_image_base_url = "";
    next.pallas_image_api_key = "";
    next.pallas_image_model = "";
    next.pallas_image_cost_per_image = "0";
  }

  const fallbacks = rows
    .filter((r) => r.role === "fallback")
    .map((r) => {
      const item: DrawGatewayBackendEntry = {};
      const name = r.name.trim();
      const provider_id = r.provider_id.trim();
      const model = r.model.trim();
      if (name) item.name = name;
      if (provider_id) {
        item.provider_id = provider_id;
      } else {
        item.base_url = r.base_url.trim();
        item.api_key = r.api_key.trim();
      }
      if (model) item.model = model;
      if (r.omit_response_format) item.omit_response_format = true;
      if (r.cost_per_image > 0) item.cost_per_image = r.cost_per_image;
      return item;
    })
    .filter((x) => {
      if (x.provider_id?.trim()) return true;
      return Boolean(x.base_url?.trim() && x.api_key?.trim());
    });

  next.pallas_image_api_backends = JSON.stringify(fallbacks, null, 2);
  return next;
}

/** 规范化费用币种（如 cny → CNY）。 */
export function normalizeDrawCostCurrency(raw: string | undefined | null): string {
  return String(raw || "").trim().toUpperCase();
}

export function emptyDrawGatewayDraft(role: DrawGatewayRole = "fallback"): DrawGatewayRow {
  return {
    id: role === "primary" ? "primary" : `gw-${Date.now().toString(36)}`,
    role,
    name: "",
    provider_id: "",
    base_url: "",
    api_key: "",
    model: "",
    omit_response_format: false,
    cost_per_image: 0,
  };
}

export function drawGatewayChipLabel(row: DrawGatewayRow, fallbackIndex: number): string {
  const custom = row.name.trim();
  if (custom) return custom;
  if (row.provider_id.trim()) return row.provider_id.trim();
  if (row.role === "primary") return rowConfigured(row) ? "主网关" : "主网关（未配置）";
  return `备线${fallbackIndex + 1}`;
}

export function drawGatewayIsConfigured(row: DrawGatewayRow): boolean {
  return rowConfigured(row);
}

export function renormalizeDrawGatewayRows(list: DrawGatewayRow[]): DrawGatewayRow[] {
  let fallbackIndex = 0;
  return list.map((row) => {
    if (row.role === "primary") return { ...row, id: "primary", omit_response_format: false };
    const id = `fallback-${fallbackIndex}`;
    fallbackIndex += 1;
    return row.id === id ? row : { ...row, id };
  });
}

/** 按数组顺序重定主/备：第 0 项为主线，其后为备线。 */
export function orderDrawGatewaysAsPrimaryFirst(rows: DrawGatewayRow[]): DrawGatewayRow[] {
  if (!rows.length) return rows;
  return renormalizeDrawGatewayRows(
    rows.map((row, index) => ({
      ...row,
      role: index === 0 ? ("primary" as const) : ("fallback" as const),
      omit_response_format: index === 0 ? false : row.omit_response_format,
    })),
  );
}

export function moveDrawGatewayRow(
  rows: DrawGatewayRow[],
  fromIndex: number,
  toIndex: number,
): DrawGatewayRow[] {
  if (
    fromIndex === toIndex
    || fromIndex < 0
    || toIndex < 0
    || fromIndex >= rows.length
    || toIndex >= rows.length
  ) {
    return rows;
  }
  const next = [...rows];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return orderDrawGatewaysAsPrimaryFirst(next);
}

export function promoteDrawFallbackToPrimary(
  rows: DrawGatewayRow[],
  fallbackId: string,
): DrawGatewayRow[] {
  const index = rows.findIndex((r) => r.id === fallbackId && r.role === "fallback");
  if (index < 0) return rows;
  return moveDrawGatewayRow(rows, index, 0);
}
