import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchDbBackendConfig,
  postDbBackendProbe,
  putDbBackendConfig,
} from "@/api/fullConsole";
import type {
  DbBackendConfigData,
  DbBackendKind,
  DbBackendMongoConfig,
  DbBackendPostgresConfig,
} from "@/api/pallasTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type Props = {
  onMessage?: (kind: "ok" | "err", text: string) => void;
};

type Draft = {
  backend: DbBackendKind;
  postgres: DbBackendPostgresConfig;
  mongo: DbBackendMongoConfig;
};

function emptyPostgres(): DbBackendPostgresConfig {
  return {
    host: "127.0.0.1",
    port: 5432,
    user: "",
    password: "",
    password_set: false,
    db: "PallasBot",
    auto_create_db: false,
  };
}

function emptyMongo(): DbBackendMongoConfig {
  return {
    host: "127.0.0.1",
    port: 27017,
    user: "",
    password: "",
    password_set: false,
    db: "PallasBot",
    auth_source: "PallasBot",
  };
}

function normalizeKind(raw: string | undefined): DbBackendKind {
  const t = (raw || "").trim().toLowerCase();
  if (t === "mongodb" || t === "mongo") return "mongodb";
  return "postgresql";
}

function draftFromData(data: DbBackendConfigData): Draft {
  return {
    backend: normalizeKind(data.backend),
    postgres: { ...emptyPostgres(), ...data.postgres, password: "" },
    mongo: { ...emptyMongo(), ...data.mongo, password: "" },
  };
}

function activeLabel(raw: string | undefined): string {
  return normalizeKind(raw) === "mongodb" ? "MongoDB" : "PostgreSQL";
}

