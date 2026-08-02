import * as React from "react";
import { cn } from "@/lib/utils";

export type SwitchProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  /** 开启态色调；默认跟 accent，amber 用于开发模式等警示项 */
  tone?: "default" | "amber";
  "aria-label"?: string;
  "aria-labelledby"?: string;
  onCheckedChange?: (checked: boolean) => void;
  /** 挂在外层 label 上，便于卡片行内 stopPropagation */
  onClick?: React.MouseEventHandler<HTMLLabelElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLLabelElement>;
};

/**
 * 全站通用开关：与偏好页「开发模式」同一套 `.console-bool-switch` 视觉。
 * API 兼容原 Radix Switch 的 checked / onCheckedChange / disabled / id。
 */
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      className,
      checked,
      defaultChecked,
      disabled = false,
      id,
      name,
      tone = "default",
      onCheckedChange,
      onClick,
      onKeyDown,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
    },
    ref,
  ) => {
    const isControlled = checked !== undefined;
    const [uncontrolled, setUncontrolled] = React.useState(Boolean(defaultChecked));
    const on = isControlled ? Boolean(checked) : uncontrolled;

    return (
      <label
        className={cn(
          "console-bool-switch",
          on && "console-bool-switch--on",
          tone === "amber" && "console-bool-switch--amber",
          disabled && "pointer-events-none",
          className,
        )}
        data-state={on ? "checked" : "unchecked"}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onMouseDown={(e) => {
          if (disabled) return;
          // 避免 Dialog 内 focus scrollIntoView 把内容顶出可视区
          e.preventDefault();
          const input = e.currentTarget.querySelector<HTMLInputElement>("input");
          input?.focus({ preventScroll: true });
        }}
      >
        <input
          ref={ref}
          id={id}
          name={name}
          type="checkbox"
          className="console-bool-switch__input"
          checked={on}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          onChange={(e) => {
            const next = e.target.checked;
            if (!isControlled) setUncontrolled(next);
            onCheckedChange?.(next);
          }}
        />
        <span className="console-bool-switch__track" aria-hidden="true">
          <span className="console-bool-switch__thumb" />
        </span>
      </label>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };
