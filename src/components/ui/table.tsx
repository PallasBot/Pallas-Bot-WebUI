import type { ComponentProps } from "react";
import { Table as HeroUITable } from "@heroui/react";
import { cn } from "@/lib/utils";

function Table({ className, children, ...props }: ComponentProps<typeof HeroUITable>) {
  return (
    <HeroUITable
      {...props}
      variant="secondary"
      className={cn(
        "relative w-full overflow-hidden rounded-[var(--radius-shell,12px)] border border-[var(--border)] [&_thead_tr]:border-b [&_thead_th]:h-10 [&_thead_th]:bg-[color-mix(in_srgb,var(--text)_3%,var(--bg-card,transparent))] [&_thead_th]:px-3 [&_thead_th]:text-left [&_thead_th]:align-middle [&_thead_th]:text-xs [&_thead_th]:font-medium [&_thead_th]:uppercase [&_thead_th]:tracking-wide [&_thead_th]:text-muted-foreground [&_tbody_tr]:border-b [&_tbody_tr]:border-[var(--border)] [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-[color-mix(in_srgb,var(--text)_4%,transparent)] [&_tbody_tr[data-selected=true]]:bg-pallas-muted [&_tbody_tr:last-child]:border-0 [&_tbody_td]:p-3 [&_tbody_td]:align-middle [&_tbody_td]:text-[0.8125rem] forced-colors:[&_tbody_tr:focus-visible]:outline-solid forced-colors:[&_tbody_tr:focus-visible]:outline-2 forced-colors:[&_tbody_tr:focus-visible]:outline-offset-[-2px] forced-colors:[&_tbody_tr:focus-visible]:outline-[Highlight] forced-colors:[&_tbody_td:focus-visible]:outline-solid forced-colors:[&_tbody_td:focus-visible]:outline-2 forced-colors:[&_tbody_td:focus-visible]:outline-offset-[-2px] forced-colors:[&_tbody_td:focus-visible]:outline-[Highlight]",
        className,
      )}
    >
      <HeroUITable.ScrollContainer className="w-full overflow-auto">
        {children}
      </HeroUITable.ScrollContainer>
    </HeroUITable>
  );
}

const TableContent = HeroUITable.Content;
const TableHeader = HeroUITable.Header;
const TableBody = HeroUITable.Body;
const TableRow = HeroUITable.Row;
const TableHead = HeroUITable.Column;
const TableCell = HeroUITable.Cell;

export { Table, TableContent, TableHeader, TableBody, TableHead, TableRow, TableCell };
