import { useMemo, useState } from "react";
import { format, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function parseIsoDate(value: string): Date | undefined {
  if (!value || value.length < 10) return undefined;
  const d = parse(value.slice(0, 10), "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

type Props = {
  value: string;
  onValueChange: (iso: string) => void;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
};

/** gsuid_hub 风格：Popover + Calendar，对外出参仍为 yyyy-MM-dd。 */
export default function DatePicker({
  value,
  onValueChange,
  className,
  ariaLabel,
  placeholder = "选择日期",
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseIsoDate(value), [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "charts-page__date-inp justify-start text-left font-normal",
            "h-[var(--ui-ctrl-height,38px)] min-w-[9.5rem] px-3",
            "border-border bg-background hover:bg-accent/10",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
          {selected ? format(selected, "yyyy-MM-dd") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={8}>
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) return;
            onValueChange(format(date, "yyyy-MM-dd"));
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
