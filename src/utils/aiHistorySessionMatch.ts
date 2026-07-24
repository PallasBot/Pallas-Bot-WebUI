import type {
  LlmHistoryBehaviorRun,
  LlmHistoryTurn,
  LlmRepeaterFeedbackEntry,
} from "@/api/pallasTypes";

export function matchBehaviorRunForAssistantTurn(
  turn: LlmHistoryTurn,
  precedingUserText: string,
  runs: LlmHistoryBehaviorRun[],
  consumed: Set<string>,
): LlmHistoryBehaviorRun | null {
  const contentKey = String(turn.content || "").trim();
  const createdAt = Number(turn.created_at || 0);
  for (const run of runs) {
    if (consumed.has(run.request_id)) continue;
    const replyKey = String(run.reply_text || "").trim();
    if (replyKey && replyKey === contentKey) {
      consumed.add(run.request_id);
      return run;
    }
  }
  for (const run of runs) {
    if (consumed.has(run.request_id)) continue;
    if (createdAt > 0 && Number(run.created_at || 0) === createdAt) {
      consumed.add(run.request_id);
      return run;
    }
  }
  for (const run of runs) {
    if (consumed.has(run.request_id)) continue;
    const replyKey = String(run.reply_text || "").trim();
    const userKey = String(run.user_text || "").trim();
    if (replyKey === contentKey && (!userKey || userKey === precedingUserText)) {
      consumed.add(run.request_id);
      return run;
    }
  }
  return null;
}

export function matchFeedbackForAssistantTurn(
  turn: LlmHistoryTurn,
  precedingUserText: string,
  entries: LlmRepeaterFeedbackEntry[],
  behaviorRun: LlmHistoryBehaviorRun | null,
  consumed: Set<string>,
): LlmRepeaterFeedbackEntry | null {
  if (behaviorRun?.request_id) {
    for (const item of entries) {
      const entryKey = item.entry_id || item.request_id;
      if (!entryKey || consumed.has(entryKey)) continue;
      if (item.request_id === behaviorRun.request_id || item.entry_id === behaviorRun.request_id) {
        consumed.add(entryKey);
        return item;
      }
    }
  }
  const contentKey = String(turn.content || "").trim();
  for (const item of entries) {
    const entryKey = item.entry_id || item.request_id;
    if (!entryKey || consumed.has(entryKey)) continue;
    if (String(item.reply_text || "").trim() !== contentKey) continue;
    const userKey = String(item.user_text || "").trim();
    if (userKey && userKey !== precedingUserText) continue;
    consumed.add(entryKey);
    return item;
  }
  return null;
}

export function feedbackEntryKey(entry: LlmRepeaterFeedbackEntry | null | undefined): string {
  if (!entry) return "";
  return entry.entry_id || entry.request_id || "";
}
