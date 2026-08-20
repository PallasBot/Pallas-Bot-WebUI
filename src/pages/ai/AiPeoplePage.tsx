import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleOff, Heart, PenLine, Search, Trash2, X } from "lucide-react";
import {
  fetchAgentCatchphrases,
  fetchAgentObservations,
  fetchAgentPersonFacts,
  resolveAgentCatchphrase,
  saveAgentPersonFact,
} from "@/api/agentPlatformApi";
import {
  fetchConversationKernelRelationshipNotes,
  postConversationKernelRelationshipNoteDelete,
  postConversationKernelRelationshipNoteSetAffinity,
  postConversationKernelRelationshipNoteSetContent,
} from "@/api/console";
import { fetchFriendList } from "@/api/console";
import { useRegisterAiObservationChrome } from "@/components/ai/AiObservationChromeContext";
import AiScopeHint from "@/components/ai/AiScopeHint";
import {
  parseScopeBotId,
  parseScopeGroupId,
  useAiObservationScope,
} from "@/components/ai/AiObservationScopeContext";
import StateBlock from "@/components/StateBlock";
import { CHROME_SEARCH_INPUT } from "@/components/ChromeTools";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { pushConsoleToast } from "@/utils/consoleToast";

type CatchStatusFilter = "candidate" | "active" | "all";
const CATCHPHRASE_PAGE_SIZE = 50;

const AFFINITY_LEVELS: Array<{ max: number; label: string }> = [
  { max: -0.5, label: "厌恶" },
  { max: -0.15, label: "冷淡" },
  { max: 0.15, label: "陌生" },
  { max: 0.4, label: "认识" },
  { max: 0.6, label: "熟人" },
  { max: 0.8, label: "朋友" },
];

function affinityLevel(affinity: number): string {
  for (const level of AFFINITY_LEVELS) {
    if (affinity < level.max) return level.label;
  }
  return "挚友";
}

