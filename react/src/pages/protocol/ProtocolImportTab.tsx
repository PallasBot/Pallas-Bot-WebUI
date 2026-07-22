import { useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { protocolApiErrorMessage, protocolImportAccounts } from "@/api/protocol";
import UiInput from "@/components/ui/UiInput";
import type { ProtocolOutletContext } from "@/pages/ProtocolPage";

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
    <div className="protocol-sub-page">
      <div className="panel protocol-sub-page__lead mb-4">
        <div className="panel__hd panel__hd--split inst-db-panel__hd">
          <div>
            <h2 className="panel__title">导入协议账号</h2>
            <p className="muted">从本地账号目录批量导入；可先 dry run 预检。</p>
          </div>
          <div className="row-actions">
            <Link className="btn" to="/protocol">
              返回实例列表
            </Link>
          </div>
        </div>
      </div>

      {msg ? <p className="muted text-sm mb-4">{msg}</p> : null}
      {!mountUrl ? <p className="alert alert--err mb-4">协议 API 未挂载，无法导入。</p> : null}

      <div className="ui-card ui-card--glass protocol-sub-page__panel">
        <div className="ui-card__content">
          <div className="panel__bd protocol-form-grid">
            <label className="field field--full">
              <span className="field__label">账号文件夹根目录</span>
              <UiInput
                placeholder="/path/to/instances"
                autoComplete="off"
                value={sourceDir}
                onValueChange={setSourceDir}
              />
            </label>
            <label className="field field--full">
              <span className="field__label">默认 WS 地址</span>
              <UiInput autoComplete="off" value={wsUrl} onValueChange={setWsUrl} />
            </label>
            <label className="field field--full">
              <span className="field__label">WS Token</span>
              <UiInput
                type="password"
                autoComplete="off"
                value={wsToken}
                onValueChange={setWsToken}
              />
            </label>
            <label className="field field--check">
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
              仅预检（dry run）
            </label>
            <label className="field field--check">
              <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
              跳过已存在账号
            </label>
            <div className="field field--full row-actions">
              <button
                type="button"
                className="btn btn--primary"
                disabled={!mountUrl || busy}
                onClick={() => void submitImport()}
              >
                {busy ? "处理中…" : dryRun ? "开始预检" : "开始导入"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {result ? (
        <div className="ui-card ui-card--glass protocol-sub-page__panel mt-4">
          <div className="ui-card__content">
            <div className="panel__hd">
              <h3 className="panel__title">导入结果</h3>
            </div>
            <div className="panel__bd protocol-import-result">
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
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
