import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  ChevronLeft,
  Eraser,
  MessageSquare,
  MessageSquareWarning,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Syringe,
  Trash2,
  Undo2,
  User,
  Wrench,
} from "lucide-react";
import { axiosErrorDetail } from "@/api/http";
import { formatTs } from "@/api/console";
import {
  fetchConversationKernelStatus,
  fetchLlmBehaviorPatterns,
  fetchLlmHistorySession,
  fetchLlmHistorySessions,
  fetchLlmPromotionCandidates,
  fetchLlmRepeaterFeedback,
  postLlmBehaviorPatternUpsert,
  postLlmHistoryBehaviorAnnotate,
  postLlmHistorySessionClear,
  postLlmHistorySessionInject,
  postLlmPromotionCandidateResolve,
  postLlmRepeaterFeedbackManage,
} from "@/api/fullConsole";
import type {
  LlmBehaviorPattern,
  LlmHistoryBehaviorRun,
  LlmHistorySessionSummary,
  LlmHistoryTurn,
  LlmRepeaterFeedbackEntry,
} from "@/api/pallasTypes";
import {
  BEHAVIOR_ACTION_OPTIONS,
  BEHAVIOR_OUTCOME_OPTIONS,
  BEHAVIOR_SCENE_OPTIONS,
  labelOutcome,
  labelRole,
  labelScene,
} from "@/utils/aiHistoryLabels";
import {
  feedbackEntryKey,
  matchBehaviorRunForAssistantTurn,
  matchFeedbackForAssistantTurn,
} from "@/utils/aiHistorySessionMatch";
import { useRegisterAiObservationChrome } from "@/components/ai/AiObservationChromeContext";
import {
  parseScopeBotId,
  parseScopeGroupId,
  useAiObservationScope,
} from "@/components/ai/AiObservationScopeContext";
import AiOptionSelect from "@/components/ai/AiOptionSelect";
import { SessionFeedbackCard, SessionTurnFeedbackControls } from "@/components/ai/SessionFeedbackControls";
import SessionLearningStrip from "@/components/ai/SessionLearningStrip";
import SessionPromotionCard from "@/components/ai/SessionPromotionCard";
import LlmToolTracePanel from "@/components/ai/LlmToolTracePanel";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { pushConsoleToast } from "@/utils/consoleToast";
import { useConsoleConfirm } from "@/hooks/useConsoleConfirm";

type SessionDetailTab = "turns" | "annotate" | "feedback" | "promotion";

type SessionTurnRow = {
  turn: LlmHistoryTurn;
  index: number;
  precedingUserText: string;
  behaviorRun: LlmHistoryBehaviorRun | null;
  feedbackEntry: LlmRepeaterFeedbackEntry | null;
};

const BEHAVIOR_LABEL_OPTIONS = ["像人", "模板感强", "姿态不对", "带偏话题", "作为参考保留"] as const;
const SESSION_LIST_LIMIT = 40;

const EMPTY_PATTERN: LlmBehaviorPattern = {
  pattern_id: "",
  scene: "smalltalk",
  action: "ack_then_short_reply",
  scope_group_id: null,
  success_score: 0,
  manual_score: 0,
  disabled: false,
  persona_affinity: "",
  trigger_features: [],
  reference_examples: [],
};

const SCENE_SELECT_OPTIONS = BEHAVIOR_SCENE_OPTIONS.filter((row) => row.value).map((row) => ({
  value: row.value,
  label: row.label,
}));

const ACTION_SELECT_OPTIONS = BEHAVIOR_ACTION_OPTIONS.map((row) => ({
  value: row.value,
  label: row.label,
}));

function toDate(ts?: number | null): Date | null {
  if (ts == null) return null;
  const d = new Date(typeof ts === "number" && ts < 1e12 ? ts * 1000 : ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 牛牛视角：对面是谁（会话主键是对谈用户，不是群号）。 */
function peerId(s: LlmHistorySessionSummary): string {
  return s.user_id != null ? String(s.user_id) : "—";
}

function maskId(id: string): string {
  const raw = id.trim();
  if (!raw || raw === "—") return "—";
  if (raw.length <= 5) return raw;
  if (raw.length <= 8) return `${raw.slice(0, 2)}··${raw.slice(-2)}`;
  return `${raw.slice(0, 3)}···${raw.slice(-4)}`;
}

function sessionTitle(s: LlmHistorySessionSummary): string {
  return `用户 ${maskId(peerId(s))}`;
}

function sessionPlaceLabel(s: LlmHistorySessionSummary): string {
  if (!s.group_id) return "私聊";
  return `群 ${maskId(String(s.group_id))}`;
}

function sessionPreview(s: LlmHistorySessionSummary): string {
  const who = s.last_role === "assistant" ? "牛牛" : "用户";
  const text = (s.last_content || "").trim() || "暂无消息";
  return `${who}：${text}`;
}

function relativeTime(ts?: number | null): string {
  const d = toDate(ts);
  if (!d) return "";
  const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 45) return "刚刚";
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小时前`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)} 天前`;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

function sessionFullTitle(s: LlmHistorySessionSummary): string {
  const place = s.group_id ? `群 ${s.group_id}` : "私聊";
  return `${sessionTitle(s)} · ${place}`;
}

function buildSessionTurnRows(
  turns: LlmHistoryTurn[],
  runs: LlmHistoryBehaviorRun[],
  feedbackEntries: LlmRepeaterFeedbackEntry[],
): SessionTurnRow[] {
  const runConsumed = new Set<string>();
  const feedbackConsumed = new Set<string>();
  let lastUserText = "";
  const rows: SessionTurnRow[] = [];
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    if (turn.role === "user") {
      lastUserText = turn.content;
      rows.push({
        turn,
        index,
        precedingUserText: "",
        behaviorRun: null,
        feedbackEntry: null,
      });
      continue;
    }
    const behaviorRun = matchBehaviorRunForAssistantTurn(turn, lastUserText, runs, runConsumed);
    const feedbackEntry = matchFeedbackForAssistantTurn(
      turn,
      lastUserText,
      feedbackEntries,
      behaviorRun,
      feedbackConsumed,
    );
    rows.push({
      turn,
      index,
      precedingUserText: lastUserText,
      behaviorRun,
      feedbackEntry,
    });
  }
  return rows;
}

function turnMaintKey(row: SessionTurnRow): string {
  return `${row.turn.created_at}-${row.index}`;
}

function PeerPlaceholderAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground",
        className,
      )}
      aria-hidden
    >
      <User className="size-[45%] opacity-70" />
    </div>
  );
}

