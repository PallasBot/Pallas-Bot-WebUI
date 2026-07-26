/**
 * 单个插件的帮助图分组：写入 help 插件的 help_tag_overrides[pluginId]。
 * 保存即生效（与画图网关面板同为立即落盘）。
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import { fetchPluginConfig, putPluginConfig } from "@/api/console";
import { pushConsoleToast } from "@/utils/consoleToast";
import SettingsFormField from "@/components/config/SettingsFormField";
import HelpTagSelect from "@/components/help/HelpTagSelect";
import { cn } from "@/lib/utils";
import {
  defaultHelpTagFromExtra,
  helpTagLabel,
  overridesFromHelpConfigFields,
  serializeHelpTagOverrides,
} from "@/components/help/helpTagOverrides";

type Props = {
  pluginId: string;
  /** 可能出现在覆盖表中的别名（nb 名等） */
  aliasIds?: string[];
  /** metadata.extra；用于展示插件默认分组 */
  metadataExtra?: Record<string, unknown> | null;
  /** help 插件配置页同步表单里的 JSON 字段，避免整页保存覆盖 */
  onOverridesSynced?: (serialized: string) => void;
  className?: string;
};

function pickOverride(overrides: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const hit = overrides[key];
    if (hit) return hit;
  }
  return "";
}

export default function PluginHelpTagField({
  pluginId,
  aliasIds,
  metadataExtra,
  onOverridesSynced,
  className,
}: Props) {
  const qc = useQueryClient();
  const id = pluginId.trim();
  const lookupKeys = useMemo(() => {
    const keys = [id, ...(aliasIds || []).map((x) => String(x || "").trim())].filter(Boolean);
    return [...new Set(keys)];
  }, [id, aliasIds]);
  const defaultTag = defaultHelpTagFromExtra(metadataExtra ?? undefined);

  const helpCfgQ = useQuery({
    queryKey: ["plugin-config", "help"],
    queryFn: () => fetchPluginConfig("help"),
    enabled: Boolean(id),
  });

  const overrides = useMemo(
    () => overridesFromHelpConfigFields(helpCfgQ.data?.fields),
    [helpCfgQ.data?.fields],
  );
  const currentOverride = pickOverride(overrides, lookupKeys);
  const extraTags = useMemo(() => Object.values(overrides), [overrides]);

  const saveMut = useMutation({
    mutationFn: async (nextTag: string) => {
      if (!id) throw new Error("缺少插件 id");
      const cfg = helpCfgQ.data ?? (await fetchPluginConfig("help"));
      const base = overridesFromHelpConfigFields(cfg.fields);
      const next = { ...base };
      for (const key of lookupKeys) {
        delete next[key];
      }
      const normalized = nextTag.trim().toLowerCase();
      if (normalized && normalized !== defaultTag) {
        next[id] = normalized;
      }
      const saved = await putPluginConfig("help", { help_tag_overrides: next });
      return { saved, serialized: serializeHelpTagOverrides(next) };
    },
    onSuccess: async ({ serialized }) => {
      onOverridesSynced?.(serialized);
      pushConsoleToast("帮助图分组已保存", "ok");
      await qc.invalidateQueries({ queryKey: ["plugin-config", "help"] });
    },
    onError: (e) => {
      pushConsoleToast(axiosErrorDetail(e) || "帮助图分组保存失败", "err");
    },
  });

  if (!id) return null;

  const statusHint = currentOverride
    ? `覆盖本插件在帮助图总览中的分组；当前为覆盖值，插件默认：${helpTagLabel(defaultTag)}。保存后立即热载。`
    : `覆盖本插件在帮助图总览中的分组；当前使用插件默认：${helpTagLabel(defaultTag)}。保存后立即热载。`;

  return (
    <SettingsFormField className={cn(className)} label="帮助图分组" hint={statusHint}>
      <HelpTagSelect
        value={currentOverride}
        extraTags={extraTags}
        allowEmpty
        emptyLabel={`使用默认（${helpTagLabel(defaultTag)}）`}
        disabled={saveMut.isPending || helpCfgQ.isLoading}
        onValueChange={(v) => {
          const next = v.trim().toLowerCase();
          if (next === (currentOverride || "").toLowerCase()) return;
          if (!next && !currentOverride) return;
          void saveMut.mutateAsync(next);
        }}
      />
    </SettingsFormField>
  );
}
