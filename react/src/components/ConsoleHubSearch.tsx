import { cn } from "@/lib/utils";
import UiInput from "@/components/ui/UiInput";

/** 对齐 Vue ConsoleHubSearch：圆角搜索 + 内嵌图标 */
export default function ConsoleHubSearch({
  value,
  onValueChange,
  placeholder = "搜索…",
  ariaLabel,
  className,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("console-hub-page__search-wrap", className)}>
      <label className="console-hub-page__search">
        <span className="console-hub-page__search-ico" aria-hidden="true">
          <svg
            className="console-hub-page__search-svg"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M10.25 10.25L13.5 13.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <UiInput
          className="console-hub-page__search-input"
          type="search"
          placeholder={placeholder}
          aria-label={ariaLabel || placeholder}
          autoComplete="off"
          disabled={disabled}
          value={value}
          onValueChange={onValueChange}
        />
      </label>
    </div>
  );
}
