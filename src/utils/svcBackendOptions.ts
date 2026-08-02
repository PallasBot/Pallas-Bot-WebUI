/** 唱歌 SVC 后端：展示名与已知 id（与 AI registry 对齐；接口未返回时仍可选手动指定）。 */

export type SvcBackendOptionSource = {
  id?: string;
  enabled?: boolean;
  script_present?: boolean;
  arg_style?: string;
};

const SVC_BACKEND_LABELS: Record<string, string> = {
  "ddsp_6.2": "DDSP-SVC 6.2",
  "ddsp_6.1": "DDSP-SVC 6.1",
  "ddsp_6.3": "DDSP-SVC 6.3",
  rvc: "RVC",
  "sovits_4.1": "SoVITS 4.1",
  "sovits_4.0": "SoVITS 4.0",
};

/** 与 AI `registry.yaml` fallback_order 大致同序；未知 id 仍可从接口追加。 */
export const KNOWN_SVC_BACKEND_IDS = [
  "ddsp_6.2",
  "ddsp_6.1",
  "ddsp_6.3",
  "rvc",
  "sovits_4.1",
  "sovits_4.0",
] as const;

export function svcBackendLabel(id: string): string {
  const key = String(id || "").trim();
  if (!key) return "";
  return SVC_BACKEND_LABELS[key] || key;
}

export type SvcBackendSelectOption = {
  value: string;
  label: string;
  description?: string;
};

/**
 * 合并接口返回与已知后端（含 rvc），供全局 / 按音色优先推理下拉使用。
 * `preferIds`：该音色已探测到的兼容后端，会排在前面并标注。
 */
export function buildSvcBackendSelectOptions(
  backends: SvcBackendOptionSource[] | undefined | null,
  preferIds?: string[] | null,
): SvcBackendSelectOption[] {
  const byId = new Map<string, SvcBackendOptionSource>();
  for (const row of backends || []) {
    const id = String(row?.id || "").trim();
    if (!id) continue;
    byId.set(id, row);
  }
  for (const id of KNOWN_SVC_BACKEND_IDS) {
    if (!byId.has(id)) byId.set(id, { id });
  }
  for (const raw of preferIds || []) {
    const id = String(raw || "").trim();
    if (id && !byId.has(id)) byId.set(id, { id });
  }

  const prefer = new Set(
    (preferIds || []).map((x) => String(x || "").trim()).filter(Boolean),
  );

  const ids = [...byId.keys()].sort((a, b) => {
    const pa = prefer.has(a) ? 0 : 1;
    const pb = prefer.has(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const ia = KNOWN_SVC_BACKEND_IDS.indexOf(a as (typeof KNOWN_SVC_BACKEND_IDS)[number]);
    const ib = KNOWN_SVC_BACKEND_IDS.indexOf(b as (typeof KNOWN_SVC_BACKEND_IDS)[number]);
    const sa = ia < 0 ? 999 : ia;
    const sb = ib < 0 ? 999 : ib;
    if (sa !== sb) return sa - sb;
    return a.localeCompare(b);
  });

  return ids.map((id) => {
    const row = byId.get(id) || { id };
    const bits: string[] = [];
    if (prefer.has(id)) bits.push("该音色可用");
    if (row.enabled === false) bits.push("已禁用");
    if (row.script_present === false) bits.push("入口未就绪");
    if (row.arg_style) bits.push(String(row.arg_style));
    const fromApi = (backends || []).some((b) => String(b?.id || "").trim() === id);
    if (!fromApi) bits.push("需 AI Runtime 支持");
    return {
      value: id,
      label: svcBackendLabel(id),
      description: bits.length ? bits.join(" · ") : undefined,
    };
  });
}

/** 仅 id 列表（兼容旧 AiModelSelect）。 */
export function buildSvcBackendIdList(
  backends: SvcBackendOptionSource[] | undefined | null,
  preferIds?: string[] | null,
): string[] {
  return buildSvcBackendSelectOptions(backends, preferIds).map((row) => row.value);
}
