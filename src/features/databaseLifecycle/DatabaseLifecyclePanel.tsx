import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DatabaseZap, Play, RefreshCw, Settings2, ShieldCheck } from "lucide-react";
import {
  fetchDbLifecycleCatalog,
  fetchDbLifecycleJob,
  previewDbLifecycle,
  putDbLifecyclePolicies,
  startDbLifecycleJob,
} from "@/api/fullConsole";
import type { DbLifecyclePolicy } from "@/api/pallasTypes";
import { axiosErrorDetail } from "@/api/http";
import ConsoleConfirmModal from "@/components/ConsoleConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatLifecycleBytes, lifecycleRiskMeta } from "./model";
import "./databaseLifecycle.css";

type Dataset = NonNullable<ReturnType<typeof useLifecycleCatalog>>["datasets"][number];

function useLifecycleCatalog() {
  const query = useQuery({
    queryKey: ["db-lifecycle-catalog"],
    queryFn: fetchDbLifecycleCatalog,
    refetchInterval: 30_000,
  });
  return query.data;
}

function policyDraft(policy: DbLifecyclePolicy): DbLifecyclePolicy {
  return {
    enabled: policy.enabled,
    retention_days: policy.retention_days ?? null,
    max_bytes: policy.max_bytes ?? null,
  };
}

