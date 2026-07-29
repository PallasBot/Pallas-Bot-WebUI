/** Runtime 安装 / 媒体资产下载等任务进度条。 */

import "@/styles/console/ai-hub.css";

export default function AiJobProgressBlock({
  label,
  percent,
  lines,
  failedTail,
  failed = false,
}: {
  label: string;
  percent: number;
  lines: string[];
  failedTail?: string;
  failed?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const logText = (failedTail || "").trim() || lines.join("\n");
  return (
    <div
      className={`ai-install-progress${failed ? " ai-install-progress--failed" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="ai-install-progress__head">
        <span className="ai-install-progress__label truncate" title={label || undefined}>
          {label || "进行中…"}
        </span>
        <span className="ai-install-progress__pct">{pct}%</span>
      </div>
      <div
        className="ai-install-progress__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={label || "任务进度"}
      >
        <span
          className={`ai-install-progress__fill${pct >= 100 ? " ai-install-progress__fill--done" : ""}`}
          style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
        />
      </div>
      {logText ? <pre className="ai-install-progress__log">{logText}</pre> : null}
    </div>
  );
}
