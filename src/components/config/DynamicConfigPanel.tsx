import PluginConfigFieldShell from "@/components/config/PluginConfigFieldShell";
import PluginConfigFormSection from "@/components/config/PluginConfigFormSection";
import type { PluginConfigField } from "@/api/console";
import type { PluginConfigFieldGroup } from "@/api/pallasTypes";
import { buildDynamicConfigGroups } from "@/utils/dynamicConfigPanelModel";

export default function DynamicConfigPanel({
  fields,
  fieldGroups,
  fieldValues,
  onFieldChange,
  groupTitles,
  groupSubtitles,
  hideGroupHeaders = false,
  defaultOpen = true,
}: {
  fields: PluginConfigField[];
  fieldGroups?: PluginConfigFieldGroup[];
  fieldValues: Record<string, string>;
  onFieldChange: (name: string, value: string) => void;
  /** group.id 或 group.title → 分组标题覆盖 */
  groupTitles?: Record<string, string>;
  /** group.id → 副文案（覆盖默认「共 N 项」） */
  groupSubtitles?: Record<string, string>;
  /** 嵌入外层分区时去掉内部分组标题，避免嵌套卡标题偏小 */
  hideGroupHeaders?: boolean;
  defaultOpen?: boolean;
}) {
  const groups = buildDynamicConfigGroups(fields, fieldGroups);

  if (hideGroupHeaders) {
    return (
      <>
        {groups.flatMap((group) =>
          group.fields.map((f) => (
            <PluginConfigFieldShell
              key={f.name}
              field={f}
              modelValue={fieldValues[f.name] ?? ""}
              onValueChange={(v) => onFieldChange(f.name, v)}
            />
          )),
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <PluginConfigFormSection
          key={group.id}
          title={groupTitles?.[group.id] ?? groupTitles?.[group.title] ?? group.title}
          subtitle={groupSubtitles?.[group.id] ?? group.subtitle ?? `共 ${group.fields.length} 项`}
          defaultOpen={defaultOpen && !group.advanced}
        >
          {group.fields.map((f) => (
            <PluginConfigFieldShell
              key={f.name}
              field={f}
              modelValue={fieldValues[f.name] ?? ""}
              onValueChange={(v) => onFieldChange(f.name, v)}
            />
          ))}
        </PluginConfigFormSection>
      ))}
    </div>
  );
}
