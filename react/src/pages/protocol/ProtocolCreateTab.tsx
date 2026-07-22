import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import {
  protocolApiErrorMessage,
  protocolCreateAccount,
  protocolListSnowlumaRuntimes,
  type SnowlumaRuntimeRow,
} from "@/api/protocol";
import UiInput from "@/components/ui/UiInput";
import UiSelect from "@/components/ui/UiSelect";
import type { ProtocolOutletContext } from "@/pages/ProtocolPage";

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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (protocolBackend !== "snowluma" || !mountUrl) {
      setSnowlumaRuntimes([]);
      return;
    }
    void protocolListSnowlumaRuntimes(mountUrl)
      .then(setSnowlumaRuntimes)
      .catch(() => setSnowlumaRuntimes([]));
  }, [protocolBackend, mountUrl]);

  async function submitCreate() {
    if (!mountUrl) {
      setMsg("协议端未就绪");
      return;
    }
    const q = qq.trim();
    if (!q) {
      setMsg("请填写 QQ 号");
      return;
    }
    if (protocolBackend === "snowluma" && snowlumaRuntimeMode === "existing" && !snowlumaRuntimeId.trim()) {
      setMsg("请选择已有 SnowLuma Runtime");
      return;
    }
    setBusy(true);
    setMsg(null);
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
      setMsg(`已创建账号 ${q}`);
      void navigate("/protocol");
    } catch (e) {
      setMsg(protocolApiErrorMessage(e, "创建失败"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="protocol-sub-page">
      <div className="panel protocol-sub-page__lead mb-4">
        <div className="panel__hd panel__hd--split inst-db-panel__hd">
          <div>
            <h2 className="panel__title">创建协议账号</h2>
            <p className="muted">填写 QQ 与连接参数后创建协议端实例；完成后可返回列表启停。</p>
          </div>
          <div className="row-actions">
            <Link className="btn" to="/protocol">
              返回实例列表
            </Link>
            <button type="button" className="btn" disabled={busy} onClick={() => void reload()}>
              刷新
            </button>
          </div>
        </div>
      </div>

      {msg ? <p className="muted text-sm mb-4">{msg}</p> : null}
      {!mountUrl ? <p className="alert alert--err mb-4">协议 API 未挂载，无法创建账号。</p> : null}

      <div className="ui-card ui-card--glass protocol-sub-page__panel">
        <div className="ui-card__content">
          <div className="panel__bd protocol-form-grid">
            <label className="field">
              <span className="field__label">QQ 号</span>
              <UiInput
                inputMode="numeric"
                autoComplete="off"
                value={qq}
                onValueChange={setQq}
              />
            </label>
            <label className="field">
              <span className="field__label">显示昵称</span>
              <UiInput
                autoComplete="off"
                placeholder="可选"
                value={displayName}
                onValueChange={setDisplayName}
              />
            </label>
            <label className="field">
              <span className="field__label">协议端类型</span>
              <UiSelect
                value={protocolBackend}
                onValueChange={setProtocolBackend}
              >
                <option value="napcat">NapCat</option>
                <option value="snowluma">SnowLuma</option>
              </UiSelect>
            </label>
            {protocolBackend === "snowluma" ? (
              <>
                <label className="field">
                  <span className="field__label">SnowLuma Runtime</span>
                  <UiSelect
                    value={snowlumaRuntimeMode}
                    onValueChange={(v) => setSnowlumaRuntimeMode(v as "new" | "existing")}
                  >
                    <option value="new">新建 Runtime（一进程可再加号）</option>
                    <option value="existing">加入已有 Runtime</option>
                  </UiSelect>
                </label>
                {snowlumaRuntimeMode === "existing" ? (
                  <label className="field">
                    <span className="field__label">选择 Runtime</span>
                    <UiSelect
                      value={snowlumaRuntimeId}
                      onValueChange={setSnowlumaRuntimeId}
                    >
                      <option value="">请选择…</option>
                      {snowlumaRuntimes.map((rt) => (
                        <option key={rt.id} value={rt.id}>
                          {rt.display_name || rt.id}（{rt.member_count ?? 0} 号）
                        </option>
                      ))}
                    </UiSelect>
                  </label>
                ) : null}
              </>
            ) : null}
            <label className="field">
              <span className="field__label">内置 WebUI 端口</span>
              <UiInput
                type="number"
                placeholder="留空自动分配；加入已有 Runtime 时沿用 Runtime 端口"
                value={webuiPort}
                onValueChange={setWebuiPort}
              />
            </label>
            {protocolBackend !== "snowluma" ? (
              <label className="field">
                <span className="field__label">WebUI token</span>
                <UiInput
                  type="password"
                  autoComplete="off"
                  placeholder="留空随机生成"
                  value={webuiToken}
                  onValueChange={setWebuiToken}
                />
              </label>
            ) : null}
            <label className="field field--full">
              <span className="field__label">WS 连接地址</span>
              <UiInput
                placeholder="ws://127.0.0.1:8088/onebot/v11/ws"
                autoComplete="off"
                value={wsUrl}
                onValueChange={setWsUrl}
              />
            </label>
            <label className="field">
              <span className="field__label">连接名</span>
              <UiInput
                placeholder="pallas"
                autoComplete="off"
                value={wsName}
                onValueChange={setWsName}
              />
            </label>
            <label className="field">
              <span className="field__label">WS Token</span>
              <UiInput
                type="password"
                autoComplete="off"
                value={wsToken}
                onValueChange={setWsToken}
              />
            </label>
            <div className="field field--full row-actions">
              <button
                type="button"
                className="btn btn--primary"
                disabled={!mountUrl || busy}
                onClick={() => void submitCreate()}
              >
                {busy ? "创建中…" : "创建"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
