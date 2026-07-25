import type { PluginConfigField } from "@/api/console";
import ConsoleSwitch from "@/components/ConsoleSwitch";
import TagsInput from "@/components/config/TagsInput";
import UiInput from "@/components/ui/UiInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const enumSelectValue = modelValue || undefined;

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
        <Select value={enumSelectValue} onValueChange={onValueChange}>
          <SelectTrigger
            className="form-field__control w-full"
            style={{ maxWidth: inputMaxWidth }}
            aria-label={fieldDisplayTitle(field)}
          >
            <SelectValue placeholder="请选择" />
          </SelectTrigger>
          <SelectContent>
            {!enumKnown && modelValue ? (
              <SelectItem value={modelValue}>{enumChoiceLabel(modelValue, fieldWithChoices)}</SelectItem>
            ) : null}
            {choices.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {enumChoiceLabel(opt, fieldWithChoices)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {!usesBoolSwitch && !usesEnumSelect && !usesTags && field.kind === "json" ? (
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
