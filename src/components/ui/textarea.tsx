import * as React from "react";
import { TextArea as HeroTextArea } from "@heroui/react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <HeroTextArea
      className={cn(
        "w-full min-h-[var(--ui-textarea-min-height,80px)]",
        className,
      )}
      data-heroui-skin="true"
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
