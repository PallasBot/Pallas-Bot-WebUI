import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Users } from "lucide-react";
import { fetchGroupList, fetchInstances } from "@/api/fullConsole";
import { useAiGovernanceScope } from "@/components/ai/AiGovernanceScope";
import BotAccountCombobox from "@/components/BotAccountCombobox";
import ChromeField from "@/components/ChromeField";
import { CHROME_TOOLS_CLUSTER } from "@/components/ChromeTools";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { useBotFavorites } from "@/hooks/useBotFavorites";
import { botSelectDropdownLabel } from "@/utils/botDisplay";

function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

/** AI 治理页范围固定为群聊，只选择 Bot 与群。 */
export default function AiGovernanceScopeFields() {
  const { botId, groupId, setBotId, setGroupId } = useAiGovernanceScope();
  const { favorites } = useBotFavorites();
  const instancesQ = useQuery({ queryKey: ["instances"], queryFn: () => fetchInstances() });
  const botReady = isPositiveInteger(botId);
  const botNumber = Number(botId);
  const groupsQ = useQuery({
    queryKey: ["group-list", String(botNumber)],
    queryFn: () => fetchGroupList(botNumber),
    enabled: botReady,
  });

  const bots = useMemo(() => {
    const data = instancesQ.data;
    if (!data) return [];
    const seen = new Set<string>();
    const options: Array<{ id: string; nickname: string }> = [];
    for (const source of [data.nonebot_bots ?? [], data.db_bot_configs ?? []]) {
      for (const item of source) {
        const id = String("self_id" in item ? item.self_id : item.account).trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        options.push({ id, nickname: data.bot_profiles?.[id]?.nickname?.trim() || "" });
      }
    }
    return options;
  }, [instancesQ.data]);

  const groupOptions = useMemo<ComboboxOption[]>(() => {
    const seen = new Set<string>();
    const options: ComboboxOption[] = [];
    for (const group of groupsQ.data?.groups ?? []) {
      const id = String(group.group_id ?? "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const name = String(group.group_name ?? "").trim();
      options.push({
        value: id,
        label: name ? `${name}（${id}）` : id,
        triggerLabel: name || id,
        keywords: `${id} ${name}`,
      });
    }
    if (groupId.trim() && !seen.has(groupId.trim())) {
      options.push({ value: groupId.trim(), label: groupId.trim(), keywords: groupId.trim() });
    }
    return options;
  }, [groupId, groupsQ.data?.groups]);

  const selectedBot = bots.find((bot) => bot.id === botId.trim());

  return (
    <div className={CHROME_TOOLS_CLUSTER}>
      <ChromeField label="Bot" icon={Bot} className="shrink-0">
        {bots.length ? (
          <BotAccountCombobox
            value={botId.trim()}
            onValueChange={setBotId}
            bots={bots}
            favorites={favorites}
            placeholder="选择 Bot"
            memoryKey="ai-governance-bot"
            title={selectedBot ? botSelectDropdownLabel(selectedBot.nickname, selectedBot.id) : botId}
          />
        ) : (
          <Input
            className="h-9 w-[7.5rem] shrink-0"
            inputMode="numeric"
            placeholder="Bot QQ"
            aria-label="Bot QQ"
            value={botId}
            onChange={(event) => setBotId(event.target.value)}
          />
        )}
      </ChromeField>

      <ChromeField label="群" icon={Users} className="shrink-0">
        {botReady ? (
          <Combobox
            value={groupId.trim()}
            onValueChange={setGroupId}
            options={groupOptions}
            placeholder="选择或输入群号"
            searchPlaceholder="搜索或输入群号…"
            emptyText="无匹配群"
            searchCount={(groupsQ.data?.groups ?? []).length}
            allowCustom
            memoryKey={`ai-governance-group:${botId.trim()}`}
            loading={groupsQ.isLoading}
            ariaLabel="治理范围群号"
            triggerClassName="h-9 w-auto min-w-[8rem] max-w-[12rem] shrink-0"
          />
        ) : (
          <Input
            className="h-9 w-[8rem] shrink-0"
            inputMode="numeric"
            placeholder="先选择 Bot"
            aria-label="群号"
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
          />
        )}
      </ChromeField>

    </div>
  );
}
