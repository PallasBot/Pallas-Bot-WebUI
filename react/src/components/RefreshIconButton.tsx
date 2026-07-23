import { cn } from "@/lib/utils";

export default function RefreshIconButton({
  busy = false,
  disabled = false,
  label = "刷新",
  busyLabel = "刷新中…",
  showLabel = false,
  embedded = true,
  className,
  onClick,
}: {
  busy?: boolean;
  disabled?: boolean;
  label?: string;
  busyLabel?: string;
  showLabel?: boolean;
  embedded?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  function handleClick() {
    if (busy || disabled) return;
    onClick?.();
  }

  return (
    <button
      type="button"
      className={cn(
        "ui-btn btn-refresh-action",
        embedded ? "ui-btn--ghost btn-refresh-action--embedded" : "ui-btn--outline",
        busy && "btn-refresh-action--busy",
        !showLabel && "btn-refresh-action--icon-only",
        className,
      )}
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={handleClick}
    >
      <svg
        className={cn("ui-btn__ico btn-refresh-action__ico", busy && "btn-refresh-action__ico--spin")}
        viewBox="0 0 24 24"
        width={16}
        height={16}
        aria-hidden="true"
      >
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"
        />
      </svg>
      {showLabel ? <span className="btn-refresh-action__text">{busy ? busyLabel : label}</span> : null}
    </button>
  );
}
