import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** 卡片折叠开关：标题区右侧的箭头按钮。 */
export default function CollapseToggle({
  open,
  onToggle,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${open ? "收起" : "展开"}${label}`}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
    >
      <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
    </button>
  );
}
