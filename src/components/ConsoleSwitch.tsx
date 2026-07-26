import { cn } from "@/lib/utils";

export default function ConsoleSwitch({
  checked,
  disabled = false,
  label,
  showLabel = true,
  tone = "default",
  ariaLabel,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label?: string;
  showLabel?: boolean;
  tone?: "default" | "amber";
  ariaLabel?: string;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "console-bool-switch",
        checked && "console-bool-switch--on",
        tone === "amber" && "console-bool-switch--amber",
      )}
      onMouseDown={(e) => {
        if (disabled) return;
        // 避免聚焦时 scrollIntoView 滚到 transform 居中的 Dialog 上，把内容顶出可视区。
        e.preventDefault();
        const input = e.currentTarget.querySelector<HTMLInputElement>("input");
        input?.focus({ preventScroll: true });
      }}
    >
      <input
        type="checkbox"
        className="console-bool-switch__input"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel || label}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <span className="console-bool-switch__track" aria-hidden="true">
        <span className="console-bool-switch__thumb" />
      </span>
      {showLabel && label ? <span className="console-bool-switch__label">{label}</span> : null}
    </label>
  );
}
