import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDraftProtection, type DraftNavigation } from "@/components/DraftProtection";
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
import { collectFieldValues, fieldValuesFromConfig } from "@/utils/pluginConfigFieldModel";
import { pushConsoleToast } from "@/utils/consoleToast";

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
    advanced: group.tier === "advanced",
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
  navigationPanel,
}: {
  sectionId: string;
  mode?: "form" | "raw";
  savedMessage?: string;
  /** false 时隐藏面板内保存按钮（改由顶栏触发） */
  inlineSave?: boolean;
  onSaveState?: AiConfigSaveStateHandler;
  navigationPanel?: string;
}) {
  const qc = useQueryClient();
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [formBaseline, setFormBaseline] = useState("");
  const [formReady, setFormReady] = useState(false);
  const [raw, setRaw] = useState("");
  const [rawBaseline, setRawBaseline] = useState("");
  const [rawReady, setRawReady] = useState(false);
  const fieldValuesRef = useRef(fieldValues);
  fieldValuesRef.current = fieldValues;
  const rawRef = useRef(raw);
  rawRef.current = raw;
  const formBaselineRef = useRef(formBaseline);
  formBaselineRef.current = formBaseline;
  const rawBaselineRef = useRef(rawBaseline);
  rawBaselineRef.current = rawBaseline;
  const formSectionRef = useRef("");
  const rawSectionRef = useRef("");

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
    const sectionChanged = formSectionRef.current !== sectionId;
    if (sectionChanged || !formReady || JSON.stringify(fieldValuesRef.current) === formBaselineRef.current) {
      const nextBaseline = JSON.stringify(next);
      formSectionRef.current = sectionId;
      fieldValuesRef.current = next;
      formBaselineRef.current = nextBaseline;
      setFieldValues(next);
      setFormBaseline(nextBaseline);
      setFormReady(true);
    }
  }, [cfgQ.data, formReady, sectionId]);

  useEffect(() => {
    if (rawQ.data == null) return;
    const sectionChanged = rawSectionRef.current !== sectionId;
    if (sectionChanged || !rawReady || rawRef.current === rawBaselineRef.current) {
      rawSectionRef.current = sectionId;
      rawRef.current = rawQ.data;
      rawBaselineRef.current = rawQ.data;
      setRaw(rawQ.data);
      setRawBaseline(rawQ.data);
      setRawReady(true);
    }
  }, [rawQ.data, rawReady, sectionId]);

  const shouldBlockNavigation = useCallback(
    ({ currentLocation, nextLocation }: DraftNavigation) => {
      if (currentLocation.pathname !== nextLocation.pathname) return true;
      if (currentLocation.pathname !== "/ai/config/dialogue") return false;
      const panelOf = (search: string) => {
        const panel = new URLSearchParams(search).get("panel") || "form";
        return ["raw", "session", "memory", "budget", "arknights", "sources", "tools"].includes(panel)
          ? panel
          : "form";
      };
      const currentPanel = panelOf(currentLocation.search);
      const nextPanel = panelOf(nextLocation.search);
      const isEditorPanel = (panel: string) => sectionId === "llm"
        ? panel === "form" || panel === "raw"
        : panel === navigationPanel;
      return isEditorPanel(currentPanel) && !isEditorPanel(nextPanel);
    },
    [sectionId, navigationPanel],
  );

  const saveForm = useMutation({
    mutationFn: (snapshot: Record<string, string>) => {
      const allFields = cfgQ.data?.fields || [];
      return putCommonConfig(sectionId, collectFieldValues(allFields, snapshot));
    },
    onSuccess: async (_, snapshot) => {
      pushConsoleToast(savedMessage, "ok");
      const nextBaseline = JSON.stringify(snapshot);
      formBaselineRef.current = nextBaseline;
      setFormBaseline(nextBaseline);
      await qc.invalidateQueries({ queryKey: ["common-config", sectionId] });
      await qc.invalidateQueries({ queryKey: ["common-config-raw", sectionId] });
    },
    onError: (e) => pushConsoleToast(axiosErrorDetail(e) || "保存失败", "err"),
  });

  const saveRaw = useMutation({
    mutationFn: (snapshot: string) => putCommonConfigRaw(sectionId, snapshot),
    onSuccess: async (_, snapshot) => {
      pushConsoleToast(savedMessage, "ok");
      rawBaselineRef.current = snapshot;
      setRawBaseline(snapshot);
      await qc.invalidateQueries({ queryKey: ["common-config", sectionId] });
      await qc.invalidateQueries({ queryKey: ["common-config-raw", sectionId] });
    },
    onError: (e) => pushConsoleToast(axiosErrorDetail(e) || "保存失败", "err"),
  });

  const saving = saveForm.isPending || saveRaw.isPending;
  const formDirty = formReady && JSON.stringify(fieldValues) !== formBaseline;
  const rawDirty = rawReady && raw !== rawBaseline;
  const dirty = formDirty || rawDirty;
  const modeDirty = mode === "raw" ? rawDirty : formDirty;
  useDraftProtection(dirty, shouldBlockNavigation);
  const fields = cfgQ.data?.fields || [];
  const apiFieldGroups = cfgQ.data?.field_groups;

  function setFieldValue(name: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  }

  const saveFormRef = useRef(saveForm);
  const saveRawRef = useRef(saveRaw);
  saveFormRef.current = saveForm;
  saveRawRef.current = saveRaw;

  const save = useCallback(() => {
    if (mode === "raw") void saveRawRef.current.mutateAsync(rawRef.current).catch(() => undefined);
    else void saveFormRef.current.mutateAsync({ ...fieldValuesRef.current }).catch(() => undefined);
  }, [mode]);

  useEffect(() => {
    if (!onSaveState) return;
    onSaveState({ dirty: modeDirty, saving, save });
  }, [onSaveState, modeDirty, saving, save]);

  useEffect(() => {
    if (!onSaveState) return;
    return () => onSaveState(null);
  }, [onSaveState]);

  return (
    <div className="space-y-3">
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
              <UiButton variant="primary" size="sm" disabled={saving || !modeDirty} onClick={save}>
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
              <UiButton variant="primary" size="sm" disabled={saving || !modeDirty} onClick={save}>
                {saving ? "保存中…" : "保存 TOML"}
              </UiButton>
            </div>
          ) : null}
        </StateBlock>
      )}
    </div>
  );
}
