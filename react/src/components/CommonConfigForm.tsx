import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import { fetchCommonConfig, fetchCommonConfigRaw, putCommonConfig, putCommonConfigRaw } from "@/api/console";
import PluginConfigFieldShell from "@/components/config/PluginConfigFieldShell";
import StateBlock from "@/components/StateBlock";
import UiButton from "@/components/ui/UiButton";
import { cn } from "@/lib/utils";
import { collectFieldValues, fieldValuesFromConfig } from "@/utils/pluginConfigFieldModel";

export default function CommonConfigForm({
  sectionId,
  mode = "form",
  savedMessage = "配置已保存",
}: {
  sectionId: string;
  mode?: "form" | "raw";
  savedMessage?: string;
}) {
  const qc = useQueryClient();
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [raw, setRaw] = useState("");
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
    setFieldValues(fieldValuesFromConfig(cfgQ.data.fields));
  }, [cfgQ.data]);

  useEffect(() => {
    if (rawQ.data != null) setRaw(rawQ.data);
  }, [rawQ.data]);

  const saveForm = useMutation({
    mutationFn: () => {
      const fields = cfgQ.data?.fields || [];
      return putCommonConfig(sectionId, collectFieldValues(fields, fieldValues));
    },
    onSuccess: async () => {
      setMsg(savedMessage);
      await qc.invalidateQueries({ queryKey: ["common-config", sectionId] });
      await qc.invalidateQueries({ queryKey: ["common-config-raw", sectionId] });
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const saveRaw = useMutation({
    mutationFn: () => putCommonConfigRaw(sectionId, raw),
    onSuccess: async () => {
      setMsg(savedMessage);
      await qc.invalidateQueries({ queryKey: ["common-config", sectionId] });
      await qc.invalidateQueries({ queryKey: ["common-config-raw", sectionId] });
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const saving = saveForm.isPending || saveRaw.isPending;
  const fields = cfgQ.data?.fields || [];

  async function save() {
    setMsg(null);
    if (mode === "raw") await saveRaw.mutateAsync();
    else await saveForm.mutateAsync();
  }

  return (
    <div className="space-y-3">
      {msg ? (
        <p className={cn("text-sm", msg.includes("已保存") ? "text-emerald-400" : "text-destructive")}>{msg}</p>
      ) : null}
      {mode === "form" ? (
        <StateBlock loading={cfgQ.isLoading} error={cfgQ.error} empty={!fields.length} emptyText="该分区无可编辑字段">
          <div className="plugin-config-form-grid">
            {fields.map((f) => (
              <PluginConfigFieldShell
                key={f.name}
                field={f}
                modelValue={fieldValues[f.name] ?? ""}
                onValueChange={(v) => setFieldValues((prev) => ({ ...prev, [f.name]: v }))}
              />
            ))}
          </div>
          <div className="mt-4">
            <UiButton variant="primary" size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? "保存中…" : "保存"}
            </UiButton>
          </div>
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
          <div className="mt-3">
            <UiButton variant="primary" size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? "保存中…" : "保存 TOML"}
            </UiButton>
          </div>
        </StateBlock>
      )}
    </div>
  );
}
