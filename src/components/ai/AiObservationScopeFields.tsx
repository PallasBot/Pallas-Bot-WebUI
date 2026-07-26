import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Users } from "lucide-react";
import { fetchInstances } from "@/api/fullConsole";
import {
  useAiObservationScope,
} from "@/components/ai/AiObservationScopeContext";
import BotAccountCombobox from "@/components/BotAccountCombobox";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import { CHROME_TOOLS_CLUSTER } from "@/components/ChromeTools";
import { Input } from "@/components/ui/input";
import { useBotFavorites } from "@/hooks/useBotFavorites";
import { botAccountFavoriteRank, botSelectDropdownLabel } from "@/utils/botDisplay";

const ALL_BOTS = "__all__";

/**
 * 观测顶栏 Bot / 群过滤（ChromeField）。
 * 是否展示由分段 `scope` 决定；Bot：有实例时下拉，否则数字输入。
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
    out.sort((a, b) => {
      const fa = botAccountFavoriteRank(favorites, a.id);
      const fb = botAccountFavoriteRank(favorites, b.id);
      if (fa !== fb) return fb - fa;
      const cmp = a.nickname.localeCompare(b.nickname, "zh-CN");
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id, "zh-CN", { numeric: true });
    });
    return out;
  }, [favorites, instQ.data]);

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
          <Input
            className="h-9 w-[7.5rem] shrink-0"
            inputMode="numeric"
            placeholder="群号可空"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          />
        </ChromeField>
      ) : null}
    </div>
  );
}
