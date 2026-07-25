/** 通用 Provider 主线/备线：与插件 Config ``ui_gateway`` 绑定。 */

export type ProviderGatewayMode = "unified" | "split";
export type ProviderGatewayRole = "primary" | "fallback";

export type ProviderGatewayBinding = {
  mode: ProviderGatewayMode;
  allow_manual?: boolean;
  capability?: string | null;
  /** unified：JSON 数组字段名 */
  field?: string;
  /** split：逻辑键 → 配置字段名 */
  primary?: Record<string, string>;
  /** split：备线 JSON 数组字段名 */
  backends?: string;
  currency_field?: string;
  title?: string;
  subtitle?: string;
};

export type ProviderGatewayRow = {
  id: string;
  role: ProviderGatewayRole;
  name: string;
  provider_id: string;
  base_url: string;
  api_key: string;
  model: string;
  omit_response_format: boolean;
  cost_per_image: number;
};

export type ProviderGatewayBackendEntry = {
  name?: string;
  provider_id?: string;
  base_url?: string;
  api_key?: string;
  model?: string;
  omit_response_format?: boolean;
  cost_per_image?: number;
};

/** 画画现网绑定（split + 手填 + 费用）。 */
export const DRAW_PROVIDER_GATEWAY_BINDING: ProviderGatewayBinding = {
  mode: "split",
  allow_manual: true,
  capability: "image",
  primary: {
    provider_id: "pallas_image_provider_id",
    name: "pallas_image_primary_name",
    base_url: "pallas_image_base_url",
    api_key: "pallas_image_api_key",
    model: "pallas_image_model",
    cost_per_image: "pallas_image_cost_per_image",
  },
  backends: "pallas_image_api_backends",
  currency_field: "pallas_image_stats_cost_currency",
  title: "画图网关",
};

export function normalizeProviderGatewayBinding(
  raw: unknown,
  options?: { anchorField?: string },
): ProviderGatewayBinding | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const mode = String(obj.mode || "unified").trim().toLowerCase();
  if (mode !== "unified" && mode !== "split") return null;
  const binding: ProviderGatewayBinding = {
    mode,
    allow_manual: Boolean(obj.allow_manual),
    capability: obj.capability == null ? null : String(obj.capability),
    field: obj.field != null ? String(obj.field) : options?.anchorField,
    backends: obj.backends != null ? String(obj.backends) : undefined,
    currency_field: obj.currency_field != null ? String(obj.currency_field) : undefined,
    title: obj.title != null ? String(obj.title) : undefined,
    subtitle: obj.subtitle != null ? String(obj.subtitle) : undefined,
  };
  if (obj.primary && typeof obj.primary === "object") {
    const primary: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj.primary as Record<string, unknown>)) {
      const name = String(v || "").trim();
      if (name) primary[k] = name;
    }
    binding.primary = primary;
  }
  return binding;
}

export function providerGatewayBoundFieldNames(binding: ProviderGatewayBinding, anchor: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const add = (name: string | undefined) => {
    const key = String(name || "").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    names.push(key);
  };
  if (binding.mode === "split") {
    if (binding.primary) {
      for (const value of Object.values(binding.primary)) add(value);
    }
    add(binding.backends);
  } else {
    add(binding.field || anchor);
  }
  add(binding.currency_field);
  return names;
}

function parseBackendsJson(raw: string): ProviderGatewayBackendEntry[] {
  const t = raw.trim();
  if (!t) return [];
  try {
    const parsed = JSON.parse(t) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is ProviderGatewayBackendEntry => typeof x === "object" && x !== null);
  } catch {
    return [];
  }
}

