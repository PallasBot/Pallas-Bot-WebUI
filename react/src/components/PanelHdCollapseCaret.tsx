import { cn } from "@/lib/utils";

export default function PanelHdCollapseCaret({
  expanded,
  label,
  onToggle,
  className,
}: {
  expanded: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
}) {
  const ariaLabel = expanded ? `收起${label}` : `展开${label}`;
  return (
    <button
      type="button"
      className={cn("panel-hd-collapse-caret", className)}
      aria-expanded={expanded}
      aria-label={ariaLabel}
      onClick={onToggle}
    >
      <span className="panel-hd-collapse-caret-ico" aria-hidden="true" />
    </button>
  );
}
