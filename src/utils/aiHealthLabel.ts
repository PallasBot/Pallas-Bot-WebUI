/** AI 运行态 / 健康检查字段 → 控制台展示文案 */

const HEALTH_LABELS: Record<string, string> = {
  healthy: "正常",
  degraded: "降级",
  unhealthy: "异常",
  unknown: "未知",
};

const CIRCUIT_LABELS: Record<string, string> = {
  closed: "闭合",
  open: "熔断",
  half_open: "半开",
};

const DEGRADED_LABELS: Record<string, string> = {
  normal: "正常",
  degraded: "降级",
  busy: "繁忙",
  overloaded: "过载",
};

const FAILURE_CLASS_LABELS: Record<string, string> = {
  provider_unavailable: "上游不可用",
  provider_error: "上游错误",
  invalid_upstream_response: "上游响应异常",
  invalid_request: "请求无效",
  internal_error: "内部错误",
  runtime_overloaded: "运行过载",
  task_failed: "任务失败",
};

function lookupLabel(map: Record<string, string>, raw?: string | null): string {
  const text = String(raw ?? "").trim();
  if (!text) return "—";
  const key = text.toLowerCase();
  return map[key] ?? text;
}

export function aiHealthStateLabel(raw?: string | null): string {
  return lookupLabel(HEALTH_LABELS, raw);
}

export function aiCircuitStateLabel(raw?: string | null): string {
  return lookupLabel(CIRCUIT_LABELS, raw);
}

export function aiDegradedStateLabel(raw?: string | null): string {
  return lookupLabel(DEGRADED_LABELS, raw);
}

export function aiFailureClassLabel(raw?: string | null): string {
  return lookupLabel(FAILURE_CLASS_LABELS, raw);
}
