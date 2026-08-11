import type { ReactNode } from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import "@/styles/status-pending.css";

type Tone = "ok" | "off" | "pending";
type StatusToneProps = Omit<BadgeProps, "variant"> & {
  pending?: boolean;
  ok?: boolean;
  pendingLabel?: string;
  okLabel?: string;
  offLabel?: string;
  showDot?: boolean;
};

/** 连接/接入类胶囊：pending 时中性「探测中」，就绪后才显示终态文案与色 */
export default function StatusTone({
  pending = false,
  ok = false,
  pendingLabel = "探测中",
  okLabel = "已连接",
  offLabel = "未连接",
  showDot = false,
  size = "regular",
  className,
  ...props
}: StatusToneProps) {
  const tone: Tone = pending ? "pending" : ok ? "ok" : "off";
  const label: ReactNode = pending ? pendingLabel : ok ? okLabel : offLabel;
  return (
    <Badge
      variant={tone === "ok" ? "success" : tone === "pending" ? "pending" : "neutral"}
      size={size}
      className={cn(
        "status-tone",
        tone === "pending" && "status-tone--pending",
        className,
      )}
      aria-busy={pending || undefined}
      aria-label={typeof label === "string" ? label : undefined}
      {...props}
    >
      {tone === "pending" || (showDot && tone === "ok") ? (
        <span className="status-tone__dot" aria-hidden />
      ) : null}
      {label}
    </Badge>
  );
}
