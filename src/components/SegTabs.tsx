import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type SegTabOption = {
  value: string;
  label: string;
  className?: string;
};

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SegTabOption[];
  ariaLabel?: string;
  className?: string;
  /** 透传给 TabsList（宽度 / 布局等） */
  listClassName?: string;
  /** 占满容器宽度，Trigger 均分（原 console-view-toggle--full） */
  full?: boolean;
  /** 与 default 相同；保留以免调用处改动 */
  size?: "default" | "toolbar";
  disabled?: boolean;
};

/**
 * 分段 Tabs（TabsList + TabsTrigger）。
 * default：h-10 + p-1；toolbar：与 chrome 控件同高 h-9，避免撑高工具条。
 */
export default function SegTabs({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
  listClassName,
  full = false,
  size = "default",
  disabled = false,
}: Props) {
  const toolbar = size === "toolbar";

  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      className={cn("shrink-0", full && "w-full max-w-full", className)}
    >
      <TabsList
        aria-label={ariaLabel}
        className={cn(
          toolbar && "h-9 p-0.5",
          full && (toolbar ? "flex h-9 w-full" : "flex h-10 w-full"),
          listClassName,
        )}
      >
        {options.map((opt) => (
          <TabsTrigger
            key={opt.value}
            value={opt.value}
            disabled={disabled}
            className={cn(full && "flex-1", toolbar && "px-2.5 py-1", opt.className)}
          >
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
