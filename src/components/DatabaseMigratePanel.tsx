import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchActiveDbMigrateMongoPgJob,
  fetchDbMigrateMongoPgInfo,
  fetchDbMigrateMongoPgJob,
  postDbMigrateMongoPg,
} from "@/api/fullConsole";
import type { DbMigrateMongoPgJob } from "@/api/pallasTypes";
import ConsoleHint from "@/components/ConsoleHint";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useConsoleConfirm } from "@/hooks/useConsoleConfirm";
import { DatabaseZap } from "lucide-react";

type Props = {
  onMessage?: (kind: "ok" | "err", text: string) => void;
};

export default function DatabaseMigratePanel({ onMessage }: Props) {
  const { confirm, confirmDialog } = useConsoleConfirm();
  const infoQ = useQuery({
    queryKey: ["db-migrate-mongo-pg-info"],
    queryFn: fetchDbMigrateMongoPgInfo,
  });
  const [dryRun, setDryRun] = useState(true);
  const [switchBackend, setSwitchBackend] = useState(true);
  const [tryHotRebind, setTryHotRebind] = useState(true);
  const [restartCursor, setRestartCursor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<DbMigrateMongoPgJob | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const lastNotifiedStatus = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const active = await fetchActiveDbMigrateMongoPgJob();
        if (!cancelled && active) setJob(active);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!job || (job.status !== "queued" && job.status !== "running")) return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const next = await fetchDbMigrateMongoPgJob(job.job_id);
          setJob(next);
          if (next.status === lastNotifiedStatus.current) return;
          if (next.status === "completed") {
            lastNotifiedStatus.current = next.status;
            onMessageRef.current?.("ok", "迁移任务已完成");
          } else if (next.status === "failed") {
            lastNotifiedStatus.current = next.status;
            onMessageRef.current?.("err", next.error || "迁移任务失败");
          }
        } catch (e) {
          onMessageRef.current?.("err", axiosErrorDetail(e));
        }
      })();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [job?.job_id, job?.status]);

  async function startJob() {
    if (
      !dryRun &&
      !(await confirm({
        title: "开始正式迁移",
        subtitle: "确定将 MongoDB 数据正式迁入 PostgreSQL？",
        warnings: ["迁移期间请尽量暂停写入。"],
        confirmLabel: "开始迁移",
      }))
    )
      return;
    setBusy(true);
    try {
      lastNotifiedStatus.current = "";
      const started = await postDbMigrateMongoPg({
        dry_run: dryRun,
        switch_backend: switchBackend,
        try_hot_rebind: tryHotRebind,
        restart_cursor: restartCursor,
      });
      setJob(started);
      onMessage?.("ok", dryRun ? "已启动预演任务" : "已启动迁移任务");
    } catch (e) {
      onMessage?.("err", axiosErrorDetail(e));
    } finally {
      setBusy(false);
    }
  }

  const info = infoQ.data;
  const running = job?.status === "queued" || job?.status === "running";

  return (
    <div className="database-migrate-panel space-y-3">
      <ConsoleHint className="mb-0 flex-col items-stretch gap-1.5 text-xs">
        <p className="m-0">
          将 MongoDB 数据迁入 PostgreSQL。建议先预演；正式迁移期间尽量暂停写入。
        </p>
        {info?.notes?.length ? (
          <ul className="m-0 list-disc space-y-0.5 pl-4">
            {info.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </ConsoleHint>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <Label className="text-sm">仅预演（不写库）</Label>
          <Switch checked={dryRun} onCheckedChange={setDryRun} disabled={busy || running} />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <Label className="text-sm">清空续传游标</Label>
          <Switch
            checked={restartCursor}
            onCheckedChange={setRestartCursor}
            disabled={busy || running}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <Label className="text-sm">完成后切到 PostgreSQL</Label>
          <Switch
            checked={switchBackend}
            onCheckedChange={setSwitchBackend}
            disabled={busy || running || dryRun}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <Label className="text-sm">尝试热切换</Label>
          <Switch
            checked={tryHotRebind}
            onCheckedChange={setTryHotRebind}
            disabled={busy || running || dryRun || !switchBackend}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" icon={DatabaseZap} disabled={busy || running} onClick={() => void startJob()}>
          {running ? "进行中…" : dryRun ? "开始预演" : "开始迁移"}
        </Button>
        {info?.active_backend ? (
          <span className="muted self-center text-xs">当前运行时：{info.active_backend}</span>
        ) : null}
      </div>
      {job ? (
        <div className="rounded-md border px-3 py-2">
          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span>
              状态：<strong>{job.status}</strong>
            </span>
            {job.phase ? (
              <span>
                阶段：<strong>{job.phase}</strong>
              </span>
            ) : null}
            {typeof job.elapsed_sec === "number" ? <span>耗时 {Math.round(job.elapsed_sec)}s</span> : null}
          </div>
          {job.error ? <p className="alert alert--err" style={{ margin: "0 0 8px" }}>{job.error}</p> : null}
          <pre
            className="pre-block"
            style={{ margin: 0, maxHeight: 220, overflow: "auto", fontSize: 11 }}
          >
            {(job.logs || []).join("\n") || "暂无日志"}
          </pre>
        </div>
      ) : null}
      {confirmDialog}
    </div>
  );
}
