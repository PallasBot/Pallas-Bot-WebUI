import type { PluginConfigField } from "@/api/console";
import ConsoleSwitch from "@/components/ConsoleSwitch";
import StringMapField, { tryParseStringMap } from "@/components/config/StringMapField";
import PersonaOutputFirewallField from "@/components/config/PersonaOutputFirewallField";
import ReplyStyleVariantsField from "@/components/config/ReplyStyleVariantsField";
import TagsInput from "@/components/config/TagsInput";
import UiInput from "@/components/ui/UiInput";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import {
  binaryEnumIsOn,
  binaryEnumOffChoice,
  binaryEnumOnChoice,
  binaryEnumSwitchLabel,
  boolChoiceLabel,
  enumChoiceLabel,
  fieldDisplayTitle,
  isBinaryBoolEnum,
} from "@/utils/configFieldDisplay";
import {
  idTagsFromJsonText,
  idTagsToJsonText,
  isChipListField,
  isIdListField,
  tagsFromJsonText,
  tagsToJsonText,
} from "@/utils/pluginConfigFieldModel";

function fieldChoices(field: PluginConfigField): string[] {
  if (field.choices?.length) return field.choices;
  return (field.options || []).map((o) => (typeof o === "string" ? o : o.value));
}

export default function ConfigFieldRenderer({
  field,
  modelValue,
  onValueChange,
  showLabel = true,
  showMeta = true,
  showDescription = true,
  inputMaxWidth = "520px",
}: {
  field: PluginConfigField;
  modelValue: string;
  onValueChange: (value: string) => void;
  showLabel?: boolean;
  showMeta?: boolean;
  showDescription?: boolean;
  inputMaxWidth?: string;
}) {
  const choices = fieldChoices(field);
  const fieldWithChoices = { ...field, choices };
  const usesBoolSwitch = field.kind === "bool" || isBinaryBoolEnum(fieldWithChoices);
  const usesEnumSelect = field.kind === "enum" && choices.length > 0 && !isBinaryBoolEnum(fieldWithChoices);
  const usesNumberInput = field.kind === "int" || field.kind === "float" || field.kind === "number";
  const usesSecretInput = field.kind === "string" && Boolean(field.secret);
  const usesMultiline = field.kind === "string" && Boolean(field.multiline);
  const usesTags = isChipListField(field);
  const usesIdTags = isIdListField(field);
  const usesStringMap = field.kind === "json" && tryParseStringMap(modelValue) != null;
  const usesReplyStyleVariants = field.name === "llm_reply_style_variants";
  const usesPersonaOutputFirewall = field.name === "llm_persona_output_firewall";
  const usesStructuredJsonForm = usesReplyStyleVariants || usesPersonaOutputFirewall;

  const boolOn =
    field.kind === "bool" ? modelValue === "true" : binaryEnumIsOn(fieldWithChoices, modelValue);
  const boolLabel =
    field.kind === "bool"
      ? boolChoiceLabel(modelValue)
      : binaryEnumSwitchLabel(fieldWithChoices, modelValue);

  function onBoolChange(checked: boolean) {
    if (field.kind === "bool") {
      onValueChange(checked ? "true" : "false");
      return;
    }
    onValueChange(
      checked ? binaryEnumOnChoice(fieldWithChoices) : binaryEnumOffChoice(fieldWithChoices),
    );
  }

  const tags = usesTags
    ? usesIdTags
      ? idTagsFromJsonText(modelValue)
      : tagsFromJsonText(modelValue)
    : [];

  const enumKnown = choices.includes(modelValue);
  const enumOptions: ComboboxOption[] = [];
  if (usesEnumSelect) {
    if (!enumKnown && modelValue) {
      enumOptions.push({
        value: modelValue,
        label: enumChoiceLabel(modelValue, fieldWithChoices),
        keywords: `${modelValue} ${enumChoiceLabel(modelValue, fieldWithChoices)}`,
      });
    }
    for (const opt of choices) {
      const label = enumChoiceLabel(opt, fieldWithChoices);
      enumOptions.push({
        value: opt,
        label,
        keywords: `${opt} ${label}`,
      });
    }
  }

  return (
    <div className={cn("config-field-renderer form-field", usesBoolSwitch && "config-field-renderer--bool")}>
      {usesBoolSwitch && showLabel ? (
        <div className="config-field-renderer__bool-head">
          <div className="config-field-renderer__title form-field__label form-field__label--title">
            {fieldDisplayTitle(field)}
          </div>
          <ConsoleSwitch
            checked={boolOn}
            label={boolLabel}
            ariaLabel={boolLabel}
            onCheckedChange={onBoolChange}
          />
        </div>
      ) : null}
      {usesBoolSwitch && !showLabel ? (
        <div className="config-field-renderer__bool-only">
          <ConsoleSwitch
            checked={boolOn}
            label={boolLabel}
            ariaLabel={boolLabel}
            onCheckedChange={onBoolChange}
          />
        </div>
      ) : null}
      {!usesBoolSwitch && showLabel ? (
        <div className="form-field__label form-field__label--title config-field-renderer__title">
          {fieldDisplayTitle(field)}
        </div>
      ) : null}

      {showDescription && field.description ? (
        <div className="muted common-config-field-desc config-field-renderer__desc">{field.description}</div>
      ) : null}
      {showMeta ? (
        <div className="muted config-field-renderer__meta">
          配置键: <code>{field.env_key || field.name}</code>
          {" · "}默认：{JSON.stringify(field.default)}
        </div>
      ) : null}

      {usesEnumSelect ? (
        <div className="form-field__control w-full" style={{ maxWidth: inputMaxWidth }}>
          <Combobox
            value={modelValue}
            onValueChange={onValueChange}
            options={enumOptions}
            placeholder="请选择"
            searchPlaceholder="搜索选项…"
            emptyText="无匹配选项"
            searchCount={choices.length}
            ariaLabel={fieldDisplayTitle(field)}
            triggerClassName="w-full"
          />
        </div>
      ) : null}

      {usesTags ? (
        <TagsInput
          variant="embedded"
          value={tags}
          onChange={(next) =>
            onValueChange(usesIdTags ? idTagsToJsonText(next) : tagsToJsonText(next))
          }
          placeholder={usesIdTags ? "输入号码后回车添加…" : "添加标签后回车"}
          inputMode={usesIdTags ? "numeric" : undefined}
          acceptPattern={usesIdTags ? /^\d+$/ : undefined}
        />
      ) : null}

      {usesReplyStyleVariants ? (
        <ReplyStyleVariantsField value={modelValue} onValueChange={onValueChange} />
      ) : null}

      {usesPersonaOutputFirewall ? (
        <PersonaOutputFirewallField value={modelValue} onValueChange={onValueChange} />
      ) : null}

      {usesStringMap && !usesStructuredJsonForm ? (
        <StringMapField
          value={modelValue}
          onValueChange={onValueChange}
          maxWidth={inputMaxWidth}
          speakerPlaceholder="Speaker id"
          aliasPlaceholder="输入别名后回车…"
        />
      ) : null}

      {!usesBoolSwitch && !usesEnumSelect && !usesTags && field.kind === "json" && !usesStringMap && !usesStructuredJsonForm ? (
        <textarea
          className="textarea inp form-field__control config-field-renderer__textarea"
          rows={6}
          value={modelValue}
          spellCheck={false}
          onChange={(e) => onValueChange(e.target.value)}
          style={{ maxWidth: inputMaxWidth }}
        />
      ) : null}

      {usesSecretInput ? (
        <UiInput
          className="form-field__control"
          type="password"
          revealable
          autoComplete="off"
          value={modelValue}
          onValueChange={onValueChange}
        />
      ) : null}

      {usesNumberInput ? (
        <input
          className="inp form-field__control"
          type="number"
          value={modelValue}
          min={field.min_value}
          max={field.max_value}
          step={field.kind === "float" ? "any" : 1}
          onChange={(e) => onValueChange(e.target.value)}
          style={{ maxWidth: inputMaxWidth }}
        />
      ) : null}

      {usesMultiline ? (
        <textarea
          className="textarea form-field__control config-field-renderer__textarea"
          rows={4}
          value={modelValue}
          onChange={(e) => onValueChange(e.target.value)}
          style={{ maxWidth: inputMaxWidth }}
        />
      ) : null}

      {!usesBoolSwitch &&
      !usesEnumSelect &&
      !usesTags &&
      field.kind !== "json" &&
      !usesSecretInput &&
      !usesNumberInput &&
      !usesMultiline ? (
        <UiInput className="form-field__control" type="text" value={modelValue} onValueChange={onValueChange} />
      ) : null}
    </div>
  );
}
