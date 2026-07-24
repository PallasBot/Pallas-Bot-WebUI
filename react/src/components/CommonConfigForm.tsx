import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchCommonConfig,
  fetchCommonConfigRaw,
  putCommonConfig,
  putCommonConfigRaw,
  type PluginConfigField,
} from "@/api/console";
import type { PluginConfigFieldGroup } from "@/api/pallasTypes";
import type { AiConfigSaveStateHandler } from "@/components/ai/aiConfigSaveState";
import DynamicConfigPanel from "@/components/config/DynamicConfigPanel";
import PluginConfigFieldShell from "@/components/config/PluginConfigFieldShell";
import PluginConfigFormSection from "@/components/config/PluginConfigFormSection";
import StateBlock from "@/components/StateBlock";
import UiButton from "@/components/ui/UiButton";
import {
  HIDDEN_LLM_STRATEGY_FIELDS,
  llmBotFieldGroupsForMode,
  type LlmBotFieldGroupDef,
} from "@/config/configFieldLabels";
import { cn } from "@/lib/utils";
import { collectFieldValues, fieldValuesFromConfig } from "@/utils/pluginConfigFieldModel";

function fieldsForDefs(
  defs: ReadonlyArray<LlmBotFieldGroupDef>,
  byName: Map<string, PluginConfigField>,
): PluginConfigField[] {
  const out: PluginConfigField[] = [];
  const seen = new Set<string>();
  for (const group of defs) {
    for (const key of group.keys) {
      const field = byName.get(key);
      if (!field || seen.has(field.name)) continue;
      seen.add(field.name);
      out.push(field);
    }
  }
  return out;
}

function groupsForDefs(defs: ReadonlyArray<LlmBotFieldGroupDef>): PluginConfigFieldGroup[] {
  return defs.map((group, index) => ({
    id: group.anchorId || `llm-${group.tier}-${index}`,
    title: group.title,
    field_names: [...group.keys],
    plugin_config_path: "llm",
  }));
}

function hintByGroupId(defs: ReadonlyArray<LlmBotFieldGroupDef>): Record<string, string> {
  const out: Record<string, string> = {};
  defs.forEach((group, index) => {
    const id = group.anchorId || `llm-${group.tier}-${index}`;
    if (group.hint) out[id] = group.hint;
  });
  return out;
}

function LlmStrategyGroupedForm({
  fields,
  fieldValues,
  onFieldChange,
}: {
  fields: PluginConfigField[];
  fieldValues: Record<string, string>;
  onFieldChange: (name: string, value: string) => void;
}) {
  const byName = useMemo(() => {
    const map = new Map<string, PluginConfigField>();
    for (const f of fields) map.set(f.name, f);
    return map;
  }, [fields]);

  const modeGroups = llmBotFieldGroupsForMode(false);
  const groupedFields = fieldsForDefs(modeGroups, byName);
  const used = new Set(groupedFields.map((f) => f.name));
  const restFields = fields.filter(
    (f) => !used.has(f.name) && !HIDDEN_LLM_STRATEGY_FIELDS.has(f.name),
  );

  return (
    <div className="space-y-4">
      <DynamicConfigPanel
        fields={groupedFields}
        fieldGroups={groupsForDefs(modeGroups)}
        groupSubtitles={hintByGroupId(modeGroups)}
        fieldValues={fieldValues}
        onFieldChange={onFieldChange}
      />

      {restFields.length ? (
        <DynamicConfigPanel
          fields={restFields}
          fieldGroups={[
            {
              id: "llm-rest",
              title: "其他项",
              field_names: restFields.map((f) => f.name),
              plugin_config_path: "llm",
            },
          ]}
          fieldValues={fieldValues}
          onFieldChange={onFieldChange}
        />
      ) : null}
    </div>
  );
}

