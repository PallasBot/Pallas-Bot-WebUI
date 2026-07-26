import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { axiosErrorDetail } from "@/api/http";
import { fetchCommonConfig, putCommonConfig, type PluginConfigField } from "@/api/console";
import type { AiConfigSaveStateHandler } from "@/components/ai/aiConfigSaveState";
import AiSectionHeader from "@/components/ai/AiSectionHeader";
import PluginConfigFieldShell from "@/components/config/PluginConfigFieldShell";
import StateBlock from "@/components/StateBlock";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { collectFieldValues, fieldValuesFromConfig } from "@/utils/pluginConfigFieldModel";
import { pushConsoleToast } from "@/utils/consoleToast";

function boolFromField(value: string | undefined): boolean {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function fieldsByNames(fields: PluginConfigField[], names: readonly string[]): PluginConfigField[] {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const out: PluginConfigField[] = [];
  for (const name of names) {
    const field = byName.get(name);
    if (field) out.push(field);
  }
  return out;
}

/** 对话子面板：总开关 + 左边线从属字段，读写 common-config/llm。 */
export default function AiLlmFieldPanel({
  icon,
  title,
  lead,
  masterKey,
  masterLabel,
  disabledHint,
  detailKeys,
  savedMessage,
  inlineSave = true,
  onSaveState,
}: {
  icon: LucideIcon;
  title: string;
  lead: string;
  masterKey?: string;
  masterLabel?: string;
  disabledHint?: string;
  detailKeys: readonly string[];
  savedMessage: string;
  /** false 时隐藏面板内保存按钮（改由顶栏触发） */
  inlineSave?: boolean;
  onSaveState?: AiConfigSaveStateHandler;
}) {
  const qc = useQueryClient();
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [baseline, setBaseline] = useState("");

  const cfgQ = useQuery({
    queryKey: ["common-config", "llm"],
    queryFn: () => fetchCommonConfig("llm"),
  });

  useEffect(() => {
    if (!cfgQ.data?.fields) return;
    const next = fieldValuesFromConfig(cfgQ.data.fields);
    setFieldValues(next);
    setBaseline(JSON.stringify(next));
  }, [cfgQ.data]);

  const dirty = useMemo(() => JSON.stringify(fieldValues) !== baseline, [fieldValues, baseline]);
  const masterOn = masterKey ? boolFromField(fieldValues[masterKey]) : true;
  const detailFields = useMemo(
    () => fieldsByNames(cfgQ.data?.fields || [], detailKeys),
    [cfgQ.data?.fields, detailKeys],
  );

  const saveMut = useMutation({
    mutationFn: () => {
      const allFields = cfgQ.data?.fields || [];
      return putCommonConfig("llm", collectFieldValues(allFields, fieldValues));
    },
    onSuccess: async () => {
      pushConsoleToast(savedMessage, "ok");
      setBaseline(JSON.stringify(fieldValues));
      await qc.invalidateQueries({ queryKey: ["common-config", "llm"] });
      await qc.invalidateQueries({ queryKey: ["common-config-raw", "llm"] });
    },
    onError: (e) => pushConsoleToast(axiosErrorDetail(e) || "保存失败", "err"),
  });

  function setFieldValue(name: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  }

  const saveMutRef = useRef(saveMut);
  saveMutRef.current = saveMut;

  const save = useCallback(() => {
    void saveMutRef.current.mutateAsync();
  }, []);

  useEffect(() => {
    if (!onSaveState) return;
    onSaveState({ dirty, saving: saveMut.isPending, save });
  }, [onSaveState, dirty, saveMut.isPending, save]);

  useEffect(() => {
    if (!onSaveState) return;
    return () => onSaveState(null);
  }, [onSaveState]);

  return (
    <div className="space-y-5">
      <AiSectionHeader
        icon={icon}
        title={title}
        lead={lead}
        action={
          masterKey ? (
            <div className="flex items-center gap-2">
              {masterLabel ? <span className="hidden text-xs text-muted-foreground sm:inline">{masterLabel}</span> : null}
              <Switch
                checked={masterOn}
                onCheckedChange={(checked) => setFieldValue(masterKey, checked ? "true" : "false")}
                aria-label={masterLabel || title}
              />
            </div>
          ) : undefined
        }
      />

      <StateBlock
        loading={cfgQ.isLoading}
        error={cfgQ.error}
        empty={!cfgQ.data?.fields?.length}
        emptyText="暂无可编辑字段"
      >
        {masterKey && !masterOn ? (
          <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 p-4 text-sm text-muted-foreground">
            <ChevronRight className="size-4 shrink-0" aria-hidden />
            <span>{disabledHint || "已关闭；开启后可调整下方参数。"}</span>
          </div>
        ) : (
          <div className="plugin-config-form-grid">
            {detailFields.map((field) => (
              <PluginConfigFieldShell
                key={field.name}
                field={field}
                modelValue={fieldValues[field.name] ?? ""}
                onValueChange={(v) => setFieldValue(field.name, v)}
              />
            ))}
          </div>
        )}

        {inlineSave ? (
          <div className="flex justify-end pt-1">
            <Button type="button" size="sm" disabled={!dirty || saveMut.isPending} onClick={save}>
              {saveMut.isPending ? "保存中…" : dirty ? "保存" : "已是最新"}
            </Button>
          </div>
        ) : null}
      </StateBlock>
    </div>
  );
}
