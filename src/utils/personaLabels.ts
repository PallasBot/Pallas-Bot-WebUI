/** 牛格观测 / 群风格：常见英文字段 → 中文展示。未知值原样返回。 */

const PERSONA_VALUE_ZH: Record<string, string> = {
  // source / seed_source
  auto: "自动",
  manual: "手动",
  cross_group: "跨群",
  none: "无",
  llm: "模型",
  heuristic: "启发式",

  // archetype（与后端 _ARCHETYPE_LABELS 对齐；preset_label 可能已是中文）
  terse: "寡言",
  chaotic: "混沌",
  polite: "礼貌",

  // tone
  neutral: "中性",
  calm: "平和",
  enthusiastic: "热情",
  dramatic: "夸张",

  // length_pref
  any: "不限",
  short: "偏短",
  medium: "适中",
  long: "偏长",
  unknown: "未知",

  // seed prefs
  restrained: "克制",
  warm: "温暖",

  // activity_level
  quiet: "安静",
  normal: "正常",
  active: "活跃",

  // export purpose
  chat: "对话",
  repeater: "复读",
};

export function personaValueZh(raw: unknown, fallback = "—"): string {
  const text = String(raw ?? "").trim();
  if (!text) return fallback;
  const mapped = PERSONA_VALUE_ZH[text.toLowerCase()];
  return mapped ?? text;
}

export function personaValuesZh(values: unknown[] | null | undefined, sep = " · "): string {
  const list = (values ?? [])
    .map((v) => personaValueZh(v, ""))
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list.join(sep) : "无";
}
