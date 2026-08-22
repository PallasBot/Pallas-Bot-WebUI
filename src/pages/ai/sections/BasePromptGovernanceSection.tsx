import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, RotateCcw, Save, Trash2 } from "lucide-react";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchBasePromptPreview,
  postBasePromptClear,
  postBasePromptContent,
  postBasePromptEnabled,
  postBasePromptRestore,
  postBasePromptSave,
} from "@/api/console";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useConsoleConfirm } from "@/hooks/useConsoleConfirm";
import { pushConsoleToast } from "@/utils/consoleToast";

type PromptMode = "append" | "replace";

function formatUpdatedAt(value: string): string {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toLocaleString() : value || "未保存";
}

export default function BasePromptGovernanceSection() {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConsoleConfirm();
  const seededAt = useRef<string | null>(null);
  const [mode, setMode] = useState<PromptMode>("append");
  const [text, setText] = useState("");
  const previewQ = useQuery({ queryKey: ["base-prompt-preview"], queryFn: fetchBasePromptPreview });
  const contentQ = useQuery({ queryKey: ["base-prompt-content"], queryFn: postBasePromptContent });

  useEffect(() => {
    const data = contentQ.data;
    if (!data || seededAt.current === data.updated_at) return;
    seededAt.current = data.updated_at;
    setMode(data.mode === "replace" ? "replace" : "append");
    setText(data.text);
  }, [contentQ.data]);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["base-prompt-preview"] }),
      qc.invalidateQueries({ queryKey: ["base-prompt-content"] }),
      qc.invalidateQueries({ queryKey: ["llm-persona-export"] }),
    ]);
  };
  const saveMut = useMutation({
    mutationFn: () => postBasePromptSave({ mode, text }),
    onSuccess: async (data) => {
      seededAt.current = data.updated_at;
      pushConsoleToast("基础提示词已保存", "ok");
      await refresh();
    },
    onError: (error) => pushConsoleToast(axiosErrorDetail(error), "err"),
  });
  const enabledMut = useMutation({
    mutationFn: (enabled: boolean) => postBasePromptEnabled(enabled),
    onSuccess: async () => {
      pushConsoleToast("基础提示词状态已更新", "ok");
      await refresh();
    },
    onError: (error) => pushConsoleToast(axiosErrorDetail(error), "err"),
  });
  const restoreMut = useMutation({
    mutationFn: (versionId: string) => postBasePromptRestore(versionId),
    onSuccess: async (data) => {
      seededAt.current = data.updated_at;
      setMode(data.mode);
      setText(data.text);
      pushConsoleToast("已恢复历史版本", "ok");
      await refresh();
    },
    onError: (error) => pushConsoleToast(axiosErrorDetail(error), "err"),
  });
  const clearMut = useMutation({
    mutationFn: postBasePromptClear,
    onSuccess: async () => {
      seededAt.current = null;
      setMode("append");
      setText("");
      pushConsoleToast("已恢复纯内置基础提示词", "ok");
      await refresh();
    },
    onError: (error) => pushConsoleToast(axiosErrorDetail(error), "err"),
  });

  const data = contentQ.data;
  const busy = saveMut.isPending || enabledMut.isPending || restoreMut.isPending || clearMut.isPending;
  const active = data?.enabled ?? previewQ.data?.enabled ?? false;
  const builtinUpdated = data?.builtin_updated ?? previewQ.data?.builtin_updated ?? false;
  const versions = data?.versions ?? [];
  const renderedPreview = mode === "append"
    ? `内置基础提示词\n\n${text.trim() || "（未填写追加规则）"}`
    : text || "（替换文本为空）";

  const save = async () => {
    if (mode !== "replace") {
      void saveMut.mutateAsync();
      return;
    }
    if (await confirm({
      title: "替换基础提示词",
      subtitle: "替换模式会忽略内置基础提示词，后续内置更新不会自动写入当前文本。",
      warnings: ["可通过历史版本或恢复纯内置撤销。"],
      confirmLabel: "保存替换文本",
    })) {
      void saveMut.mutateAsync();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">基础提示词</CardTitle>
        <CardDescription>内置基线保持只读；可追加规则或完整替换。</CardDescription>
      </CardHeader>
      <CardContent>
        <StateBlock loading={previewQ.isLoading || contentQ.isLoading} error={contentQ.error || previewQ.error}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={active ? "success" : "muted"}>{active ? "自定义生效" : "使用内置"}</Badge>
              {builtinUpdated ? <Badge variant="outline">内置基线有更新</Badge> : null}
              {data?.updated_at ? <span className="text-xs text-muted-foreground">最近保存：{formatUpdatedAt(data.updated_at)}</span> : null}
              <label className="ml-auto flex items-center gap-2 text-sm">
                启用自定义
                <Switch checked={active} disabled={!data || busy} onCheckedChange={(checked) => void enabledMut.mutateAsync(checked)} />
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {(["append", "replace"] as const).map((value) => (
                <label key={value} className="flex min-h-10 items-center justify-between gap-2 rounded-md border px-3 text-sm">
                  <span>{value === "append" ? "追加到内置基线后" : "完整替换内置基线"}</span>
                  <input
                    type="radio"
                    name="base-prompt-mode"
                    checked={mode === value}
                    disabled={busy}
                    onChange={() => setMode(value)}
                  />
                </label>
              ))}
            </div>

            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={busy}
              className="min-h-52 font-mono text-xs leading-relaxed"
              placeholder={mode === "append" ? "追加给模型的规则" : "完整的 system prompt"}
            />
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">编译顺序预览</div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{renderedPreview}</pre>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={Save} disabled={busy} onClick={() => void save()}>保存</Button>
              <Button
                size="sm"
                variant="outline"
                icon={Trash2}
                disabled={busy || !data}
                onClick={() => void confirm({
                  title: "恢复纯内置提示词",
                  subtitle: "将删除当前自定义文本与历史版本，重新使用内置基础提示词。",
                  warnings: ["此操作不能恢复。"],
                  confirmLabel: "恢复纯内置",
                }).then((accepted) => {
                  if (accepted) void clearMut.mutateAsync();
                })}
              >
                恢复纯内置
              </Button>
            </div>

            {versions.length ? (
              <section className="space-y-2 border-t pt-3" aria-label="基础提示词历史版本">
                <div className="flex items-center gap-2 text-sm font-medium"><History className="size-4" />历史版本</div>
                <div className="space-y-2">
                  {versions.map((version) => (
                    <div key={version.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate">{version.mode === "append" ? "追加" : "替换"} · {formatUpdatedAt(version.updated_at)}</div>
                        <div className="truncate text-xs text-muted-foreground">{version.text}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        icon={RotateCcw}
                        disabled={busy}
                        onClick={() => void confirm({
                          title: "恢复历史版本",
                          subtitle: "当前编辑内容将被该历史版本替换。",
                          confirmLabel: "恢复版本",
                        }).then((accepted) => {
                          if (accepted) void restoreMut.mutateAsync(version.id);
                        })}
                      >
                        恢复
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </StateBlock>
      </CardContent>
      {confirmDialog}
    </Card>
  );
}
