export interface HelpPreviewSelectOption {
  value: string;
  label: string;
}

type HelpPreviewPluginRow = {
  name: string;
  resolved_plugin_id?: string;
  nb_plugin_name?: string;
  metadata?: {
    name?: string;
    extra?: Record<string, unknown> & { menu_data?: unknown[] };
  } | null;
};

function pluginDisplayTitle(plugin: HelpPreviewPluginRow): string {
  const metaName = (plugin.metadata?.name || "").trim();
  if (metaName) return metaName;
  return (plugin.nb_plugin_name || plugin.name || "").trim();
}

function pluginDisplaySubtitle(plugin: HelpPreviewPluginRow): string {
  const id = (plugin.resolved_plugin_id || plugin.name || "").trim();
  const title = pluginDisplayTitle(plugin);
  if (!id || id === title) return "";
  return id;
}

function isUserHelpAudience(audience: unknown): boolean {
  const normalized = String(audience ?? "user").trim().toLowerCase();
  return normalized !== "maintainer" && normalized !== "superuser";
}

export function listHelpPreviewPluginOptions(rows: HelpPreviewPluginRow[]): HelpPreviewSelectOption[] {
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
  row: HelpPreviewPluginRow | null | undefined,
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
