import { useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { protocolApiErrorMessage, protocolImportAccounts } from "@/api/protocol";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ProtocolOutletContext } from "@/pages/ProtocolPage";

const FORM_PANEL = "protocol-sub-page__panel flex flex-col overflow-hidden shadow-none";
const FORM_PANEL_HD =
  "panel__hd flex-row items-start justify-between space-y-0 border-b px-4 py-3";
const FORM_PANEL_BD = "panel__bd protocol-form-grid px-4 pb-4 pt-3";

export default function ProtocolImportTab() {
  const { mountUrl } = useOutletContext<ProtocolOutletContext>();
  const navigate = useNavigate();
  const [sourceDir, setSourceDir] = useState("");
  const [wsUrl, setWsUrl] = useState("");
  const [wsToken, setWsToken] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [skipExisting, setSkipExisting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const counts = useMemo(() => {
    const len = (key: string) => (Array.isArray(result?.[key]) ? (result![key] as unknown[]).length : 0);
    return { imported: len("imported"), skipped: len("skipped"), failed: len("failed") };
  }, [result]);

  const failedRows = useMemo(() => {
    const rows = result?.failed;
    return Array.isArray(rows)
      ? rows.filter((x): x is { folder?: string; reason?: string } => typeof x === "object" && x != null)
      : [];
  }, [result]);

  async function submitImport() {
    if (!mountUrl) {
      setMsg("协议端未就绪");
      return;
    }
    if (!sourceDir.trim()) {
      setMsg("请填写账号文件夹根目录");
      return;
    }
    setBusy(true);
    setMsg(null);
    setResult(null);
    try {
      const data = await protocolImportAccounts(mountUrl, {
        source_dir: sourceDir.trim(),
        dry_run: dryRun,
        skip_existing: skipExisting,
        ws_url: wsUrl.trim(),
        ws_token: wsToken,
      });
      setResult(data);
      const n = Array.isArray(data.imported) ? data.imported.length : 0;
      setMsg(dryRun ? `预检完成：可导入 ${n} 个` : `已导入 ${n} 个账号`);
      if (!dryRun && n > 0) {
        window.setTimeout(() => void navigate("/protocol"), 1200);
      }
    } catch (e) {
      setMsg(protocolApiErrorMessage(e, "导入失败"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="protocol-sub-page space-y-4">
      <Card className={cn(FORM_PANEL, "mb-0")}>
        <CardHeader className={cn(FORM_PANEL_HD, "inst-db-panel__hd")}>
          <div>
            <CardTitle className="panel__title">导入协议账号</CardTitle>
            <CardDescription className="muted mt-1">从本地目录导入账号。</CardDescription>
          </div>
          <div className="row-actions inst-db-panel__hd-side">
            <Button asChild type="button" variant="outline" size="sm">
              <Link to="/protocol">返回实例列表</Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {msg ? <p className="muted mb-0 text-sm">{msg}</p> : null}
      {!mountUrl ? <p className="alert alert--err mb-0">协议 API 未挂载，无法导入。</p> : null}

      <Card className={FORM_PANEL}>
        <CardContent className={FORM_PANEL_BD}>
          <div className="field field--full space-y-1.5">
            <Label htmlFor="import-source-dir">账号文件夹根目录</Label>
            <Input
              id="import-source-dir"
              className="h-9"
              placeholder="/path/to/instances"
              autoComplete="off"
              value={sourceDir}
              onChange={(e) => setSourceDir(e.target.value)}
            />
          </div>
          <div className="field field--full space-y-1.5">
            <Label htmlFor="import-ws-url">默认 WS 地址</Label>
            <Input
              id="import-ws-url"
              className="h-9"
              autoComplete="off"
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
            />
          </div>
          <div className="field field--full space-y-1.5">
            <Label htmlFor="import-ws-token">WS Token</Label>
            <Input
              id="import-ws-token"
              className="h-9"
              type="password"
              autoComplete="off"
              value={wsToken}
              onChange={(e) => setWsToken(e.target.value)}
            />
          </div>
          <div className="field field--check flex items-center gap-2">
            <Switch id="import-dry-run" checked={dryRun} onCheckedChange={setDryRun} />
            <Label htmlFor="import-dry-run">仅预检（dry run）</Label>
          </div>
          <div className="field field--check flex items-center gap-2">
            <Switch id="import-skip-existing" checked={skipExisting} onCheckedChange={setSkipExisting} />
            <Label htmlFor="import-skip-existing">跳过已存在账号</Label>
          </div>
          <div className="field field--full row-actions">
            <Button type="button" size="sm" disabled={!mountUrl || busy} onClick={() => void submitImport()}>
              {busy ? "处理中…" : dryRun ? "开始预检" : "开始导入"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <Card className={FORM_PANEL}>
          <CardHeader className={FORM_PANEL_HD}>
            <CardTitle className="panel__title">导入结果</CardTitle>
          </CardHeader>
          <CardContent className="panel__bd protocol-import-result px-4 pb-4 pt-3">
            <p>
              已导入：{counts.imported} · 跳过：{counts.skipped} · 失败：{counts.failed}
            </p>
            {failedRows.length ? (
              <ul className="protocol-import-result__list">
                {failedRows.map((row, i) => (
                  <li key={`f-${i}`}>
                    {row.folder || "—"}：{row.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
