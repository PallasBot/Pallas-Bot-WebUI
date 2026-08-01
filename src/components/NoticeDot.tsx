import { cn } from "@/lib/utils";

/** 与侧栏「更新」提醒同款的小圆点，可嵌在 Select / Combobox 文案旁。 */
export default function NoticeDot({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn("console-notice-dot", className)}
      title={title}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    />
  );
}
