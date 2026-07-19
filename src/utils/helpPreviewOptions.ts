import type { PluginRow } from "@/api/pallasTypes";
import { pluginDisplaySubtitle, pluginDisplayTitle } from "@/utils/pluginDisplayMeta";

export interface HelpPreviewSelectOption {
  value: string;
  label: string;
}

function isUserHelpAudience(audience: unknown): boolean {
  const normalized = String(audience ?? "user").trim().toLowerCase();
  return normalized !== "maintainer" && normalized !== "superuser";
}

export function listHelpPreviewPluginOptions(rows: PluginRow[]): HelpPreviewSelectOption[] {
  return rows
    .filter((row) => {
      const extra = row.metadata?.extra;
      if (!extra || typeof extra !== "object") return true;
      return isUserHelpAudience((extra as Record<string, unknown>).help_audience);
    })
    .map((row) => {
      const title = pluginDisplayTitle(row);
      const subtitle = pluginDisplaySubtitle(row);
      const label = subtitle && subtitle !== title ? `${title}（${subtitle}）` : title;
      return { value: row.name, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
}

export function listHelpPreviewFunctionOptions(
  row: PluginRow | null | undefined,
): HelpPreviewSelectOption[] {
  const menu = row?.metadata?.extra?.menu_data;
  if (!Array.isArray(menu)) return [];
  const options: HelpPreviewSelectOption[] = [];
  menu.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    if (!isUserHelpAudience(record.help_audience)) return;
    const func = String(record.func || "").trim() || `功能 ${index + 1}`;
    options.push({ value: String(index + 1), label: func });
  });
  return options;
}

export function pickDefaultHelpPreviewFunction(
  options: HelpPreviewSelectOption[],
  current: string,
): string {
  if (options.some((item) => item.value === current)) return current;
  return options[0]?.value ?? "1";
}
