import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteSceneDialogueExample,
  fetchSceneDialogueExamples,
  postSceneDialogueExample,
  putSceneDialogueExample,
} from "@/api/fullConsole";
import { axiosErrorDetail } from "@/api/http";
import type { SceneDialogueExample } from "@/api/pallasTypes";
import AiScopeHint from "@/components/ai/AiScopeHint";
import StateBlock from "@/components/StateBlock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Draft = Pick<SceneDialogueExample, "scene" | "user_cue" | "positive" | "negative" | "enabled" | "order">;

const sceneOptions: ComboboxOption[] = [
  { value: "banter", label: "接梗玩笑", triggerLabel: "banter · 接梗玩笑", keywords: "接梗 玩笑 梗" },
  { value: "smalltalk", label: "日常闲聊", triggerLabel: "smalltalk · 日常闲聊", keywords: "日常 闲聊 接话" },
  { value: "venting", label: "吐槽安抚", triggerLabel: "venting · 吐槽安抚", keywords: "吐槽 加班 抽卡 安抚" },
  { value: "provocation", label: "挑衅抬杠", triggerLabel: "provocation · 挑衅抬杠", keywords: "挑衅 抬杠 顶嘴" },
  { value: "group_threading", label: "群聊接续", triggerLabel: "group_threading · 群聊接续", keywords: "群聊 接续 上下文" },
  { value: "light_help", label: "轻量帮助", triggerLabel: "light_help · 轻量帮助", keywords: "帮助 问题 说明" },
  { value: "greeting", label: "问候", triggerLabel: "greeting · 问候", keywords: "问候 早安 晚安" },
  { value: "warm_reply", label: "友好回应", triggerLabel: "warm_reply · 友好回应", keywords: "感谢 安慰 友好" },
  { value: "agreement", label: "附和认同", triggerLabel: "agreement · 附和认同", keywords: "附和 认同 同意" },
];

const emptyDraft = (): Draft => ({
  scene: "",
  user_cue: "",
  positive: "",
  negative: "",
  enabled: true,
  order: 0,
});

export default function SceneDialogueExamplesCard({ botId }: { botId: number | null }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const query = useQuery({
    queryKey: ["scene-dialogue-examples", botId],
    enabled: Boolean(botId),
    queryFn: () => fetchSceneDialogueExamples(botId as number),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["scene-dialogue-examples", botId] });
  const save = async () => {
    if (!botId) return;
    setActionError("");
    setActionPending(true);
    try {
      if (editing) await putSceneDialogueExample(editing, draft);
      else await postSceneDialogueExample({ bot_id: botId, ...draft });
      setDraft(emptyDraft());
      setEditing(null);
      refresh();
    } catch (error) {
      setActionError(`保存失败：${axiosErrorDetail(error)}`);
    } finally {
      setActionPending(false);
    }
  };
  const toggle = async (item: SceneDialogueExample) => {
    setActionError("");
    setActionPending(true);
    try {
      await putSceneDialogueExample(item.example_id, { enabled: !item.enabled });
      refresh();
    } catch (error) {
      setActionError(`更新失败：${axiosErrorDetail(error)}`);
    } finally {
      setActionPending(false);
    }
  };
  const remove = async (exampleId: string) => {
    setActionError("");
    setActionPending(true);
    try {
      await deleteSceneDialogueExample(exampleId);
      refresh();
    } catch (error) {
      setActionError(`删除失败：${axiosErrorDetail(error)}`);
    } finally {
      setActionPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">场景正反例</CardTitle>
        <CardDescription>
          手工维护的小型示例；按场景与用户线索选取，不会自动收集群聊。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!botId ? <AiScopeHint>请在顶栏指定 Bot QQ。</AiScopeHint> : null}
        {botId ? (
          <>
            <div className="space-y-2 rounded-md border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Combobox
                  value={draft.scene}
                  onValueChange={(scene) => setDraft({ ...draft, scene })}
                  options={sceneOptions}
                  allowCustom
                  placeholder="选择场景"
                  searchPlaceholder="搜索或输入自定义场景"
                  ariaLabel="场景"
                />
                <Input value={draft.user_cue} onChange={(e) => setDraft({ ...draft, user_cue: e.target.value })} placeholder="用户线索" />
              </div>
              <Textarea value={draft.positive} onChange={(e) => setDraft({ ...draft, positive: e.target.value })} placeholder="建议回应或示例" />
              <Textarea value={draft.negative} onChange={(e) => setDraft({ ...draft, negative: e.target.value })} placeholder="避免回应或示例" />
              <div className="flex flex-wrap items-center gap-2">
                <Input className="w-24" type="number" value={draft.order} onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) || 0 })} aria-label="排序" />
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />启用</label>
                <Button size="sm" onClick={() => void save()} disabled={actionPending || !draft.scene || !draft.user_cue || !draft.positive || !draft.negative}>保存</Button>
                {editing ? <Button size="sm" variant="ghost" disabled={actionPending} onClick={() => { setEditing(null); setDraft(emptyDraft()); }}>取消</Button> : null}
              </div>
            </div>
            {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
            <StateBlock loading={query.isLoading} error={query.error} empty={!query.data?.items.length} emptyText="暂无场景对话示例。">
              <div className="space-y-2">
                {(query.data?.items ?? []).map((item) => (
                  <article key={item.example_id} className="space-y-2 rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{item.scene} · {item.enabled ? "启用" : "停用"}</span>
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" disabled={actionPending} onClick={() => void toggle(item)}>{item.enabled ? "停用" : "启用"}</Button>
                        <Button size="sm" variant="outline" disabled={actionPending} onClick={() => { setEditing(item.example_id); setDraft(item); }}>编辑</Button>
                        <Button size="sm" variant="destructive" disabled={actionPending} onClick={() => void remove(item.example_id)}>删除</Button>
                      </div>
                    </div>
                    <p className="text-muted-foreground">线索：{item.user_cue}</p>
                    <p>建议：{item.positive}</p>
                    <p>避免：{item.negative}</p>
                  </article>
                ))}
              </div>
            </StateBlock>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
