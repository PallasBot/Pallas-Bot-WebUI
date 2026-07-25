/**
 * 帮助图分组覆盖：插件名 → help_tag。
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { fetchPlugins } from "@/api/fullConsole";
import PluginConfigFormSection from "@/components/config/PluginConfigFormSection";
import { HelpField } from "@/components/help/HelpPortalSelect";
import HelpPluginSelect from "@/components/help/HelpPluginSelect";
import HelpTagSelect from "@/components/help/HelpTagSelect";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  HELP_TAG_OVERRIDES_FIELD,
  parseHelpTagOverrides,
  serializeHelpTagOverrides,
} from "@/components/help/helpTagOverrides";

export {
  HELP_TAG_OVERRIDES_FIELD,
  HELP_TAG_PRESETS,
  PRESET_TAG_VALUES,
} from "@/components/help/helpTagOverrides";

type Props = {
  fieldValues: Record<string, string>;
  onFieldChange: (name: string, value: string) => void;
  className?: string;
};

export default function HelpTagOverridesPanel({ fieldValues, onFieldChange, className }: Props) {
  const overrides = useMemo(
    () => parseHelpTagOverrides(fieldValues[HELP_TAG_OVERRIDES_FIELD]),
    [fieldValues[HELP_TAG_OVERRIDES_FIELD]],
  );
  const rows = useMemo(
    () => Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)),
    [overrides],
  );

  const pluginsQ = useQuery({
    queryKey: ["plugins"],
    queryFn: async () => fetchPlugins(),
  });
  const pluginOptions = useMemo(() => {
    const list = pluginsQ.data || [];
    const ids = list
      .map((r) => String(r.resolved_plugin_id || r.name || "").trim())
      .filter(Boolean);
    return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
  }, [pluginsQ.data]);

  const extraTags = useMemo(() => Object.values(overrides), [overrides]);

  const [draftPlugin, setDraftPlugin] = useState("");
  const [draftTag, setDraftTag] = useState("fun");

  function commit(next: Record<string, string>) {
    onFieldChange(HELP_TAG_OVERRIDES_FIELD, serializeHelpTagOverrides(next));
  }

  function upsert(plugin: string, tag: string) {
    const name = plugin.trim();
    const value = tag.trim().toLowerCase();
    if (!name || !value) return;
    commit({ ...overrides, [name]: value });
  }

  function remove(plugin: string) {
    const next = { ...overrides };
    delete next[plugin];
    commit(next);
  }

  function addRow() {
    const name = draftPlugin.trim();
    const tag = draftTag.trim().toLowerCase() || "other";
    if (!name) return;
    upsert(name, tag);
    setDraftPlugin("");
    setDraftTag("fun");
  }

  return (
    <PluginConfigFormSection
      className={cn(className)}
      title="帮助图分组覆盖"
      subtitle="批量覆盖插件 metadata.extra.help_tag；可选已有分组或手输新分组名。保存后帮助图热载生效。"
      bodyClassName="!grid-cols-1 gap-3"
    >
      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无覆盖，全部使用插件默认分组。</p>
        ) : (
          <ul className="space-y-2">
            {rows.map(([plugin, tag]) => (
              <li
                key={plugin}
                className="flex flex-col gap-2 rounded-md border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1 break-all font-mono text-sm">{plugin}</div>
                <div className="w-full min-w-0 sm:max-w-[240px] sm:flex-1">
                  <HelpTagSelect
                    value={tag}
                    extraTags={extraTags}
                    allowEmpty={false}
                    onValueChange={(v) => upsert(plugin, v)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 self-end sm:self-auto"
                  onClick={() => remove(plugin)}
                  aria-label={`删除 ${plugin}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 rounded-md border border-dashed border-border/80 p-3">
          <HelpField label="插件">
            <HelpPluginSelect
              value={draftPlugin}
              pluginIds={pluginOptions}
              allowEmpty
              emptyLabel="（未选）"
              onValueChange={setDraftPlugin}
            />
          </HelpField>
          <HelpField label="分组">
            <HelpTagSelect
              value={draftTag}
              extraTags={extraTags}
              allowEmpty={false}
              onValueChange={setDraftTag}
            />
          </HelpField>
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={addRow}>
            <Plus className="mr-1 size-4" />
            添加
          </Button>
        </div>
      </div>
    </PluginConfigFormSection>
  );
}