export default function CommonConfigForm({
  sectionId,
  mode = "form",
  savedMessage = "配置已保存",
  inlineSave = true,
  onSaveState,
}: {
  sectionId: string;
  mode?: "form" | "raw";
  savedMessage?: string;
  /** false 时隐藏面板内保存按钮（改由顶栏触发） */
  inlineSave?: boolean;
  onSaveState?: AiConfigSaveStateHandler;
}) {
  const qc = useQueryClient();
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [formBaseline, setFormBaseline] = useState("");
  const [raw, setRaw] = useState("");
  const [rawBaseline, setRawBaseline] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const cfgQ = useQuery({
    queryKey: ["common-config", sectionId],
    queryFn: () => fetchCommonConfig(sectionId),
  });
  const rawQ = useQuery({
    queryKey: ["common-config-raw", sectionId],
    queryFn: () => fetchCommonConfigRaw(sectionId),
    enabled: mode === "raw",
  });

  useEffect(() => {
    if (!cfgQ.data?.fields) return;
    const next = fieldValuesFromConfig(cfgQ.data.fields);
    setFieldValues(next);
    setFormBaseline(JSON.stringify(next));
  }, [cfgQ.data]);

  useEffect(() => {
    if (rawQ.data == null) return;
    setRaw(rawQ.data);
    setRawBaseline(rawQ.data);
  }, [rawQ.data]);

  const saveForm = useMutation({
    mutationFn: () => {
      const allFields = cfgQ.data?.fields || [];
      return putCommonConfig(sectionId, collectFieldValues(allFields, fieldValues));
    },
    onSuccess: async () => {
      setMsg(savedMessage);
      setFormBaseline(JSON.stringify(fieldValues));
      await qc.invalidateQueries({ queryKey: ["common-config", sectionId] });
      await qc.invalidateQueries({ queryKey: ["common-config-raw", sectionId] });
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const saveRaw = useMutation({
    mutationFn: () => putCommonConfigRaw(sectionId, raw),
    onSuccess: async () => {
      setMsg(savedMessage);
      setRawBaseline(raw);
      await qc.invalidateQueries({ queryKey: ["common-config", sectionId] });
      await qc.invalidateQueries({ queryKey: ["common-config-raw", sectionId] });
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const saving = saveForm.isPending || saveRaw.isPending;
  const dirty =
    mode === "raw" ? raw !== rawBaseline : JSON.stringify(fieldValues) !== formBaseline;
  const fields = cfgQ.data?.fields || [];
  const apiFieldGroups = cfgQ.data?.field_groups;

  function setFieldValue(name: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  }

  const save = useCallback(() => {
    setMsg(null);
    if (mode === "raw") void saveRaw.mutateAsync();
    else void saveForm.mutateAsync();
  }, [mode, saveForm, saveRaw]);

  useEffect(() => {
    if (!onSaveState) return;
    onSaveState({ dirty, saving, save });
  }, [onSaveState, dirty, saving, save]);

  useEffect(() => {
    if (!onSaveState) return;
    return () => onSaveState(null);
  }, [onSaveState]);

  return (
    <div className="space-y-3">
      {msg ? (
        <p className={cn("text-sm", msg.includes("已保存") ? "text-emerald-400" : "text-destructive")}>{msg}</p>
      ) : null}
      {mode === "form" ? (
        <StateBlock loading={cfgQ.isLoading} error={cfgQ.error} empty={!fields.length} emptyText="该分区无可编辑字段">
          {sectionId === "llm" ? (
            <LlmStrategyGroupedForm fields={fields} fieldValues={fieldValues} onFieldChange={setFieldValue} />
          ) : sectionId === "arknights_kb" ? (
            <div className="plugin-config-form-grid">
              {fields.map((f) => (
                <PluginConfigFieldShell
                  key={f.name}
                  field={f}
                  modelValue={fieldValues[f.name] ?? ""}
                  onValueChange={(v) => setFieldValue(f.name, v)}
                />
              ))}
            </div>
          ) : apiFieldGroups?.length ? (
            <DynamicConfigPanel
              fields={fields}
              fieldGroups={apiFieldGroups}
              fieldValues={fieldValues}
              onFieldChange={setFieldValue}
            />
          ) : (
            <PluginConfigFormSection subtitle={`共 ${fields.length} 项参数，保存后写入运行配置`}>
              {fields.map((f) => (
                <PluginConfigFieldShell
                  key={f.name}
                  field={f}
                  modelValue={fieldValues[f.name] ?? ""}
                  onValueChange={(v) => setFieldValue(f.name, v)}
                />
              ))}
            </PluginConfigFormSection>
          )}
          {inlineSave ? (
            <div className="mt-4">
              <UiButton variant="primary" size="sm" disabled={saving || !dirty} onClick={save}>
                {saving ? "保存中…" : "保存"}
              </UiButton>
            </div>
          ) : null}
        </StateBlock>
      ) : (
        <StateBlock loading={rawQ.isLoading} error={rawQ.error}>
          <div className="plugin-config-page__raw-toml-wrap">
            <textarea
              className="inp textarea plugin-config-page__raw-toml min-h-[22rem] w-full font-mono text-xs leading-relaxed"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              spellCheck={false}
            />
          </div>
          {inlineSave ? (
            <div className="mt-3">
              <UiButton variant="primary" size="sm" disabled={saving || !dirty} onClick={save}>
                {saving ? "保存中…" : "保存 TOML"}
              </UiButton>
            </div>
          ) : null}
        </StateBlock>
      )}
    </div>
  );
}