function parseCostPerImage(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function rowConfigured(row: Pick<ProviderGatewayRow, "provider_id" | "base_url" | "api_key">): boolean {
  if (row.provider_id.trim()) return true;
  return Boolean(row.base_url.trim() && row.api_key.trim());
}

function primaryField(binding: ProviderGatewayBinding, key: string): string {
  return String(binding.primary?.[key] || "").trim();
}

export function parseProviderGatewaysFromFieldValues(
  fieldValues: Record<string, string>,
  binding: ProviderGatewayBinding,
): ProviderGatewayRow[] {
  if (binding.mode === "unified") {
    const field = String(binding.field || "").trim();
    const entries = parseBackendsJson(fieldValues[field] ?? "[]");
    if (!entries.length) {
      return [emptyProviderGatewayDraft("primary")];
    }
    return renormalizeProviderGatewayRows(
      entries.map((entry, index) => ({
        id: index === 0 ? "primary" : `fallback-${index - 1}`,
        role: index === 0 ? ("primary" as const) : ("fallback" as const),
        name: String(entry.name ?? "").trim(),
        provider_id: String(entry.provider_id ?? "").trim(),
        base_url: String(entry.base_url ?? "").trim(),
        api_key: String(entry.api_key ?? "").trim(),
        model: String(entry.model ?? "").trim(),
        omit_response_format: Boolean(entry.omit_response_format),
        cost_per_image: parseCostPerImage(entry.cost_per_image),
      })),
    );
  }

  const pid = primaryField(binding, "provider_id");
  const name = primaryField(binding, "name");
  const baseUrl = primaryField(binding, "base_url");
  const apiKey = primaryField(binding, "api_key");
  const model = primaryField(binding, "model");
  const cost = primaryField(binding, "cost_per_image");
  const rows: ProviderGatewayRow[] = [
    {
      id: "primary",
      role: "primary",
      name: (fieldValues[name] ?? "").trim(),
      provider_id: (fieldValues[pid] ?? "").trim(),
      base_url: (fieldValues[baseUrl] ?? "").trim(),
      api_key: (fieldValues[apiKey] ?? "").trim(),
      model: (fieldValues[model] ?? "").trim(),
      omit_response_format: false,
      cost_per_image: parseCostPerImage(fieldValues[cost]),
    },
  ];
  const backendsField = String(binding.backends || "").trim();
  const backends = parseBackendsJson(fieldValues[backendsField] ?? "[]");
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

export function applyProviderGatewaysToFieldValues(
  fieldValues: Record<string, string>,
  rows: ProviderGatewayRow[],
  binding: ProviderGatewayBinding,
): Record<string, string> {
  const next = { ...fieldValues };
  if (binding.mode === "unified") {
    const field = String(binding.field || "").trim();
    const payload = renormalizeProviderGatewayRows(rows).map((r) => {
      const item: ProviderGatewayBackendEntry = {};
      if (r.name.trim()) item.name = r.name.trim();
      if (r.provider_id.trim()) {
        item.provider_id = r.provider_id.trim();
      } else if (binding.allow_manual) {
        item.base_url = r.base_url.trim();
        item.api_key = r.api_key.trim();
      }
      if (r.model.trim()) item.model = r.model.trim();
      if (r.omit_response_format) item.omit_response_format = true;
      if (r.cost_per_image > 0) item.cost_per_image = r.cost_per_image;
      return item;
    });
    next[field] = JSON.stringify(payload, null, 2);
    return next;
  }

  const primary = rows.find((r) => r.role === "primary") ?? rows[0];
  const setPrimary = (logical: string, value: string) => {
    const field = primaryField(binding, logical);
    if (field) next[field] = value;
  };
  if (primary) {
    setPrimary("name", primary.name.trim());
    setPrimary("provider_id", primary.provider_id.trim());
    setPrimary("base_url", primary.provider_id.trim() ? "" : primary.base_url.trim());
    setPrimary("api_key", primary.provider_id.trim() ? "" : primary.api_key.trim());
    setPrimary("model", primary.model.trim());
    setPrimary("cost_per_image", primary.cost_per_image > 0 ? String(primary.cost_per_image) : "0");
  } else {
    setPrimary("name", "");
    setPrimary("provider_id", "");
    setPrimary("base_url", "");
    setPrimary("api_key", "");
    setPrimary("model", "");
    setPrimary("cost_per_image", "0");
  }

  const backendsField = String(binding.backends || "").trim();
  const fallbacks = rows
    .filter((r) => r.role === "fallback")
    .map((r) => {
      const item: ProviderGatewayBackendEntry = {};
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
  if (backendsField) next[backendsField] = JSON.stringify(fallbacks, null, 2);
  return next;
}

export function normalizeGatewayCostCurrency(raw: string | undefined | null): string {
  return String(raw || "").trim().toUpperCase();
}

export function emptyProviderGatewayDraft(role: ProviderGatewayRole = "fallback"): ProviderGatewayRow {
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

export function providerGatewayChipLabel(row: ProviderGatewayRow, fallbackIndex: number): string {
  const custom = row.name.trim();
  if (custom) return custom;
  if (row.provider_id.trim()) return row.provider_id.trim();
  if (row.role === "primary") return rowConfigured(row) ? "主网关" : "主网关（未配置）";
  return `备线${fallbackIndex + 1}`;
}

export function providerGatewayIsConfigured(row: ProviderGatewayRow): boolean {
  return rowConfigured(row);
}

export function renormalizeProviderGatewayRows(list: ProviderGatewayRow[]): ProviderGatewayRow[] {
  let fallbackIndex = 0;
  return list.map((row) => {
    if (row.role === "primary") return { ...row, id: "primary", omit_response_format: false };
    const id = `fallback-${fallbackIndex}`;
    fallbackIndex += 1;
    return row.id === id ? row : { ...row, id };
  });
}

export function orderProviderGatewaysAsPrimaryFirst(rows: ProviderGatewayRow[]): ProviderGatewayRow[] {
  if (!rows.length) return rows;
  return renormalizeProviderGatewayRows(
    rows.map((row, index) => ({
      ...row,
      role: index === 0 ? ("primary" as const) : ("fallback" as const),
      omit_response_format: index === 0 ? false : row.omit_response_format,
    })),
  );
}

export function moveProviderGatewayRow(
  rows: ProviderGatewayRow[],
  fromIndex: number,
  toIndex: number,
): ProviderGatewayRow[] {
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
  return orderProviderGatewaysAsPrimaryFirst(next);
}

export function promoteProviderFallbackToPrimary(
  rows: ProviderGatewayRow[],
  fallbackId: string,
): ProviderGatewayRow[] {
  const index = rows.findIndex((r) => r.id === fallbackId && r.role === "fallback");
  if (index < 0) return rows;
  return moveProviderGatewayRow(rows, index, 0);
}
