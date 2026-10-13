import * as React from "react";
import { Switch as HeroSwitch } from "@heroui/react";
import type { SwitchButtonRenderProps } from "@heroui/react";
import type { DOMRenderFunction } from "react-aria-components";
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
  "aria-describedby"?: string;
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
      "aria-describedby": ariaDescribedBy,
    },
    ref,
  ) => {
    const isControlled = checked !== undefined;
    const [uncontrolled, setUncontrolled] = React.useState(Boolean(defaultChecked));
    const on = isControlled ? Boolean(checked) : uncontrolled;
    const contentProps: React.ComponentProps<typeof HeroSwitch.Content> & {
      render: DOMRenderFunction<"label", SwitchButtonRenderProps>;
    } = {
      className: cn(
        "console-bool-switch",
        on && "console-bool-switch--on",
        tone === "amber" && "console-bool-switch--amber",
        disabled && "pointer-events-none",
        className,
      ),
      onMouseDown: (event) => {
        if (disabled) return;
        event.preventDefault();
        const input = event.currentTarget.querySelector<HTMLInputElement>("input");
        input?.focus({ preventScroll: true });
      },
      children: ({ isFocusVisible, isDisabled }) => (
        <HeroSwitch.Control
          className={cn(
            "console-bool-switch__track",
            isFocusVisible && "outline-2 outline-offset-2 outline-[var(--accent)] forced-colors:outline-hidden",
            isDisabled && "opacity-[0.55]",
          )}
          aria-hidden="true"
        >
          <HeroSwitch.Thumb className="console-bool-switch__thumb" />
        </HeroSwitch.Control>
      ),
      render: (domProps) => (
        <label
          {...domProps}
          data-state={on ? "checked" : "unchecked"}
          onClick={(event) => {
            domProps.onClick?.(event);
            onClick?.(event);
          }}
          onKeyDown={(event) => {
            domProps.onKeyDown?.(event);
            onKeyDown?.(event);
          }}
        />
      ),
    };

    return (
      <HeroSwitch.Root
        className="contents"
        inputRef={ref}
        id={id}
        name={name}
        isSelected={isControlled ? Boolean(checked) : undefined}
        defaultSelected={isControlled ? undefined : Boolean(defaultChecked)}
        isDisabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        onPressStart={
          onKeyDown
            ? (event) => {
                if (event.pointerType === "keyboard") event.continuePropagation();
              }
            : undefined
        }
        onChange={(next) => {
          if (!isControlled) setUncontrolled(next);
          onCheckedChange?.(next);
        }}
      >
        <HeroSwitch.Content {...contentProps} />
      </HeroSwitch.Root>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };
