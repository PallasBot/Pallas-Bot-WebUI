/**
 * @deprecated 新代码请直接用 `@/components/ui/input` 的 `Input`。
 * 保留 onValueChange / revealable 以兼容现有表单。
 */
import { useState, type CSSProperties, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value?: string;
  onValueChange?: (value: string) => void;
  invalid?: boolean;
  revealable?: boolean;
  wrapClassName?: string;
  wrapStyle?: CSSProperties;
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
  wrapStyle,
  style,
  ...rest
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const showEye = type === "password" && revealable;
  const inputType = showEye ? (revealed ? "text" : "password") : type;

  return (
    <div
      className={cn("relative w-full", showEye && "pr-0", wrapClassName, !showEye && className)}
      style={wrapStyle ?? style}
    >
      <Input
        {...rest}
        className={cn(showEye && "pr-10", invalid && "border-destructive focus-visible:ring-destructive", className)}
        type={inputType}
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange?.(e.target.value)}
        aria-invalid={invalid || undefined}
      />
      {showEye ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
          aria-label={revealed ? "隐藏内容" : "显示内容"}
          aria-pressed={revealed}
          disabled={disabled}
          onClick={() => setRevealed((v) => !v)}
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      ) : null}
    </div>
  );
}
