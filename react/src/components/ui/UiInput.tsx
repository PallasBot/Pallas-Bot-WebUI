import { useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value?: string;
  onValueChange?: (value: string) => void;
  invalid?: boolean;
  revealable?: boolean;
  wrapClassName?: string;
};

export default function UiInput({
  value = "",
  onValueChange,
  type = "text",
  invalid = false,
  revealable = false,
  disabled,
  className,
  wrapClassName,
  ...rest
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const showEye = type === "password" && revealable;
  const inputType = showEye ? (revealed ? "text" : "password") : type;

  return (
    <div className={cn("ui-input-wrap", showEye && "ui-input-wrap--revealable", wrapClassName, className)}>
      <input
        {...rest}
        className={cn("inp ui-input", invalid && "ui-input--invalid")}
        type={inputType}
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange?.(e.target.value)}
      />
      {showEye ? (
        <button
          type="button"
          className="ui-input__eye"
          aria-label={revealed ? "隐藏内容" : "显示内容"}
          aria-pressed={revealed}
          disabled={disabled}
          onClick={() => setRevealed((v) => !v)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            {revealed ? (
              <>
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                <path d="M9.4 5.2A9.4 9.4 0 0 1 12 4.9c5 0 9 4.1 9 7.1a11 11 0 0 1-2.4 3.3" />
                <path d="M6.2 6.7A11 11 0 0 0 3 12c0 3 4 7.1 9 7.1a9.6 9.6 0 0 0 3.3-.6" />
              </>
            ) : (
              <>
                <path d="M3 12c0-3 4-7.1 9-7.1s9 4.1 9 7.1-4 7.1-9 7.1S3 15 3 12Z" />
                <circle cx="12" cy="12" r="2.4" />
              </>
            )}
          </svg>
        </button>
      ) : null}
    </div>
  );
}
