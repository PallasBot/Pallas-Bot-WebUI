export type AiExtensionLogKind = "uvicorn" | "celery" | "celery-media";

export const AI_EXTENSION_LOG_KINDS: { id: AiExtensionLogKind; label: string }[] = [
  { id: "uvicorn", label: "Web 服务（uvicorn）" },
  { id: "celery", label: "Celery · LLM" },
  { id: "celery-media", label: "Celery · 媒体" },
];

export const AI_LOG_DEFAULTS = { lines: 200, lineOptions: [100, 200, 500, 1000] as number[] };

export const AI_NCM_DEFAULTS = { countryCode: 86, phoneMinLength: 5, captchaMinLength: 2 };
