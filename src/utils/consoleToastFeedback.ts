import { axiosErrorDetail } from "@/api/http";

import { pushConsoleToast, type ConsoleToastLevel } from "./consoleToast";

export function toastSaveSuccess(message = "配置已保存"): void {
  pushConsoleToast(message, "ok");
}

export function toastApiError(e: unknown, fallback = "操作失败"): void {
  const detail = axiosErrorDetail(e);
  pushConsoleToast(detail.trim() || fallback, "err");
}

export function toastProbeLines(lines: string[]): void {
  if (!lines.length) {
    pushConsoleToast("检测完成：无结果", "warn");
    return;
  }
  const bad = lines.filter(
    (line) =>
      /：HTTP |：超时|：连接失败|：不可用|：未启用|：未配置/.test(line) && !/：\d+ms/.test(line),
  );
  let level: ConsoleToastLevel = "ok";
  let message: string;
  if (bad.length === 0) {
    message = `检测完成：${lines.length} 项正常`;
  } else if (bad.length === lines.length) {
    level = "err";
    message = `检测完成：${bad.length} 项异常`;
  } else {
    level = "warn";
    message = `检测完成：${lines.length - bad.length}/${lines.length} 项正常`;
  }
  pushConsoleToast(message, level);
}
