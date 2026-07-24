import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Users } from "lucide-react";
import { fetchInstances } from "@/api/fullConsole";
import {
  useAiObservationScope,
} from "@/components/ai/AiObservationScopeContext";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const instQ = useQuery({ queryKey: ["instances"], queryFn: () => fetchInstances() });

  const botOptions = useMemo(() => {
    const data = instQ.data;
    if (!data) return [];
    const seen = new Set<string>();
    const out: Array<{ id: string; label: string }> = [];
    for (const b of data.nonebot_bots ?? []) {
      const id = String(b.self_id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const nick = data.bot_profiles?.[id]?.nickname;
      out.push({ id, label: nick ? `${nick} (${id})` : id });
    }
    for (const cfg of data.db_bot_configs ?? []) {
      const id = String(cfg.account ?? "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, label: id });
    }
    return out;
  }, [instQ.data]);

  const useSelect = botOptions.length > 0;

  /* 须 shrink-0 + nowrap：顶栏 chrome-row 横向滚动依赖子项不被压窄换行 */
  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
      {showBot ? (
        <ChromeField label="Bot" icon={Bot} className="shrink-0">
          {useSelect ? (
            <Select
              value={botId.trim() || ALL_BOTS}
              onValueChange={(v) => setBotId(v === ALL_BOTS ? "" : v)}
            >
              <SelectTrigger className="h-9 w-[9rem] shrink-0">
                <SelectValue placeholder="全部 Bot" />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value={ALL_BOTS}>
                  <ChromeOptionLabel icon={Bot}>全部</ChromeOptionLabel>
                </SelectItem>
                {botOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    <ChromeOptionLabel icon={Bot}>{b.label}</ChromeOptionLabel>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
