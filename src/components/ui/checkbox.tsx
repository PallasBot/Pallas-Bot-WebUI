import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Checkbox as HeroCheckbox } from "@heroui/react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type RadixCheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;
type HeroCheckboxProps = React.ComponentPropsWithoutRef<typeof HeroCheckbox.Root>;
type HeroEventKeys = Exclude<Extract<keyof HeroCheckboxProps, keyof React.DOMAttributes<Element>>, "onChange">;
type HeroEventProps = Pick<HeroCheckboxProps, HeroEventKeys>;
type CheckboxProps =
  | (RadixCheckboxProps & { asChild: true })
  | (Omit<RadixCheckboxProps, "asChild" | "onChange" | HeroEventKeys> &
      HeroEventProps & { asChild?: false; onChange?: RadixCheckboxProps["onChange"] });
type CheckboxRef = HTMLInputElement | React.ElementRef<typeof CheckboxPrimitive.Root>;

const Checkbox = React.forwardRef<CheckboxRef, CheckboxProps>(
  (checkboxProps, ref) => {
    const { className, checked, defaultChecked, onCheckedChange, disabled, required, value } = checkboxProps;
    const [defaultIndeterminate, setDefaultIndeterminate] = React.useState(defaultChecked === "indeterminate");
    const setControlRef = (node: CheckboxRef | null) => {
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };
    if (checkboxProps.asChild) {
      const child = React.Children.only(
        checkboxProps.children as React.ReactElement<{ children?: React.ReactNode }>,
      );
      return (
        <CheckboxPrimitive.Root
          {...checkboxProps}
          ref={setControlRef}
          className={cn(
            "peer h-4 w-4 shrink-0 rounded-pallas-sm border border-primary ring-offset-pallas-background data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          required={required}
          value={value}
          onCheckedChange={onCheckedChange}
        >
          {React.cloneElement(child, undefined,
            child.props.children,
            <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
              <Check className="h-4 w-4" />
            </CheckboxPrimitive.Indicator>,
          )}
        </CheckboxPrimitive.Root>
      );
    }

    const {
      asChild: _asChild,
      className: _className,
      checked: _checked,
      defaultChecked: _defaultChecked,
      disabled: _disabled,
      onChange: nativeOnChange,
      onCheckedChange: _onCheckedChange,
      required: _required,
      value: _value,
      ...heroProps
    } = checkboxProps;
    // This wrapper reports state changes through onCheckedChange, not a native input change event.
    void nativeOnChange;
    return (
      <HeroCheckbox.Root
        className="contents"
        inputRef={setControlRef}
        isSelected={checked === undefined ? undefined : checked === true}
        defaultSelected={defaultChecked === true}
        isIndeterminate={checked === undefined ? defaultIndeterminate : checked === "indeterminate"}
        isDisabled={disabled}
        isRequired={required}
        value={value == null ? undefined : String(value)}
        onChange={(next) => {
          if (checked === undefined) setDefaultIndeterminate(false);
          onCheckedChange?.(next);
        }}
        {...heroProps}
      >
        {({ isSelected, isIndeterminate, isDisabled }) => (
          <HeroCheckbox.Content className="contents">
            {({ isFocusVisible }) => (
              <HeroCheckbox.Control
                className={cn(
                  "peer relative inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-pallas-sm border border-primary ring-offset-pallas-background",
                  (isSelected || isIndeterminate) && "bg-primary text-primary-foreground",
                  isFocusVisible && "outline-hidden ring-2 ring-ring ring-offset-2",
                  isDisabled && "cursor-not-allowed opacity-50",
                  className,
                )}
              >
                {(isSelected || isIndeterminate) && (
                  <HeroCheckbox.Indicator className="flex items-center justify-center text-current">
                    <Check className="h-4 w-4" />
                  </HeroCheckbox.Indicator>
                )}
              </HeroCheckbox.Control>
            )}
          </HeroCheckbox.Content>
        )}
      </HeroCheckbox.Root>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
