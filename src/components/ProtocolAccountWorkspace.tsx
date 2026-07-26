import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { NapcatAccountRow, SystemData } from "@/api/pallasTypes";
import { copyTextToClipboard } from "@/utils/clipboard";
import {
  accountConnectedWsPortLabel,
  accountSnowlumaNovncHref,
  accountWebUiHref,
  snowlumaManagedWebuiPassword,
  snowlumaNovncPasswordHint,
  snowlumaRuntimeWebuiPassword,
} from "@/utils/protocolLinks";
import {
  protocolApiErrorMessage,
  protocolDeleteAccount,
  protocolFetchAccount,
  protocolFetchAccountConfigs,
  protocolFetchAccountLogs,
  protocolFetchQrcodeImageBlob,
  protocolFetchQrcodeMeta,
  protocolListSnowlumaRuntimes,
  protocolRefreshAccountQrcode,
  protocolRestartAccount,
  protocolSnowlumaInjectHook,
  protocolStartAccount,
  protocolStopAccount,
  protocolSwitchAccountRuntime,
  protocolUpdateAccount,
  protocolUpdateAccountConfigs,
  type SnowlumaRuntimeRow,
} from "@/api/protocol";
import CopyIconButton from "@/components/CopyIconButton";
import ProtocolDockerImageSelect from "@/components/protocol/ProtocolDockerImageSelect";
import PluginConfigFormSection from "@/components/config/PluginConfigFormSection";
import SettingsFormField from "@/components/config/SettingsFormField";
import ConsoleDeleteConfirmModal from "@/components/ConsoleDeleteConfirmModal";
import SegTabs from "@/components/SegTabs";
import UiInput from "@/components/ui/UiInput";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { pushConsoleToast } from "@/utils/consoleToast";
import {
  protocolAccountIsLinuxDocker,
  protocolBackendDisplayName,
  protocolRuntimeModeLabel,
  protocolRuntimeVersionText,
} from "@/utils/protocolUi";
import { Cable, Server, Tag } from "lucide-react";

export type ProtocolAccountTab = "overview" | "settings";

export type ProtocolAccountHeaderProfile = {
  displayName: string;
  qq: string;
  backendLabel: string;
  runtimeModeLabel: string;
  processRunning: boolean;
  connected: boolean;
};

export type ProtocolAccountWorkspaceHandle = {
  saveSettings: () => Promise<void>;
  saveBusy: boolean;
  loadBusy: boolean;
  pageTitle: string;
  statusLine: string;
  headerProfile: ProtocolAccountHeaderProfile;
};

const PROTOCOL_LOG_QR_LINE_RE = /^[\s\u2580-\u259F]+$/u;

function isProtocolLogQrLine(line: string): boolean {
  const t = line.replace(/\s+$/u, "");
  if (t.length < 10) return false;
  if (!PROTOCOL_LOG_QR_LINE_RE.test(t)) return false;
  return t.replace(/\s/gu, "").length >= 10;
}

type ProtocolLogSegment = { kind: "text" | "qr"; text: string };

function segmentProtocolLogLines(lines: string[]): ProtocolLogSegment[] {
  if (!lines.length) return [];
  const out: ProtocolLogSegment[] = [];
  let kind: "text" | "qr" | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (!kind || !buf.length) return;
    out.push({ kind, text: buf.join("\n") });
    buf = [];
  };
  for (const line of lines) {
    const next: "text" | "qr" = isProtocolLogQrLine(line) ? "qr" : "text";
    if (kind != null && kind !== next) flush();
    kind = next;
    buf.push(line);
  }
  flush();
  return out;
}

type Props = {
  accountId: string;
  mountUrl: string | null;
  system?: SystemData | null;
  activeTab: ProtocolAccountTab;
  onActiveTabChange: (tab: ProtocolAccountTab) => void;
  presentation?: "dialog" | "embedded";
  /** dialog 标题栏已放切换时隐藏内容区 tab */
  hideTabNav?: boolean;
  onDeleted?: () => void;
  onAccountLoaded?: (row: NapcatAccountRow) => void;
  onNotify?: (message: string, level?: "ok" | "warn" | "err") => void;
};

