import { useState } from "react";
import type { PluginConfigField } from "@/api/console";
import ConfigFieldRenderer from "@/components/config/ConfigFieldRenderer";
import UiField from "@/components/ui/UiField";
import { cn } from "@/lib/utils";
import { resolveConfigFieldLayout } from "@/utils/pluginConfigFieldModel";
import { fieldDisplayTitle } from "@/utils/configFieldDisplay";

export default function PluginConfigFieldShell({
  field,
  modelValue,
  onValueChange,
}: {
  field: PluginConfigField;
  modelValue: string;
  onValueChange: (value: string) => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const layout = resolveConfigFieldLayout(field);
  const title = fieldDisplayTitle(field);
  const hasDesc = Boolean(field.description?.trim());

  return (
    <UiField
      className={cn("plugin-config-form-item", `plugin-config-form-item--${layout}`)}
      label={title}
      required={Boolean(field.required)}
      secret={Boolean(field.secret)}
      labelEnd={
        <button
          type="button"
          className={cn(
            "plugin-config-form-item__help-btn",
            hasDesc && "plugin-config-form-item__help-btn--has-desc",
          )}
          aria-expanded={helpOpen}
          aria-label={`查看 ${title} 说明`}
          onClick={(e) => {
            e.stopPropagation();
            setHelpOpen((v) => !v);
          }}
        >
          ?
        </button>
      }
      meta={
        <span className="plugin-config-form-item__meta-pill">{field.kind}</span>
      }
    >
      {helpOpen && hasDesc ? (
        <p className="plugin-config-form-item__help-body">{field.description}</p>
      ) : null}
      <ConfigFieldRenderer
        field={field}
        modelValue={modelValue}
        onValueChange={onValueChange}
        showLabel={false}
        showMeta={false}
        showDescription={false}
        inputMaxWidth="100%"
      />
    </UiField>
  );
}
