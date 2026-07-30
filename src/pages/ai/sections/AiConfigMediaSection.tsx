import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import "@/styles/console/ai-hub.css";
import {
  AudioLines, Cloud, HardDrive, Layers, Music2, Palette, Server, type LucideIcon,
} from "lucide-react";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchAiExtensionConfig, fetchAiInstallStatus, fetchAiNcmStatus, fetchAiRuntimeStatus,
  fetchMediaAssetsDownloadJob, fetchMediaAssetsStatus, fetchSingBackends, fetchSingSpeakers,
  fetchTtsVoices, fetchTtsTranslator, openAiInstallJobEventSource, postAiExtensionTest, postAiInstall,
  postAiNcmLogout, postAiNcmSendSms, postAiNcmVerifySms, postMediaAssetsDelete,
  postMediaAssetsDownload, postAiRuntimeStart, postAiRuntimeStop, putAiExtensionConfig,
  putSingDefaults, putTtsDefaults, putTtsTranslator,
} from "@/api/console";
import { useRegisterAiConfigChrome } from "@/components/ai/AiConfigChromeContext";
import AiConfigField from "@/components/ai/AiConfigField";
import AiJobProgressBlock from "@/components/ai/AiJobProgressBlock";
import AiOptionSelect from "@/components/ai/AiOptionSelect";
import AiConfigSectionCard from "@/components/ai/AiConfigSectionCard";
import AiSectionHeader from "@/components/ai/AiSectionHeader";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import { CHROME_SELECT_TRIGGER } from "@/components/ChromeTools";
import ConsoleHint from "@/components/ConsoleHint";
import { preserveShellMainScroll } from "@/utils/preserveShellScroll";
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
import { AI_NCM_DEFAULTS, aiRuntimeLayoutLabel } from "@/config/aiConstants";
import { InstallJobFailedError, waitForInstallJob } from "@/utils/installJobStream";
import {
  aiInstallSubtitle,
  resolveAiInstallPrimary,
  showAiInstallBootstrapSecondary,
} from "@/utils/aiInstallPrimary";
import { pushConsoleToast } from "@/utils/consoleToast";

function notifyOk(message: string) {
  pushConsoleToast(message, "ok");
}

function notifyErr(message: string) {
  pushConsoleToast(message || "操作失败", "err");
}

