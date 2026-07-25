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