function truncateText(raw: string, max = 72): string {
  const text = String(raw || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function friendDisplayName(row: { nickname?: string; remark?: string; user_id: number }): string {
  const remark = String(row.remark || "").trim();
  const nick = String(row.nickname || "").trim();
  return remark || nick || String(row.user_id);
}

function catchphraseStatusLabel(status: string): string {
  if (status === "candidate") return "待审";
  if (status === "active") return "已启用";
  if (status === "rejected") return "已驳回";
  return status || "—";
}

function observationStatusLabel(status: string): string {
  if (status === "pending") return "待整理";
  if (status === "processed") return "已处理";
  if (status === "dropped") return "已丢弃";
  return status || "—";
}

function factScopeLabel(scope: string): string {
  if (scope === "group") return "本群";
  if (scope === "global") return "全局";
  return scope || "—";
}

export default function AiPeoplePage() {
  const qc = useQueryClient();
  const { botId, groupId } = useAiObservationScope();
  const scopeBot = parseScopeBotId(botId);
  const scopeGroup = parseScopeGroupId(groupId);
  const [userId, setUserId] = useState("");
  const [content, setContent] = useState("");
  const [catchFilter, setCatchFilter] = useState<CatchStatusFilter>("candidate");
  const [catchOffset, setCatchOffset] = useState(0);
  const [notesSearch, setNotesSearch] = useState("");

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
    queryKey: ["agent-catchphrases", scopeBot, catchFilter, catchOffset],
    queryFn: () =>
      fetchAgentCatchphrases({
        botId: scopeBot,
        status: catchFilter === "all" ? undefined : catchFilter,
        offset: catchOffset,
        limit: CATCHPHRASE_PAGE_SIZE,
      }),
  });
  const friendsQuery = useQuery({
    queryKey: ["friend-list", scopeBot],
    enabled: Boolean(scopeBot),
    queryFn: () => fetchFriendList(scopeBot!),
  });

  const notesQuery = useQuery({
    queryKey: ["conversation-kernel-notes", scopeBot, scopeGroup, notesSearch],
    enabled: Boolean(scopeBot),
    queryFn: () =>
      fetchConversationKernelRelationshipNotes({
        botId: scopeBot!,
        groupId: scopeGroup,
        query: notesSearch || undefined,
        limit: 80,
      }),
  });

  const notes = useMemo(() => notesQuery.data?.items || [], [notesQuery.data]);

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

  const [affinityDrafts, setAffinityDrafts] = useState<Record<string, string>>({});
  const [contentDrafts, setContentDrafts] = useState<Record<string, string>>({});
  const [editingNote, setEditingNote] = useState<number | null>(null);

  const setContentMut = useMutation({
    mutationFn: (args: { userId: number; content: string }) =>
      postConversationKernelRelationshipNoteSetContent({
        botId: scopeBot!,
        groupId: scopeGroup,
        userId: args.userId,
        content: args.content,
      }),
    onSuccess: async () => {
      pushConsoleToast("关系备注已更新", "ok");
      setEditingNote(null);
      setContentDrafts({});
      await qc.invalidateQueries({ queryKey: ["conversation-kernel-notes"] });
    },
  });

  const setAffinityMut = useMutation({
    mutationFn: (args: { userId: number; affinity: number }) =>
      postConversationKernelRelationshipNoteSetAffinity({
        botId: scopeBot!,
        groupId: scopeGroup,
        userId: args.userId,
        affinity: args.affinity,
      }),
    onSuccess: async (_data, vars) => {
      pushConsoleToast("好感度已更新", "ok");
      setAffinityDrafts((prev) => {
        const next = { ...prev };
        delete next[String(vars.userId)];
        return next;
      });
      await qc.invalidateQueries({ queryKey: ["conversation-kernel-notes"] });
    },
  });

  const deleteNoteMut = useMutation({
    mutationFn: (id: number) =>
      postConversationKernelRelationshipNoteDelete({ id, botId: scopeBot! }),
    onSuccess: async () => {
      pushConsoleToast("关系笔记已删除", "ok");
      await qc.invalidateQueries({ queryKey: ["conversation-kernel-notes"] });
    },
  });

  const facts = useMemo(() => factsQuery.data?.items || [], [factsQuery.data]);
  const observations = useMemo(() => observationsQuery.data?.items || [], [observationsQuery.data]);
  const catchphrases = useMemo(() => catchphrasesQuery.data?.items || [], [catchphrasesQuery.data]);
  const friends = useMemo(() => friendsQuery.data?.friends || [], [friendsQuery.data]);

  const friendOptions = useMemo(() => {
    const out: ComboboxOption[] = [];
    const seen = new Set<string>();
    for (const row of friends) {
      const id = String(row.user_id ?? "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const name = friendDisplayName(row);
      out.push({
        value: id,
        label: name !== id ? `${name}（${id}）` : id,
        triggerLabel: name || id,
        keywords: `${id} ${row.nickname || ""} ${row.remark || ""}`,
      });
    }
    const cur = userId.trim();
    if (cur && !seen.has(cur)) {
      out.push({ value: cur, label: cur, keywords: cur });
    }
    return out;
  }, [friends, userId]);

  const catchCounts = catchphrasesQuery.data?.counts ?? { candidate: 0, active: 0, all: 0 };
  const catchTotal = catchphrasesQuery.data?.total ?? 0;
  const catchPageEnd = catchOffset + catchphrases.length;

  if (!scopeBot) {
    return <AiScopeHint>请在顶栏指定 Bot QQ。</AiScopeHint>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">人物事实</CardTitle>
          <CardDescription>
            写入希望怎么称呼等稳定信息。默认本群生效，跨群复用需用户同意。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Combobox
              value={userId}
              onValueChange={setUserId}
              options={friendOptions}
              placeholder="选择或输入用户 QQ"
              searchPlaceholder="搜索好友昵称 / QQ…"
              emptyText={friendsQuery.isLoading ? "好友加载中…" : "无匹配好友"}
              allowCustom
              searchThreshold={0}
              searchCount={friends.length}
              ariaLabel="用户 QQ"
              triggerClassName="h-9 w-full min-w-0 sm:max-w-[14rem]"
              title={userId || undefined}
            />
            <Input
              placeholder="例如：希望被叫作小明"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <Button
              icon={PenLine}
              disabled={!content.trim() || saveFact.isPending || scopeGroup == null || !userId.trim()}
              onClick={() => saveFact.mutate()}
            >
              写入
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {friendsQuery.isError
              ? "好友列表拉取失败，仍可直接输入 QQ。"
              : friends.length
                ? `已加载 ${friends.length} 位好友，可搜索或直接输入 QQ。`
                : "可搜索好友，或直接输入 QQ。"}
            {scopeGroup == null ? " 写入前请先在顶栏选择群。" : ""}
          </p>
          {saveFact.error ? <p className="text-xs text-destructive">{String(saveFact.error)}</p> : null}
          <StateBlock loading={factsQuery.isLoading} error={factsQuery.error}>
            <ul className="max-h-[14rem] space-y-1.5 overflow-y-auto overscroll-contain pr-1">
              {facts.map((item) => (
                <li
                  key={String(item.fact_id)}
                  className="rounded-md border px-2.5 py-1.5 text-sm leading-snug"
                >
                  <div className="font-medium">{truncateText(String(item.content || ""), 96)}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    QQ {String(item.user_id)} · {factScopeLabel(String(item.scope || ""))} ·{" "}
                    {String(item.status || "—")}
                  </div>
                </li>
              ))}
              {!facts.length ? <li className="text-sm text-muted-foreground">还没有人物事实。</li> : null}
            </ul>
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">待整理观察</CardTitle>
          <CardDescription>
            尚未写入长期记忆的候选片段，当前 {observationsQuery.data?.queue_size ?? 0}{" "}
            条。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={observationsQuery.isLoading} error={observationsQuery.error}>
            <ul className="max-h-[12rem] space-y-1.5 overflow-y-auto overscroll-contain pr-1">
              {observations.slice(0, 30).map((item) => (
                <li
                  key={String(item.observation_id)}
                  className="rounded-md border px-2.5 py-1.5 text-sm leading-snug"
                >
                  <div>{truncateText(String(item.text || ""), 100)}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {observationStatusLabel(String(item.status || ""))} · QQ {String(item.user_id)}
                    {item.source ? ` · ${String(item.source)}` : ""}
                  </div>
                </li>
              ))}
              {!observations.length ? (
                <li className="text-sm text-muted-foreground">队列是空的。</li>
              ) : null}
            </ul>
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5">
            <Heart className="size-4 text-muted-foreground" /> 关系笔记
          </CardTitle>
          <CardDescription className="flex flex-col gap-2">
            <span>与成员的关系备注与好感度。好感度直接改数后保存，档位随数值自动更新。</span>
            <span className="relative max-w-xs">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--text-muted)]"
                strokeWidth={1.75}
                aria-hidden
              />
              <Input
                type="search"
                className={CHROME_SEARCH_INPUT}
                placeholder="搜索关系笔记…"
                aria-label="搜索关系笔记"
                autoComplete="off"
                value={notesSearch}
                onChange={(e) => setNotesSearch(e.target.value)}
              />
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={notesQuery.isLoading} error={notesQuery.error}>
            <ul className="max-h-[min(24rem,55vh)] space-y-1.5 overflow-y-auto overscroll-contain pr-1">
              {notes.map((note) => {
                const id = Number(note.id);
                const userId = Number(note.user_id);
                const affinity = typeof note.affinity === "number" ? note.affinity : null;
                const draft = affinityDrafts[String(userId)];
                return (
                  <li
                    key={String(note.id)}
                    className="rounded-md border px-2.5 py-2 text-sm leading-snug"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">QQ {String(note.user_id)}</span>
                      {Number.isFinite(id) ? (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            icon={PenLine}
                            disabled={deleteNoteMut.isPending}
                            onClick={() => {
                              if (editingNote === id) {
                                setEditingNote(null);
                                setContentDrafts((prev) => {
                                  const next = { ...prev };
                                  delete next[String(userId)];
                                  return next;
                                });
                              } else {
                                setEditingNote(id);
                                setContentDrafts((prev) => ({
                                  ...prev,
                                  [String(userId)]: String(note.content || ""),
                                }));
                              }
                            }}
                          >
                            {editingNote === id ? "取消" : "编辑"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            icon={Trash2}
                            disabled={deleteNoteMut.isPending}
                            onClick={() => deleteNoteMut.mutate(id)}
                          >
                            删除
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    {editingNote === id ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Input
                          className="h-7 min-w-0 flex-1 text-sm"
                          placeholder="关系备注（不自动改写好感度）"
                          value={contentDrafts[String(userId)] ?? ""}
                          onChange={(e) =>
                            setContentDrafts((prev) => ({
                              ...prev,
                              [String(userId)]: e.target.value,
                            }))
                          }
                        />
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={
                            setContentMut.isPending ||
                            !(contentDrafts[String(userId)] ?? "").trim()
                          }
                          onClick={() => {
                            setContentMut.mutate({
                              userId,
                              content: (contentDrafts[String(userId)] ?? "").trim(),
                            });
                          }}
                        >
                          保存
                        </Button>
                      </div>
                    ) : note.content ? (
                      <p className="mt-0.5 text-muted-foreground">{String(note.content)}</p>
                    ) : null}
                    {affinity != null ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{affinityLevel(affinity)}</Badge>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          好感度 {affinity > 0 ? `+${affinity.toFixed(2)}` : affinity.toFixed(2)}
                        </span>
                        <Input
                          className="h-7 w-24"
                          type="number"
                          min={-1}
                          max={1}
                          step={0.05}
                          placeholder={affinity > 0 ? `+${affinity.toFixed(2)}` : affinity.toFixed(2)}
                          value={draft ?? ""}
                          onChange={(e) =>
                            setAffinityDrafts((prev) => ({ ...prev, [String(userId)]: e.target.value }))
                          }
                        />
                        {draft != null &&
                        Number.isFinite(Number(draft)) &&
                        (Number(draft) < -1 || Number(draft) > 1) ? (
                          <span className="text-xs text-destructive">范围 -1 ~ 1</span>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={setAffinityMut.isPending || draft == null}
                          onClick={() =>
                            setAffinityDrafts((prev) => {
                              const next = { ...prev };
                              delete next[String(userId)];
                              return next;
                            })
                          }
                        >
                          重置
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={
                            setAffinityMut.isPending ||
                            !draft?.trim() ||
                            !Number.isFinite(Number(draft)) ||
                            Number(draft) < -1 ||
                            Number(draft) > 1
                          }
                          onClick={() => {
                            const value = Number(draft);
                            if (Number.isFinite(value)) {
                              setAffinityMut.mutate({ userId, affinity: value });
                            }
                          }}
                        >
                          保存
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
              {!notes.length ? (
                <li className="text-sm text-muted-foreground">还没有关系笔记。</li>
              ) : null}
            </ul>
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">口癖候选</CardTitle>
              <CardDescription>成功回复里提炼的短习惯，通过后注入人设。</CardDescription>
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["candidate", `待审 ${catchCounts.candidate}`],
                  ["active", `已启用 ${catchCounts.active}`],
                  ["all", `全部 ${catchCounts.all}`],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={catchFilter === key ? "secondary" : "ghost"}
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setCatchFilter(key);
                    setCatchOffset(0);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <StateBlock loading={catchphrasesQuery.isLoading} error={catchphrasesQuery.error}>
            <ul className="max-h-[min(22rem,50vh)] divide-y overflow-y-auto overscroll-contain rounded-md border">
              {catchphrases.map((item) => {
                const status = String(item.status || "");
                const saying = String(item.saying || "");
                return (
                  <li
                    key={String(item.entry_id)}
                    className="flex flex-col gap-1.5 px-2.5 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium leading-snug" title={saying}>
                        {truncateText(saying, 80)}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Badge variant={status === "active" ? "default" : "outline"} className="h-5 px-1.5 text-[10px]">
                          {catchphraseStatusLabel(status)}
                        </Badge>
                        <span>支持 {String(item.support)}</span>
                        <span>
                          出现过的群 {Array.isArray(item.groups_seen) ? item.groups_seen.length : 0}
                        </span>
                      </div>
                    </div>
                    {status === "candidate" ? (
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          size="sm"
                          className="h-7 px-2"
                          icon={Check}
                          disabled={resolveCatchphrase.isPending}
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
                          className="h-7 px-2"
                          icon={X}
                          iconMotion="close"
                          disabled={resolveCatchphrase.isPending}
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
                    {status === "active" ? (
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          icon={CircleOff}
                          disabled={resolveCatchphrase.isPending}
                          onClick={() =>
                            resolveCatchphrase.mutate({
                              entryId: String(item.entry_id),
                              action: "reject",
                            })
                          }
                        >
                          停用
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
              {!catchphrases.length ? (
                <li className="px-2.5 py-3 text-sm text-muted-foreground">当前筛选下没有口癖。</li>
              ) : null}
            </ul>
            {catchTotal > CATCHPHRASE_PAGE_SIZE ? (
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {catchOffset + 1}-{catchPageEnd} / {catchTotal}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    disabled={catchOffset === 0 || catchphrasesQuery.isFetching}
                    onClick={() => setCatchOffset((offset) => Math.max(0, offset - CATCHPHRASE_PAGE_SIZE))}
                  >
                    上一页
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    disabled={catchPageEnd >= catchTotal || catchphrasesQuery.isFetching}
                    onClick={() => setCatchOffset((offset) => offset + CATCHPHRASE_PAGE_SIZE)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            ) : null}
          </StateBlock>
        </CardContent>
      </Card>
    </div>
  );
}