export default function DatabaseBackendPanel({ onMessage }: Props) {
  const q = useQuery({ queryKey: ["db-backend-config"], queryFn: fetchDbBackendConfig });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [probeBusy, setProbeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [hint, setHint] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (q.data) setDraft(draftFromData(q.data));
  }, [q.data]);

  const activeBackend = normalizeKind(q.data?.active_backend);
  const busy = probeBusy || saveBusy || q.isFetching;

  function clearPageAlerts() {
    onMessage?.("ok", "");
  }

  function showHint(kind: "ok" | "err", text: string) {
    setHint({ kind, text });
  }

  function buildBody(force = false) {
    if (!draft) return null;
    return {
      backend: draft.backend,
      postgres: {
        host: draft.postgres.host,
        port: draft.postgres.port,
        user: draft.postgres.user,
        password: draft.postgres.password,
        db: draft.postgres.db,
        auto_create_db: draft.postgres.auto_create_db,
      },
      mongo: {
        host: draft.mongo.host,
        port: draft.mongo.port,
        user: draft.mongo.user,
        password: draft.mongo.password,
        db: draft.mongo.db,
        auth_source: draft.mongo.auth_source,
      },
      force,
    };
  }

  async function onProbe() {
    const body = buildBody();
    if (!body) return;
    setProbeBusy(true);
    setHint(null);
    clearPageAlerts();
    try {
      const data = await postDbBackendProbe(body);
      if (data.ok) {
        showHint("ok", `已连通（${data.latency_ms} ms）`);
      } else {
        showHint("err", data.detail || "无法连接");
      }
    } catch (e) {
      showHint("err", axiosErrorDetail(e));
    } finally {
      setProbeBusy(false);
    }
  }

  async function onSave() {
    const body = buildBody();
    if (!body) return;
    setSaveBusy(true);
    setHint(null);
    clearPageAlerts();
    try {
      let force = false;
      try {
        const probe = await postDbBackendProbe(body);
        if (!probe.ok) {
          const ok = window.confirm(
            `测试连接失败：${probe.detail || "未知错误"}\n\n若仍保存，重启后可能无法启动。确定要保存吗？`,
          );
          if (!ok) {
            showHint("err", probe.detail || "无法连接");
            return;
          }
          force = true;
        }
      } catch (e) {
        const detail = axiosErrorDetail(e);
        const ok = window.confirm(
          `测试连接出错：${detail}\n\n若仍保存，重启后可能无法启动。确定要保存吗？`,
        );
        if (!ok) {
          showHint("err", detail);
          return;
        }
        force = true;
      }

      const result = await putDbBackendConfig({ ...body, force });
      showHint("ok", result.message || "已保存，重启后生效");
      await q.refetch();
    } catch (e) {
      showHint("err", axiosErrorDetail(e));
    } finally {
      setSaveBusy(false);
    }
  }

  if (q.isLoading && !draft) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        正在加载…
      </div>
    );
  }

  if (!draft) {
    return (
      <p className="muted py-2 text-sm">
        {q.error ? axiosErrorDetail(q.error) : "加载失败"}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="muted text-sm" style={{ margin: 0 }}>
        当前运行 {activeLabel(activeBackend)}。
        {q.data?.restart_required_hint || "保存后需重启 Bot，新后端才会生效。"}
      </p>

      <div className="space-y-1.5 max-w-sm">
        <Label className="text-sm font-medium">数据库后端</Label>
        <Select
          value={draft.backend}
          onValueChange={(v) =>
            setDraft((d) => (d ? { ...d, backend: normalizeKind(v) } : d))
          }
          disabled={busy}
        >
          <SelectTrigger className="h-9" aria-label="数据库后端">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="postgresql">PostgreSQL（推荐）</SelectItem>
            <SelectItem value="mongodb">MongoDB</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {draft.backend === "postgresql" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="主机">
            <Input
              value={draft.postgres.host}
              onChange={(e) =>
                setDraft((d) =>
                  d ? { ...d, postgres: { ...d.postgres, host: e.target.value } } : d,
                )
              }
            />
          </Field>
          <Field label="端口">
            <Input
              type="number"
              value={draft.postgres.port}
              onChange={(e) =>
                setDraft((d) =>
                  d
                    ? {
                        ...d,
                        postgres: { ...d.postgres, port: Number(e.target.value) || 5432 },
                      }
                    : d,
                )
              }
            />
          </Field>
          <Field label="用户名">
            <Input
              value={draft.postgres.user}
              onChange={(e) =>
                setDraft((d) =>
                  d ? { ...d, postgres: { ...d.postgres, user: e.target.value } } : d,
                )
              }
            />
          </Field>
          <Field label="密码" hint={draft.postgres.password_set ? "已设置，留空不改" : "未设置"}>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={draft.postgres.password_set ? "********" : "可选"}
              value={draft.postgres.password}
              onChange={(e) =>
                setDraft((d) =>
                  d ? { ...d, postgres: { ...d.postgres, password: e.target.value } } : d,
                )
              }
            />
          </Field>
          <Field label="数据库">
            <Input
              value={draft.postgres.db}
              onChange={(e) =>
                setDraft((d) =>
                  d ? { ...d, postgres: { ...d.postgres, db: e.target.value } } : d,
                )
              }
            />
          </Field>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 sm:col-span-2">
            <div>
              <div className="text-sm font-medium">自动建库</div>
              <p className="text-xs text-muted-foreground">仅本地开发；生产或 Compose 请关闭</p>
            </div>
            <Switch
              checked={draft.postgres.auto_create_db}
              onCheckedChange={(v) =>
                setDraft((d) =>
                  d ? { ...d, postgres: { ...d.postgres, auto_create_db: v } } : d,
                )
              }
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="主机">
            <Input
              value={draft.mongo.host}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, mongo: { ...d.mongo, host: e.target.value } } : d))
              }
            />
          </Field>
          <Field label="端口">
            <Input
              type="number"
              value={draft.mongo.port}
              onChange={(e) =>
                setDraft((d) =>
                  d
                    ? { ...d, mongo: { ...d.mongo, port: Number(e.target.value) || 27017 } }
                    : d,
                )
              }
            />
          </Field>
          <Field label="用户名">
            <Input
              value={draft.mongo.user}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, mongo: { ...d.mongo, user: e.target.value } } : d))
              }
            />
          </Field>
          <Field label="密码" hint={draft.mongo.password_set ? "已设置，留空不改" : "未设置"}>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={draft.mongo.password_set ? "********" : "可选"}
              value={draft.mongo.password}
              onChange={(e) =>
                setDraft((d) =>
                  d ? { ...d, mongo: { ...d.mongo, password: e.target.value } } : d,
                )
              }
            />
          </Field>
          <Field label="数据库">
            <Input
              value={draft.mongo.db}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, mongo: { ...d.mongo, db: e.target.value } } : d))
              }
            />
          </Field>
          <Field label="认证库">
            <Input
              value={draft.mongo.auth_source}
              onChange={(e) =>
                setDraft((d) =>
                  d ? { ...d, mongo: { ...d.mongo, auth_source: e.target.value } } : d,
                )
              }
            />
          </Field>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={busy}
            onClick={() => void onProbe()}
          >
            {probeBusy ? <Loader2 className="size-4 animate-spin" /> : null}
            测试连接
          </Button>
          <Button type="button" className="gap-2" disabled={busy} onClick={() => void onSave()}>
            {saveBusy ? <Loader2 className="size-4 animate-spin" /> : null}
            保存
          </Button>
        </div>

        {hint ? (
          <div
            className={cn(
              "alert break-words text-sm",
              hint.kind === "ok" ? "alert--ok" : "alert--err",
            )}
            style={{ margin: 0, maxHeight: 120, overflow: "auto" }}
          >
            {hint.text}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
