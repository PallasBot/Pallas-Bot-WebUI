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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import { cn } from "@/lib/utils";
import { Database, Loader2, Server } from "lucide-react";

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
  const [probeHint, setProbeHint] = useState("");

  useEffect(() => {
    if (q.data) setDraft(draftFromData(q.data));
  }, [q.data]);

  const activeBackend = normalizeKind(q.data?.active_backend);
  const busy = probeBusy || saveBusy || q.isFetching;

  function notify(kind: "ok" | "err", text: string) {
    onMessage?.(kind, text);
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
    setProbeHint("");
    try {
      const data = await postDbBackendProbe(body);
      if (data.ok) {
        setProbeHint(`连通成功（${data.latency_ms} ms）`);
        notify("ok", data.detail || "连通成功");
      } else {
        setProbeHint(data.detail || "连通失败");
        notify("err", data.detail || "连通失败");
      }
    } catch (e) {
      const detail = axiosErrorDetail(e);
      setProbeHint(detail);
      notify("err", detail);
    } finally {
      setProbeBusy(false);
    }
  }

  async function onSave() {
    const body = buildBody();
    if (!body) return;
    setSaveBusy(true);
    setProbeHint("");
    try {
      let force = false;
      try {
        const probe = await postDbBackendProbe(body);
        if (!probe.ok) {
          const ok = window.confirm(
            `连通性探测失败：${probe.detail || "未知错误"}\n\n未连通时重启后可能无法启动。仍要保存吗？`,
          );
          if (!ok) return;
          force = true;
        }
      } catch (e) {
        const detail = axiosErrorDetail(e);
        const ok = window.confirm(
          `连通性探测出错：${detail}\n\n未连通时重启后可能无法启动。仍要保存吗？`,
        );
        if (!ok) return;
        force = true;
      }

      const result = await putDbBackendConfig({ ...body, force });
      notify("ok", result.message || "已保存，请重启进程后生效");
      await q.refetch();
    } catch (e) {
      notify("err", axiosErrorDetail(e));
    } finally {
      setSaveBusy(false);
    }
  }

  if (q.isLoading && !draft) {
    return (
      <Card className="database-page__panel shadow-none">
        <CardContent className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          加载后端配置…
        </CardContent>
      </Card>
    );
  }

  if (!draft) {
    return (
      <Card className="database-page__panel shadow-none">
        <CardContent className="px-4 py-6 text-sm text-muted-foreground">
          {q.error ? axiosErrorDetail(q.error) : "无法加载后端配置"}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="database-page__panel shadow-none" id="db-backend-config">
      <CardHeader className="border-b px-4 py-3 space-y-1">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <PanelTitleIcon icon={Database} />
          后端配置
          <span className="rounded-md border px-2 py-0.5 text-xs font-normal text-muted-foreground">
            运行中：{activeLabel(activeBackend)}
          </span>
        </CardTitle>
        <CardDescription>
          {q.data?.restart_required_hint || "保存后需重启进程才能切换数据库后端。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              {
                id: "postgresql" as const,
                title: "PostgreSQL",
                desc: "推荐 · 新装默认",
                icon: Database,
              },
              {
                id: "mongodb" as const,
                title: "MongoDB",
                desc: "文档型数据库",
                icon: Server,
              },
            ] as const
          ).map((opt) => {
            const selected = draft.backend === opt.id;
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={busy}
                onClick={() => setDraft((d) => (d ? { ...d, backend: opt.id } : d))}
                className={cn(
                  "rounded-lg border-2 p-3 text-left transition-all",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50",
                )}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Icon className="size-4 shrink-0" />
                  <span className="text-sm font-medium">{opt.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </button>
            );
          })}
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
            <Field
              label="密码"
              hint={draft.postgres.password_set ? "已设置 · 留空不修改" : "未设置"}
            >
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={draft.postgres.password_set ? "********" : ""}
                value={draft.postgres.password}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, postgres: { ...d.postgres, password: e.target.value } } : d,
                  )
                }
              />
            </Field>
            <Field label="数据库名">
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
                <p className="text-xs text-muted-foreground">仅本地开发；托管 / Compose 勿开</p>
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
            <Field
              label="密码"
              hint={draft.mongo.password_set ? "已设置 · 留空不修改" : "未设置"}
            >
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={draft.mongo.password_set ? "********" : ""}
                value={draft.mongo.password}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, mongo: { ...d.mongo, password: e.target.value } } : d,
                  )
                }
              />
            </Field>
            <Field label="数据库名">
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

        {probeHint ? <p className="text-xs text-muted-foreground">{probeHint}</p> : null}

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
      </CardContent>
    </Card>
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
        <Label className="text-sm">{label}</Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