function AiRuntimeNotReadyBlock({
  canManage,
  busy,
  onGoService,
  onStart,
}: {
  canManage: boolean;
  busy: boolean;
  onGoService: () => void;
  onStart: () => void;
}) {
  return (
    <div className="space-y-3">
      <ConsoleHint>
        媒体服务还没就绪。请先到「媒体服务」完成安装与启动，确认健康后再回来操作。
      </ConsoleHint>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onGoService}>前往媒体服务</Button>
        {canManage ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onStart}>
            启动媒体服务
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** URL / 内部 panel；connection、runtime 为旧深链别名，归一到 service；draw-raw → draw。 */
type Panel = "service" | "connection" | "runtime" | "assets" | "sing" | "tts" | "draw" | "ncm";
type SelectPanel = "service" | "assets" | "sing" | "tts" | "draw" | "ncm";

const SELECT_OPTIONS: Array<{ value: SelectPanel; label: string; icon: LucideIcon; lead: string }> = [
  { value: "service", label: "媒体服务", icon: Server, lead: "安装、启停与连接。" },
  { value: "assets", label: "媒体资产", icon: HardDrive, lead: "下载唱歌 / 语音所需的模型与素材。" },
  { value: "sing", label: "唱歌", icon: Music2, lead: "默认音色与音色映射。" },
  { value: "tts", label: "牛牛说", icon: AudioLines, lead: "默认音色、语种与中译日。" },
  { value: "draw", label: "画画", icon: Palette, lead: "画画网关；其它项在插件配置。" },
  { value: "ncm", label: "网易云", icon: Cloud, lead: "短信登录与会话状态。" },
];

/** GPT-SoVITS v2 语种；合成语种 / 提示语种共用。 */
const TTS_LANG_OPTIONS = [
  { value: "zh", label: "中文", description: "zh" },
  { value: "ja", label: "日语", description: "ja" },
  { value: "en", label: "英语", description: "en" },
  { value: "yue", label: "粤语", description: "yue" },
  { value: "ko", label: "韩语", description: "ko" },
  { value: "auto", label: "自动识别", description: "auto" },
  { value: "auto_yue", label: "自动识别（含粤语）", description: "auto_yue" },
  { value: "all_zh", label: "强制中文切分", description: "all_zh" },
  { value: "all_ja", label: "强制日语切分", description: "all_ja" },
  { value: "all_yue", label: "强制粤语切分", description: "all_yue" },
  { value: "all_ko", label: "强制韩语切分", description: "all_ko" },
];

function PluginConfigElsewhereHint({
  pluginName,
  label,
  extras,
}: {
  pluginName: string;
  label: string;
  extras: string;
}) {
  return (
    <p className="text-sm text-muted-foreground">
      {extras}
      请到{" "}
      <Link to={`/plugins/${encodeURIComponent(pluginName)}`}>{`插件配置 · ${label}`}</Link>
      {" "}
      设置。
    </p>
  );
}
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
  const setPanel = (next: Panel) => {
    preserveShellMainScroll(() => {
      setParams((prev) => {
        const nextParams = new URLSearchParams(prev);
        nextParams.set("panel", next === "connection" || next === "runtime" ? "service" : next);
        return nextParams;
      }, { replace: true });
    });
  };
  const qc = useQueryClient();

  const aiCfgQ = useQuery({ queryKey: ["ai-extension-config"], queryFn: fetchAiExtensionConfig });
  const runtimeQ = useQuery({ queryKey: ["ai-runtime"], queryFn: fetchAiRuntimeStatus });
  const installQ = useQuery({ queryKey: ["ai-install"], queryFn: fetchAiInstallStatus });
  /** 权重 / 唱歌 / TTS / 网易云都代理到 AI Runtime；未健康时不要打 :9099，避免与「安装与启动」脱节。 */
  const runtimeProbeDone = !runtimeQ.isLoading;
  const runtimeReady = runtimeQ.data?.health?.ok === true;
  const mediaQ = useQuery({
    queryKey: ["media-assets"],
    queryFn: fetchMediaAssetsStatus,
    enabled: panel === "assets" && runtimeProbeDone && runtimeReady,
    retry: false,
  });
  const singQ = useQuery({
    queryKey: ["sing-models"],
    queryFn: async () => ({ speakers: await fetchSingSpeakers(), backends: await fetchSingBackends() }),
    enabled: panel === "sing" && runtimeProbeDone && runtimeReady,
    retry: false,
  });
  const ttsQ = useQuery({
    queryKey: ["tts-voices"],
    queryFn: fetchTtsVoices,
    enabled: panel === "tts" && runtimeProbeDone && runtimeReady,
    retry: false,
  });
  const ttsTranslatorQ = useQuery({
    queryKey: ["tts-translator"],
    queryFn: fetchTtsTranslator,
    enabled: panel === "tts" && runtimeProbeDone && runtimeReady,
    retry: false,
  });
  const statusQ = useQuery({
    queryKey: ["ai-ncm"],
    queryFn: fetchAiNcmStatus,
    enabled: panel === "ncm" && runtimeProbeDone && runtimeReady,
    retry: false,
  });

  const [baseUrl, setBaseUrl] = useState("");
  const [timeoutSec, setTimeoutSec] = useState("30");
  const [bearerToken, setBearerToken] = useState("");
  const [installProgress, setInstallProgress] = useState("");
  const [installPercent, setInstallPercent] = useState(0);
  const [installLogLines, setInstallLogLines] = useState<string[]>([]);
  const [installFailTail, setInstallFailTail] = useState("");
  const [useGpu, setUseGpu] = useState(false);
  const [noStart, setNoStart] = useState(false);
  const [jobLines, setJobLines] = useState<string[]>([]);
  const [assetDlPercent, setAssetDlPercent] = useState(0);
  const [assetDlLabel, setAssetDlLabel] = useState("");
  const [assetDlActive, setAssetDlActive] = useState(false);
  const [assetDlFailed, setAssetDlFailed] = useState(false);
  const pollRef = useRef<number | null>(null);
  const [defaultSpeaker, setDefaultSpeaker] = useState("");
  const [preferredBackend, setPreferredBackend] = useState("");
  const [ttsRef, setTtsRef] = useState("");
  const [ttsPrompt, setTtsPrompt] = useState("");
  const [ttsPromptLang, setTtsPromptLang] = useState("");
  const [ttsTextLang, setTtsTextLang] = useState("");
  const [ttsTranslateEnable, setTtsTranslateEnable] = useState(false);
  const [ttsTranslateProvider, setTtsTranslateProvider] = useState("baidu");
  const [ttsBaiduAppId, setTtsBaiduAppId] = useState("");
  const [ttsBaiduSecret, setTtsBaiduSecret] = useState("");
  const [ttsYoudaoAppKey, setTtsYoudaoAppKey] = useState("");
  const [ttsYoudaoSecret, setTtsYoudaoSecret] = useState("");
  const [ttsBaiduSecretConfigured, setTtsBaiduSecretConfigured] = useState(false);
  const [ttsYoudaoSecretConfigured, setTtsYoudaoSecretConfigured] = useState(false);
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
      setBearerToken(aiCfgQ.data.token || "");
    }
  }, [aiCfgQ.data]);
  useEffect(() => {
    const sp = singQ.data?.speakers; if (sp?.default_speaker) setDefaultSpeaker(sp.default_speaker);
    if (sp?.preferred_backend) setPreferredBackend(sp.preferred_backend);
    const d = ttsQ.data?.defaults;
    if (d?.ref_audio_path) setTtsRef(d.ref_audio_path); if (d?.prompt_text) setTtsPrompt(d.prompt_text);
    if (d?.prompt_lang) setTtsPromptLang(d.prompt_lang); if (d?.text_lang) setTtsTextLang(d.text_lang);
  }, [singQ.data, ttsQ.data]);
  useEffect(() => {
    const t = ttsTranslatorQ.data;
    if (!t) return;
    setTtsTranslateEnable(Boolean(t.enable));
    setTtsTranslateProvider(String(t.provider || "baidu").trim() || "baidu");
    setTtsBaiduAppId(String(t.baidu_app_id || ""));
    setTtsYoudaoAppKey(String(t.youdao_app_key || ""));
    setTtsBaiduSecretConfigured(Boolean(t.baidu_secret_configured));
    setTtsYoudaoSecretConfigured(Boolean(t.youdao_secret_configured));
    setTtsBaiduSecret("");
    setTtsYoudaoSecret("");
  }, [ttsTranslatorQ.data]);
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
    qc.invalidateQueries({ queryKey: ["ai-extension-config"] }),
    qc.invalidateQueries({ queryKey: ["ai-runtime"] }),
    qc.invalidateQueries({ queryKey: ["ai-install"] }),
    qc.invalidateQueries({ queryKey: ["media-assets"] }),
    qc.invalidateQueries({ queryKey: ["sing-models"] }),
    qc.invalidateQueries({ queryKey: ["tts-voices"] }),
    qc.invalidateQueries({ queryKey: ["ai-ncm"] }),
  ]);
  const saveMut = useMutation({
    mutationFn: () => putAiExtensionConfig({
      base_url: baseUrl.trim(),
      api_prefix: (aiCfgQ.data?.api_prefix || "/api").trim() || "/api",
      token: bearerToken.trim(),
      health_paths: aiCfgQ.data?.health_paths?.length ? aiCfgQ.data.health_paths : ["/health"],
      uvicorn_log_file: aiCfgQ.data?.uvicorn_log_file || "",
      celery_log_file: aiCfgQ.data?.celery_log_file || "",
      celery_media_log_file: aiCfgQ.data?.celery_media_log_file || "",
      timeout_sec: Number(timeoutSec) || 30,
    }),
    onSuccess: async () => { notifyOk("AI 扩展连接已保存"); await invalidate(); }, onError: (e) => notifyErr(axiosErrorDetail(e)),
  });
  const testMut = useMutation({
    mutationFn: postAiExtensionTest,
    onSuccess: (r) => {
      if (r.ok) {
        notifyOk(r.status_code != null ? `连通性 OK (HTTP ${r.status_code})` : "连通性 OK");
      } else {
        notifyErr(r.error || "不可达");
      }
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });
  const startMut = useMutation({
    mutationFn: () => postAiRuntimeStart(),
    onSuccess: async () => { notifyOk("媒体服务已启动"); await invalidate(); }, onError: (e) => notifyErr(axiosErrorDetail(e)),
  });
  const stopMut = useMutation({
    mutationFn: postAiRuntimeStop,
    onSuccess: async () => { notifyOk("媒体服务已停止"); await invalidate(); }, onError: (e) => notifyErr(axiosErrorDetail(e)),
  });
  const installMut = useMutation({
    mutationFn: async (action: "clone" | "bootstrap" | "clone_and_bootstrap" | "update") => {
      setInstallProgress("已排队…");
      setInstallPercent(0);
      setInstallLogLines([]);
      setInstallFailTail("");
      const job = await postAiInstall({
        action,
        no_start: noStart,
        use_gpu: useGpu,
      });
      return waitForInstallJob(job.job_id, openAiInstallJobEventSource, (p) => {
        setInstallPercent(p.percent);
        if (p.message) setInstallProgress(p.message);
        if (p.line != null && p.line !== "") {
          setInstallLogLines((prev) => {
            const next = [...prev, p.line as string];
            return next.length > 400 ? next.slice(-320) : next;
          });
        }
      });
    },
    onSuccess: async () => {
      notifyOk("安装任务完成");
      setInstallProgress("");
      setInstallPercent(0);
      setInstallLogLines([]);
      setInstallFailTail("");
      await invalidate();
    },
    onError: (e) => {
      if (e instanceof InstallJobFailedError) {
        const tail = String(e.result?.output_tail || "").trim();
        if (tail) setInstallFailTail(tail);
        else if (e.logLines.length) setInstallFailTail(e.logLines.join("\n"));
        notifyErr(e.message);
      } else {
        notifyErr(axiosErrorDetail(e));
      }
      setInstallProgress("");
    },
  });
  const pollJob = (jobId: string) => {
    if (pollRef.current != null) window.clearInterval(pollRef.current);
    setAssetDlActive(true);
    setAssetDlFailed(false);
    const tick = () => {
      void fetchMediaAssetsDownloadJob(jobId)
        .then((job) => {
          if (job.lines?.length) setJobLines(job.lines);
          if (job.message) setAssetDlLabel(job.message);
          if (job.progress_percent != null) {
            setAssetDlPercent(Math.max(0, Math.min(100, Number(job.progress_percent) || 0)));
          }
          const state = String(job.state || "");
          if (state === "done" || state === "failed" || state === "error") {
            if (pollRef.current != null) window.clearInterval(pollRef.current);
            pollRef.current = null;
            setAssetDlActive(false);
            if (state === "done") {
              setAssetDlPercent(100);
              setAssetDlLabel(job.message || "媒体权重下载完成");
              notifyOk(job.message || "媒体权重下载完成");
            } else {
              setAssetDlFailed(true);
              notifyErr(job.error || job.message || "媒体权重下载失败");
            }
            void qc.invalidateQueries({ queryKey: ["media-assets"] });
          }
        })
        .catch((e) => {
          if (pollRef.current != null) window.clearInterval(pollRef.current);
          pollRef.current = null;
          setAssetDlActive(false);
          setAssetDlFailed(true);
          notifyErr(axiosErrorDetail(e));
        });
    };
    tick();
    pollRef.current = window.setInterval(tick, 1000);
  };
  const downloadMut = useMutation({
    mutationFn: (assets?: string[]) => {
      setAssetDlPercent(0);
      setAssetDlLabel("已排队…");
      setJobLines([]);
      setAssetDlFailed(false);
      setAssetDlActive(true);
      return postMediaAssetsDownload(assets);
    },
    onSuccess: (job) => {
      if (job.progress_percent != null) {
        setAssetDlPercent(Math.max(0, Math.min(100, Number(job.progress_percent) || 0)));
      }
      if (job.message) setAssetDlLabel(job.message);
      if (job.lines?.length) setJobLines(job.lines);
      const state = String(job.state || "");
      if (state === "done") {
        setAssetDlActive(false);
        setAssetDlPercent(100);
        notifyOk(job.message || "媒体权重已就绪");
        void qc.invalidateQueries({ queryKey: ["media-assets"] });
        return;
      }
      if (job.job_id) pollJob(job.job_id);
      else {
        setAssetDlActive(false);
        notifyErr("下载任务未返回 job_id");
      }
    },
    onError: (e) => {
      setAssetDlActive(false);
      setAssetDlFailed(true);
      notifyErr(axiosErrorDetail(e));
    },
  });
  const deleteMut = useMutation({
    mutationFn: (assets: string[]) => postMediaAssetsDelete(assets),
    onSuccess: async () => { notifyOk("已删除选中资产"); await qc.invalidateQueries({ queryKey: ["media-assets"] }); },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });
  const singMut = useMutation({
    mutationFn: () => putSingDefaults({ default_speaker: defaultSpeaker, preferred_backend: preferredBackend }),
    onSuccess: () => notifyOk("唱歌默认已保存"), onError: (e) => notifyErr(axiosErrorDetail(e)),
  });
  const ttsMut = useMutation({
    mutationFn: () => putTtsDefaults({ ref_audio_path: ttsRef, prompt_text: ttsPrompt, prompt_lang: ttsPromptLang, text_lang: ttsTextLang }),
    onSuccess: () => notifyOk("TTS 默认已保存"), onError: (e) => notifyErr(axiosErrorDetail(e)),
  });
  const ttsTranslatorMut = useMutation({
    mutationFn: () => putTtsTranslator({
      enable: ttsTranslateEnable,
      provider: ttsTranslateProvider,
      baidu_app_id: ttsBaiduAppId,
      baidu_secret_key: ttsBaiduSecret.trim() || undefined,
      youdao_app_key: ttsYoudaoAppKey,
      youdao_app_secret: ttsYoudaoSecret.trim() || undefined,
    }),
    onSuccess: async () => {
      notifyOk("TTS 翻译配置已保存");
      await qc.invalidateQueries({ queryKey: ["tts-translator"] });
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });
  const singSaveRef = useRef(singMut.mutateAsync);
  const ttsSaveRef = useRef(ttsMut.mutateAsync);
  singSaveRef.current = singMut.mutateAsync;
  ttsSaveRef.current = ttsMut.mutateAsync;
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
    onSuccess: async (r) => { if (r.ok) notifyOk("验证码已发送"); else notifyErr(r.error || "发送失败"); await statusQ.refetch(); },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });
  const verifyMut = useMutation({
    mutationFn: () => postAiNcmVerifySms({ phone: phone.trim(), captcha: captcha.trim(), ctcode: Number(ctcode) || AI_NCM_DEFAULTS.countryCode }),
    onSuccess: async (r) => { if (r.ok) notifyOk("登录成功"); else notifyErr(r.error || "验证失败"); await statusQ.refetch(); },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });
  const logoutMut = useMutation({
    mutationFn: postAiNcmLogout,
    onSuccess: async (r) => { if (r.ok) notifyOk("已登出"); else notifyErr(r.error || "登出失败"); await statusQ.refetch(); },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });
  const busy = saveMut.isPending || testMut.isPending || startMut.isPending || stopMut.isPending || installMut.isPending ||
    downloadMut.isPending || assetDlActive || deleteMut.isPending || singMut.isPending || ttsMut.isPending ||
    ttsTranslatorMut.isPending ||
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
  const drawWorkspaceRef = useRef<PluginConfigWorkspaceHandle>(null);
  const singWorkspaceRef = useRef<PluginConfigWorkspaceHandle>(null);
  const emptyPluginStatus = {
    saving: false,
    checking: false,
    loading: true,
    hasData: false,
    supportsConfigCheck: false,
  };
  const [drawStatus, setDrawStatus] = useState(emptyPluginStatus);
  const [singPluginStatus, setSingPluginStatus] = useState(emptyPluginStatus);

  const onPluginStatusChange = useCallback(
    (
      setter: typeof setDrawStatus,
    ) => (next: Omit<PluginConfigWorkspaceHandle, "save" | "runConfigCheck">) => {
      setter((prev) => {
        if (
          prev.saving === next.saving
          && prev.checking === next.checking
          && prev.loading === next.loading
          && prev.hasData === next.hasData
          && prev.supportsConfigCheck === next.supportsConfigCheck
        ) {
          return prev;
        }
        return next;
      });
    },
    [],
  );
  const onDrawStatusChange = useMemo(() => onPluginStatusChange(setDrawStatus), [onPluginStatusChange]);
  const onSingPluginStatusChange = useMemo(
    () => onPluginStatusChange(setSingPluginStatus),
    [onPluginStatusChange],
  );

  const chromeMiddle = useMemo(() => (
    <ChromeField label="媒体配置" icon={Layers}>
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
  ), [contentPanel]);

  const chromeTrailing = useMemo(() => {
    if (contentPanel === "sing") {
      return (
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={
            busy
            || singQ.isLoading
            || singMut.isPending
            || singPluginStatus.saving
            || singPluginStatus.loading
          }
          onClick={() => {
            void (async () => {
              await singSaveRef.current();
              if (singPluginStatus.hasData) await singWorkspaceRef.current?.save();
            })();
          }}
        >
          {singMut.isPending || singPluginStatus.saving ? "保存中…" : "保存"}
        </Button>
      );
    }
    if (contentPanel === "tts") {
      return (
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={busy || ttsQ.isLoading || ttsMut.isPending}
          onClick={() => { void ttsSaveRef.current(); }}
        >
          {ttsMut.isPending ? "保存中…" : "保存"}
        </Button>
      );
    }
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
  }, [
    contentPanel,
    drawStatus,
    singPluginStatus,
    busy,
    singQ.isLoading,
    ttsQ.isLoading,
    singMut.isPending,
    ttsMut.isPending,
  ]);

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
  const canUpdate = installQ.data?.can_update === true;
  const hasUpdate = installQ.data?.has_update;
  const installPrimary = resolveAiInstallPrimary({ canClone, canBootstrap, canUpdate, hasUpdate });
  const showBootstrapSecondary = showAiInstallBootstrapSecondary({ canBootstrap, canUpdate });
  const inDocker = installQ.data?.in_docker === true;
  const runtimeLayout = runtimeQ.data?.layout || installQ.data?.layout || "";
  const localInstallUi = canManageRuntime || canClone || canBootstrap;
  const installSubtitle = aiInstallSubtitle({ localInstallUi, canClone, canUpdate, hasUpdate });
  const dockerOrRemoteHint =
    (installQ.data?.docker_hint || "").trim()
    || (inDocker || runtimeLayout === "docker" || runtimeLayout === "remote"
      ? "当前环境无法在此页安装或启停媒体服务，请在宿主机用 compose / 源码管理，本页只负责连接与测通。"
      : "");
  const aiRootPath = String(runtimeQ.data?.ai_root || installQ.data?.ai_root || "").trim();
  const singModelsRel = "resource/sing/models/<音色名>/";
  const singModelsAbs = aiRootPath
    ? `${aiRootPath.replace(/[/\\]+$/, "")}/resource/sing/models/<音色名>/`
    : "";

  const panelHelp = useMemo((): ReactNode => {
    if (contentPanel === "assets") {
      return (
        <>
          <span>下方清单是官方打包权重（可一键下载）。</span>
          <span>
            自备唱歌音色请放到媒体服务安装目录下的
            {" "}
            <code className="font-mono">{singModelsRel}</code>
            （目录名即音色 id，勿用
            {" "}
            <code className="font-mono">pretrain</code>
            ），放入
            {" "}
            <code className="font-mono">.pt</code>
            /
            <code className="font-mono">.pth</code>
            后到「唱歌」页刷新。
          </span>
          {singModelsAbs ? (
            <span className="break-all font-mono text-[11px]">{singModelsAbs}</span>
          ) : null}
        </>
      );
    }
    if (contentPanel === "sing") {
      return (
        <>
          <span>
            需安装官方扩展「牛牛唱歌」（
            <Link to="/plugin-store">插件商店</Link>
            中的 pallas-plugin-ai-media）。
          </span>
          <span>
            自备音色：在媒体服务安装目录下新建
            {" "}
            <code className="font-mono">{singModelsRel}</code>
            ，目录名即音色 id（勿占用
            {" "}
            <code className="font-mono">pretrain</code>
            ）。放入
            {" "}
            <code className="font-mono">.pt</code>
            /
            <code className="font-mono">.pth</code>
            后刷新本页，再在「音色映射」指到该 id。
          </span>
          {singModelsAbs ? (
            <span>
              当前完整路径：
              <br />
              <code className="break-all font-mono text-[11px]">{singModelsAbs}</code>
            </span>
          ) : (
            <span>尚未探测到媒体服务目录时请按相对路径放置；就绪后会显示绝对路径。</span>
          )}
        </>
      );
    }
    if (contentPanel === "tts") {
      return (
        <span>
          需安装官方扩展「牛牛说」（
          <Link to="/plugin-store">插件商店</Link>
          ）。访问密钥在「媒体服务」的连接里配置。
        </span>
      );
    }
    if (contentPanel === "draw") {
      return (
        <span>
          与插件页共享画画配置；未安装时请先到
          {" "}
          <Link to="/plugin-store">插件商店</Link>
          {" "}
          安装。
        </span>
      );
    }
    return null;
  }, [contentPanel, singModelsAbs, singModelsRel]);

  return <AiConfigSectionCard contentClassName="space-y-4">
    <AiSectionHeader
      icon={panelMeta.icon}
      title={panelMeta.label}
      lead={panelMeta.lead}
      help={panelHelp}
      helpTitle={panelMeta.label}
    />
    {installMut.isPending || installFailTail ? (
      <AiJobProgressBlock
        label={installMut.isPending ? (installProgress || "安装中…") : "安装失败"}
        percent={installPercent}
        lines={installLogLines}
        failedTail={installMut.isPending ? undefined : installFailTail}
        failed={!installMut.isPending && Boolean(installFailTail)}
      />
    ) : null}
    {panel === "service" ? (
      <StateBlock loading={serviceLoading} error={serviceError}>
        <div className="space-y-4">
          <PluginConfigFormSection
            title="安装与运行"
            subtitle={installSubtitle}
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
                <div className="grid grid-cols-2 gap-2">
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
                  <Button
                    size="sm"
                    variant={canClone ? "outline" : "default"}
                    disabled={busy || !canManageRuntime}
                    onClick={() => { void startMut.mutateAsync(); }}
                  >
                    启动
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy || !canManageRuntime} onClick={() => { void stopMut.mutateAsync(); }}>停止</Button>
                  {installPrimary.visible !== false ? (
                    <Button
                      size="sm"
                      variant={
                        installPrimary.enabled && (canClone || hasUpdate === true || hasUpdate == null)
                          ? "default"
                          : "outline"
                      }
                      disabled={busy || !installPrimary.enabled}
                      title={installPrimary.title}
                      onClick={() => { void installMut.mutateAsync(installPrimary.action); }}
                    >
                      {installPrimary.label}
                    </Button>
                  ) : null}
                  {showBootstrapSecondary ? (
                    <Button
                      size="sm"
                      variant={installPrimary.visible === false ? "outline" : "ghost"}
                      disabled={busy || !canBootstrap}
                      title="只重跑 bootstrap（不 git pull），用于修复依赖或切换 GPU 开关后重装"
                      onClick={() => { void installMut.mutateAsync("bootstrap"); }}
                    >
                      仅重装依赖
                    </Button>
                  ) : null}
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
            <div className="grid grid-cols-2 gap-3">
              <AiConfigField label="服务地址" description="例如 http://127.0.0.1:9099">
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              </AiConfigField>
              <AiConfigField label="超时（秒）" description="请求超时上限">
                <Input type="number" value={timeoutSec} onChange={(e) => setTimeoutSec(e.target.value)} />
              </AiConfigField>
              <AiConfigField
                label="Bearer Token"
                description="须与 AI 侧 PALLAS_AI_API_TOKEN 一致；供 /v1 与日志回退鉴权。"
                className="md:col-span-2"
              >
                <Input
                  type="password"
                  autoComplete="off"
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  placeholder="可留空（AI 未强制鉴权时）"
                />
              </AiConfigField>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => { void saveMut.mutateAsync(); }}>保存</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => { void testMut.mutateAsync(); }}>测试连通</Button>
            </div>
          </PluginConfigFormSection>
        </div>
      </StateBlock>
    ) : null}
    {panel === "assets" ? (
      !runtimeProbeDone ? (
        <StateBlock loading error={null}><span /></StateBlock>
      ) : !runtimeReady ? (
        <AiRuntimeNotReadyBlock
          canManage={canManageRuntime}
          busy={busy}
          onGoService={() => setPanel("service")}
          onStart={() => { void startMut.mutateAsync(); }}
        />
      ) : (
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
              {mediaQ.data?.hints?.includes("ai_unreachable") ? (
                <Badge variant="warn">媒体服务不可达，请先启动</Badge>
              ) : !mediaQ.data?.download_allowed ? (
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
                      onClick={() => { void downloadMut.mutateAsync([key]); }}
                    >
                      下载
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !asset?.ready || mediaQ.data?.delete_allowed === false}
                      onClick={() => { void deleteMut.mutateAsync([key]); }}
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
                onClick={() => { void downloadMut.mutateAsync(undefined); }}
              >
                下载全部
              </Button>
            </div>
          </PluginConfigFormSection>

          {assetDlActive || assetDlFailed || jobLines.length ? (
            <PluginConfigFormSection
              title="下载进度"
              subtitle="按资产项与下载字节估算；完成后可刷新清单。"
              bodyClassName="!grid-cols-1"
              defaultOpen
            >
              <AiJobProgressBlock
                label={
                  assetDlActive
                    ? assetDlLabel || "下载中…"
                    : assetDlFailed
                      ? assetDlLabel || "下载失败"
                      : assetDlLabel || "最近一次下载"
                }
                percent={assetDlPercent}
                lines={jobLines}
                failed={assetDlFailed}
              />
            </PluginConfigFormSection>
          ) : null}
        </div>
      </StateBlock>
      )
    ) : null}
    {panel === "sing" ? (
      !runtimeProbeDone ? (
        <StateBlock loading error={null}><span /></StateBlock>
      ) : !runtimeReady ? (
        <AiRuntimeNotReadyBlock
          canManage={canManageRuntime}
          busy={busy}
          onGoService={() => setPanel("service")}
          onStart={() => { void startMut.mutateAsync(); }}
        />
      ) : (
      <div className="space-y-4">
        <StateBlock loading={singQ.isLoading} error={singQ.error}>
          <div className="space-y-4">
            <PluginConfigFormSection
              title="运行概况"
              subtitle="已探测到的音色目录与可用推理方式。"
              bodyClassName="!grid-cols-1 gap-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  音色 {singQ.data?.speakers.speakers?.length ?? 0} 个
                </Badge>
                <Badge variant="outline">
                  推理方式 {singQ.data?.backends.backends?.length ?? 0} 个
                </Badge>
              </div>
              <p className="break-all font-mono text-[11px] text-muted-foreground">
                {(singQ.data?.backends.backends || []).map((b) => b.id).join(", ") || "暂无推理方式"}
              </p>
              {(singQ.data?.speakers.speakers || []).length ? (
                <ul className="space-y-1 rounded-[var(--radius-control,8px)] border bg-muted/20 px-3 py-2 text-[11px]">
                  {(singQ.data?.speakers.speakers || []).map((row) => (
                    <li key={row.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-mono font-medium">{row.id}</span>
                      <Badge variant={row.ready ? "success" : "secondary"} className="text-[10px]">
                        {row.ready ? "就绪" : "未就绪"}
                      </Badge>
                      {row.path ? (
                        <span className="break-all font-mono text-muted-foreground">{row.path}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  尚未探测到音色。请确认已下载官方
                  {" "}
                  <code className="font-mono text-[11px]">sing_pallas</code>
                  {" "}
                  资产，或按标题旁说明放入自备模型。
                </p>
              )}
            </PluginConfigFormSection>

            <PluginConfigFormSection
              title="默认设置"
              subtitle="点歌时未指定音色或推理方式时使用。"
              bodyClassName="!grid-cols-1 gap-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <AiConfigField label="默认音色" description="未指定时使用的唱歌音色。">
                  <AiOptionSelect
                    value={defaultSpeaker}
                    options={speakerOptions}
                    placeholder="选择音色"
                    emptyLabel="（未指定）"
                    onValueChange={setDefaultSpeaker}
                  />
                </AiConfigField>
                <AiConfigField label="优先推理方式" description="首选的唱歌推理实现；失败时仍会自动尝试其它可用方式。">
                  <AiOptionSelect
                    value={preferredBackend}
                    options={backendOptions}
                    placeholder="选择推理方式"
                    emptyLabel="（未指定）"
                    onValueChange={setPreferredBackend}
                  />
                </AiConfigField>
              </div>
            </PluginConfigFormSection>
          </div>
        </StateBlock>
        <PluginConfigFormSection
          title="音色映射"
          subtitle="口令里的名字对应到媒体服务里的音色 id。"
          bodyClassName="!grid-cols-1 gap-3"
          defaultOpen
        >
          <PluginConfigWorkspace
            ref={singWorkspaceRef}
            pluginName="sing"
            presentation="dialog"
            compact
            includeFields={["sing_speakers"]}
            onStatusChange={onSingPluginStatusChange}
          />
          <PluginConfigElsewhereHint
            pluginName="sing"
            label="唱歌"
            extras="启停、默认合成时长、任务模式等其它项"
          />
        </PluginConfigFormSection>
      </div>
      )
    ) : null}

    {panel === "tts" ? (
      !runtimeProbeDone ? (
        <StateBlock loading error={null}><span /></StateBlock>
      ) : !runtimeReady ? (
        <AiRuntimeNotReadyBlock
          canManage={canManageRuntime}
          busy={busy}
          onGoService={() => setPanel("service")}
          onStart={() => { void startMut.mutateAsync(); }}
        />
      ) : (
      <div className="space-y-4">
        <StateBlock loading={ttsQ.isLoading} error={ttsQ.error}>
          <div className="space-y-4">
            <PluginConfigFormSection
              title="音色概况"
              subtitle="可用的参考音频。"
              bodyClassName="!grid-cols-1 gap-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">音色 {ttsQ.data?.voices?.length ?? 0} 个</Badge>
              </div>
            </PluginConfigFormSection>

            <PluginConfigFormSection
              title="默认音色"
              subtitle="「牛牛说」未另外指定时使用的参考音频与语种。"
              bodyClassName="!grid-cols-1 gap-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <AiConfigField label="参考音频" description="用于模仿说话风格的样例音频。" className="md:col-span-2">
                  <AiOptionSelect
                    value={ttsRef}
                    options={voicePathOptions}
                    placeholder="选择参考音频"
                    emptyLabel="（未指定）"
                    onValueChange={setTtsRef}
                  />
                </AiConfigField>
                <AiConfigField
                  label="提示文本"
                  description="参考音频里实际说的内容，用来对齐音色。"
                  className="md:col-span-2"
                >
                  <Input
                    value={ttsPrompt}
                    onChange={(e) => setTtsPrompt(e.target.value)}
                    placeholder="与参考音频一致的原文"
                  />
                </AiConfigField>
                <AiConfigField label="提示语种" description="参考音频本身的语种（与提示文本一致）。例如参考音是日语样例，选日语。">
                  <AiOptionSelect
                    value={ttsPromptLang}
                    options={TTS_LANG_OPTIONS}
                    placeholder="选择语种"
                    allowEmpty={false}
                    onValueChange={setTtsPromptLang}
                  />
                </AiConfigField>
                <AiConfigField
                  label="合成语种"
                  description={
                    "要念的文字语种，作默认与兜底。"
                    + "开启下方「中译日」且翻译成功时，会自动按日语合成，不必改成日语；"
                    + "翻译失败或关闭中译日时，按这里的设置念原文——中文输入请保持「中文」，以免中文被当成日语切分。"
                  }
                >
                  <AiOptionSelect
                    value={ttsTextLang}
                    options={TTS_LANG_OPTIONS}
                    placeholder="选择语种"
                    allowEmpty={false}
                    onValueChange={setTtsTextLang}
                  />
                </AiConfigField>
              </div>
            </PluginConfigFormSection>

            <PluginConfigFormSection
              title="中文转日语"
              subtitle="念之前可选先把中文译成日文（部分音色更适合日语）。译成功会自动按日语合成；译失败则退回原文并用上方「合成语种」。密钥保存在媒体服务；留空密钥表示不改已有值。尚未在本页保存过时，会沿用安装目录里的默认配置。"
              bodyClassName="!grid-cols-1 gap-3"
            >
              <StateBlock loading={ttsTranslatorQ.isLoading} error={ttsTranslatorQ.error}>
                <div className="space-y-3">
                  <AiConfigField
                    label="启用中译日"
                    description={
                      "开：先把中文译成日文再合成（成功时自动按日语，与上方「合成语种」无关）。"
                      + "关：直接按「合成语种」念原文。"
                      + "翻译失败时仍用原文 +「合成语种」，故中文场景建议合成语种保持中文。"
                    }
                  >
                    <div className="flex min-h-9 flex-wrap items-center gap-2">
                      <Switch checked={ttsTranslateEnable} onCheckedChange={setTtsTranslateEnable} />
                      {ttsTranslatorQ.data?.source ? (
                        <span className="text-xs text-muted-foreground">
                          当前生效：
                          {ttsTranslatorQ.data.source === "disk" ? "本页已保存" : "安装目录默认配置"}
                        </span>
                      ) : null}
                    </div>
                  </AiConfigField>
                  <div className="grid grid-cols-2 gap-3">
                    <AiConfigField label="翻译服务" description="百度或有道（一般有免费额度）。">
                      <AiOptionSelect
                        value={ttsTranslateProvider}
                        options={[
                          { value: "baidu", label: "百度" },
                          { value: "youdao", label: "有道" },
                        ]}
                        placeholder="选择服务"
                        emptyLabel="（未指定）"
                        onValueChange={setTtsTranslateProvider}
                      />
                    </AiConfigField>
                    {ttsTranslateProvider === "youdao" ? (
                      <>
                        <AiConfigField label="有道 App Key" description="有道开放平台里的应用 Key。">
                          <Input value={ttsYoudaoAppKey} onChange={(e) => setTtsYoudaoAppKey(e.target.value)} />
                        </AiConfigField>
                        <AiConfigField
                          label="有道密钥"
                          description={ttsYoudaoSecretConfigured ? "已配置；留空则不改。" : "有道应用密钥。"}
                          className="md:col-span-2"
                        >
                          <Input
                            type="password"
                            autoComplete="new-password"
                            value={ttsYoudaoSecret}
                            onChange={(e) => setTtsYoudaoSecret(e.target.value)}
                            placeholder={ttsYoudaoSecretConfigured ? "已配置，留空不改" : ""}
                          />
                        </AiConfigField>
                      </>
                    ) : (
                      <>
                        <AiConfigField label="百度 App ID" description="百度翻译开放平台里的应用 ID。">
                          <Input value={ttsBaiduAppId} onChange={(e) => setTtsBaiduAppId(e.target.value)} />
                        </AiConfigField>
                        <AiConfigField
                          label="百度密钥"
                          description={ttsBaiduSecretConfigured ? "已配置；留空则不改。" : "百度翻译密钥。"}
                          className="md:col-span-2"
                        >
                          <Input
                            type="password"
                            autoComplete="new-password"
                            value={ttsBaiduSecret}
                            onChange={(e) => setTtsBaiduSecret(e.target.value)}
                            placeholder={ttsBaiduSecretConfigured ? "已配置，留空不改" : ""}
                          />
                        </AiConfigField>
                      </>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy || ttsTranslatorQ.isLoading || ttsTranslatorMut.isPending || ttsTranslatorQ.data?.writable === false}
                    onClick={() => void ttsTranslatorMut.mutateAsync()}
                  >
                    {ttsTranslatorMut.isPending ? "保存中…" : "保存翻译配置"}
                  </Button>
                </div>
              </StateBlock>
            </PluginConfigFormSection>
          </div>
        </StateBlock>
        <PluginConfigFormSection
          title="其它设置"
          subtitle="启停、超时与字数上限等。"
          bodyClassName="!grid-cols-1 gap-3"
          defaultOpen
        >
          <PluginConfigElsewhereHint
            pluginName="tts"
            label="牛牛说"
            extras="启停、超时、字数上限等"
          />
        </PluginConfigFormSection>
      </div>
      )
    ) : null}

    {panel === "draw" ? (
      <div className="space-y-4">
        <PluginConfigFormSection
          title="画画网关"
          subtitle="主线与备用画图线路。"
          bodyClassName="!grid-cols-1 gap-3"
          defaultOpen
        >
          <PluginConfigWorkspace
            ref={drawWorkspaceRef}
            pluginName="draw"
            presentation="dialog"
            compact
            includeFields={[]}
            includeGateways
            onStatusChange={onDrawStatusChange}
          />
          <PluginConfigElsewhereHint
            pluginName="draw"
            label="画画"
            extras="模型、默认尺寸、冷却等其它项"
          />
        </PluginConfigFormSection>
      </div>
    ) : null}

    {panel === "ncm" ? (
      !runtimeProbeDone ? (
        <StateBlock loading error={null}><span /></StateBlock>
      ) : !runtimeReady ? (
        <AiRuntimeNotReadyBlock
          canManage={canManageRuntime}
          busy={busy}
          onGoService={() => setPanel("service")}
          onStart={() => { void startMut.mutateAsync(); }}
        />
      ) : (
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
          <div className="grid grid-cols-2 gap-3">
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
              onClick={() => { void sendMut.mutateAsync(); }}
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
              onClick={() => { void verifyMut.mutateAsync(); }}
            >
              验证登录
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !loggedIn}
              onClick={() => { void logoutMut.mutateAsync(); }}
            >
              登出
            </Button>
          </div>
        </PluginConfigFormSection>
      </div>
      )
    ) : null}
  </AiConfigSectionCard>;
}
