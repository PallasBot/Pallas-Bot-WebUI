import { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * 单行/多行截断；仅在实际溢出时悬停展示全文。
 */
export default function TruncatedText({
  text,
  className,
  lines = 1,
  contentClassName,
}: {
  text: string;
  className?: string;
  lines?: 1 | 2;
  contentClassName?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      if (lines === 1) {
        setTruncated(el.scrollWidth > el.clientWidth + 1);
      } else {
        setTruncated(el.scrollHeight > el.clientHeight + 1);
      }
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [lines, text]);

  const span = (
    <span
      ref={ref}
      className={cn(
        /* block + max-w-full：inline span 无法靠 truncate 限宽，长串会撑破网格卡片 */
        "block min-w-0 max-w-full",
        lines === 1 ? "truncate" : "line-clamp-2",
        className,
      )}
    >
      {text}
    </span>
  );

  if (!truncated) return span;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{span}</TooltipTrigger>
        <TooltipContent side="top" className={cn("max-w-xs break-all text-xs", contentClassName)}>
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
