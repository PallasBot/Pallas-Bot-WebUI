import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Tabs as HeroTabs } from "@heroui/react";

import { cn } from "@/lib/utils";

type TabsRootProps = Omit<React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>, "activationMode" | "asChild">;

const Tabs = React.forwardRef<HTMLDivElement, TabsRootProps>(
  ({ value, defaultValue, onValueChange, children, ...props }, ref) => (
    <HeroTabs.Root
      {...props}
      ref={ref}
      selectedKey={value}
      defaultSelectedKey={defaultValue}
      onSelectionChange={(key) => onValueChange?.(String(key))}
    >
      {children}
    </HeroTabs.Root>
  ),
);
Tabs.displayName = "Tabs";

type TabsListProps = React.ComponentPropsWithoutRef<typeof HeroTabs.List> & { containerClassName?: string };
const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(({ className, containerClassName, ...props }, ref) => (
  <HeroTabs.ListContainer className={containerClassName}>
    <HeroTabs.List
      ref={ref}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-[var(--radius-control,8px)] bg-pallas-muted p-1 text-muted-foreground",
        className,
      )}
      {...(props as React.ComponentPropsWithoutRef<typeof HeroTabs.List>)}
    />
  </HeroTabs.ListContainer>
));
TabsList.displayName = "TabsList";

type TabsTriggerProps = Omit<React.ComponentPropsWithoutRef<typeof HeroTabs.Tab>, "id" | "isDisabled"> & {
  value: string;
  disabled?: boolean;
};
const TabsTrigger = React.forwardRef<React.ElementRef<typeof HeroTabs.Tab>, TabsTriggerProps>(
  ({ className, value, disabled, ...props }, ref) => (
    <HeroTabs.Tab
      ref={ref}
      id={value}
      isDisabled={disabled}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-[max(0px,calc(var(--radius-control,8px)-2px))] px-3 py-1.5 text-sm font-medium ring-offset-pallas-background transition-all aria-selected:bg-pallas-background aria-selected:text-pallas-foreground aria-selected:shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...(props as React.ComponentPropsWithoutRef<typeof HeroTabs.Tab>)}
    />
  ),
);
TabsTrigger.displayName = "TabsTrigger";

type TabsContentProps = Omit<React.ComponentPropsWithoutRef<typeof HeroTabs.Panel>, "id"> & {
  value: string;
};
const TabsContent = React.forwardRef<React.ElementRef<typeof HeroTabs.Panel>, TabsContentProps>(
  ({ className, value, ...props }, ref) => (
      <HeroTabs.Panel
        ref={ref}
        id={value}
        className={cn(
          "mt-2 ring-offset-pallas-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        {...(props as React.ComponentPropsWithoutRef<typeof HeroTabs.Panel>)}
      />
  ),
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
