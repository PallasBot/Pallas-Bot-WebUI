import { useRef, useState } from "react";
import { Calendar, DatePicker as HeroDatePicker } from "@heroui/react";
import { parseDate, type CalendarDate } from "@internationalized/date";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function parseIsoDate(value: string): CalendarDate | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  try {
    return parseDate(value);
  } catch {
    return undefined;
  }
}

type Props = {
  value: string;
  onValueChange: (iso: string) => void;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  /** 返回 true 的日期不可选（仍可浏览月份） */
  isDayDisabled?: (iso: string) => boolean;
};

export default function DatePicker({
  value,
  onValueChange,
  className,
  ariaLabel,
  placeholder = "选择日期",
  disabled = false,
  isDayDisabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = parseIsoDate(value);
  const label = ariaLabel ?? placeholder;

  return (
    <HeroDatePicker
      value={selected ?? null}
      isDisabled={disabled}
      isOpen={open}
      onOpenChange={setOpen}
      onChange={(date) => date && onValueChange(date.toString())}
    >
      <HeroDatePicker.Trigger
        ref={triggerRef}
        aria-label={label}
        className={cn(
          "charts-page__date-inp inline-flex h-[var(--ui-ctrl-height,38px)] min-w-[9.5rem] items-center justify-start gap-2 rounded-[var(--radius-control,8px)] border border-[var(--control-edge)] bg-[var(--control-bg)] px-3 py-0 text-left text-[length:var(--console-control-font-size,14px)] font-normal leading-none text-[var(--text)] shadow-[var(--control-shadow)] hover:bg-[color-mix(in_srgb,var(--text)_4%,var(--control-bg))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:opacity-45",
          !selected && "text-muted-foreground",
          className,
        )}
      >
        <CalendarIcon className="size-4 shrink-0 opacity-70" aria-hidden="true" />
        <span className="leading-[1.25]">{selected?.toString() ?? placeholder}</span>
      </HeroDatePicker.Trigger>
      <HeroDatePicker.Popover
        triggerRef={triggerRef}
        className="w-auto p-0"
        placement="bottom start"
      >
        <Calendar
          aria-label={label}
          value={selected ?? null}
          isDateUnavailable={
            isDayDisabled ? (date) => isDayDisabled(date.toString()) : undefined
          }
          className="p-3"
        >
          <Calendar.Header className="flex items-center justify-between gap-2">
            <Calendar.NavButton slot="previous" aria-label="上个月"><ChevronLeft className="size-4" /></Calendar.NavButton>
            <Calendar.Heading />
            <Calendar.NavButton slot="next" aria-label="下个月"><ChevronRight className="size-4" /></Calendar.NavButton>
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
        </Calendar>
      </HeroDatePicker.Popover>
    </HeroDatePicker>
  );
}
