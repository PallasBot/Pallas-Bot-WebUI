import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Users } from "lucide-react";
import { fetchGroupList, fetchInstances } from "@/api/fullConsole";
import {
  useAiObservationScope,
} from "@/components/ai/AiObservationScopeContext";
import BotAccountCombobox from "@/components/BotAccountCombobox";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import { CHROME_TOOLS_CLUSTER } from "@/components/ChromeTools";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { useBotFavorites } from "@/hooks/useBotFavorites";
import { botSelectDropdownLabel } from "@/utils/botDisplay";

const ALL_BOTS = "__all__";
const ALL_GROUPS = "__all_groups__";

/**
 * 观测顶栏 Bot / 群过滤（ChromeField）。
 * 是否展示由分段 `scope` 决定；Bot：有实例时下拉，否则数字输入。
 * 群：已选 Bot 时用 Combobox（可搜 / 手输群号），否则数字输入。
 */
export default function AiObservationScopeFields({
  showBot = true,
  showGroup = true,
}: {
  showBot?: boolean;
  showGroup?: boolean;
}) {
  const { botId, groupId, setBotId, setGroupId } = useAiObservationScope();
  const { favorites } = useBotFavorites();
  const instQ = useQuery({ queryKey: ["instances"], queryFn: () => fetchInstances() });

  const botOptions = useMemo(() => {
    const data = instQ.data;
    if (!data) return [];
    const seen = new Set<string>();
    const out: Array<{ id: string; nickname: string }> = [];
    for (const b of data.nonebot_bots ?? []) {
      const id = String(b.self_id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, nickname: data.bot_profiles?.[id]?.nickname?.trim() || "" });
    }
    for (const cfg of data.db_bot_configs ?? []) {
      const id = String(cfg.account ?? "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, nickname: data.bot_profiles?.[id]?.nickname?.trim() || "" });
    }
    return out;
  }, [instQ.data]);

  const botNum = Number.parseInt(botId.trim(), 10);
  const botReady = Number.isFinite(botNum) && botNum > 0;
  const groupsQ = useQuery({
    queryKey: ["group-list", String(botNum)],
    queryFn: () => fetchGroupList(botNum),
    enabled: botReady,
  });

  const groupOptions = useMemo(() => {
    const out: ComboboxOption[] = [
      {
        value: ALL_GROUPS,
        label: <ChromeOptionLabel icon={Users}>全部</ChromeOptionLabel>,
        keywords: "全部群",
      },
    ];
    const rows = groupsQ.data?.groups ?? [];
    const seen = new Set<string>();
    for (const g of rows) {
      const id = String(g.group_id ?? "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const name = String(g.group_name ?? "").trim();
      out.push({
        value: id,
        label: name ? `${name}（${id}）` : id,
        triggerLabel: name || id,
        keywords: `${id} ${name}`,
      });
    }
    const cur = groupId.trim();
    if (cur && !seen.has(cur)) {
      out.push({ value: cur, label: cur, keywords: cur });
    }
    return out;
  }, [groupId, groupsQ.data?.groups]);

  const useSelect = botOptions.length > 0;
  const selected = botOptions.find((b) => b.id === botId.trim());

  /* 须 shrink-0 + nowrap：顶栏 chrome-row 横向滚动依赖子项不被压窄换行 */
  return (
    <div className={CHROME_TOOLS_CLUSTER}>
      {showBot ? (
        <ChromeField label="Bot" icon={Bot} className="shrink-0">
          {useSelect ? (
            <BotAccountCombobox
              value={botId.trim() || ALL_BOTS}
              onValueChange={(v) => setBotId(v === ALL_BOTS ? "" : v)}
              bots={botOptions}
              favorites={favorites}
              leadingOption={{
                value: ALL_BOTS,
                label: <ChromeOptionLabel icon={Bot}>全部</ChromeOptionLabel>,
                keywords: "全部 Bot",
              }}
              placeholder="全部 Bot"
              title={
                selected
                  ? botSelectDropdownLabel(selected.nickname, selected.id)
                  : botId.trim()
                    ? botId
                    : undefined
              }
            />
          ) : (
            <Input
              className="h-9 w-[7.5rem] shrink-0"
              inputMode="numeric"
              placeholder="Bot QQ"
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
            />
          )}
        </ChromeField>
      ) : null}

      {showGroup ? (
        <ChromeField label="群" icon={Users} className="shrink-0">
          {botReady ? (
            <Combobox
              value={groupId.trim() || ALL_GROUPS}
              onValueChange={(v) => setGroupId(v === ALL_GROUPS ? "" : v)}
              options={groupOptions}
              placeholder="全部群"
              searchPlaceholder="搜索或输入群号…"
              emptyText="无匹配群"
              searchCount={(groupsQ.data?.groups ?? []).length}
              allowCustom
              ariaLabel="群号过滤"
              triggerClassName="h-9 w-auto min-w-[7.5rem] max-w-[12rem] shrink-0"
            />
          ) : (
            <Input
              className="h-9 w-[7.5rem] shrink-0"
              inputMode="numeric"
              placeholder="群号可空"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            />
          )}
        </ChromeField>
      ) : null}
    </div>
  );
}
