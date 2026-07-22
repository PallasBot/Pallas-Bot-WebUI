import { useState } from "react";
import type { PluginConfigField } from "@/api/console";
import ConsoleSwitch from "@/components/ConsoleSwitch";
import UiInput from "@/components/ui/UiInput";
import UiSelect from "@/components/ui/UiSelect";
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
import { isStringListField, tagsFromJsonText, tagsToJsonText } from "@/utils/pluginConfigFieldModel";

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
  const usesNumberStepper = field.kind === "int" || field.kind === "float" || field.kind === "number";
  const usesSecretInput = field.kind === "string" && Boolean(field.secret);
  const usesMultiline = field.kind === "string" && Boolean(field.multiline);
  const usesTags = isStringListField(field);
  const [tagDraft, setTagDraft] = useState("");

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

  function stepNumber(delta: number) {
    const isInt = field.kind === "int";
    const cur = modelValue.trim() === "" ? 0 : Number(modelValue);
    const base = Number.isFinite(cur) ? cur : 0;
    const next = isInt ? Math.round(base + delta) : base + delta;
    let clamped = next;
    if (field.min_value != null && clamped < field.min_value) clamped = field.min_value;
    if (field.max_value != null && clamped > field.max_value) clamped = field.max_value;
    onValueChange(isInt ? String(Math.trunc(clamped)) : String(clamped));
  }

  const tags = usesTags ? tagsFromJsonText(modelValue) : [];

  function addTag() {
    const t = tagDraft.trim();
    if (!t || tags.includes(t)) {
      setTagDraft("");
      return;
    }
    onValueChange(tagsToJsonText([...tags, t]));
    setTagDraft("");
  }

  return (
    <div className={cn("config-field-renderer form-field", usesBoolSwitch && "config-field-renderer--bool")}>
      {usesBoolSwitch && showLabel ? (
        <div className="config-field-renderer__bool-head">
          <div className="config-field-renderer__title form-field__label form-field__label--title">
            {fieldDisplayTitle(field)}
            {!field.label ? <span className="muted config-field-renderer__kind">（{field.kind}）</span> : null}
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
          {!field.label ? <span className="muted config-field-renderer__kind">（{field.kind}）</span> : null}
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
        <UiSelect className="form-field__control" value={modelValue} onValueChange={onValueChange}>
          {choices.map((opt) => (
            <option key={opt} value={opt}>
              {enumChoiceLabel(opt, fieldWithChoices)}
            </option>
          ))}
        </UiSelect>
      ) : null}

      {usesTags ? (
        <div className="config-field-renderer__tags">
          {tags.map((t) => (
            <span key={t} className="config-field-renderer__tag">
              {t}
              <button
                type="button"
                className="config-field-renderer__tag-remove"
                aria-label={`移除 ${t}`}
                onClick={() => onValueChange(tagsToJsonText(tags.filter((x) => x !== t)))}
              >
                ×
              </button>
            </span>
          ))}
          <div className="config-field-renderer__tags-add">
            <UiInput
              value={tagDraft}
              placeholder="添加标签后回车"
              onValueChange={setTagDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <button type="button" className="btn ui-btn ui-btn--outline ui-btn--sm" onClick={addTag}>
              添加
            </button>
          </div>
        </div>
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

      {usesNumberStepper ? (
        <div className="config-field-renderer__number" style={{ maxWidth: inputMaxWidth }}>
          <input
            className="inp"
            type="number"
            value={modelValue}
            min={field.min_value}
            max={field.max_value}
            step={field.kind === "float" ? "any" : 1}
            onChange={(e) => onValueChange(e.target.value)}
          />
          <button type="button" className="config-field-renderer__step" onClick={() => stepNumber(-1)} aria-label="减少">
            −
          </button>
          <button type="button" className="config-field-renderer__step" onClick={() => stepNumber(1)} aria-label="增加">
            +
          </button>
        </div>
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
      !usesNumberStepper &&
      !usesMultiline ? (
        <UiInput className="form-field__control" type="text" value={modelValue} onValueChange={onValueChange} />
      ) : null}
    </div>
  );
}
