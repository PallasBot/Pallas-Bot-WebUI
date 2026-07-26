import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAgentCatchphrases,
  fetchAgentObservations,
  fetchAgentPersonFacts,
  resolveAgentCatchphrase,
  saveAgentPersonFact,
} from "@/api/agentPlatformApi";
import { useRegisterAiObservationChrome } from "@/components/ai/AiObservationChromeContext";
import AiScopeHint from "@/components/ai/AiScopeHint";
import {
  parseScopeBotId,
  parseScopeGroupId,
  useAiObservationScope,
} from "@/components/ai/AiObservationScopeContext";
import StateBlock from "@/components/StateBlock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AiPeoplePage() {
  const qc = useQueryClient();
  const { botId, groupId } = useAiObservationScope();
  const scopeBot = parseScopeBotId(botId);
  const scopeGroup = parseScopeGroupId(groupId);
  const [userId, setUserId] = useState("");
  const [content, setContent] = useState("");

  useRegisterAiObservationChrome({ middle: null });

  const factsQuery = useQuery({
    queryKey: ["agent-person-facts", scopeBot, scopeGroup],
    enabled: Boolean(scopeBot),
    queryFn: () =>
      fetchAgentPersonFacts({
        botId: scopeBot!,
        groupId: scopeGroup,
      }),
  });
  const observationsQuery = useQuery({
    queryKey: ["agent-observations", scopeBot, scopeGroup],
    queryFn: () =>
      fetchAgentObservations({
        botId: scopeBot,
        groupId: scopeGroup,
        status: "all",
      }),
  });
  const catchphrasesQuery = useQuery({
    queryKey: ["agent-catchphrases", scopeBot],
    queryFn: () => fetchAgentCatchphrases({ botId: scopeBot }),
  });

  const saveFact = useMutation({
    mutationFn: async () => {
      if (!scopeBot || scopeGroup == null) throw new Error("需要 Bot 与群号");
      const uid = Number(userId);
      if (!Number.isFinite(uid) || uid <= 0) throw new Error("用户 ID 无效");
      return saveAgentPersonFact({
        botId: scopeBot,
        groupId: scopeGroup,
        userId: uid,
        content,
      });
    },
    onSuccess: async () => {
      setContent("");
      await qc.invalidateQueries({ queryKey: ["agent-person-facts"] });
    },
  });

  const resolveCatchphrase = useMutation({
    mutationFn: ({ entryId, action }: { entryId: string; action: "approve" | "reject" }) =>
      resolveAgentCatchphrase(entryId, action),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["agent-catchphrases"] });
    },
  });

  const facts = useMemo(() => factsQuery.data?.items || [], [factsQuery.data]);
  const observations = useMemo(() => observationsQuery.data?.items || [], [observationsQuery.data]);
  const catchphrases = useMemo(() => catchphrasesQuery.data?.items || [], [catchphrasesQuery.data]);

  if (!scopeBot) {
    return <AiScopeHint>请在顶栏指定 Bot QQ。</AiScopeHint>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">人物事实</CardTitle>
          <CardDescription>群内默认隔离；全局层需用户同意后才可复用。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              className="sm:max-w-[10rem]"
              placeholder="用户 QQ"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
            <Input
              placeholder="稳定事实，例如希望被叫作…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <Button
              disabled={!content.trim() || saveFact.isPending || scopeGroup == null}
              onClick={() => saveFact.mutate()}
            >
              写入
            </Button>
          </div>
          {scopeGroup == null ? <p className="text-xs text-muted-foreground">写入事实需要选择群号。</p> : null}
          {saveFact.error ? <p className="text-xs text-destructive">{String(saveFact.error)}</p> : null}
          <StateBlock loading={factsQuery.isLoading} error={factsQuery.error}>
            <ul className="space-y-2">
              {facts.map((item) => (
                <li key={String(item.fact_id)} className="rounded-md border p-3 text-sm">
                  <div className="font-medium">{String(item.content || "")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    用户 {String(item.user_id)} · {String(item.scope)} · {String(item.status)}
                  </div>
                </li>
              ))}
              {!facts.length ? <li className="text-sm text-muted-foreground">暂无人物事实。</li> : null}
            </ul>
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">观察队列</CardTitle>
          <CardDescription>待整理的候选记忆；队列大小 {observationsQuery.data?.queue_size ?? 0}。</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={observationsQuery.isLoading} error={observationsQuery.error}>
            <ul className="space-y-2">
              {observations.slice(0, 20).map((item) => (
                <li key={String(item.observation_id)} className="rounded-md border p-3 text-sm">
                  <div>{String(item.text || "")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {String(item.status)} · 用户 {String(item.user_id)} · {String(item.source)}
                  </div>
                </li>
              ))}
              {!observations.length ? <li className="text-sm text-muted-foreground">队列为空。</li> : null}
            </ul>
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">账号口癖候选</CardTitle>
          <CardDescription>仅来自该 Bot 成功表达；审批后进入账号级口癖。</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={catchphrasesQuery.isLoading} error={catchphrasesQuery.error}>
            <ul className="space-y-2">
              {catchphrases.map((item) => (
                <li
                  key={String(item.entry_id)}
                  className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">{String(item.saying || "")}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {String(item.status)} · 支持 {String(item.support)} · 群数{" "}
                      {Array.isArray(item.groups_seen) ? item.groups_seen.length : 0}
                    </div>
                  </div>
                  {String(item.status) === "candidate" ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          resolveCatchphrase.mutate({
                            entryId: String(item.entry_id),
                            action: "approve",
                          })
                        }
                      >
                        通过
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          resolveCatchphrase.mutate({
                            entryId: String(item.entry_id),
                            action: "reject",
                          })
                        }
                      >
                        驳回
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
              {!catchphrases.length ? <li className="text-sm text-muted-foreground">暂无口癖候选。</li> : null}
            </ul>
          </StateBlock>
        </CardContent>
      </Card>
    </div>
  );
}
