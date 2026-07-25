import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  AudioLines, Cloud, HardDrive, Music2, Palette, Server, type LucideIcon,
} from "lucide-react";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchAiExtensionConfig, fetchAiInstallStatus, fetchAiNcmStatus, fetchAiRuntimeStatus,
  fetchMediaAssetsDownloadJob, fetchMediaAssetsStatus, fetchSingBackends, fetchSingSpeakers,
  fetchTtsVoices, openAiInstallJobEventSource, postAiExtensionTest, postAiInstall,
  postAiNcmLogout, postAiNcmSendSms, postAiNcmVerifySms, postMediaAssetsDelete,
  postMediaAssetsDownload, postAiRuntimeStart, postAiRuntimeStop, putAiExtensionConfig,
  putSingDefaults, putTtsDefaults,
} from "@/api/console";
import { useRegisterAiConfigChrome } from "@/components/ai/AiConfigChromeContext";
import AiConfigField from "@/components/ai/AiConfigField";
import AiOptionSelect from "@/components/ai/AiOptionSelect";
import AiConfigSectionCard from "@/components/ai/AiConfigSectionCard";
import AiSectionHeader from "@/components/ai/AiSectionHeader";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import { CHROME_SELECT_TRIGGER } from "@/components/ChromeTools";
import PluginConfigFormSection from "@/components/config/PluginConfigFormSection";
import PluginConfigWorkspace, {
  type PluginConfigWorkspaceHandle,
} from "@/components/PluginConfigWorkspace";
import StateBlock from "@/components/StateBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AI_ENTRY_PLUGIN_CONFIG_CHECK } from "@/config/aiEntrySemantics";
import { cn } from "@/lib/utils";
import { AI_NCM_DEFAULTS, aiRuntimeLayoutLabel } from "@/config/aiConstants";
import { InstallJobFailedError, waitForInstallJob } from "@/utils/installJobStream";

/** URL / 内部 panel；connection、runtime 为旧深链别名，归一到 service；draw-raw → draw。 */
type Panel = "service" | "connection" | "runtime" | "assets" | "sing" | "tts" | "draw" | "ncm";
type SelectPanel = "service" | "assets" | "sing" | "tts" | "draw" | "ncm";

const SELECT_OPTIONS: Array<{ value: SelectPanel; label: string; icon: LucideIcon; lead: string }> = [
  { value: "service", label: "媒体服务", icon: Server, lead: "安装、启停与连接。" },
  { value: "assets", label: "媒体资产", icon: HardDrive, lead: "唱歌 / TTS 权重与素材下载。" },
  { value: "sing", label: "唱歌", icon: Music2, lead: "默认音色与推理后端。" },
  { value: "tts", label: "TTS", icon: AudioLines, lead: "参考音频与语种默认值。" },
  { value: "draw", label: "画画", icon: Palette, lead: "画画插件配置（与插件页同源）。" },
  { value: "ncm", label: "网易云", icon: Cloud, lead: "短信登录与会话状态。" },
];
const PANEL_SET = new Set<string>([
  ...SELECT_OPTIONS.map((item) => item.value),
  "connection",
  "runtime",
]);
/** 本页即媒体服务；bootstrap 固定媒体栈，开关仅 GPU / 是否自启。 */
const INSTALL_SWITCHES = [
  {
    label: "使用 GPU",
    hint: "唱歌/TTS 装 NVIDIA torch；与 Ollama 无关。",
    key: "useGpu" as const,
  },
  {
    label: "安装后不启动",
    hint: "装完后不自动启动，需再点「启动」。",
    key: "noStart" as const,
  },
] as const;

function normalizeMediaPanel(raw: string): Panel {
  if (raw === "connection" || raw === "runtime") return "service";
  if (raw === "draw-raw") return "draw";
  if (PANEL_SET.has(raw)) return raw as Panel;
  return "service";
}

