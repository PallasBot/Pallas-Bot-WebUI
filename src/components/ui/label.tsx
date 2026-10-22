import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Label as HeroLabel } from "@heroui/react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const labelVariants = cva("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70");

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement> &
  VariantProps<typeof labelVariants> & { asChild?: boolean };

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, asChild = false, ...props }, ref) => {
  const classes = cn(labelVariants(), className);
  if (asChild) return <Slot ref={ref} className={classes} {...props} />;
  return <HeroLabel.Root ref={ref} className={classes} {...props} />;
});
Label.displayName = "Label";

export { Label };
