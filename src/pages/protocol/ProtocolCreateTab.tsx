import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  protocolApiErrorMessage,
  protocolCreateAccount,
  protocolListSnowlumaRuntimes,
  type SnowlumaRuntimeRow,
} from "@/api/protocol";
import SnowlumaRuntimeCombobox from "@/components/protocol/SnowlumaRuntimeCombobox";
import { useRegisterProtocolChrome } from "@/components/protocol/ProtocolChromeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import { cn } from "@/lib/utils";
import { pushConsoleToast } from "@/utils/consoleToast";
import type { ProtocolOutletContext } from "@/pages/ProtocolPage";

const FORM_PANEL = "protocol-sub-page__panel flex flex-col overflow-hidden shadow-none";
const FORM_PANEL_HD =
  "panel__hd flex-row items-start justify-between space-y-0 border-b px-4 py-3";
const FORM_PANEL_BD = "panel__bd protocol-form-grid px-4 pb-4 pt-3";


function notifyOk(message: string) {
  pushConsoleToast(message, "ok");
}

function notifyErr(message: string) {
  pushConsoleToast(message || "操作失败", "err");
}

function notifyWarn(message: string) {
  pushConsoleToast(message, "warn");
}

export default function ProtocolCreateTab() {
  const { mountUrl, reload } = useOutletContext<ProtocolOutletContext>();
  const navigate = useNavigate();
  const [qq, setQq] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [protocolBackend, setProtocolBackend] = useState("napcat");
  const [webuiPort, setWebuiPort] = useState("");
  const [webuiToken, setWebuiToken] = useState("");
  const [wsUrl, setWsUrl] = useState("");
  const [wsName, setWsName] = useState("");
  const [wsToken, setWsToken] = useState("");
  const [snowlumaRuntimes, setSnowlumaRuntimes] = useState<SnowlumaRuntimeRow[]>([]);
  const [snowlumaRuntimeId, setSnowlumaRuntimeId] = useState("");
  const [snowlumaRuntimeMode, setSnowlumaRuntimeMode] = useState<"new" | "existing">("new");
  const [runtimesLoading, setRuntimesLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const chromeRefresh = useCallback(() => {
    void reload();
  }, [reload]);
  useRegisterProtocolChrome(
    useMemo(() => ({ onRefresh: chromeRefresh }), [chromeRefresh]),
  );

  useEffect(() => {
    if (protocolBackend !== "snowluma" || !mountUrl) {
      setSnowlumaRuntimes([]);
      setRuntimesLoading(false);
      return;
    }
    let cancelled = false;
    setRuntimesLoading(true);
    void protocolListSnowlumaRuntimes(mountUrl, { lite: true })
      .then((rows) => {
        if (!cancelled) setSnowlumaRuntimes(rows);
      })
      .catch(() => {
        if (!cancelled) setSnowlumaRuntimes([]);
      })
      .finally(() => {
        if (!cancelled) setRuntimesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [protocolBackend, mountUrl]);

  async function submitCreate() {
    if (!mountUrl) {
      notifyWarn("协议端未就绪");
      return;
    }
    const q = qq.trim();
    if (!q) {
      notifyWarn("请填写 QQ 号");
      return;
    }
    if (protocolBackend === "snowluma" && snowlumaRuntimeMode === "existing" && !snowlumaRuntimeId.trim()) {
      notifyWarn("请选择已有 SnowLuma Runtime");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        id: q,
        qq: q,
        display_name: displayName.trim(),
        enabled: true,
        protocol_backend: protocolBackend,
      };
      const wp = parseInt(webuiPort.trim(), 10);
      if (webuiPort.trim() && !Number.isNaN(wp)) body.webui_port = wp;
      if (protocolBackend !== "snowluma" && webuiToken.trim()) body.webui_token = webuiToken.trim();
      if (protocolBackend === "snowluma") {
        if (snowlumaRuntimeMode === "existing") {
          body.snowluma_runtime_id = snowlumaRuntimeId.trim();
          body.create_runtime = false;
        } else {
          body.create_runtime = true;
        }
      }
      if (wsUrl.trim()) body.ws_url = wsUrl.trim();
      if (wsName.trim()) body.ws_name = wsName.trim();
      if (wsToken) body.ws_token = wsToken;
      await protocolCreateAccount(mountUrl, body);
      notifyOk(`已创建账号 ${q}`);
      void navigate("/protocol");
    } catch (e) {
      notifyErr(protocolApiErrorMessage(e, "创建失败"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="protocol-sub-page console-panel-stack">
      <Card className={cn(FORM_PANEL, "mb-0")}>
        <CardHeader className={FORM_PANEL_HD}>
          <div>
            <CardTitle className="panel__title flex items-center gap-1.5">
              <PanelTitleIcon icon={UserPlus} />
              创建协议账号
            </CardTitle>
            <CardDescription className="muted mt-1">创建协议端账号实例。</CardDescription>
          </div>
        </CardHeader>
      </Card>

      {!mountUrl ? <p className="alert alert--err mb-0">协议 API 未挂载，无法创建账号。</p> : null}

      <Card className={FORM_PANEL}>
        <CardContent className={FORM_PANEL_BD}>
          <div className="field space-y-1.5">
            <Label htmlFor="create-qq">QQ 号</Label>
            <Input
              id="create-qq"
              className="h-9"
              inputMode="numeric"
              autoComplete="off"
              value={qq}
              onChange={(e) => setQq(e.target.value)}
            />
          </div>
          <div className="field space-y-1.5">
            <Label htmlFor="create-display-name">显示昵称</Label>
            <Input
              id="create-display-name"
              className="h-9"
              autoComplete="off"
              placeholder="可选"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="field space-y-1.5">
            <Label htmlFor="create-protocol-backend">协议端类型</Label>
            <Select value={protocolBackend} onValueChange={setProtocolBackend}>
              <SelectTrigger id="create-protocol-backend" className="h-9 w-full" aria-label="协议端类型">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="napcat">NapCat</SelectItem>
                <SelectItem value="snowluma">SnowLuma</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {protocolBackend === "snowluma" ? (
            <>
              <div className="field space-y-1.5">
                <Label htmlFor="create-snowluma-mode">SnowLuma Runtime</Label>
                <Select
                  value={snowlumaRuntimeMode}
                  onValueChange={(v) => setSnowlumaRuntimeMode(v as "new" | "existing")}
                >
                  <SelectTrigger
                    id="create-snowluma-mode"
                    className="h-9 w-full"
                    aria-label="SnowLuma Runtime 模式"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">新建 Runtime（一进程可再加号）</SelectItem>
                    <SelectItem value="existing">加入已有 Runtime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {snowlumaRuntimeMode === "existing" ? (
                <div className="field space-y-1.5">
                  <Label htmlFor="create-snowluma-runtime">选择 Runtime</Label>
                  <SnowlumaRuntimeCombobox
                    runtimes={snowlumaRuntimes}
                    value={snowlumaRuntimeId}
                    onValueChange={(id) => setSnowlumaRuntimeId(id)}
                    loading={runtimesLoading}
                    placeholder="请选择…"
                    ariaLabel="选择 Runtime"
                  />
                </div>
              ) : null}
            </>
          ) : null}
          <div className="field space-y-1.5">
            <Label htmlFor="create-webui-port">原生 WebUI 端口</Label>
            <Input
              id="create-webui-port"
              className="h-9"
              type="number"
              placeholder="留空自动分配；加入已有 Runtime 时沿用 Runtime 端口"
              value={webuiPort}
              onChange={(e) => setWebuiPort(e.target.value)}
            />
          </div>
          {protocolBackend !== "snowluma" ? (
            <div className="field space-y-1.5">
              <Label htmlFor="create-webui-token">WebUI token</Label>
              <Input
                id="create-webui-token"
                className="h-9"
                type="password"
                autoComplete="off"
                placeholder="留空随机生成"
                value={webuiToken}
                onChange={(e) => setWebuiToken(e.target.value)}
              />
            </div>
          ) : null}
          <div className="field field--full space-y-1.5">
            <Label htmlFor="create-ws-url">WS 连接地址</Label>
            <Input
              id="create-ws-url"
              className="h-9"
              placeholder="ws://127.0.0.1:8088/onebot/v11/ws"
              autoComplete="off"
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
            />
          </div>
          <div className="field space-y-1.5">
            <Label htmlFor="create-ws-name">连接名</Label>
            <Input
              id="create-ws-name"
              className="h-9"
              placeholder="pallas"
              autoComplete="off"
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
            />
          </div>
          <div className="field space-y-1.5">
            <Label htmlFor="create-ws-token">WS Token</Label>
            <Input
              id="create-ws-token"
              className="h-9"
              type="password"
              autoComplete="off"
              value={wsToken}
              onChange={(e) => setWsToken(e.target.value)}
            />
          </div>
          <div className="field field--full row-actions">
            <Button type="button" size="sm" disabled={!mountUrl || busy} onClick={() => void submitCreate()}>
              {busy ? "创建中…" : "创建"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
