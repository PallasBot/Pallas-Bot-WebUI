import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
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
  const singQ = useQuery({ queryKey: ["sing-models"], queryFn: async () => ({
    speakers: await fetchSingSpeakers(),
    backends: await fetchSingBackends(),
  }) });
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

  const refreshAll = () => {
    void mediaQ.refetch();
    void singQ.refetch();
    void ttsQ.refetch();
  };

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
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>媒体资产</CardTitle>
            <CardDescription>download / delete / status</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className={mediaQ.isFetching ? "animate-spin" : undefined} />
            刷新
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <StateBlock loading={mediaQ.isLoading} error={mediaQ.error}>
            <div className="flex flex-wrap gap-2">
              <Badge variant={mediaQ.data?.all_media_assets_ready ? "success" : "warn"}>
                {mediaQ.data?.all_media_assets_ready ? "全部就绪" : "未就绪"}
              </Badge>
              <Badge variant="outline">{mediaQ.data?.deploy_mode || "—"}</Badge>
            </div>
            <div className="space-y-2">
              {assetKeys.map((k) => {
                const a = mediaQ.data?.assets?.[k];
                return (
                  <div key={k} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <span className="font-mono text-xs">{k}</span>
                    <Badge variant={a?.ready ? "success" : "secondary"}>{a?.ready ? "ready" : "missing"}</Badge>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy || !mediaQ.data?.download_allowed} onClick={() => { setMsg(null); void downloadMut.mutateAsync(undefined); }}>
                下载全部
              </Button>
              {assetKeys.slice(0, 3).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => { setMsg(null); void deleteMut.mutateAsync([k]); }}
                >
                  删 {k}
                </Button>
              ))}
            </div>
            {jobLines.length ? (
              <pre className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">{jobLines.join("\n")}</pre>
            ) : null}
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>唱歌</CardTitle>
          <CardDescription>backends / speakers / defaults</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <StateBlock loading={singQ.isLoading} error={singQ.error}>
            <p className="text-xs text-muted-foreground">
              后端 {(singQ.data?.backends.backends || []).map((b) => b.id).join(", ") || "—"} · 说话人{" "}
              {singQ.data?.speakers.speakers?.length ?? 0} 个
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-muted-foreground">default_speaker</span>
                <Input value={defaultSpeaker} onChange={(e) => setDefaultSpeaker(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-muted-foreground">preferred_backend</span>
                <Input value={preferredBackend} onChange={(e) => setPreferredBackend(e.target.value)} />
              </label>
            </div>
            <Button size="sm" disabled={busy} onClick={() => { setMsg(null); void singMut.mutateAsync(); }}>
              保存唱歌默认
            </Button>
          </StateBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>TTS</CardTitle>
          <CardDescription>voices / defaults</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <StateBlock loading={ttsQ.isLoading} error={ttsQ.error}>
            <p className="text-xs text-muted-foreground">音色 {ttsQ.data?.voices?.length ?? 0} 个</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-muted-foreground">ref_audio_path</span>
                <Input value={ttsRef} onChange={(e) => setTtsRef(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-muted-foreground">prompt_text</span>
                <Input value={ttsPrompt} onChange={(e) => setTtsPrompt(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-muted-foreground">prompt_lang</span>
                <Input value={ttsPromptLang} onChange={(e) => setTtsPromptLang(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-muted-foreground">text_lang</span>
                <Input value={ttsTextLang} onChange={(e) => setTtsTextLang(e.target.value)} />
              </label>
            </div>
            <Button size="sm" disabled={busy} onClick={() => { setMsg(null); void ttsMut.mutateAsync(); }}>
              保存 TTS 默认
            </Button>
          </StateBlock>
        </CardContent>
      </Card>
    </div>
  );
}