export default function AiConfigMediaSection() {
  const [params, setParams] = useSearchParams();
  const rawPanel = params.get("panel") || "";
  const panel = normalizeMediaPanel(rawPanel);
  const setPanel = (next: Panel) => setParams((prev) => {
    const nextParams = new URLSearchParams(prev);
    nextParams.set("panel", next === "connection" || next === "runtime" ? "service" : next);
    return nextParams;
  }, { replace: true });
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);

  const aiCfgQ = useQuery({ queryKey: ["ai-extension-config"], queryFn: fetchAiExtensionConfig });
  const runtimeQ = useQuery({ queryKey: ["ai-runtime"], queryFn: fetchAiRuntimeStatus });
  const installQ = useQuery({ queryKey: ["ai-install"], queryFn: fetchAiInstallStatus });
  const mediaQ = useQuery({ queryKey: ["media-assets"], queryFn: fetchMediaAssetsStatus });
  const singQ = useQuery({
    queryKey: ["sing-models"],
    queryFn: async () => ({ speakers: await fetchSingSpeakers(), backends: await fetchSingBackends() }),
  });
  const ttsQ = useQuery({ queryKey: ["tts-voices"], queryFn: fetchTtsVoices });
  const statusQ = useQuery({ queryKey: ["ai-ncm"], queryFn: fetchAiNcmStatus });

  const [baseUrl, setBaseUrl] = useState("");
  const [timeoutSec, setTimeoutSec] = useState("30");
  const [installProgress, setInstallProgress] = useState("");
  const [useGpu, setUseGpu] = useState(false);
  const [noStart, setNoStart] = useState(false);
  const [jobLines, setJobLines] = useState<string[]>([]);
  const pollRef = useRef<number | null>(null);
  const [defaultSpeaker, setDefaultSpeaker] = useState("");
  const [preferredBackend, setPreferredBackend] = useState("");
  const [ttsRef, setTtsRef] = useState("");
  const [ttsPrompt, setTtsPrompt] = useState("");
  const [ttsPromptLang, setTtsPromptLang] = useState("");
  const [ttsTextLang, setTtsTextLang] = useState("");
  const [phone, setPhone] = useState("");
  const [ctcode, setCtcode] = useState(String(AI_NCM_DEFAULTS.countryCode));
  const [captcha, setCaptcha] = useState("");

  const installSwitchState = {
    useGpu: { checked: useGpu, set: setUseGpu },
    noStart: { checked: noStart, set: setNoStart },
  };

  useEffect(() => {
    if (aiCfgQ.data) {
      setBaseUrl(aiCfgQ.data.base_url || "");
      setTimeoutSec(String(aiCfgQ.data.timeout_sec ?? 30));
    }
  }, [aiCfgQ.data]);
  useEffect(() => {
    const sp = singQ.data?.speakers; if (sp?.default_speaker) setDefaultSpeaker(sp.default_speaker);
    if (sp?.preferred_backend) setPreferredBackend(sp.preferred_backend);
    const d = ttsQ.data?.defaults;
    if (d?.ref_audio_path) setTtsRef(d.ref_audio_path); if (d?.prompt_text) setTtsPrompt(d.prompt_text);
    if (d?.prompt_lang) setTtsPromptLang(d.prompt_lang); if (d?.text_lang) setTtsTextLang(d.text_lang);
  }, [singQ.data, ttsQ.data]);
  useEffect(() => () => { if (pollRef.current != null) window.clearInterval(pollRef.current); }, []);

  // 旧深链 ?panel=connection|runtime → service；draw-raw → draw
  useEffect(() => {
    if (rawPanel === "connection" || rawPanel === "runtime" || rawPanel === "draw-raw") {
      setParams((prev) => {
        const nextParams = new URLSearchParams(prev);
        nextParams.set(
          "panel",
          rawPanel === "draw-raw" ? "draw" : "service",
        );
        return nextParams;
      }, { replace: true });
    }
  }, [rawPanel, setParams]);

  const invalidate = async () => Promise.all([
    qc.invalidateQueries({ queryKey: ["ai-extension-config"] }), qc.invalidateQueries({ queryKey: ["ai-runtime"] }),
    qc.invalidateQueries({ queryKey: ["ai-install"] }),
  ]);
  const saveMut = useMutation({
    mutationFn: () => putAiExtensionConfig({
      base_url: baseUrl.trim(),
      api_prefix: (aiCfgQ.data?.api_prefix || "/api").trim() || "/api",
      timeout_sec: Number(timeoutSec) || 30,
    }),
    onSuccess: async () => { setMsg("AI 扩展连接已保存"); await invalidate(); }, onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const testMut = useMutation({
    mutationFn: postAiExtensionTest,
    onSuccess: (r) => setMsg(r.reachable ? `连通性 OK (${r.latency_ms ?? "?"} ms)` : r.error || "不可达"),
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const startMut = useMutation({
    mutationFn: () => postAiRuntimeStart(),
    onSuccess: async () => { setMsg("媒体服务已启动"); await invalidate(); }, onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const stopMut = useMutation({
    mutationFn: postAiRuntimeStop,
    onSuccess: async () => { setMsg("媒体服务已停止"); await invalidate(); }, onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const installMut = useMutation({
    mutationFn: async (action: "clone" | "bootstrap" | "clone_and_bootstrap") => {
      const job = await postAiInstall({
        action,
        no_start: noStart,
        use_gpu: useGpu,
      });
      return waitForInstallJob(job.job_id, openAiInstallJobEventSource, setInstallProgress);
    },
    onSuccess: async () => { setMsg("安装任务完成"); setInstallProgress(""); await invalidate(); },
    onError: (e) => { setInstallProgress(""); setMsg(e instanceof InstallJobFailedError ? e.message : axiosErrorDetail(e)); },
  });
  const pollJob = (jobId: string) => {
    if (pollRef.current != null) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => void fetchMediaAssetsDownloadJob(jobId).then((job) => {
      if (job.lines?.length) setJobLines(job.lines);
      if (job.state === "done" || job.state === "failed" || job.state === "error") {
        if (pollRef.current != null) window.clearInterval(pollRef.current); pollRef.current = null;
        void qc.invalidateQueries({ queryKey: ["media-assets"] });
      }
    }), 1500);
  };
  const downloadMut = useMutation({
    mutationFn: (assets?: string[]) => postMediaAssetsDownload(assets),
    onSuccess: (job) => { setMsg(`下载任务 ${job.job_id || "—"} · ${job.state || "queued"}`); if (job.job_id) pollJob(job.job_id); },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const deleteMut = useMutation({
    mutationFn: (assets: string[]) => postMediaAssetsDelete(assets),
    onSuccess: async () => { setMsg("已删除选中资产"); await qc.invalidateQueries({ queryKey: ["media-assets"] }); },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const singMut = useMutation({
    mutationFn: () => putSingDefaults({ default_speaker: defaultSpeaker, preferred_backend: preferredBackend }),
    onSuccess: () => setMsg("唱歌默认已保存"), onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const ttsMut = useMutation({
    mutationFn: () => putTtsDefaults({ ref_audio_path: ttsRef, prompt_text: ttsPrompt, prompt_lang: ttsPromptLang, text_lang: ttsTextLang }),
    onSuccess: () => setMsg("TTS 默认已保存"), onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const payload = (statusQ.data?.data || {}) as Record<string, unknown>;
  const loggedIn = Boolean(payload.success) && Boolean(payload.session);
  const ncmSessionHint = useMemo(() => {
    const session = payload.session;
    if (session == null) return "";
    if (typeof session === "string") return session.length > 48 ? `${session.slice(0, 48)}…` : session;
    if (typeof session === "object") {
      const row = session as Record<string, unknown>;
      const id = row.userId ?? row.user_id ?? row.uid ?? row.nickname ?? row.id;
      if (id != null && String(id).trim()) return `uid ${String(id)}`;
    }
    return loggedIn ? "会话有效" : "";
  }, [loggedIn, payload.session]);
  const sendMut = useMutation({
    mutationFn: () => postAiNcmSendSms({ phone: phone.trim(), ctcode: Number(ctcode) || AI_NCM_DEFAULTS.countryCode }),
    onSuccess: async (r) => { setMsg(r.ok ? "验证码已发送" : r.error || "发送失败"); await statusQ.refetch(); },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const verifyMut = useMutation({
    mutationFn: () => postAiNcmVerifySms({ phone: phone.trim(), captcha: captcha.trim(), ctcode: Number(ctcode) || AI_NCM_DEFAULTS.countryCode }),
    onSuccess: async (r) => { setMsg(r.ok ? "登录成功" : r.error || "验证失败"); await statusQ.refetch(); },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const logoutMut = useMutation({
    mutationFn: postAiNcmLogout,
    onSuccess: async (r) => { setMsg(r.ok ? "已登出" : r.error || "登出失败"); await statusQ.refetch(); },
    onError: (e) => setMsg(axiosErrorDetail(e)),
  });
  const busy = saveMut.isPending || testMut.isPending || startMut.isPending || stopMut.isPending || installMut.isPending ||
    downloadMut.isPending || deleteMut.isPending || singMut.isPending || ttsMut.isPending ||
    sendMut.isPending || verifyMut.isPending || logoutMut.isPending;
  const assetKeys = Object.keys(mediaQ.data?.assets || {});
  const speakerOptions = useMemo(
    () =>
      (singQ.data?.speakers.speakers || [])
        .map((s) => {
          const id = String(s.id || "").trim();
          if (!id) return null;
          return {
            value: id,
            label: id,
            description: s.ready === false ? "未就绪" : s.path || undefined,
          };
        })
        .filter((row): row is { value: string; label: string; description: string | undefined } => Boolean(row)),
    [singQ.data],
  );
  const backendOptions = useMemo(
    () => (singQ.data?.backends.backends || []).map((b) => b.id).filter(Boolean),
    [singQ.data],
  );
  const voicePathOptions = useMemo(
    () =>
      (ttsQ.data?.voices || [])
        .map((v) => {
          const path = String(v.path || "").trim();
          if (!path) return null;
          const name = String(v.name || v.id || "").trim();
          return {
            value: path,
            label: name && name !== path ? name : path.split(/[/\\]/).pop() || path,
            description: path,
          };
        })
        .filter((row): row is { value: string; label: string; description: string } => Boolean(row)),
    [ttsQ.data],
  );
  const contentPanel: SelectPanel = panel as SelectPanel;
  const activeSelectIcon =
    SELECT_OPTIONS.find((item) => item.value === contentPanel)?.icon || Server;
  const drawWorkspaceRef = useRef<PluginConfigWorkspaceHandle>(null);
  const [drawStatus, setDrawStatus] = useState<
    Omit<PluginConfigWorkspaceHandle, "save" | "runConfigCheck">
  >({
    saving: false,
    checking: false,
    loading: true,
    hasData: false,
    supportsConfigCheck: false,
  });

  const chromeMiddle = useMemo(() => (
    <ChromeField label="媒体配置" icon={activeSelectIcon}>
      <Select
        value={contentPanel}
        onValueChange={(value) => setPanel(value as SelectPanel)}
      >
        <SelectTrigger className={CHROME_SELECT_TRIGGER}><SelectValue /></SelectTrigger>
        <SelectContent align="start">{SELECT_OPTIONS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            <ChromeOptionLabel icon={item.icon}>{item.label}</ChromeOptionLabel>
          </SelectItem>
        ))}</SelectContent>
      </Select>
    </ChromeField>
  ), [activeSelectIcon, contentPanel]);

  const chromeTrailing = useMemo(() => {
    if (contentPanel !== "draw") return null;
    return (
      <>
        {drawStatus.supportsConfigCheck ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={
              !drawStatus.hasData
              || drawStatus.loading
              || drawStatus.saving
              || drawStatus.checking
            }
            onClick={() => void drawWorkspaceRef.current?.runConfigCheck()}
          >
            {drawStatus.checking ? "检测中…" : AI_ENTRY_PLUGIN_CONFIG_CHECK.label}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={
            !drawStatus.hasData
            || drawStatus.loading
            || drawStatus.saving
            || drawStatus.checking
          }
          onClick={() => void drawWorkspaceRef.current?.save()}
        >
          {drawStatus.saving ? "保存中…" : "保存"}
        </Button>
      </>
    );
  }, [contentPanel, drawStatus]);

  useRegisterAiConfigChrome({ middle: chromeMiddle, trailing: chromeTrailing });

  const panelMeta =
    contentPanel === "draw"
      ? {
          label: "画画",
          icon: Palette,
          lead: SELECT_OPTIONS.find((item) => item.value === "draw")?.lead || "",
        }
      : (() => {
          const found = SELECT_OPTIONS.find((item) => item.value === contentPanel) || SELECT_OPTIONS[0];
          return { label: found.label, icon: found.icon, lead: found.lead };
        })();

  const serviceLoading = aiCfgQ.isLoading || runtimeQ.isLoading || installQ.isLoading;
  const serviceError = aiCfgQ.error || runtimeQ.error || installQ.error;
  const canManageRuntime = runtimeQ.data?.can_manage === true;
  const canClone = installQ.data?.can_clone === true;
  const canBootstrap = installQ.data?.can_bootstrap === true;
  const inDocker = installQ.data?.in_docker === true;
  const runtimeLayout = runtimeQ.data?.layout || installQ.data?.layout || "";
  const localInstallUi = canManageRuntime || canClone || canBootstrap;
  const dockerOrRemoteHint =
    (installQ.data?.docker_hint || "").trim()
    || (inDocker || runtimeLayout === "docker" || runtimeLayout === "remote"
      ? "当前环境无法在此页安装或启停媒体服务，请在宿主机用 compose / 源码管理，本页只负责连接与测通。"
      : "");

  return <AiConfigSectionCard contentClassName="space-y-4">
    <AiSectionHeader icon={panelMeta.icon} title={panelMeta.label} lead={panelMeta.lead} />
    {msg ? <p className={cn("text-sm", /成功|OK|完成|已保存|已删除|任务|已发送|已登出|已启动|已停止/.test(msg) ? "text-emerald-400" : "text-destructive")}>{msg}</p> : null}
    {installProgress ? <p className="text-xs text-muted-foreground">{installProgress}</p> : null}
    {panel === "service" ? (
      <StateBlock loading={serviceLoading} error={serviceError}>
        <div className="space-y-4">
          <PluginConfigFormSection
            title="安装与运行"
            subtitle={
              localInstallUi
                ? "首次建议「下载并安装」，完成后点「启动」。"
                : "Docker / 远端部署时，请在宿主机管理媒体服务。"
            }
            bodyClassName="!grid-cols-1 gap-3"
          >
            <div className="flex flex-wrap gap-2">
              <Badge variant={runtimeQ.data?.running ? "success" : "secondary"}>
                {runtimeQ.data?.running ? "运行中" : "未运行"}
              </Badge>
              <Badge variant="outline">{aiRuntimeLayoutLabel(runtimeLayout)}</Badge>
              {inDocker ? <Badge variant="outline">Bot · Docker</Badge> : null}
              <Badge variant={runtimeQ.data?.health?.ok ? "success" : "warn"}>
                健康 {runtimeQ.data?.health?.ok ? "正常" : "异常"}
              </Badge>
            </div>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {runtimeQ.data?.ai_root || installQ.data?.ai_root || "—"}
            </p>
            {localInstallUi ? (
              <>
                <div className="grid gap-2 md:grid-cols-2">
                  {INSTALL_SWITCHES.map((item) => {
                    const state = installSwitchState[item.key];
                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-3 rounded-[var(--radius-control,8px)] border px-3 py-2"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <span className="text-xs">{item.label}</span>
                          <p className="text-[11px] leading-snug text-muted-foreground">{item.hint}</p>
                        </div>
                        <Switch
                          checked={state.checked}
                          disabled={!canClone && !canBootstrap}
                          onCheckedChange={state.set}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy || !canManageRuntime} onClick={() => { setMsg(null); void startMut.mutateAsync(); }}>启动</Button>
                  <Button size="sm" variant="outline" disabled={busy || !canManageRuntime} onClick={() => { setMsg(null); void stopMut.mutateAsync(); }}>停止</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !canClone}
                    title="首次使用：拉取媒体服务源码并安装依赖"
                    onClick={() => { setMsg(null); void installMut.mutateAsync("clone_and_bootstrap"); }}
                  >
                    下载并安装
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !canBootstrap}
                    title="已有源码目录时：只重装依赖"
                    onClick={() => { setMsg(null); void installMut.mutateAsync("bootstrap"); }}
                  >
                    安装依赖
                  </Button>
                </div>
              </>
            ) : (
              <pre className="whitespace-pre-wrap rounded-[var(--radius-control,8px)] border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
                {dockerOrRemoteHint || "当前无法在此安装或启停，请改用连接配置。"}
              </pre>
            )}
          </PluginConfigFormSection>

          <PluginConfigFormSection
            title="连接"
            subtitle={
              localInstallUi
                ? "配置并测试 Bot 与媒体推理服务的连接。"
                : "配置并测试 Bot 与媒体推理服务的连接（Docker 环境通常为 http://pallasbot-ai:9099）。"
            }
            bodyClassName="!grid-cols-1 gap-3"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <AiConfigField label="服务地址" description="例如 http://127.0.0.1:9099">
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              </AiConfigField>
              <AiConfigField label="超时（秒）" description="请求超时上限">
                <Input type="number" value={timeoutSec} onChange={(e) => setTimeoutSec(e.target.value)} />
              </AiConfigField>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => { setMsg(null); void saveMut.mutateAsync(); }}>保存</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => { setMsg(null); void testMut.mutateAsync(); }}>测试连通</Button>
            </div>
          </PluginConfigFormSection>
        </div>
      </StateBlock>
    ) : null}
    {panel === "assets" ? (
      <StateBlock loading={mediaQ.isLoading} error={mediaQ.error}>
        <div className="space-y-4">
          <PluginConfigFormSection
            title="就绪状态"
            subtitle="权重与素材是否齐备。"
            bodyClassName="!grid-cols-1 gap-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={mediaQ.data?.all_media_assets_ready ? "success" : "warn"}>
                {mediaQ.data?.all_media_assets_ready ? "全部就绪" : "未就绪"}
              </Badge>
              <Badge variant="outline">{mediaQ.data?.deploy_mode || "—"}</Badge>
              {!mediaQ.data?.download_allowed ? (
                <Badge variant="secondary">当前环境不可下载</Badge>
              ) : null}
              {mediaQ.data?.delete_allowed === false ? (
                <Badge variant="secondary">当前环境不可删除</Badge>
              ) : null}
            </div>
          </PluginConfigFormSection>

          <PluginConfigFormSection
            title="资产清单"
            subtitle="按项下载或删除；也可一次拉齐缺失项。"
            bodyClassName="!grid-cols-1 gap-2"
          >
            {assetKeys.length ? assetKeys.map((key) => {
              const asset = mediaQ.data?.assets?.[key];
              return (
                <div
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control,8px)] border px-3 py-2.5"
                >
                  <div className="min-w-0 space-y-0.5">
                    <span className="font-mono text-xs">{key}</span>
                    {asset?.path ? (
                      <p className="break-all font-mono text-[11px] text-muted-foreground">{String(asset.path)}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge variant={asset?.ready ? "success" : "secondary"}>
                      {asset?.ready ? "就绪" : "缺失"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !mediaQ.data?.download_allowed}
                      onClick={() => { setMsg(null); void downloadMut.mutateAsync([key]); }}
                    >
                      下载
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !asset?.ready || mediaQ.data?.delete_allowed === false}
                      onClick={() => { setMsg(null); void deleteMut.mutateAsync([key]); }}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              );
            }) : (
              <p className="text-sm text-muted-foreground">暂无已配置的媒体资产。</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                disabled={busy || !mediaQ.data?.download_allowed}
                onClick={() => { setMsg(null); void downloadMut.mutateAsync(undefined); }}
              >
                下载全部
              </Button>
            </div>
          </PluginConfigFormSection>

          {jobLines.length ? (
            <PluginConfigFormSection
              title="任务日志"
              subtitle="最近一次下载任务输出。"
              bodyClassName="!grid-cols-1"
              defaultOpen
            >
              <pre className="max-h-40 overflow-auto rounded-[var(--radius-control,8px)] border bg-muted/30 p-2 text-xs">
                {jobLines.join("\n")}
              </pre>
            </PluginConfigFormSection>
          ) : null}
        </div>
      </StateBlock>
    ) : null}
    {panel === "sing" ? (
      <StateBlock loading={singQ.isLoading} error={singQ.error}>
        <div className="space-y-4">
          <PluginConfigFormSection
            title="运行概况"
            subtitle="已登记的推理后端与 Speaker。"
            bodyClassName="!grid-cols-1 gap-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                Speaker {singQ.data?.speakers.speakers?.length ?? 0} 个
              </Badge>
              <Badge variant="outline">
                后端 {singQ.data?.backends.backends?.length ?? 0} 个
              </Badge>
            </div>
            <p className="break-all font-mono text-[11px] text-muted-foreground">
              {(singQ.data?.backends.backends || []).map((b) => b.id).join(", ") || "暂无后端"}
            </p>
          </PluginConfigFormSection>

          <PluginConfigFormSection
            title="默认参数"
            subtitle="未在命令中指定时使用。"
            bodyClassName="!grid-cols-1 gap-3"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <AiConfigField label="默认 Speaker" description="未指定时使用的唱歌音色。">
                <AiOptionSelect
                  value={defaultSpeaker}
                  options={speakerOptions}
                  placeholder="选择 Speaker"
                  emptyLabel="（未指定）"
                  onValueChange={setDefaultSpeaker}
                />
              </AiConfigField>
              <AiConfigField label="优先后端" description="首选推理后端。">
                <AiOptionSelect
                  value={preferredBackend}
                  options={backendOptions}
                  placeholder="选择后端"
                  emptyLabel="（未指定）"
                  onValueChange={setPreferredBackend}
                />
              </AiConfigField>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => { setMsg(null); void singMut.mutateAsync(); }}>
                保存
              </Button>
            </div>
          </PluginConfigFormSection>
        </div>
      </StateBlock>
    ) : null}

    {panel === "tts" ? (
      <StateBlock loading={ttsQ.isLoading} error={ttsQ.error}>
        <div className="space-y-4">
          <PluginConfigFormSection
            title="音色概况"
            subtitle="可用的参考音频路径。"
            bodyClassName="!grid-cols-1 gap-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">音色 {ttsQ.data?.voices?.length ?? 0} 个</Badge>
            </div>
          </PluginConfigFormSection>

          <PluginConfigFormSection
            title="合成默认"
            subtitle="参考音频、提示文本与语种默认值。"
            bodyClassName="!grid-cols-1 gap-3"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <AiConfigField label="参考音频" description="参考音频路径" className="md:col-span-2">
                <AiOptionSelect
                  value={ttsRef}
                  options={voicePathOptions}
                  placeholder="选择参考音频"
                  emptyLabel="（未指定）"
                  onValueChange={setTtsRef}
                />
              </AiConfigField>
              <AiConfigField label="提示文本" className="md:col-span-2">
                <Input value={ttsPrompt} onChange={(e) => setTtsPrompt(e.target.value)} />
              </AiConfigField>
              <AiConfigField label="提示语种" description="参考音频对应语种，如 zh / en。">
                <Input value={ttsPromptLang} onChange={(e) => setTtsPromptLang(e.target.value)} />
              </AiConfigField>
              <AiConfigField label="合成语种" description="待合成文本语种。">
                <Input value={ttsTextLang} onChange={(e) => setTtsTextLang(e.target.value)} />
              </AiConfigField>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => { setMsg(null); void ttsMut.mutateAsync(); }}>
                保存
              </Button>
            </div>
          </PluginConfigFormSection>
        </div>
      </StateBlock>
    ) : null}

    {panel === "draw" ? (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          与插件页共享 draw 配置；未装画画插件时会加载失败。
        </p>
        <PluginConfigWorkspace
          ref={drawWorkspaceRef}
          pluginName="draw"
          presentation="dialog"
          onStatusChange={setDrawStatus}
        />
      </div>
    ) : null}

    {panel === "ncm" ? (
      <div className="space-y-4">
        <PluginConfigFormSection
          title="登录状态"
          subtitle="会话是否有效；点歌依赖已登录。"
          bodyClassName="!grid-cols-1 gap-3"
        >
          <StateBlock loading={statusQ.isLoading} error={statusQ.error}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={loggedIn ? "success" : "secondary"}>
                {loggedIn ? "已登录" : "未登录"}
              </Badge>
              {ncmSessionHint ? (
                <Badge variant="outline" className="max-w-full truncate font-mono text-[11px]">
                  {ncmSessionHint}
                </Badge>
              ) : null}
            </div>
            {statusQ.data ? (
              <details className="rounded-[var(--radius-control,8px)] border bg-muted/20">
                <summary className="cursor-pointer select-none px-3 py-2 text-xs text-muted-foreground">
                  查看原始状态
                </summary>
                <pre className="max-h-48 overflow-auto border-t bg-muted/30 p-2 text-xs">
                  {JSON.stringify(statusQ.data, null, 2)}
                </pre>
              </details>
            ) : null}
          </StateBlock>
        </PluginConfigFormSection>

        <PluginConfigFormSection
          title="短信登录"
          subtitle="手机号验证码登录；已登录可登出。"
          bodyClassName="!grid-cols-1 gap-3"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <AiConfigField label="手机号" description="接收验证码的手机号。">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="11 位手机号"
              />
            </AiConfigField>
            <AiConfigField label="国家码" description={`默认 ${AI_NCM_DEFAULTS.countryCode}`}>
              <Input value={ctcode} onChange={(e) => setCtcode(e.target.value)} type="number" />
            </AiConfigField>
            <AiConfigField label="验证码" description="短信收到的验证码。" className="md:col-span-2">
              <Input
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="验证码"
              />
            </AiConfigField>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || phone.trim().length < AI_NCM_DEFAULTS.phoneMinLength}
              onClick={() => { setMsg(null); void sendMut.mutateAsync(); }}
            >
              发送验证码
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={
                busy
                || phone.trim().length < AI_NCM_DEFAULTS.phoneMinLength
                || captcha.trim().length < AI_NCM_DEFAULTS.captchaMinLength
              }
              onClick={() => { setMsg(null); void verifyMut.mutateAsync(); }}
            >
              验证登录
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !loggedIn}
              onClick={() => { setMsg(null); void logoutMut.mutateAsync(); }}
            >
              登出
            </Button>
          </div>
        </PluginConfigFormSection>
      </div>
    ) : null}
  </AiConfigSectionCard>;
}