function BehaviorAnnotateControls({
  run,
  busy,
  onSave,
}: {
  run: LlmHistoryBehaviorRun;
  busy: boolean;
  onSave: (patch: { labels?: string[]; finalOutcome?: string | null; disabled?: boolean }) => void;
}) {
  const labels = run.manual_labels ?? [];
  const hasLabel = (label: string) => labels.includes(label);
  const outcomeValue = run.final_outcome ?? "";

  return (
    <div className="mt-2 space-y-2 border-t pt-2 text-xs">
      <div className="flex flex-wrap gap-1">
        {BEHAVIOR_LABEL_OPTIONS.map((label) => (
          <Button
            key={label}
            size="sm"
            variant={hasLabel(label) ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            disabled={busy}
            onClick={() =>
              onSave({
                labels: hasLabel(label) ? labels.filter((item) => item !== label) : [...labels, label],
              })
            }
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">结果</span>
        <Select
          value={outcomeValue || "__empty__"}
          disabled={busy}
          onValueChange={(v) => onSave({ finalOutcome: v === "__empty__" ? null : v })}
        >
          <SelectTrigger className="h-8 w-[8.5rem]">
            <SelectValue placeholder="未判定">{labelOutcome(outcomeValue)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {BEHAVIOR_OUTCOME_OPTIONS.map((item) => (
              <SelectItem key={item.value || "empty"} value={item.value || "__empty__"}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={Boolean(run.disabled)}
            disabled={busy}
            onChange={() => onSave({ disabled: !run.disabled })}
          />
          不参与学习
        </label>
      </div>
    </div>
  );
}


function notifyOk(message: string) {
  pushConsoleToast(message, "ok");
}

function notifyErr(message: string) {
  pushConsoleToast(message || "操作失败", "err");
}

export default function AiHistoryPage() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConsoleConfirm();
  const { botId, groupId } = useAiObservationScope();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<SessionDetailTab>("turns");
  const [listQuery, setListQuery] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [patternEditor, setPatternEditor] = useState<LlmBehaviorPattern>(EMPTY_PATTERN);
  const [annotateBusy, setAnnotateBusy] = useState<Record<string, boolean>>({});
  const [triggerFeaturesText, setTriggerFeaturesText] = useState("[]");
  const [injectDraft, setInjectDraft] = useState("");
  const [expandedMaintain, setExpandedMaintain] = useState<Record<string, boolean>>({});
  const [expandedToolTrace, setExpandedToolTrace] = useState<Record<string, boolean>>({});
  const [correctionDrafts, setCorrectionDrafts] = useState<Record<string, string>>({});
  const [feedbackBusy, setFeedbackBusy] = useState<Record<string, boolean>>({});
  const [promoIncludeResolved, setPromoIncludeResolved] = useState(false);

  const q = useQuery({
    queryKey: ["llm-history-sessions", botId, groupId],
    queryFn: () =>
      fetchLlmHistorySessions({
        botId: parseScopeBotId(botId),
        groupId: parseScopeGroupId(groupId),
        limit: SESSION_LIST_LIMIT,
      }),
  });
  const selected = (q.data?.items || []).find((s) => s.session_key === selectedKey);

  const detailQ = useQuery({
    queryKey: ["llm-history-session", selected?.bot_id, selected?.group_id, selected?.user_id],
    queryFn: () =>
      fetchLlmHistorySession({
        botId: selected!.bot_id!,
        groupId: selected?.group_id ?? null,
        userId: selected!.user_id!,
        limit: 80,
      }),
    enabled: Boolean(selected?.bot_id && selected?.user_id),
  });

  const scopeGroupId = parseScopeGroupId(groupId);
  const scopeBotId = parseScopeBotId(botId);
  const sessionGroupId =
    selected?.group_id != null && selected.group_id > 0 ? selected.group_id : null;
  const learningGroupId = sessionGroupId ?? (scopeGroupId != null && scopeGroupId > 0 ? scopeGroupId : null);
  const learningBotId = selected?.bot_id != null && selected.bot_id > 0 ? selected.bot_id : scopeBotId;

  const kernelQ = useQuery({
    queryKey: ["conversation-kernel-status"],
    queryFn: fetchConversationKernelStatus,
  });

  const feedbackQ = useQuery({
    queryKey: ["llm-repeater-feedback", learningBotId, learningGroupId],
    queryFn: () => fetchLlmRepeaterFeedback({ botId: learningBotId!, groupId: learningGroupId!, limit: 30 }),
    enabled: learningBotId != null && learningGroupId != null && detailTab === "feedback",
  });

  const promoQ = useQuery({
    queryKey: ["llm-promotion-candidates", learningBotId, learningGroupId, 40, promoIncludeResolved],
    queryFn: () =>
      fetchLlmPromotionCandidates({
        botId: learningBotId!,
        groupId: learningGroupId!,
        includeResolved: promoIncludeResolved,
        limit: 40,
      }),
    enabled: learningBotId != null && learningGroupId != null && detailTab === "promotion",
  });

  const patternsQ = useQuery({
    queryKey: ["llm-behavior-patterns", scopeGroupId],
    queryFn: () => fetchLlmBehaviorPatterns({ groupId: scopeGroupId }),
    enabled: rulesOpen,
  });

  const annotateMut = useMutation({
    mutationFn: (args: {
      run: LlmHistoryBehaviorRun;
      patch: { labels?: string[]; finalOutcome?: string | null; disabled?: boolean };
    }) =>
      postLlmHistoryBehaviorAnnotate({
        requestId: args.run.request_id,
        labels: args.patch.labels ?? args.run.manual_labels ?? [],
        finalOutcome: args.patch.finalOutcome ?? args.run.final_outcome ?? "",
        disabled: typeof args.patch.disabled === "boolean" ? args.patch.disabled : Boolean(args.run.disabled),
      }),
    onMutate: ({ run }) => {
      setAnnotateBusy((prev) => ({ ...prev, [run.request_id]: true }));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["llm-history-session"] });
    },
    onSettled: (_data, _err, vars) => {
      setAnnotateBusy((prev) => ({ ...prev, [vars.run.request_id]: false }));
    },
  });

  const patternMut = useMutation({
    mutationFn: () =>
      postLlmBehaviorPatternUpsert({
        ...patternEditor,
        pattern_id: patternEditor.pattern_id.trim(),
        scene: patternEditor.scene || "smalltalk",
        action: patternEditor.action || "ack_then_short_reply",
        trigger_features: [...(patternEditor.trigger_features ?? [])],
        reference_examples: [...(patternEditor.reference_examples ?? [])],
      }),
    onSuccess: async () => {
      notifyOk("规则已保存");
      setPatternEditor(EMPTY_PATTERN);
      setTriggerFeaturesText("[]");
      await qc.invalidateQueries({ queryKey: ["llm-behavior-patterns"] });
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const injectMut = useMutation({
    mutationFn: (content: string) => {
      if (!selected?.bot_id || !selected.user_id) {
        throw new Error("请先选择会话");
      }
      return postLlmHistorySessionInject({
        botId: selected.bot_id,
        groupId: selected.group_id ?? null,
        userId: selected.user_id,
        content,
        role: "user",
      });
    },
    onSuccess: async () => {
      setInjectDraft("");
      notifyOk("已注入上下文消息。");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["llm-history-session"] }),
        qc.invalidateQueries({ queryKey: ["llm-history-sessions"] }),
      ]);
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const clearMut = useMutation({
    mutationFn: () => {
      if (!selected?.bot_id) {
        throw new Error("请先选择会话");
      }
      return postLlmHistorySessionClear({
        botId: selected.bot_id,
        groupId: selected.group_id ?? null,
        userId: selected.user_id ?? null,
      });
    },
    onSuccess: async () => {
      notifyOk("已清空会话上下文。");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["llm-history-session"] }),
        qc.invalidateQueries({ queryKey: ["llm-history-sessions"] }),
      ]);
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  const feedbackMut = useMutation({
    mutationFn: (body: {
      busyKey: string;
      entryId?: string;
      requestId?: string;
      action: "invalidate" | "restore" | "delete" | "correct" | "clear_correction";
      correctedReplyText?: string;
       botId: number;
       groupId: number;
      userId?: number;
      userText?: string;
      replyText?: string;
      llmRoute?: string;
      behaviorScene?: string;
    }) =>
      postLlmRepeaterFeedbackManage({
        entryId: body.entryId,
        requestId: body.requestId,
        action: body.action,
        correctedReplyText: body.correctedReplyText,
        botId: body.botId,
        groupId: body.groupId,
        userId: body.userId,
        userText: body.userText,
        replyText: body.replyText,
        llmRoute: body.llmRoute,
        behaviorScene: body.behaviorScene,
      }),
    onMutate: (vars) => {
      setFeedbackBusy((prev) => ({ ...prev, [vars.busyKey]: true }));
          },
    onSuccess: async (_data, vars) => {
      const labels: Record<string, string> = {
        invalidate: "已排除",
        restore: "已恢复",
        delete: "已删除",
        correct: "已保存期望回复",
        clear_correction: "已清除校正",
      };
      notifyOk(labels[vars.action] || "已更新");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["llm-history-session"] }),
        qc.invalidateQueries({ queryKey: ["llm-repeater-feedback"] }),
        qc.invalidateQueries({ queryKey: ["llm-promotion-candidates"] }),
      ]);
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
    onSettled: (_d, _e, vars) => {
      setFeedbackBusy((prev) => ({ ...prev, [vars.busyKey]: false }));
    },
  });

  const promoMut = useMutation({
    mutationFn: (body: { candidateId: string; action: "promote" | "reject" }) => {
      if (learningBotId == null || learningGroupId == null) throw new Error("请先选择 Bot 与群");
      return postLlmPromotionCandidateResolve({
        ...body,
        botId: learningBotId,
        groupId: learningGroupId,
      });
    },
    onMutate: (vars) => {
      setFeedbackBusy((prev) => ({ ...prev, [`promo:${vars.candidateId}`]: true }));
    },
    onSuccess: async (data, vars) => {
      if (vars.action === "promote") {
        const wb = String(data.writeback_status || "").trim();
        if (wb === "written") notifyOk("已入库并写入语料。");
        else if (wb === "failed") {
          pushConsoleToast(`已入库，写入失败：${data.writeback_message || "未知原因"}`, "warn");
        } else notifyOk("已入库（未写入语料）。");
      } else {
        notifyOk("已拒绝候选。");
      }
      await qc.invalidateQueries({ queryKey: ["llm-promotion-candidates"] });
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
    onSettled: (_d, _e, vars) => {
      setFeedbackBusy((prev) => ({ ...prev, [`promo:${vars.candidateId}`]: false }));
    },
  });

  const sessionBehaviorRuns = detailQ.data?.behavior_runs ?? [];
  const sessionTurnRows = useMemo(
    () =>
      buildSessionTurnRows(
        detailQ.data?.turns || [],
        detailQ.data?.behavior_runs || [],
        detailQ.data?.feedback_entries || [],
      ),
    [detailQ.data?.turns, detailQ.data?.behavior_runs, detailQ.data?.feedback_entries],
  );

  const onRefresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["llm-history-sessions"] });
    void qc.invalidateQueries({ queryKey: ["llm-history-session"] });
    void qc.invalidateQueries({ queryKey: ["llm-behavior-patterns"] });
    void qc.invalidateQueries({ queryKey: ["llm-repeater-feedback"] });
    void qc.invalidateQueries({ queryKey: ["llm-promotion-candidates"] });
    void qc.invalidateQueries({ queryKey: ["conversation-kernel-status"] });
  }, [qc]);

  useRegisterAiObservationChrome({ onRefresh });

  function openPattern(item: LlmBehaviorPattern) {
    setPatternEditor({
      ...item,
      trigger_features: [...(item.trigger_features ?? [])],
      reference_examples: [...(item.reference_examples ?? [])],
    });
    setTriggerFeaturesText(JSON.stringify(item.trigger_features ?? []));
      }

  function clearSelection() {
    setSelectedKey(null);
    setDetailTab("turns");
    setInjectDraft("");
            setExpandedMaintain({});
  }

  function selectSession(key: string) {
    setDetailTab("turns");
    setSelectedKey(key);
    setInjectDraft("");
            setExpandedMaintain({});
  }

  function submitInject() {
    const content = injectDraft.trim();
    if (!content || injectMut.isPending) return;
    void injectMut.mutateAsync(content);
  }

  async function confirmClearSession() {
    if (!selected || clearMut.isPending) return;
    if (
      !(await confirm({
        title: "清空会话上下文",
        subtitle: "确定清空当前会话上下文？",
        confirmLabel: "清空",
      }))
    )
      return;
    void clearMut.mutateAsync();
  }

  const sessionItems = q.data?.items ?? [];
  const filteredSessions = useMemo(() => {
    const needle = listQuery.trim().toLowerCase();
    if (!needle) return sessionItems;
    return sessionItems.filter((s) => {
      const hay = [
        peerId(s),
        sessionTitle(s),
        sessionPlaceLabel(s),
        String(s.group_id ?? ""),
        String(s.bot_id ?? ""),
        s.last_content || "",
        s.session_key,
        sessionPreview(s),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [sessionItems, listQuery]);

  const promoPendingCount = (promoQ.data?.items || []).filter(
    (item) => !item.promoted && !String(item.rejected_reason || "").trim(),
  ).length;

  function correctionDraftFor(key: string, fallback = ""): string {
    if (Object.prototype.hasOwnProperty.call(correctionDrafts, key)) return correctionDrafts[key];
    return fallback;
  }

  function setCorrectionDraft(key: string, value: string) {
    setCorrectionDrafts((prev) => ({ ...prev, [key]: value }));
  }

  function manageTurnFeedback(
    row: SessionTurnRow,
    action: "invalidate" | "restore" | "delete" | "correct" | "clear_correction",
  ) {
    if (!selected) return;
    const maintKey = turnMaintKey(row);
    const entry = row.feedbackEntry;
    const busyKey = feedbackEntryKey(entry) || maintKey;
    const draft = correctionDraftFor(maintKey, entry?.corrected_reply_text || "").trim();
    void feedbackMut.mutateAsync({
      busyKey,
      entryId: entry?.entry_id,
      requestId:
        entry?.request_id ||
        entry?.entry_id ||
        row.behaviorRun?.request_id ||
        `session-correct-${row.turn.created_at}`,
      action,
      correctedReplyText: action === "correct" ? draft : undefined,
      botId: selected.bot_id,
      groupId: selected.group_id,
      userId: selected.user_id,
      userText: row.precedingUserText,
      replyText: row.turn.content,
      llmRoute: entry?.llm_route,
      behaviorScene: entry?.behavior_scene || row.behaviorRun?.scene,
    });
  }

  function manageFeedbackCard(
    item: LlmRepeaterFeedbackEntry,
    action: "invalidate" | "restore" | "delete" | "correct" | "clear_correction",
  ) {
    const key = feedbackEntryKey(item);
    if (!key) return;
    const draft = correctionDraftFor(key, item.corrected_reply_text || "").trim();
    void feedbackMut.mutateAsync({
      busyKey: key,
      entryId: item.entry_id,
      requestId: item.request_id,
      action,
      correctedReplyText: action === "correct" ? draft : undefined,
      botId: item.bot_id,
      groupId: item.group_id,
      userId: item.user_id,
      userText: item.user_text,
      replyText: item.reply_text,
      llmRoute: item.llm_route,
      behaviorScene: item.behavior_scene,
    });
  }

  const privateLearningHint = (
    <p className="text-sm text-muted-foreground">纠错与入库仅支持群聊会话。</p>
  );

  const learningStrip = <SessionLearningStrip status={kernelQ.data} className="mb-3" />;

  const detailBody =
    detailTab === "turns" ? (
      <StateBlock
        loading={detailQ.isLoading}
        error={detailQ.error}
        empty={!sessionTurnRows.length}
        emptyText="暂无对话记录。"
      >
        {learningStrip}
        <div className="space-y-2.5">
          {sessionTurnRows.map((row) => {
            const t = row.turn;
            const isBot = t.role === "assistant";
            const maintKey = turnMaintKey(row);
            const expanded = Boolean(expandedMaintain[maintKey]);
            const toolExpanded = Boolean(expandedToolTrace[maintKey]);
            const busyKey = feedbackEntryKey(row.feedbackEntry) || maintKey;
            const agentTrace = row.behaviorRun?.auto_feedback_payload?.agent_trace || null;
            const requestId = row.behaviorRun?.request_id || row.feedbackEntry?.request_id || "";
            const hasToolHint = Boolean(
              requestId ||
                (agentTrace &&
                  ((agentTrace.tool_call_count ?? 0) > 0 ||
                    (agentTrace.tool_schema_count ?? 0) > 0 ||
                    (agentTrace.rounds || []).length > 0)),
            );
            return (
              <div
                key={maintKey}
                className={cn("flex flex-col gap-1", isBot ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "flex items-center gap-1.5 text-[11px] text-muted-foreground",
                    isBot ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  <span className={cn("font-medium", isBot ? "text-emerald-600" : "text-foreground/70")}>
                    {labelRole(t.role)}
                  </span>
                  <span className="tabular-nums">{formatTs(t.created_at)}</span>
                  {isBot && row.feedbackEntry ? (
                    <Badge
                      variant={row.feedbackEntry.eligible_for_bias ? "success" : "secondary"}
                      className="h-5 px-1.5 text-[10px] font-normal"
                    >
                      {row.feedbackEntry.eligible_for_bias ? "参与学习" : "已排除"}
                    </Badge>
                  ) : null}
                  {isBot && (agentTrace?.tool_call_count ?? 0) > 0 ? (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                      工具 {agentTrace?.tool_call_count}
                    </Badge>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "max-w-[min(100%,36rem)] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    isBot
                      ? "rounded-tr-md bg-primary/12 text-foreground"
                      : "rounded-tl-md bg-muted/60 text-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{t.content || ""}</p>
                </div>
                {isBot ? (
                  <div className={cn("w-full max-w-[min(100%,36rem)]", isBot ? "text-right" : "")}>
                    <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5">
                      {row.feedbackEntry?.eligible_for_bias ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          icon={Ban}
                          disabled={Boolean(feedbackBusy[busyKey])}
                          onClick={() => manageTurnFeedback(row, "invalidate")}
                        >
                          排除
                        </Button>
                      ) : row.feedbackEntry ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          icon={Undo2}
                          iconMotion="undo"
                          disabled={Boolean(feedbackBusy[busyKey])}
                          onClick={() => manageTurnFeedback(row, "restore")}
                        >
                          恢复
                        </Button>
                      ) : null}
                      {hasToolHint ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          icon={Wrench}
                          onClick={() =>
                            setExpandedToolTrace((prev) => ({ ...prev, [maintKey]: !prev[maintKey] }))
                          }
                        >
                          {toolExpanded ? "收起工具" : "工具轨迹"}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        icon={MessageSquareWarning}
                        onClick={() =>
                          setExpandedMaintain((prev) => ({ ...prev, [maintKey]: !prev[maintKey] }))
                        }
                      >
                        {expanded ? "收起" : "纠错详情"}
                      </Button>
                    </div>
                    {toolExpanded ? (
                      <div className="mt-2 rounded-lg border bg-muted/20 p-2.5 text-left">
                        <LlmToolTracePanel
                          agentTrace={agentTrace}
                          requestId={requestId || null}
                          fetchDebug={Boolean(requestId)}
                        />
                      </div>
                    ) : null}
                    {expanded ? (
                      <SessionTurnFeedbackControls
                        entry={row.feedbackEntry}
                        busy={Boolean(feedbackBusy[busyKey])}
                        correctionDraft={correctionDraftFor(
                          maintKey,
                          row.feedbackEntry?.corrected_reply_text || "",
                        )}
                        onCorrectionChange={(v) => setCorrectionDraft(maintKey, v)}
                        onManage={(action) => manageTurnFeedback(row, action)}
                        onSaveCorrection={() => manageTurnFeedback(row, "correct")}
                        onClearCorrection={() => manageTurnFeedback(row, "clear_correction")}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </StateBlock>
    ) : detailTab === "annotate" ? (
      <div className="space-y-3">
        <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <p>
            评价回复表现，用于优化 LLM 对话；也可管理行为规则。
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7"
            icon={SlidersHorizontal}
            iconMotion="settings"
            onClick={() => {
                            setRulesOpen(true);
            }}
          >
            管理行为规则（进阶）
          </Button>
        </div>
        <StateBlock
          loading={detailQ.isLoading}
          error={detailQ.error}
          empty={!sessionBehaviorRuns.length}
          emptyText="暂无可评价的回复。"
        >
          <div className="space-y-2">
            {sessionBehaviorRuns.map((run) => (
              <div key={run.request_id} className="rounded-lg border p-3 text-sm">
                <div className="text-xs text-muted-foreground">
                  {labelScene(run.scene)}
                  {run.final_outcome ? ` · ${labelOutcome(run.final_outcome)}` : null}
                </div>
                <p className="mt-1 line-clamp-3">{run.reply_text || run.user_text || "—"}</p>
                <BehaviorAnnotateControls
                  run={run}
                  busy={Boolean(annotateBusy[run.request_id])}
                  onSave={(patch) => void annotateMut.mutateAsync({ run, patch })}
                />
              </div>
            ))}
          </div>
        </StateBlock>
      </div>
    ) : detailTab === "feedback" ? (
      learningGroupId == null ? (
        privateLearningHint
      ) : (
        <StateBlock
          loading={feedbackQ.isLoading}
          error={feedbackQ.error}
          empty={!feedbackQ.data?.items?.length}
          emptyText="暂无纠错数据。"
        >
          {learningStrip}
          <div className="space-y-2">
            {(feedbackQ.data?.items || []).map((item) => {
              const key = feedbackEntryKey(item);
              return (
                <SessionFeedbackCard
                  key={key}
                  item={item}
                  busy={Boolean(feedbackBusy[key])}
                  correctionDraft={correctionDraftFor(key, item.corrected_reply_text || "")}
                  onCorrectionChange={(v) => setCorrectionDraft(key, v)}
                  onManage={(action) => manageFeedbackCard(item, action)}
                  onSaveCorrection={() => manageFeedbackCard(item, "correct")}
                  onClearCorrection={() => manageFeedbackCard(item, "clear_correction")}
                />
              );
            })}
          </div>
        </StateBlock>
      )
    ) : learningGroupId == null ? (
      privateLearningHint
    ) : (
      <StateBlock
        loading={promoQ.isLoading}
        error={promoQ.error}
        empty={!promoQ.data?.items?.length}
        emptyText="暂无入库候选。"
      >
        {learningStrip}
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-muted-foreground">
            <input
              type="checkbox"
              checked={promoIncludeResolved}
              onChange={(e) => setPromoIncludeResolved(e.target.checked)}
            />
            显示已处理
          </label>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            icon={RefreshCw}
            iconMotion="spin"
            iconBusy={promoQ.isFetching}
            disabled={promoQ.isFetching}
            onClick={() => void promoQ.refetch()}
          >
            {promoQ.isFetching ? "刷新中…" : "刷新候选"}
          </Button>
          <span className="text-muted-foreground">待审批 {promoPendingCount}</span>
        </div>
        <div className="space-y-2">
          {(promoQ.data?.items || []).map((item) => (
            <SessionPromotionCard
              key={item.candidate_id}
              item={item}
              busy={Boolean(feedbackBusy[`promo:${item.candidate_id}`])}
              onResolve={(action) =>
                void promoMut.mutateAsync({ candidateId: item.candidate_id, action })
              }
            />
          ))}
        </div>
      </StateBlock>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex h-[min(72vh,42rem)] min-h-[22rem] overflow-hidden rounded-lg border bg-card">
        {/* 左栏：会话列表（窄栏） */}
        <div
          className={cn(
            "flex min-h-0 w-full shrink-0 flex-col border-border/40 sm:w-60 sm:border-r md:w-64 lg:w-72",
            selectedKey ? "hidden sm:flex" : "flex",
          )}
        >
          <div className="space-y-2 border-b px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">牛牛的会话</span>
              <span className="text-xs text-muted-foreground">
                {filteredSessions.length}
                {listQuery.trim() ? ` / ${sessionItems.length}` : ""} 条
              </span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                placeholder="搜索 QQ / 群号 / 内容"
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[color-mix(in_srgb,var(--muted)_28%,transparent)] p-1.5">
            <StateBlock
              loading={q.isLoading}
              error={q.error}
              empty={!filteredSessions.length}
              emptyText={listQuery.trim() ? "无匹配会话" : "暂无会话。"}
            >
              <div className="space-y-1">
                {filteredSessions.map((s) => {
                  const active = s.session_key === selectedKey;
                  return (
                    <button
                      key={s.session_key}
                      type="button"
                      title={sessionFullTitle(s)}
                      className={cn(
                        "relative w-full rounded-2xl px-2.5 py-2.5 text-left transition-all",
                        "hover:bg-background/80",
                        active
                          ? "bg-background shadow-sm ring-1 ring-primary/20"
                          : "bg-transparent",
                      )}
                      onClick={() => selectSession(s.session_key)}
                    >
                      <div className="flex items-start gap-2.5">
                        <PeerPlaceholderAvatar className="mt-0.5 size-10" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 truncate text-[13px] font-semibold leading-none tracking-tight">
                              {sessionTitle(s)}
                            </span>
                            <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
                              {relativeTime(s.last_created_at)}
                            </span>
                          </div>
                          <p className="mt-1.5 truncate text-[12.5px] leading-snug text-foreground/80">
                            {sessionPreview(s)}
                          </p>
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                            <span className="rounded-full bg-muted/80 px-1.5 py-px">
                              {sessionPlaceLabel(s)}
                            </span>
                            <span className="tabular-nums">{s.turn_count ?? 0} 轮</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </StateBlock>
          </div>
        </div>

        {/* 右栏：详情（桌面常驻；窄屏选中后全宽） */}
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            selectedKey ? "flex" : "hidden sm:flex",
          )}
        >
          {selected ? (
            <>
              <div className="shrink-0 border-b">
                <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 sm:hidden"
                    onClick={clearSelection}
                    aria-label="返回列表"
                  >
                    <ChevronLeft className="size-5" />
                  </Button>
                  <PeerPlaceholderAvatar className="size-9 hidden sm:flex" />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold tracking-tight">
                        {sessionTitle(selected)}
                      </span>
                      <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                        {selected.group_id ? "群聊" : "私聊"}
                      </span>
                    </div>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      {selected.group_id ? (
                        <span className="truncate" title={`群 ${selected.group_id}`}>
                          群 {maskId(String(selected.group_id))}
                        </span>
                      ) : null}
                      <span className="tabular-nums">{selected.turn_count ?? 0} 轮</span>
                      <span className="tabular-nums">{relativeTime(selected.last_created_at)}</span>
                    </div>
                  </div>
                </div>
                <div
                  className="-mb-px flex gap-0.5 overflow-x-auto px-2 sm:px-3"
                  role="tablist"
                  aria-label="会话详情分栏"
                >
                  {(
                    [
                      { value: "turns" as const, label: "对话", count: null as number | null },
                      {
                        value: "annotate" as const,
                        label: "评价",
                        count: sessionBehaviorRuns.length || null,
                      },
                      {
                        value: "feedback" as const,
                        label: "纠错",
                        count:
                          detailTab === "feedback" && feedbackQ.data?.items?.length
                            ? feedbackQ.data.items.length
                            : null,
                      },
                      {
                        value: "promotion" as const,
                        label: "入库",
                        count: detailTab === "promotion" && promoPendingCount > 0 ? promoPendingCount : null,
                      },
                    ] as const
                  ).map((tab) => {
                    const active = detailTab === tab.value;
                    return (
                      <button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        className={cn(
                          "relative shrink-0 px-2.5 pb-2 pt-1 text-xs font-medium transition-colors",
                          "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:content-['']",
                          active
                            ? "text-foreground after:bg-primary"
                            : "text-muted-foreground after:bg-transparent hover:text-foreground",
                        )}
                        onClick={() => {
                          setDetailTab(tab.value);
                                                  }}
                      >
                        <span className="inline-flex items-center gap-1">
                          {tab.label}
                          {tab.count != null ? (
                            <span
                              className={cn(
                                "rounded-md px-1 py-px text-[10px] tabular-nums",
                                active ? "bg-primary/12 text-foreground" : "bg-muted text-muted-foreground",
                              )}
                            >
                              {tab.count}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">{detailBody}</div>
                {detailTab === "turns" ? (
                  <div className="shrink-0 space-y-2 border-t px-3 py-2.5 sm:px-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        value={injectDraft}
                        onChange={(e) => {
                          setInjectDraft(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submitInject();
                          }
                        }}
                        placeholder="输入要注入的上下文消息"
                        className="h-9 min-w-0 flex-1 text-sm"
                        disabled={injectMut.isPending || clearMut.isPending}
                      />
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          className="h-9 flex-1 sm:flex-none"
                          icon={Syringe}
                          disabled={!injectDraft.trim() || injectMut.isPending || clearMut.isPending}
                          onClick={submitInject}
                        >
                          {injectMut.isPending ? "注入中…" : "注入"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-9 flex-1 sm:flex-none"
                          icon={Trash2}
                          disabled={injectMut.isPending || clearMut.isPending}
                          onClick={() => void confirmClearSession()}
                        >
                          {clearMut.isPending ? "清空中…" : "清空"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
              <MessageSquare className="size-10 opacity-40" />
            <p className="text-sm">请选择会话查看聊天记录。</p>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={rulesOpen}
        onOpenChange={(open) => {
          setRulesOpen(open);
        }}
      >
        <DialogContent className="flex max-h-[min(860px,calc(100dvh-32px))] w-[min(640px,calc(100vw-32px))] max-w-[min(640px,calc(100vw-32px))] gap-0 overflow-hidden bg-card p-0">
          <DialogHeader className="border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left">
            <DialogTitle>行为规则（进阶）</DialogTitle>
            <DialogDescription className="text-left">
              配置特定 LLM 对话场景的回复动作。日常维护在「评价」中打标签即可。
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-muted-foreground">
                规则 ID（英文短名）
                <Input
                  placeholder="例如 smalltalk_ack"
                  value={patternEditor.pattern_id}
                  onChange={(e) => setPatternEditor({ ...patternEditor, pattern_id: e.target.value })}
                />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                人格偏好（可选，多数情况留空）
                <Input
                  placeholder="可选"
                  value={patternEditor.persona_affinity ?? ""}
                  onChange={(e) => setPatternEditor({ ...patternEditor, persona_affinity: e.target.value })}
                />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                场景（什么情况下用）
                <AiOptionSelect
                  value={patternEditor.scene}
                  onValueChange={(v) => setPatternEditor({ ...patternEditor, scene: v || "smalltalk" })}
                  options={SCENE_SELECT_OPTIONS}
                  allowEmpty={false}
                  placeholder="选择场景"
                />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                动作（怎么回）
                <AiOptionSelect
                  value={patternEditor.action}
                  onValueChange={(v) => setPatternEditor({ ...patternEditor, action: v || "ack_then_short_reply" })}
                  options={ACTION_SELECT_OPTIONS}
                  allowEmpty={false}
                  placeholder="选择动作"
                />
              </label>
            </div>
            <details className="rounded-md border px-3 py-2 text-xs">
              <summary className="cursor-pointer select-none text-muted-foreground">
                触发特征（可选，JSON，一般不用改）
              </summary>
              <textarea
                className="mt-2 min-h-[4rem] w-full rounded-md border bg-background p-2 font-mono text-xs"
                placeholder='[]'
                value={triggerFeaturesText}
                onChange={(e) => {
                  setTriggerFeaturesText(e.target.value);
                  try {
                    setPatternEditor({
                      ...patternEditor,
                      trigger_features: JSON.parse(e.target.value) as string[],
                    });
                  } catch {
                    /* keep typing */
                  }
                }}
                spellCheck={false}
              />
            </details>
            <DialogFooter className="ai-history-page__pattern-edit-foot gap-2 sm:justify-between">
              <Button
                size="sm"
                variant="ghost"
                icon={Eraser}
                onClick={() => {
                  setPatternEditor(EMPTY_PATTERN);
                  setTriggerFeaturesText("[]");
                }}
              >
                清空表单
              </Button>
              <Button
                size="sm"
                icon={Save}
                iconMotion="scale"
                disabled={patternMut.isPending || !patternEditor.pattern_id.trim()}
                onClick={() => {
                  void patternMut.mutateAsync();
                }}
              >
                {patternMut.isPending ? "保存中…" : "保存规则"}
              </Button>
            </DialogFooter>
            <StateBlock
              loading={patternsQ.isLoading}
              error={patternsQ.error}
              empty={!patternsQ.data?.items?.length}
              emptyText="暂无行为规则。"
            >
              <div className="max-h-[14rem] space-y-1 overflow-y-auto text-sm">
                {(patternsQ.data?.items || []).map((item) => (
                  <button
                    key={item.pattern_id}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left hover:bg-muted/40"
                    onClick={() => openPattern(item)}
                  >
                    <span className="min-w-0 truncate">{item.pattern_id}</span>
                    <Badge variant={item.disabled ? "secondary" : "outline"}>{labelScene(item.scene)}</Badge>
                  </button>
                ))}
              </div>
            </StateBlock>
          </div>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
