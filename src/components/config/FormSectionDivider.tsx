import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/** hub 风格分段：竖条标题 + 分隔线；操作放标题下方，不挤在线旁。 */
export default function FormSectionDivider({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("form-section-divider", className)}>
      <div className="form-section-divider__main">
        <span className="form-section-divider__bar" aria-hidden />
        <h3 className="form-section-divider__title">{title}</h3>
        <Separator className="form-section-divider__line" />
      </div>
      {action ? <div className="form-section-divider__toolbar">{action}</div> : null}
    </div>
  );
}
