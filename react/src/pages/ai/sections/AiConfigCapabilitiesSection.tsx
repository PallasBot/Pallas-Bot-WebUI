import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchMediaAssetsDownloadJob,
  fetchMediaAssetsStatus,
  fetchSingBackends,
  fetchSingSpeakers,
  fetchTtsVoices,
  postMediaAssetsDelete,
  postMediaAssetsDownload,
  putSingDefaults,
  putTtsDefaults,
} from "@/api/console";
import AiConfigField, { AiModelSelect } from "@/components/ai/AiConfigField";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function AiConfigCapabilitiesSection() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [jobLines, setJobLines] = useState<string[]>([]);
  const pollRef = useRef<number | null>(null);

  const mediaQ = useQuery({ queryKey: ["media-assets"], queryFn: fetchMediaAssetsStatus });
  const singQ = useQuery({
    queryKey: ["sing-models"],
    queryFn: async () => ({
      speakers: await fetchSingSpeakers(),
      backends: await fetchSingBackends(),
    }),
  });
  const ttsQ = useQuery({ queryKey: ["tts-voices"], queryFn: fetchTtsVoices });

  const [defaultSpeaker, setDefaultSpeaker] = useState("");
  const [preferredBackend, setPreferredBackend] = useState("");
  const [ttsRef, setTtsRef] = useState("");
  const [ttsPrompt, setTtsPrompt] = useState("");
  const [ttsPromptLang, setTtsPromptLang] = useState("");
  const [ttsTextLang, setTtsTextLang] = useState("");

  useEffect(() => {
    const sp = singQ.data?.speakers;
    if (sp?.default_speaker) setDefaultSpeaker(sp.default_speaker);
    if (sp?.preferred_backend) setPreferredBackend(sp.preferred_backend);
    const d = ttsQ.data?.defaults;
    if (d?.ref_audio_path) setTtsRef(d.ref_audio_path);
    if (d?.prompt_text) setTtsPrompt(d.prompt_text);
    if (d?.prompt_lang) setTtsPromptLang(d.prompt_lang);
    if (d?.text_lang) setTtsTextLang(d.text_lang);
  }, [singQ.data, ttsQ.data]);

  useEffect(
    () => () => {
      if (pollRef.current != null) window.clearInterval(pollRef.current);
    },
    [],
  );

  const speakerOptions = useMemo(
    () => (singQ.data?.speakers.speakers || []).map((s) => s.id).filter(Boolean),
    [singQ.data],
  );
  const backendOptions = useMemo(
    () => (singQ.data?.backends.backends || []).map((b) => b.id).filter(Boolean),
    [singQ.data],
  );
  const voicePathOptions = useMemo(
    () => (ttsQ.data?.voices || []).map((v) => v.path).filter(Boolean),
    [ttsQ.data],
  );

  const pollJob = (jobId: string) => {
    if (pollRef.current != null) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => {
      void fetchMediaAssetsDownloadJob(jobId).then((job) => {
        if (job.lines?.length) setJobLines(job.lines);
        if (job.state === "done" || job.state === "failed" || job.state === "error") {
          if (pollRef.current != null) window.clearInterval(pollRef.current);
          pollRef.current = null;
          void qc.invalidateQueries({ queryKey: ["media-assets"] });
        }
      });
    }, 1500);
  };

  const downloadMut = useMutation({
    mutationFn: (assets?: string[]) => postMediaAssetsDownload(assets),
    onSuccess: (job) => {
      setMsg(`下载任务 ${job.job_id || "—"} · ${job.state || "queued"}`);
      if (job.job_id) pollJob(job.job_id);
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (assets: string[]) => postMediaAssetsDelete(assets),
    onSuccess: async () => {
      setMsg("已删除选中资产");
      await qc.invalidateQueries({ queryKey: ["media-assets"] });
    },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const singMut = useMutation({
    mutationFn: () => putSingDefaults({ default_speaker: defaultSpeaker, preferred_backend: preferredBackend }),
    onSuccess: () => setMsg("唱歌默认已保存"),
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const ttsMut = useMutation({
    mutationFn: () =>
      putTtsDefaults({
        ref_audio_path: ttsRef,
        prompt_text: ttsPrompt,
        prompt_lang: ttsPromptLang,
        text_lang: ttsTextLang,
      }),
    onSuccess: () => setMsg("TTS 默认已保存"),
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });

  const assetKeys = Object.keys(mediaQ.data?.assets || {});
  const busy = downloadMut.isPending || deleteMut.isPending || singMut.isPending || ttsMut.isPending;

  return (
    <div className="space-y-4">
      {msg ? (
        <p className={cn("text-sm", /成功|已保存|已删除|任务/.test(msg) ? "text-emerald-400" : "text-destructive")}>
          {msg}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>媒体资产</CardTitle>
          <CardDescription>下载、删除与就绪状态。</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={mediaQ.isLoading} error={mediaQ.error}>
            <div className="flex flex-wrap gap-2">
              <Badge variant={mediaQ.data?.all_media_assets_ready ? "success" : "warn"}>
                {mediaQ.data?.all_media_assets_ready ? "全部就绪" : "未就绪"}
              </Badge>
              <Badge variant="outline">{mediaQ.data?.deploy_mode || "—"}</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {assetKeys.map((k) => {
                const a = mediaQ.data?.assets?.[k];
                return (
                  <div
                    key={k}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control,8px)] border px-3 py-2"
                  >
                    <span className="font-mono text-xs">{k}</span>
                    <Badge variant={a?.ready ? "success" : "secondary"}>{a?.ready ? "就绪" : "缺失"}</Badge>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy || !mediaQ.data?.download_allowed}
                onClick={() => {
                  setMsg(null);
                  void downloadMut.mutateAsync(undefined);
                }}
              >
                下载全部
              </Button>
              {assetKeys.slice(0, 3).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setMsg(null);
                    void deleteMut.mutateAsync([k]);
                  }}
                >
                  删 {k}
                </Button>
              ))}
            </div>
            {jobLines.length ? (
              <pre className="mt-3 max-h-40 overflow-auto rounded-[var(--radius-control,8px)] border bg-muted/30 p-2 text-xs">
                {jobLines.join("\n")}
              </pre>
            ) : null}
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>唱歌</CardTitle>
          <CardDescription>
            后端 {(singQ.data?.backends.backends || []).map((b) => b.id).join(", ") || "—"} · 说话人{" "}
            {singQ.data?.speakers.speakers?.length ?? 0} 个
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={singQ.isLoading} error={singQ.error}>
            <div className="grid gap-3 sm:grid-cols-2">
              <AiConfigField label="默认说话人" description="未指定时使用的唱歌音色。">
                <AiModelSelect
                  value={defaultSpeaker}
                  options={speakerOptions}
                  placeholder="选择说话人"
                  emptyLabel="（未指定）"
                  onValueChange={setDefaultSpeaker}
                />
              </AiConfigField>
              <AiConfigField label="优先后端" description="首选推理后端。">
                <AiModelSelect
                  value={preferredBackend}
                  options={backendOptions}
                  placeholder="选择后端"
                  emptyLabel="（未指定）"
                  onValueChange={setPreferredBackend}
                />
              </AiConfigField>
            </div>
            <Button
              className="mt-3"
              size="sm"
              disabled={busy}
              onClick={() => {
                setMsg(null);
                void singMut.mutateAsync();
              }}
            >
              保存唱歌默认
            </Button>
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>TTS</CardTitle>
          <CardDescription>音色 {ttsQ.data?.voices?.length ?? 0} 个</CardDescription>
        </CardHeader>
        <CardContent>
          <StateBlock loading={ttsQ.isLoading} error={ttsQ.error}>
            <div className="grid gap-3 sm:grid-cols-2">
              <AiConfigField label="参考音频" description="ref_audio_path">
                <AiModelSelect
                  value={ttsRef}
                  options={voicePathOptions}
                  placeholder="选择参考音频"
                  emptyLabel="（未指定）"
                  onValueChange={setTtsRef}
                />
              </AiConfigField>
              <AiConfigField label="提示文本" description="prompt_text">
                <Input value={ttsPrompt} onChange={(e) => setTtsPrompt(e.target.value)} />
              </AiConfigField>
              <AiConfigField label="提示语种" description="prompt_lang">
                <Input value={ttsPromptLang} onChange={(e) => setTtsPromptLang(e.target.value)} />
              </AiConfigField>
              <AiConfigField label="合成语种" description="text_lang">
                <Input value={ttsTextLang} onChange={(e) => setTtsTextLang(e.target.value)} />
              </AiConfigField>
            </div>
            <Button
              className="mt-3"
              size="sm"
              disabled={busy}
              onClick={() => {
                setMsg(null);
                void ttsMut.mutateAsync();
              }}
            >
              保存 TTS 默认
            </Button>
          </StateBlock>
        </CardContent>
      </Card>
    </div>
  );
}
