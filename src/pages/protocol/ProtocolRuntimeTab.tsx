import { useCallback, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  protocolApiErrorMessage,
  protocolListSnowlumaRuntimes,
  protocolStartSnowlumaRuntime,
  protocolStopSnowlumaRuntime,
} from "@/api/protocol";
import { useRegisterProtocolChrome } from "@/components/protocol/ProtocolChromeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu } from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import type { ProtocolOutletContext } from "@/pages/ProtocolPage";
import { pushConsoleToast } from "@/utils/consoleToast";
import { cn } from "@/lib/utils";

const PROTO_PANEL = "protocol-page__panel flex flex-col overflow-hidden shadow-none";
const PROTO_PANEL_HD =
  "panel__hd panel__hd--split inst-db-panel__hd flex-row items-start justify-between space-y-0 border-b px-4 py-3";
const PROTO_PANEL_BD = "panel__bd px-4 pb-4 pt-3";

export default function ProtocolRuntimeTab() {
  const { mountUrl } = useOutletContext<ProtocolOutletContext>();
  const qc = useQueryClient();
  const [snowlumaRuntimeBusyId, setSnowlumaRuntimeBusyId] = useState<string | null>(null);

  const runtimesQ = useQuery({
    queryKey: ["protocol-snowluma-runtimes", mountUrl],
    queryFn: () => protocolListSnowlumaRuntimes(mountUrl!),
    enabled: Boolean(mountUrl),
  });
  const snowlumaRuntimes = runtimesQ.data ?? [];

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["protocol-snowluma-runtimes", mountUrl] });
  }, [qc, mountUrl]);

  useRegisterProtocolChrome(
    useMemo(() => ({ onRefresh: refresh }), [refresh]),
  );

  async function startSnowlumaRuntime(runtimeId: string) {
    if (!mountUrl) return;
    setSnowlumaRuntimeBusyId(runtimeId);
    try {
      await protocolStartSnowlumaRuntime(mountUrl, runtimeId);
      pushConsoleToast("已请求启动 Runtime", "ok");
      refresh();
    } catch (e) {
      pushConsoleToast(protocolApiErrorMessage(e, "启动失败"), "err");
    } finally {
      setSnowlumaRuntimeBusyId(null);
    }
  }

  async function stopSnowlumaRuntime(runtimeId: string) {
    if (!mountUrl) return;
    setSnowlumaRuntimeBusyId(runtimeId);
    try {
      await protocolStopSnowlumaRuntime(mountUrl, runtimeId);
      pushConsoleToast("已请求停止 Runtime", "ok");
      refresh();
    } catch (e) {
      pushConsoleToast(protocolApiErrorMessage(e, "停止失败"), "err");
    } finally {
      setSnowlumaRuntimeBusyId(null);
    }
  }

  return (
    <div className="protocol-runtime-tab console-panel-stack">
      {!mountUrl ? <p className="muted text-sm">协议 API 未挂载，无法加载 Runtime。</p> : null}

      <Card className={PROTO_PANEL}>
        <CardHeader className={cn(PROTO_PANEL_HD, "border-b")}>
          <CardTitle className="panel__title flex items-center gap-1.5">
            <PanelTitleIcon icon={Cpu} />
            SnowLuma Runtime
          </CardTitle>
        </CardHeader>
        <CardContent className={PROTO_PANEL_BD}>
          <p className="muted">
            一个 Runtime 对应一个 SnowLuma 进程/容器，可挂多个 QQ。停某个 QQ 不会停 Runtime。
          </p>
          {runtimesQ.isLoading ? (
            <p className="muted">加载中…</p>
          ) : !snowlumaRuntimes.length ? (
            <p className="muted">暂无 SnowLuma Runtime。可在「创建账号」里新建或选用已有 Runtime。</p>
          ) : (
            <div className="protocol-runtime-list">
              {snowlumaRuntimes.map((rt) => (
                <div key={rt.id} className="protocol-runtime-row">
                  <div className="protocol-runtime-row__main">
                    <strong>{rt.display_name || rt.id}</strong>
                    <span className="muted">{rt.id}</span>
                    <span className={rt.process_running ? "pill pill--ok" : "pill"}>
                      {rt.process_running ? "运行中" : "已停止"}
                    </span>
                    <span className="muted">{rt.member_count ?? 0} 个 QQ</span>
                    {rt.webui_port != null && String(rt.webui_port).trim() ? (
                      <span className="muted">WebUI :{rt.webui_port}</span>
                    ) : null}
                    {(rt.member_account_ids ?? []).length ? (
                      <span
                        className="muted protocol-runtime-row__members"
                        title={(rt.member_account_ids ?? []).join(", ")}
                      >
                        成员 {(rt.member_account_ids ?? []).join(", ")}
                      </span>
                    ) : null}
                  </div>
                  <div className="row-actions protocol-runtime-row__actions">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={snowlumaRuntimeBusyId === rt.id}
                      onClick={() => void startSnowlumaRuntime(rt.id)}
                    >
                      {snowlumaRuntimeBusyId === rt.id ? "启动中…" : "启 Runtime"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={snowlumaRuntimeBusyId === rt.id}
                      onClick={() => void stopSnowlumaRuntime(rt.id)}
                    >
                      {snowlumaRuntimeBusyId === rt.id ? "停止中…" : "停 Runtime"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