function numberOrNull(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function formatRows(value: number | null): string {
  return value == null ? "—" : new Intl.NumberFormat("zh-CN").format(value);
}

function datasetState(dataset: Dataset): { label: string; className: string } {
  if (dataset.errors.length) return { label: "统计异常", className: "badge badge--err" };
  return dataset.policy.enabled
    ? { label: "已启用", className: "badge badge--ok" }
    : { label: "未启用", className: "badge" };
}

export default function DatabaseLifecyclePanel() {
  const queryClient = useQueryClient();
  const catalog = useLifecycleCatalog();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DbLifecyclePolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewDbLifecycle>> | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const selected = catalog?.datasets.find((dataset) => dataset.dataset_id === selectedId) ?? null;
  const jobQ = useQuery({
    queryKey: ["db-lifecycle-job", jobId],
    queryFn: () => fetchDbLifecycleJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 1000 : false;
    },
  });

  useEffect(() => {
    if (!selected) return;
    setDraft(policyDraft(selected.policy));
    setError("");
    setPreview(null);
  }, [selectedId]);

  useEffect(() => {
    if (jobQ.data?.status === "completed" || jobQ.data?.status === "failed") {
      void queryClient.invalidateQueries({ queryKey: ["db-lifecycle-catalog"] });
    }
  }, [jobQ.data?.status, queryClient]);

  const closeSheet = () => {
    if (saving || previewing) return;
    setSelectedId(null);
  };

  const savePolicy = async () => {
    if (!selected || !draft) return;
    setSaving(true);
    setError("");
    try {
      await putDbLifecyclePolicies({ [selected.dataset_id]: draft });
      await queryClient.invalidateQueries({ queryKey: ["db-lifecycle-catalog"] });
    } catch (cause) {
      setError(axiosErrorDetail(cause));
      throw cause;
    } finally {
      setSaving(false);
    }
  };

  const requestPreview = async () => {
    if (!selected || !draft) return;
    setPreviewing(true);
    setError("");
    try {
      await savePolicy();
      setPreview(await previewDbLifecycle(selected.dataset_id, draft));
    } catch {
      // savePolicy has already exposed a meaningful response error.
    } finally {
      setPreviewing(false);
    }
  };

  const startJob = async () => {
    if (!selected || !draft || !preview) return;
    setPreviewing(true);
    setError("");
    try {
      const job = await startDbLifecycleJob(selected.dataset_id, draft, preview.confirmation_token);
      setJobId(job.job_id);
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ["db-lifecycle-catalog"] });
    } catch (cause) {
      setError(axiosErrorDetail(cause));
    } finally {
      setPreviewing(false);
    }
  };

  const activeJob = jobQ.data;

  return (
    <section className="database-lifecycle" aria-label="数据库生命周期">
      <div className="database-lifecycle__intro">
        <div>
          <p className="database-lifecycle__eyebrow">生命周期</p>
          <h3>数据保留与存储上限</h3>
          <p>已登记的数据集可设置自动维护；未知、配置与安全对象始终受保护。</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          icon={RefreshCw}
          iconMotion="spin"
          onClick={() => void queryClient.invalidateQueries({ queryKey: ["db-lifecycle-catalog"] })}
          disabled={!catalog}
        >
          刷新
        </Button>
      </div>

      {activeJob ? (
        <div className={cn("database-lifecycle__job", activeJob.status === "failed" && "database-lifecycle__job--failed")}>
          <DatabaseZap aria-hidden="true" />
          <span>
            {activeJob.status === "queued" || activeJob.status === "running"
              ? `正在维护 ${activeJob.dataset_id}，已处理 ${formatRows(activeJob.deleted_rows)} 条。`
              : activeJob.status === "completed"
                ? `维护完成：清理 ${formatRows(activeJob.deleted_rows)} 条，预计释放 ${formatLifecycleBytes(activeJob.freed_bytes)}。`
                : activeJob.error || "维护任务失败。"}
          </span>
        </div>
      ) : null}

      {catalog ? (
        <>
          <div className="database-lifecycle__table-wrap">
            <table className="data console-data-table database-lifecycle__table">
              <thead>
                <tr>
                  <th>数据集</th>
                  <th>物理对象</th>
                  <th>记录</th>
                  <th>存储</th>
                  <th>策略</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {catalog.datasets.map((dataset) => {
                  const risk = lifecycleRiskMeta(dataset.risk);
                  const state = datasetState(dataset);
                  return (
                    <tr key={dataset.dataset_id}>
                      <td>
                        <div className="database-lifecycle__name">
                          <strong>{dataset.label}</strong>
                          <span className={risk.className}>{risk.label}</span>
                        </div>
                      </td>
                      <td className="database-lifecycle__objects">{dataset.present_objects.join("、") || "尚未发现"}</td>
                      <td className="database-lifecycle__numeric">{formatRows(dataset.row_count)}</td>
                      <td className="database-lifecycle__numeric">{formatLifecycleBytes(dataset.size_bytes)}</td>
                      <td>
                        {dataset.policy.retention_days == null ? "不按天数" : `${dataset.policy.retention_days} 天`}
                        {dataset.policy.max_bytes == null ? "" : ` / ${formatLifecycleBytes(dataset.policy.max_bytes)}`}
                      </td>
                      <td><span className={state.className}>{state.label}</span></td>
                      <td>
                        <Button type="button" size="sm" variant="outline" icon={Settings2} onClick={() => setSelectedId(dataset.dataset_id)}>
                          管理
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="database-lifecycle__cards">
            {catalog.datasets.map((dataset) => {
              const risk = lifecycleRiskMeta(dataset.risk);
              const state = datasetState(dataset);
              return (
                <article key={dataset.dataset_id} className="database-lifecycle__card">
                  <div className="database-lifecycle__card-title">
                    <strong>{dataset.label}</strong>
                    <span className={risk.className}>{risk.label}</span>
                  </div>
                  <p>{dataset.present_objects.join("、") || "尚未发现物理对象"}</p>
                  <dl>
                    <div><dt>记录</dt><dd>{formatRows(dataset.row_count)}</dd></div>
                    <div><dt>存储</dt><dd>{formatLifecycleBytes(dataset.size_bytes)}</dd></div>
                  </dl>
                  <div className="database-lifecycle__card-footer">
                    <span className={state.className}>{state.label}</span>
                    <Button type="button" size="sm" variant="outline" icon={Settings2} onClick={() => setSelectedId(dataset.dataset_id)}>管理</Button>
                  </div>
                </article>
              );
            })}
          </div>

          {catalog.unmanaged_objects.length ? (
            <div className="database-lifecycle__protected">
              <div><ShieldCheck aria-hidden="true" /><span>受保护对象</span></div>
              <p>{catalog.unmanaged_objects.map((object) => object.name).join("、")}</p>
            </div>
          ) : null}
        </>
      ) : (
        <p className="muted">正在读取生命周期目录…</p>
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent side="right" className="database-lifecycle__sheet">
          <SheetHeader>
            <SheetTitle>{selected?.label ?? "生命周期策略"}</SheetTitle>
            <p className="muted m-0 text-sm">{selected?.present_objects.join("、") || "尚未发现物理对象"}</p>
          </SheetHeader>
          {selected && draft ? (
            <div className="database-lifecycle__form">
              <label className="database-lifecycle__switch-row">
                <span><strong>自动维护</strong><small>每天 04:45 在维护进程检查此策略。</small></span>
                <Switch checked={draft.enabled} onCheckedChange={(enabled) => setDraft({ ...draft, enabled })} />
              </label>
              <label>
                <span>保留天数 {!selected.supports_retention ? <small>该数据集仅清理已过期记录。</small> : null}</span>
                <Input
                  inputMode="numeric"
                  type="number"
                  min="1"
                  max="3650"
                  value={draft.retention_days ?? ""}
                  onChange={(event) => setDraft({ ...draft, retention_days: numberOrNull(event.target.value) })}
                  placeholder={selected.supports_retention ? "不按天数清理" : "不适用"}
                  disabled={!selected.supports_retention}
                />
              </label>
              <label>
                <span>存储上限（GiB） {!selected.supports_max_bytes ? <small>该数据集不支持按容量裁剪。</small> : null}</span>
                <Input
                  inputMode="numeric"
                  type="number"
                  min="0.016"
                  max="2048"
                  step="0.1"
                  value={draft.max_bytes == null ? "" : String(draft.max_bytes / 1024 ** 3)}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    const gib = Number(value);
                    setDraft({
                      ...draft,
                      max_bytes: value && Number.isFinite(gib) && gib > 0 ? Math.round(gib * 1024 ** 3) : null,
                    });
                  }}
                  placeholder={selected.supports_max_bytes ? "不按容量清理" : "不适用"}
                  disabled={!selected.supports_max_bytes}
                />
              </label>
              {selected.errors.length ? <p className="alert alert--err m-0">{selected.errors.join("；")}</p> : null}
              {error ? <p className="alert alert--err m-0">{error}</p> : null}
              <div className="database-lifecycle__form-actions">
                <Button type="button" variant="outline" onClick={() => void savePolicy()} disabled={saving || previewing}>
                  {saving ? "保存中…" : "保存策略"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  icon={Play}
                  onClick={() => void requestPreview()}
                  disabled={saving || previewing || Boolean(selected.errors.length)}
                >
                  {previewing ? "正在预估…" : "预估影响"}
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConsoleConfirmModal
        open={Boolean(preview && selected && draft)}
        title={`确认维护${selected ? `：${selected.label}` : ""}`}
        subtitle={preview ? `预计清理 ${formatRows(preview.candidate_rows)} 条记录，预计释放 ${formatLifecycleBytes(preview.candidate_bytes)}。操作不可逆。` : ""}
        warnings={["该操作会删除符合当前生命周期策略的数据。请确认策略和预估影响。"]}
        confirmLabel="开始维护"
        busy={previewing}
        busyLabel="正在启动…"
        onClose={() => !previewing && setPreview(null)}
        onConfirm={() => void startJob()}
      />
    </section>
  );
}