const ProtocolAccountWorkspace = forwardRef<ProtocolAccountWorkspaceHandle, Props>(
  function ProtocolAccountWorkspace(
    {
      accountId,
      mountUrl,
      system = null,
      activeTab,
      onActiveTabChange,
      presentation = "embedded",
      hideTabNav = false,
      onDeleted,
      onAccountLoaded,
      onNotify,
    },
    ref,
  ) {
    const isDialog = presentation === "dialog";
    const showTabNav = !hideTabNav;
    const logPreRef = useRef<HTMLPreElement>(null);

    const [account, setAccount] = useState<NapcatAccountRow | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [loadBusy, setLoadBusy] = useState(false);
    const [actionBusy, setActionBusy] = useState(false);
    const [injectBusy, setInjectBusy] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteErr, setDeleteErr] = useState("");
    const [saveBusy, setSaveBusy] = useState(false);
    const [systemLocal, setSystemLocal] = useState<SystemData | null>(system);

    const [displayName, setDisplayName] = useState("");
    const [webuiPort, setWebuiPort] = useState("");
    const [wsUrl, setWsUrl] = useState("");
    const [wsName, setWsName] = useState("");
    const [wsToken, setWsToken] = useState("");
    const [targetBackend, setTargetBackend] = useState<"napcat" | "snowluma">("napcat");
    const [napcatDockerImage, setNapcatDockerImage] = useState("");
    const [snowlumaDockerImage, setSnowlumaDockerImage] = useState("");
    const [bypassEnabled, setBypassEnabled] = useState(false);
    const [runtimeMode, setRuntimeMode] = useState<"new" | "existing">("new");
    const [runtimeId, setRuntimeId] = useState("");
    const [snowlumaRuntimes, setSnowlumaRuntimes] = useState<SnowlumaRuntimeRow[]>([]);
    const [savedRuntimeSettings, setSavedRuntimeSettings] = useState("");
    const [savedBypassEnabled, setSavedBypassEnabled] = useState(false);
    const [savedConnectionSettings, setSavedConnectionSettings] = useState("");

    const [qrHint, setQrHint] = useState("");
    const [qrExists, setQrExists] = useState(false);
    const [qrUpdatedAt, setQrUpdatedAt] = useState(0);
    const [qrRefreshBusy, setQrRefreshBusy] = useState(false);
    const [qrImageUrl, setQrImageUrl] = useState("");
    const [followLogTail, setFollowLogTail] = useState(true);

    const resolvedSystem = system ?? systemLocal;

    const pageTitle = useMemo(() => {
      const name = (account?.display_name || "").trim();
      return name || `账号 ${accountId}`;
    }, [account, accountId]);

    const isLinuxDocker = protocolAccountIsLinuxDocker(account as Record<string, unknown> | null);

    const headerProfile = useMemo((): ProtocolAccountHeaderProfile => {
      const qq = String(account?.qq ?? accountId);
      const row = (account ?? {}) as Record<string, unknown>;
      return {
        displayName: pageTitle,
        qq,
        backendLabel: account ? protocolBackendDisplayName(account) : "—",
        runtimeModeLabel: account ? protocolRuntimeModeLabel(row) : "—",
        processRunning: account?.process_running === true,
        connected: account?.connected === true,
      };
    }, [account, accountId, pageTitle]);

    const statusLine = useMemo(() => {
      const a = account;
      if (!a) return "加载中…";
      if (a.process_running) {
        let s = "运行中";
        if (!isLinuxDocker && a.pid != null) s += ` · PID ${a.pid}`;
        else if (isLinuxDocker) s += " · 容器";
        if (a.connected) s += " · 已连接";
        return s;
      }
      if (a.connected) return "已连接（进程可能已脱离）";
      if (a.launch_ready) return "已停止";
      const issues = Array.isArray(a.launch_issues) ? a.launch_issues.join("; ") : "";
      return issues || "未就绪";
    }, [account, isLinuxDocker]);

    const isSnowluma = String(account?.protocol_backend ?? "").toLowerCase() === "snowluma";
    const isAccountConnected = account?.connected === true;

    const displayQrHint = qrRefreshBusy
      ? qrHint || "正在恢复登录…"
      : isAccountConnected
        ? "登录成功 · Bot 已连接"
        : qrHint || "加载中…";

    const showQrImage = !isAccountConnected && qrExists && Boolean(qrImageUrl);
    const isSnowlumaDocker = isLinuxDocker && isSnowluma;
    const snowlumaNovncHref = accountSnowlumaNovncHref(account, resolvedSystem);
    const snowlumaManagedPassword = snowlumaManagedWebuiPassword(account);
    const snowlumaInitialPassword = (() => {
      const initial = snowlumaRuntimeWebuiPassword(account);
      const managed = snowlumaManagedPassword;
      if (!initial || initial === managed) return "";
      return initial;
    })();
    const snowlumaWebuiUser =
      String(account?.snowluma_webui_default_user ?? "admin").trim() || "admin";
    const snowlumaNovncHint = snowlumaNovncPasswordHint(account);
    const showSnowlumaAccess =
      isSnowluma &&
      Boolean(
        snowlumaNovncHref ||
          isSnowlumaDocker ||
          snowlumaManagedPassword ||
          snowlumaInitialPassword,
      );
    const webUiHref = account ? accountWebUiHref(account, resolvedSystem) : null;
    const wsPortLabel = account ? accountConnectedWsPortLabel(account) : "—";
    const runtimeVersion = account ? protocolRuntimeVersionText(account) : "—";
    const nativeWebUiLabel = "原生 WebUI";
    const nativeWebUiAuthNote = String(account?.native_webui_auth_note ?? "").trim();

    const overviewFacts = useMemo(() => {
      const rows: Array<{ label: string; value: string; mono: boolean }> = [
        { label: "实例名", value: (account?.display_name || "").trim() || "—", mono: false },
      ];
      if (!isLinuxDocker) {
        rows.push({ label: "PID", value: account?.pid != null ? String(account.pid) : "—", mono: true });
      }
      rows.push(
        { label: "版本", value: runtimeVersion || "—", mono: false },
        { label: "WS 端口", value: wsPortLabel || "—", mono: true },
      );
      return rows;
    }, [account?.display_name, account?.pid, isLinuxDocker, runtimeVersion, wsPortLabel]);

    const overviewSecrets = useMemo(() => {
      const rows: Array<{
        label: string;
        secret: string;
        copyText: string;
        plain?: boolean;
      }> = [];
      if (!isSnowluma) return rows;
      if (snowlumaManagedPassword) {
        rows.push({
          label: "托管密码",
          secret: snowlumaManagedPassword,
          copyText: snowlumaManagedPassword,
        });
      }
      if (snowlumaInitialPassword) {
        rows.push({
          label: "初始密码",
          secret: snowlumaInitialPassword,
          copyText: snowlumaInitialPassword,
        });
      }
      if (snowlumaNovncHref) {
        rows.push({
          label: "VNC 密码",
          secret: snowlumaNovncHint,
          copyText: snowlumaNovncHint,
        });
      } else if (isSnowlumaDocker) {
        rows.push({
          label: "SL 桌面",
          secret: "未发布 noVNC 端口",
          copyText: "",
          plain: true,
        });
      }
      return rows;
    }, [
      isSnowluma,
      isSnowlumaDocker,
      snowlumaInitialPassword,
      snowlumaManagedPassword,
      snowlumaNovncHint,
      snowlumaNovncHref,
    ]);

    const logSegments = useMemo(() => segmentProtocolLogLines(logs), [logs]);

    function notify(message: string, level: "ok" | "warn" | "err" = "ok") {
      onNotify?.(message, level);
      pushConsoleToast(message, level);
    }

    function revokeQrUrl() {
      setQrImageUrl((prev) => {
        if (prev) {
          try {
            URL.revokeObjectURL(prev);
          } catch {
            /* ignore */
          }
        }
        return "";
      });
    }

    async function loadQrImage(ts: number) {
      if (!mountUrl || !accountId) return;
      const blob = await protocolFetchQrcodeImageBlob(mountUrl, accountId, ts || undefined);
      revokeQrUrl();
      setQrImageUrl(URL.createObjectURL(blob));
    }

    async function refreshQrcode(force = false) {
      if (!mountUrl || !accountId || qrRefreshBusy) return;
      if (force) {
        setQrRefreshBusy(true);
        setQrHint("正在恢复登录…");
      }
      try {
        const meta = force
          ? await protocolRefreshAccountQrcode(mountUrl, accountId)
          : await protocolFetchQrcodeMeta(mountUrl, accountId);
        if (meta.login_mode === "quick_login") {
          setQrExists(false);
          revokeQrUrl();
          setQrHint(meta.message || "已点击 QQ「登录」，请稍候确认上线");
          if (meta.inject_hook) {
            notify("已自动注入 SnowLuma Hook", "ok");
            await loadAccount(false);
          } else if (meta.inject_hook_error) {
            notify(meta.inject_hook_error, "warn");
          }
          return;
        }
        const nowExists = meta.exists === true;
        const ts = meta.updated_at ?? 0;
        if (nowExists && (force || ts !== qrUpdatedAt)) {
          setQrUpdatedAt(ts);
          await loadQrImage(force ? Date.now() : ts);
        }
        setQrExists(nowExists);
        if (account?.connected) {
          setQrHint("登录成功 · Bot 已连接");
        } else {
          setQrHint(
            nowExists
              ? `更新于 ${new Date((ts || Date.now() / 1000) * 1000).toLocaleString()} · 可直接扫码`
              : meta.message || "暂无二维码；可点「恢复登录」尝试一键登录或刷新二维码",
          );
        }
      } catch (e) {
        if (force) {
          setQrExists(false);
          revokeQrUrl();
          setQrHint(protocolApiErrorMessage(e, "恢复登录失败"));
        }
      } finally {
        if (force) setQrRefreshBusy(false);
      }
    }

    async function loadAccount(brief = false) {
      if (!mountUrl || !accountId) return;
      if (!brief) setLoadBusy(true);
      try {
        const row = await protocolFetchAccount(mountUrl, accountId, { brief });
        if (!row) throw new Error("账号不存在");
        setAccount(row);
        onAccountLoaded?.(row);
        if (!brief) {
          const nextDisplayName = String(row.display_name ?? "");
          const nextWebuiPort = row.webui_port != null ? String(row.webui_port) : "";
          const nextWsUrl = String(row.ws_url ?? "");
          const nextWsName = String(row.ws_name ?? "");
          const nextWsToken = String(row.ws_token ?? "");
          setDisplayName(nextDisplayName);
          setWebuiPort(nextWebuiPort);
          setWsUrl(nextWsUrl);
          setWsName(nextWsName);
          setWsToken(nextWsToken);
          setSavedConnectionSettings(
            JSON.stringify({
              display_name: nextDisplayName.trim(),
              webui_port: nextWebuiPort.trim(),
              ws_url: nextWsUrl.trim(),
              ws_name: nextWsName.trim(),
              ws_token: nextWsToken,
            }),
          );
          const nextBackend =
            String(row.protocol_backend ?? "").trim().toLowerCase() === "snowluma"
              ? "snowluma"
              : "napcat";
          const nextDockerImage = String(row.docker_image ?? "");
          const nextSnowlumaDockerImage = String(row.snowluma_docker_image ?? "");
          const nextRuntimeId = String(row.snowluma_runtime_id ?? "");
          const nextRuntimeMode: "new" | "existing" = nextRuntimeId ? "existing" : "new";
          setTargetBackend(nextBackend);
          setNapcatDockerImage(nextDockerImage);
          setSnowlumaDockerImage(nextSnowlumaDockerImage);
          setRuntimeId(nextRuntimeId);
          setRuntimeMode(nextRuntimeMode);
          setSavedRuntimeSettings(
            JSON.stringify({
              protocol_backend: nextBackend,
              docker_image: nextDockerImage.trim(),
              snowluma_docker_image: nextSnowlumaDockerImage.trim(),
              runtime_mode: nextRuntimeMode,
              runtime_id: nextRuntimeId.trim(),
            }),
          );
          const [configs, runtimes] = await Promise.all([
            protocolFetchAccountConfigs(mountUrl, accountId),
            protocolListSnowlumaRuntimes(mountUrl),
          ]);
          const nextBypass = configs.napcat?.bypass_enabled === true;
          setBypassEnabled(nextBypass);
          setSavedBypassEnabled(nextBypass);
          setSnowlumaRuntimes(runtimes);
        }
      } catch (e) {
        notify(protocolApiErrorMessage(e, "加载账号失败"), "err");
      } finally {
        if (!brief) setLoadBusy(false);
      }
    }

    function runtimeSettingsKey(): string {
      return JSON.stringify({
        protocol_backend: targetBackend,
        docker_image: napcatDockerImage.trim(),
        snowluma_docker_image: snowlumaDockerImage.trim(),
        runtime_mode: runtimeMode,
        runtime_id: runtimeId.trim(),
      });
    }

    function connectionSettingsKey(): string {
      return JSON.stringify({
        display_name: displayName.trim(),
        webui_port: webuiPort.trim(),
        ws_url: wsUrl.trim(),
        ws_name: wsName.trim(),
        ws_token: wsToken,
      });
    }

    function validateRuntimeSettings(): string | null {
      if (targetBackend !== "snowluma" || runtimeMode !== "existing") return null;
      const selectedRuntimeId = runtimeId.trim();
      if (!selectedRuntimeId) return "请选择 Runtime";
      if (!snowlumaRuntimes.some((runtime) => runtime.id === selectedRuntimeId)) {
        return "所选 Runtime 不存在或已被删除";
      }
      return null;
    }

    async function loadLogs() {
      if (!mountUrl || !accountId) return;
      try {
        const next = await protocolFetchAccountLogs(mountUrl, accountId, 120);
        setLogs(next);
        scrollLogsToBottom();
      } catch {
        /* polling */
      }
    }

    function isLogPreNearBottom(el: HTMLElement): boolean {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      return gap <= Math.max(48, Math.floor(el.clientHeight * 0.12));
    }

    function scrollLogsToBottom(force = false) {
      if (!force && !followLogTail) return;
      const el = logPreRef.current;
      if (!el) return;
      const apply = () => {
        el.scrollTop = el.scrollHeight;
      };
      apply();
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          apply();
          window.requestAnimationFrame(apply);
        });
      }
    }

    function onLogPreScroll() {
      const el = logPreRef.current;
      if (!el) return;
      setFollowLogTail(isLogPreNearBottom(el));
    }

    async function runAction(kind: "start" | "stop" | "restart") {
      if (!mountUrl || !accountId || actionBusy) return;
      setActionBusy(true);
      try {
        if (kind === "start") await protocolStartAccount(mountUrl, accountId);
        else if (kind === "stop") await protocolStopAccount(mountUrl, accountId);
        else await protocolRestartAccount(mountUrl, accountId);
        notify("操作已提交", "ok");
        await loadAccount(false);
        if (kind !== "stop") void refreshQrcode(true);
      } catch (e) {
        notify(protocolApiErrorMessage(e, "操作失败"), "err");
      } finally {
        setActionBusy(false);
      }
    }

    async function saveSettings() {
      if (!mountUrl || !accountId || saveBusy) return;
      const runtimeError = validateRuntimeSettings();
      if (runtimeError) {
        notify(runtimeError, "warn");
        return;
      }
      const runtimeChanged = runtimeSettingsKey() !== savedRuntimeSettings;
      const connectionChanged = connectionSettingsKey() !== savedConnectionSettings;
      setSaveBusy(true);
      try {
        if (runtimeChanged) {
          await protocolSwitchAccountRuntime(mountUrl, accountId, {
            protocol_backend: targetBackend,
            docker_image:
              targetBackend === "napcat" ? napcatDockerImage.trim() || undefined : undefined,
            ...(targetBackend === "snowluma"
              ? { snowluma_docker_image: snowlumaDockerImage.trim() }
              : {}),
            runtime_mode: runtimeMode,
            runtime_id: runtimeId.trim() || undefined,
          });
        }
        if (connectionChanged) {
          const body: Record<string, unknown> = {
            display_name: displayName.trim(),
            ws_url: wsUrl.trim(),
            ws_name: wsName.trim(),
            ws_token: wsToken,
          };
          const wp = parseInt(webuiPort.trim(), 10);
          if (webuiPort.trim() && !Number.isNaN(wp)) body.webui_port = wp;
          await protocolUpdateAccount(mountUrl, accountId, body, true);
        }
        if (bypassEnabled !== savedBypassEnabled) {
          await protocolUpdateAccountConfigs(mountUrl, accountId, {
            napcat: { bypass_enabled: bypassEnabled },
          });
        }
        notify("已保存并重启协议进程", "ok");
        await loadAccount(false);
      } catch (e) {
        notify(protocolApiErrorMessage(e, "保存失败"), "err");
      } finally {
        setSaveBusy(false);
      }
    }

    async function injectHook() {
      if (!mountUrl || !accountId || injectBusy) return;
      setInjectBusy(true);
      try {
        await protocolSnowlumaInjectHook(mountUrl, accountId);
        notify("SnowLuma Hook 注入成功", "ok");
        await loadAccount(false);
      } catch (e) {
        notify(protocolApiErrorMessage(e, "注入失败"), "err");
      } finally {
        setInjectBusy(false);
      }
    }

    function openDeleteModal() {
      setDeleteErr("");
      setDeleteModalOpen(true);
    }

    function closeDeleteModal() {
      if (deleteBusy) return;
      setDeleteModalOpen(false);
      setDeleteErr("");
    }

    async function confirmDeleteAccount() {
      if (!mountUrl || !accountId) return;
      setDeleteBusy(true);
      setDeleteErr("");
      try {
        await protocolDeleteAccount(mountUrl, accountId);
        notify("账号已删除", "ok");
        setDeleteModalOpen(false);
        onDeleted?.();
      } catch (e) {
        setDeleteErr(protocolApiErrorMessage(e, "删除失败"));
      } finally {
        setDeleteBusy(false);
      }
    }

    const deleteModalWarnings = useMemo(() => {
      if (!account) return [];
      const out: string[] = [];
      if (account.process_running === true || account.running === true) {
        out.push(`账号 ${accountId} 进程仍在运行。删除前将尝试停止，请确认。`);
      }
      if (account.connected === true) {
        out.push(`账号 ${accountId} 当前仍在线连接。删除后可能导致运行异常，请确认。`);
      }
      return out;
    }, [account, accountId]);

    async function copySnowlumaSecret(label: string, text: string) {
      const ok = await copyTextToClipboard(text);
      notify(ok ? `${label}已复制` : "复制失败", ok ? "ok" : "err");
    }

    async function copyProcessLogs() {
      const text = logs.join("\n").trim();
      if (!text) {
        notify("暂无日志可复制", "warn");
        return;
      }
      const ok = await copyTextToClipboard(text);
      notify(ok ? "日志已复制" : "复制失败", ok ? "ok" : "err");
    }

    const saveSettingsRef = useRef(saveSettings);
    saveSettingsRef.current = saveSettings;

    useImperativeHandle(
      ref,
      () => ({
        saveSettings: () => saveSettingsRef.current(),
        saveBusy,
        loadBusy,
        pageTitle,
        statusLine,
        headerProfile,
      }),
      [saveBusy, loadBusy, pageTitle, statusLine, headerProfile],
    );

    useEffect(() => {
      if (system) setSystemLocal(system);
    }, [system]);

    useEffect(() => {
      revokeQrUrl();
      setAccount(null);
      setLogs([]);
      setFollowLogTail(true);
      if (!accountId || !mountUrl) return;

      void (async () => {
        await loadAccount(true);
        void loadAccount(false);
        void refreshQrcode(false);
        void loadLogs();
      })();

      const qrPollTimer = setInterval(() => void refreshQrcode(false), 8000);
      const logsPollTimer = setInterval(() => void loadLogs(), 5000);
      return () => {
        clearInterval(qrPollTimer);
        clearInterval(logsPollTimer);
        revokeQrUrl();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- remount on account/mount
    }, [accountId, mountUrl]);

    useEffect(() => {
      if (activeTab === "overview") scrollLogsToBottom(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    if (loadBusy && !account) {
      return <div className="protocol-account-workspace__loading muted">加载账号信息…</div>;
    }

    return (
      <>
      <div
        className={`protocol-account-workspace${isDialog ? " protocol-account-workspace--dialog" : ""}`}
      >
        {showTabNav ? (
          <nav className="protocol-account-workspace__tabs" aria-label="账号分区">
            {isDialog ? (
              <div className="protocol-account-workspace__portal-tabs" role="tablist" aria-label="账号分区">
                {(
                  [
                    { id: "overview", label: "概览" },
                    { id: "settings", label: "设置" },
                  ] as const
                ).map((tab) => {
                  const on = activeTab === tab.id;
                  return (
                    <Button
                      key={tab.id}
                      type="button"
                      size="sm"
                      role="tab"
                      aria-selected={on}
                      variant={on ? "secondary" : "ghost"}
                      className={cn(
                        "h-8 min-w-[4.5rem] px-3 text-xs",
                        on ? "font-medium" : "text-muted-foreground",
                      )}
                      onClick={() => onActiveTabChange(tab.id)}
                    >
                      {tab.label}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <SegTabs
                full
                ariaLabel="账号分区"
                value={activeTab}
                onValueChange={(v) => onActiveTabChange(v === "settings" ? "settings" : "overview")}
                options={[
                  { value: "overview", label: "概览" },
                  { value: "settings", label: "设置" },
                ]}
              />
            )}
          </nav>
        ) : null}

        {activeTab === "overview" ? (
          <section className="protocol-account-workspace__section" aria-label="账号概览">
            {isDialog ? (
              <div className="protocol-account-workspace__overview">
                <div className="protocol-account-workspace__overview-body">
                  <div className="protocol-account-workspace__overview-main">
                    {showQrImage ? (
                      <div className="protocol-account-workspace__qr-panel">
                        <div className="protocol-account-workspace__tile-hd protocol-account-workspace__tile-hd--row">
                          <div className="min-w-0">
                            <h3 className="protocol-account-workspace__block-title">扫码登录</h3>
                            <p className="muted protocol-account-workspace__block-lead">{displayQrHint}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            disabled={qrRefreshBusy}
                            onClick={() => void refreshQrcode(true)}
                          >
                            {qrRefreshBusy ? "恢复中…" : "恢复登录"}
                          </Button>
                        </div>
                        <div className="protocol-account-workspace__qr-body">
                          <img src={qrImageUrl} alt="登录二维码" className="protocol-account-workspace__qr-img" />
                        </div>
                      </div>
                    ) : null}

                    <dl className="protocol-account-workspace__detail-grid" aria-label="账号详情">
                      {overviewFacts.map((row) => (
                        <div
                          key={row.label}
                          className={
                            row.mono
                              ? "protocol-account-workspace__detail-cell protocol-account-workspace__detail-cell--mono"
                              : "protocol-account-workspace__detail-cell"
                          }
                        >
                          <dt>{row.label}</dt>
                          <dd title={row.value}>{row.value}</dd>
                        </div>
                      ))}
                    </dl>

                    {overviewSecrets.length ? (
                      <>
                        <ul className="protocol-account-workspace__secrets" aria-label="访问凭证">
                          {overviewSecrets.map((row) => (
                            <li key={row.label} className="protocol-account-workspace__secret-row">
                              <span className="protocol-account-workspace__secret-label">{row.label}</span>
                              <div className="protocol-account-workspace__secret-main">
                                {row.plain ? (
                                  <span className="muted protocol-account-workspace__secret-plain">
                                    {row.secret}
                                  </span>
                                ) : (
                                  <input
                                    type="password"
                                    readOnly
                                    autoComplete="off"
                                    className="protocol-account-workspace__secret-input mono"
                                    value={row.secret}
                                    aria-label={row.label}
                                    tabIndex={-1}
                                  />
                                )}
                                {row.copyText ? (
                                  <CopyIconButton
                                    label={`复制${row.label}`}
                                    className="protocol-account-workspace__copy-btn"
                                    onClick={() => void copySnowlumaSecret(row.label, row.copyText)}
                                  />
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                        <p className="protocol-account-workspace__secrets-note">
                          托管密码用于原生 WebUI；VNC 密码用于 SL 桌面。点击复制即可粘贴。
                        </p>
                      </>
                    ) : null}
                  </div>

                  <aside className="protocol-account-workspace__overview-aside" aria-label="账号操作">
                    <div className="protocol-account-workspace__aside-group">
                      <p className="protocol-account-workspace__aside-label">生命周期</p>
                      <div className="protocol-account-workspace__aside-actions">
                        <Button type="button" size="sm" variant="outline" disabled={actionBusy} onClick={() => void runAction("start")}>
                          启动
                        </Button>
                        <Button type="button" size="sm" variant="outline" disabled={actionBusy} onClick={() => void runAction("stop")}>
                          停止
                        </Button>
                        <Button type="button" size="sm" variant="outline" disabled={actionBusy} onClick={() => void runAction("restart")}>
                          重启
                        </Button>
                        {isSnowluma ? (
                          <Button type="button" size="sm" variant="outline" disabled={injectBusy} onClick={() => void injectHook()}>
                            注入
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="protocol-account-workspace__aside-group">
                      <p className="protocol-account-workspace__aside-label">打开</p>
                      <div className="protocol-account-workspace__aside-actions">
                        {webUiHref ? (
                          <Button type="button" size="sm" variant="secondary" asChild>
                            <a href={webUiHref} target="_blank" rel="noopener noreferrer" title={nativeWebUiAuthNote || undefined}>
                              {nativeWebUiLabel}
                            </a>
                          </Button>
                        ) : null}
                        {snowlumaNovncHref ? (
                          <Button type="button" size="sm" variant="secondary" asChild>
                            <a href={snowlumaNovncHref} target="_blank" rel="noopener noreferrer" title={`VNC 密码 ${snowlumaNovncHint}`}>
                              SL 桌面
                            </a>
                          </Button>
                        ) : null}
                        {!showQrImage ? (
                          <Button type="button" size="sm" disabled={qrRefreshBusy} onClick={() => void refreshQrcode(true)}>
                            {qrRefreshBusy ? "恢复中…" : "恢复登录"}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="protocol-account-workspace__aside-danger">
                      <Button type="button" size="sm" variant="destructive" onClick={openDeleteModal}>
                        删除账号
                      </Button>
                    </div>
                  </aside>
                </div>

                <div className="protocol-account-workspace__log-block protocol-account-workspace__log-block--full">
                  <div className="protocol-account-workspace__tile-hd protocol-account-workspace__tile-hd--row">
                    <h3 className="protocol-account-workspace__block-title">进程日志</h3>
                    <div className="protocol-account-workspace__log-tools">
                      <span className="muted protocol-account-workspace__log-meta">每 5 秒刷新</span>
                      <CopyIconButton
                        label="复制日志"
                        className="protocol-account-workspace__copy-btn"
                        onClick={() => void copyProcessLogs()}
                      />
                    </div>
                  </div>
                  <pre
                    ref={logPreRef}
                    className={
                      logs.length
                        ? "protocol-account-workspace__log-pre"
                        : "protocol-account-workspace__log-pre protocol-account-workspace__log-pre--empty"
                    }
                    onScroll={onLogPreScroll}
                  >
                    {!logs.length
                      ? "暂无进程输出"
                      : logSegments.map((seg, i) => (
                          <span key={i}>
                            {seg.kind === "qr" ? (
                              <span className="protocol-account-workspace__log-qr">{seg.text}</span>
                            ) : (
                              seg.text
                            )}
                            {i < logSegments.length - 1 ? "\n" : ""}
                          </span>
                        ))}
                  </pre>
                </div>
              </div>

            ) : (
              <>
                <div className="ui-card protocol-account-workspace__panel ui-card--glass">
                  <div className="ui-card__content">
                    <div className="panel__hd panel__hd--split protocol-account-workspace__panel-hd">
                      <div>
                        <h3 className="panel__title">进程控制</h3>
                        <p className="muted protocol-account-workspace__panel-lead">
                          启动、停止或重启本账号的协议端进程。
                        </p>
                      </div>
                    </div>
                    <div className="panel__bd">
                      <div className="protocol-account-workspace__actions">
                        <button
                          type="button"
                          className="btn ui-btn"
                          disabled={actionBusy}
                          onClick={() => void runAction("start")}
                        >
                          启动
                        </button>
                        <button
                          type="button"
                          className="btn ui-btn"
                          disabled={actionBusy}
                          onClick={() => void runAction("stop")}
                        >
                          停止
                        </button>
                        <button
                          type="button"
                          className="btn ui-btn"
                          disabled={actionBusy}
                          onClick={() => void runAction("restart")}
                        >
                          重启
                        </button>
                        {isSnowluma ? (
                          <button
                            type="button"
                            className="btn ui-btn"
                            disabled={injectBusy}
                            onClick={() => void injectHook()}
                          >
                            注入
                          </button>
                        ) : null}
                        {webUiHref ? (
                          <a
                            className="btn ui-btn"
                            href={webUiHref}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {nativeWebUiLabel}
                          </a>
                        ) : null}
                        {snowlumaNovncHref ? (
                          <a
                            className="btn ui-btn"
                            href={snowlumaNovncHref}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            SL 桌面
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="btn ui-btn btn--danger ui-btn--destructive"
                          onClick={openDeleteModal}
                        >
                          删除账号
                        </button>
                      </div>
                      {showSnowlumaAccess || webUiHref ? (
                        <div className="protocol-account-workspace__extras">
                          {webUiHref ? (
                            <a
                              className="protocol-account-workspace__extra-link"
                              href={webUiHref}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              打开 {nativeWebUiLabel}
                            </a>
                          ) : null}
                          {snowlumaNovncHref ? (
                            <a
                              className="protocol-account-workspace__extra-link"
                              href={snowlumaNovncHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`VNC 密码 ${snowlumaNovncHint}`}
                            >
                              打开 SL 桌面（noVNC）
                            </a>
                          ) : isSnowlumaDocker ? (
                            <span className="muted protocol-account-workspace__extra-item">
                              SL 桌面未发布 noVNC 端口
                            </span>
                          ) : null}
                          {snowlumaManagedPassword ? (
                            <p className="protocol-account-workspace__extra-item muted protocol-account-workspace__secret-inline">
                              <span>托管密码：</span>
                              <span className="mono">{snowlumaWebuiUser}</span>
                              <span>/</span>
                              <input
                                type="password"
                                readOnly
                                autoComplete="off"
                                className="protocol-account-workspace__secret-input mono"
                                value={snowlumaManagedPassword}
                                aria-label="托管密码"
                                tabIndex={-1}
                              />
                              <CopyIconButton
                                label="复制托管密码"
                                className="protocol-account-workspace__copy-btn"
                                onClick={() =>
                                  void copySnowlumaSecret(
                                    "托管 WebUI 密码",
                                    `${snowlumaWebuiUser}/${snowlumaManagedPassword}`,
                                  )
                                }
                              />
                            </p>
                          ) : null}
                          {snowlumaInitialPassword ? (
                            <p className="protocol-account-workspace__extra-item muted protocol-account-workspace__secret-inline">
                              <span>初始密码：</span>
                              <input
                                type="password"
                                readOnly
                                autoComplete="off"
                                className="protocol-account-workspace__secret-input mono"
                                value={snowlumaInitialPassword}
                                aria-label="初始密码"
                                tabIndex={-1}
                              />
                              <CopyIconButton
                                label="复制初始密码"
                                className="protocol-account-workspace__copy-btn"
                                onClick={() => void copySnowlumaSecret("初始密码", snowlumaInitialPassword)}
                              />
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="ui-card protocol-account-workspace__panel ui-card--glass">
                  <div className="ui-card__content">
                    <div className="panel__hd panel__hd--split protocol-account-workspace__login-hd">
                      <div className="protocol-account-workspace__qr-head">
                        <h3 className="panel__title">登录</h3>
                        <p className="muted protocol-account-workspace__panel-lead">{displayQrHint}</p>
                      </div>
                      <button
                        type="button"
                        className="btn"
                        disabled={qrRefreshBusy}
                        onClick={() => void refreshQrcode(true)}
                      >
                        {qrRefreshBusy ? "恢复中…" : "恢复登录"}
                      </button>
                    </div>
                    {showQrImage ? (
                      <div className="panel__bd protocol-account-workspace__qr-body">
                        <img src={qrImageUrl} alt="登录二维码" className="protocol-account-workspace__qr-img" />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="ui-card protocol-account-workspace__panel protocol-account-workspace__panel--logs ui-card--glass">
                  <div className="ui-card__content">
                    <div className="panel__hd panel__hd--split">
                      <div>
                        <h3 className="panel__title">协议进程日志</h3>
                        <p className="muted protocol-account-workspace__panel-lead">
                          最近输出，每 5 秒自动刷新。
                        </p>
                      </div>
                    </div>
                    <div className="panel__bd protocol-account-workspace__log-wrap">
                      <pre
                        ref={logPreRef}
                        className="protocol-account-workspace__log-pre"
                        onScroll={onLogPreScroll}
                      >
                        {!logs.length ? (
                          "暂无进程输出"
                        ) : (
                          logSegments.map((seg, i) => (
                            <span key={i}>
                              {seg.kind === "qr" ? (
                                <span className="protocol-account-workspace__log-qr">{seg.text}</span>
                              ) : (
                                seg.text
                              )}
                              {i < logSegments.length - 1 ? "\n" : ""}
                            </span>
                          ))
                        )}
                      </pre>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        ) : null}

        {activeTab === "settings" ? (
          <section className="protocol-account-workspace__section" aria-label="账号设置">
            {isDialog ? (
              <div className="protocol-account-workspace__settings-stack">
                <PluginConfigFormSection
                  title="实例"
                  subtitle="控制台展示与协议端原生 WebUI。"
                  icon={Tag}
                  bodyClassName="protocol-account-workspace__form-grid"
                >
                  <SettingsFormField label="实例名" hint="控制台与列表中的展示称呼。">
                    <UiInput
                      type="text"
                      autoComplete="off"
                      value={displayName}
                      onValueChange={setDisplayName}
                    />
                  </SettingsFormField>
                  <SettingsFormField
                    label="原生 WebUI 端口"
                    hint="协议端自带 Web 控制台监听端口。"
                  >
                    <UiInput
                      type="number"
                      min={1}
                      max={65535}
                      value={webuiPort}
                      onValueChange={setWebuiPort}
                    />
                  </SettingsFormField>
                </PluginConfigFormSection>

                <PluginConfigFormSection
                  title="协议与运行时"
                  subtitle="切换到 SnowLuma 时保留原 NapCat 数据目录。"
                  icon={Server}
                  bodyClassName="protocol-account-workspace__form-grid"
                >
                  <SettingsFormField label="协议实现" hint="保存后按所选实现重启协议进程。">
                    <Select
                      value={targetBackend}
                      onValueChange={(v) =>
                        setTargetBackend(v === "snowluma" ? "snowluma" : "napcat")
                      }
                    >
                      <SelectTrigger className="w-full" aria-label="协议实现">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="napcat">NapCat</SelectItem>
                        <SelectItem value="snowluma">SnowLuma</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingsFormField>
                  {targetBackend === "napcat" ? (
                    <>
                      <SettingsFormField
                        label="NapCat Docker 镜像"
                        hint="留空时使用服务端默认镜像。"
                      >
                        <ProtocolDockerImageSelect
                          mountUrl={mountUrl}
                          protocol="napcat"
                          value={napcatDockerImage}
                          onValueChange={setNapcatDockerImage}
                          placeholder="mlikiowa/napcat-docker:latest"
                        />
                      </SettingsFormField>
                      <SettingsFormField
                        className="field--full"
                        label="启用 NapCat bypass 总开关"
                        hint="关闭后不写入 NapCat bypass 配置。"
                      >
                        <label className="protocol-account-workspace__check">
                          <input
                            type="checkbox"
                            checked={bypassEnabled}
                            onChange={(e) => setBypassEnabled(e.target.checked)}
                          />
                          <span>{bypassEnabled ? "已启用" : "已关闭"}</span>
                        </label>
                      </SettingsFormField>
                    </>
                  ) : (
                    <>
                      <SettingsFormField
                        label="SnowLuma Docker 镜像"
                        hint="留空时使用服务端默认镜像。"
                      >
                        <ProtocolDockerImageSelect
                          mountUrl={mountUrl}
                          protocol="snowluma"
                          value={snowlumaDockerImage}
                          onValueChange={setSnowlumaDockerImage}
                          placeholder="pallas/snowluma-auto-login:latest"
                        />
                      </SettingsFormField>
                      <SettingsFormField
                        label="Runtime 模式"
                        hint="新建，或挂载到已有 Runtime。"
                      >
                        <Select
                          value={runtimeMode}
                          onValueChange={(v) =>
                            setRuntimeMode(v === "existing" ? "existing" : "new")
                          }
                        >
                          <SelectTrigger className="w-full" aria-label="Runtime 模式">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">新建</SelectItem>
                            <SelectItem value="existing">挂载已有</SelectItem>
                          </SelectContent>
                        </Select>
                      </SettingsFormField>
                      {runtimeMode === "existing" ? (
                        <SettingsFormField className="field--full" label="Runtime">
                          <Select
                            value={runtimeId || "__empty__"}
                            onValueChange={(v) => {
                              const nextId = v === "__empty__" ? "" : v;
                              setRuntimeId(nextId);
                              const picked = snowlumaRuntimes.find((runtime) => runtime.id === nextId);
                              const fromRuntime = String(picked?.snowluma_docker_image ?? "").trim();
                              if (fromRuntime) setSnowlumaDockerImage(fromRuntime);
                            }}
                          >
                            <SelectTrigger className="w-full" aria-label="Runtime">
                              <SelectValue placeholder="选择 Runtime" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__empty__">选择 Runtime</SelectItem>
                              {snowlumaRuntimes.map((runtime) => (
                                <SelectItem key={runtime.id} value={runtime.id}>
                                  {runtime.display_name?.trim() || runtime.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </SettingsFormField>
                      ) : null}
                    </>
                  )}
                </PluginConfigFormSection>

                <PluginConfigFormSection
                  title="连接"
                  subtitle="Bot 侧 OneBot WebSocket 接入参数。"
                  icon={Cable}
                  bodyClassName="protocol-account-workspace__form-grid"
                >
                  <SettingsFormField
                    className="field--full"
                    label="WS 连接地址"
                    hint="Bot 连接 OneBot WebSocket 的完整地址。"
                  >
                    <UiInput
                      type="text"
                      autoComplete="off"
                      placeholder="ws://127.0.0.1:8088/onebot/v11/ws"
                      value={wsUrl}
                      onValueChange={setWsUrl}
                    />
                  </SettingsFormField>
                  <SettingsFormField label="连接名" hint="实例列表里显示的连接标识。">
                    <UiInput
                      type="text"
                      autoComplete="off"
                      value={wsName}
                      onValueChange={setWsName}
                    />
                  </SettingsFormField>
                  <SettingsFormField
                    label="WS Token"
                    hint="须与协议端鉴权配置一致。"
                    secret
                  >
                    <UiInput
                      type="password"
                      autoComplete="off"
                      value={wsToken}
                      onValueChange={setWsToken}
                    />
                  </SettingsFormField>
                </PluginConfigFormSection>
              </div>
            ) : (
              <div className="ui-card protocol-account-workspace__panel ui-card--glass">
                <div className="ui-card__content">
                  <div className="panel__hd panel__hd--split">
                    <div>
                      <h3 className="panel__title">连接与实例</h3>
                      <p className="muted protocol-account-workspace__panel-lead">
                        保存后将重启协议进程以使配置生效。
                      </p>
                    </div>
                  </div>
                  <div className="panel__bd protocol-account-workspace__form-grid">
                    <SettingsFormField label="实例名" hint="控制台与列表中的展示称呼。">
                      <UiInput
                        type="text"
                        autoComplete="off"
                        value={displayName}
                        onValueChange={setDisplayName}
                      />
                    </SettingsFormField>
                    <SettingsFormField
                      label="原生 WebUI 端口"
                      hint="协议端自带 Web 控制台监听端口。"
                    >
                      <UiInput
                        type="number"
                        min={1}
                        max={65535}
                        value={webuiPort}
                        onValueChange={setWebuiPort}
                      />
                    </SettingsFormField>
                    <div className="field field--full protocol-account-workspace__runtime-heading">
                      <span className="field__label">协议与运行时</span>
                    </div>
                    <SettingsFormField label="协议实现" hint="保存后按所选实现重启协议进程。">
                      <Select
                        value={targetBackend}
                        onValueChange={(v) =>
                          setTargetBackend(v === "snowluma" ? "snowluma" : "napcat")
                        }
                      >
                        <SelectTrigger className="w-full" aria-label="协议实现">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="napcat">NapCat</SelectItem>
                          <SelectItem value="snowluma">SnowLuma</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingsFormField>
                    {targetBackend === "napcat" ? (
                      <>
                        <SettingsFormField
                          label="NapCat Docker 镜像"
                          hint="留空时使用服务端默认镜像。"
                        >
                          <ProtocolDockerImageSelect
                            mountUrl={mountUrl}
                            protocol="napcat"
                            value={napcatDockerImage}
                            onValueChange={setNapcatDockerImage}
                            placeholder="mlikiowa/napcat-docker:latest"
                          />
                        </SettingsFormField>
                        <SettingsFormField
                          className="field--full"
                          label="启用 NapCat bypass 总开关"
                          hint="关闭后不写入 NapCat bypass 配置。"
                        >
                          <label className="protocol-account-workspace__check">
                            <input
                              type="checkbox"
                              checked={bypassEnabled}
                              onChange={(e) => setBypassEnabled(e.target.checked)}
                            />
                            <span>{bypassEnabled ? "已启用" : "已关闭"}</span>
                          </label>
                        </SettingsFormField>
                      </>
                    ) : (
                      <>
                        <SettingsFormField
                          label="SnowLuma Docker 镜像"
                          hint="留空时使用服务端默认镜像。"
                        >
                          <ProtocolDockerImageSelect
                            mountUrl={mountUrl}
                            protocol="snowluma"
                            value={snowlumaDockerImage}
                            onValueChange={setSnowlumaDockerImage}
                            placeholder="pallas/snowluma-auto-login:latest"
                          />
                        </SettingsFormField>
                        <SettingsFormField
                          label="Runtime 模式"
                          hint="新建，或挂载到已有 Runtime。"
                        >
                          <Select
                            value={runtimeMode}
                            onValueChange={(v) =>
                              setRuntimeMode(v === "existing" ? "existing" : "new")
                            }
                          >
                            <SelectTrigger className="w-full" aria-label="Runtime 模式">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">新建</SelectItem>
                              <SelectItem value="existing">挂载已有</SelectItem>
                            </SelectContent>
                          </Select>
                        </SettingsFormField>
                        {runtimeMode === "existing" ? (
                          <SettingsFormField className="field--full" label="Runtime">
                            <Select
                              value={runtimeId || "__empty__"}
                              onValueChange={(v) => {
                                const nextId = v === "__empty__" ? "" : v;
                                setRuntimeId(nextId);
                                const picked = snowlumaRuntimes.find((runtime) => runtime.id === nextId);
                                const fromRuntime = String(picked?.snowluma_docker_image ?? "").trim();
                                if (fromRuntime) setSnowlumaDockerImage(fromRuntime);
                              }}
                            >
                              <SelectTrigger className="w-full" aria-label="Runtime">
                                <SelectValue placeholder="选择 Runtime" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__empty__">选择 Runtime</SelectItem>
                                {snowlumaRuntimes.map((runtime) => (
                                  <SelectItem key={runtime.id} value={runtime.id}>
                                    {runtime.display_name?.trim() || runtime.id}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </SettingsFormField>
                        ) : null}
                      </>
                    )}
                    <SettingsFormField
                      className="field--full"
                      label="WS 连接地址"
                      hint="Bot 连接 OneBot WebSocket 的完整地址。"
                    >
                      <UiInput
                        type="text"
                        autoComplete="off"
                        placeholder="ws://127.0.0.1:8088/onebot/v11/ws"
                        value={wsUrl}
                        onValueChange={setWsUrl}
                      />
                    </SettingsFormField>
                    <SettingsFormField label="连接名" hint="实例列表里显示的连接标识。">
                      <UiInput
                        type="text"
                        autoComplete="off"
                        value={wsName}
                        onValueChange={setWsName}
                      />
                    </SettingsFormField>
                    <SettingsFormField
                      label="WS Token"
                      hint="须与协议端鉴权配置一致。"
                      secret
                    >
                      <UiInput
                        type="password"
                        autoComplete="off"
                        value={wsToken}
                        onValueChange={setWsToken}
                      />
                    </SettingsFormField>
                    <div className="field field--full protocol-account-workspace__save-row">
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={saveBusy}
                        onClick={() => void saveSettings()}
                      >
                        {saveBusy ? "保存中…" : "保存并重启"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </div>
      <ConsoleDeleteConfirmModal
        open={deleteModalOpen}
        title="删除账号"
        subtitle="将删除此协议端账号，数据目录是否保留取决于主仓配置，操作不可撤销。"
        items={[{ key: accountId, label: `${pageTitle || accountId} · ${account?.qq ?? accountId}` }]}
        warnings={deleteModalWarnings}
        busy={deleteBusy}
        error={deleteErr}
        titleId="protocol-account-delete-modal-title"
        onClose={closeDeleteModal}
        onConfirm={() => void confirmDeleteAccount()}
      />
      </>
    );
  },
);

export default ProtocolAccountWorkspace;
