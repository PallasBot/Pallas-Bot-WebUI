import { useEffect, useMemo, useState } from "react";
import {
  protocolApiErrorMessage,
  protocolStartAccount,
  protocolStopAccount,
  protocolUpdateSnowlumaRuntime,
  protocolSwitchAccountRuntime,
  type NapcatAccountRow,
  type SnowlumaRuntimeRow,
} from "@/api/protocol";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import ProtocolDockerImageSelect from "@/components/protocol/ProtocolDockerImageSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Power, UserMinus, UserPlus, X } from "lucide-react";
import { pushConsoleToast } from "@/utils/consoleToast";
import { coerceBoolean } from "@/utils/protocolUi";
import { snowlumaRuntimeWebUiHref } from "@/utils/protocolLinks";
import { cn } from "@/lib/utils";
import type { SystemData } from "@/api/pallasTypes";
import { useConsoleConfirm } from "@/hooks/useConsoleConfirm";
import { useConfirmAgain } from "@/hooks/useConfirmAgain";

function accountLabel(account: NapcatAccountRow): string {
  const name = String(account.display_name ?? "").trim();
  const qq = String(account.qq ?? account.id ?? "").trim();
  if (name && qq && name !== qq) return `${name}（${qq}）`;
  return name || qq || "未知账号";
}

function runtimeTitle(rt: SnowlumaRuntimeRow): string {
  return String(rt.display_name || rt.id || "Runtime").trim() || "Runtime";
}

/** SnowLuma Runtime 挂载配置弹窗（启停 QQ / 挂载 / 卸下）。 */
export default function ProtocolRuntimeConfigDialog({
  open,
  runtime,
  accounts,
  mountUrl,
  system = null,
  accountsLoading = false,
  onClose,
  onChanged,
}: {
  open: boolean;
  runtime: SnowlumaRuntimeRow | null;
  accounts: NapcatAccountRow[];
  mountUrl: string | null;
  system?: SystemData | null;
  accountsLoading?: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { confirm, confirmDialog } = useConsoleConfirm();
  const again = useConfirmAgain();
  const [memberBusyKey, setMemberBusyKey] = useState<string | null>(null);
  const [addAccountId, setAddAccountId] = useState("");
  const [dockerImage, setDockerImage] = useState("");
  const [imageSaving, setImageSaving] = useState(false);

  const runtimeId = runtime?.id ?? "";
  useEffect(() => {
    if (open) setDockerImage(String(runtime?.snowluma_docker_image ?? "").trim());
  }, [open, runtime?.id, runtime?.snowluma_docker_image]);

  const members = useMemo(
    () => (runtime?.member_account_ids ?? []).map((id) => String(id || "").trim()).filter(Boolean),
    [runtime],
  );

  const accountById = useMemo(() => {
    const map = new Map<string, NapcatAccountRow>();
    for (const row of accounts) {
      const id = String(row.id ?? "").trim();
      if (id) map.set(id, row);
    }
    return map;
  }, [accounts]);

  const addOpts = useMemo(() => {
    if (!runtime) return [] as ComboboxOption[];
    const memberSet = new Set(members);
    const opts: ComboboxOption[] = [];
    for (const row of accounts) {
      const id = String(row.id ?? "").trim();
      if (!id || memberSet.has(id)) continue;
      const backend = String(row.protocol_backend ?? "").trim().toLowerCase();
      if (backend && backend !== "snowluma") continue;
      opts.push({
        value: id,
        label: accountLabel(row),
        keywords: [String(row.qq ?? ""), String(row.display_name ?? ""), id].join(" "),
      });
    }
    return opts;
  }, [accounts, members, runtime]);

  const webuiPort =
    runtime?.webui_port != null && String(runtime.webui_port).trim()
      ? String(runtime.webui_port).trim()
      : "";
  const webuiHref = webuiPort ? snowlumaRuntimeWebUiHref(runtime, accounts, system) : null;
  const title = runtime ? runtimeTitle(runtime) : "Runtime";
  const busy = memberBusyKey != null || imageSaving;

  async function saveDockerImage() {
    if (!mountUrl || !runtimeId) return;
    setImageSaving(true);
    try {
      await protocolUpdateSnowlumaRuntime(mountUrl, runtimeId, {
        snowluma_docker_image: dockerImage.trim(),
      });
      const cleared = !dockerImage.trim();
      pushConsoleToast(
        runtime?.process_running
          ? cleared
            ? "已恢复默认镜像配置，当前容器不受影响；下次启动时使用。"
            : "镜像配置已保存，当前容器不受影响；下次启动时使用。"
          : cleared
            ? "已恢复默认镜像配置，下次启动时使用。"
            : "镜像配置已保存，下次启动时使用。",
        "ok",
      );
      onChanged?.();
    } catch (e) {
      pushConsoleToast(protocolApiErrorMessage(e, "保存镜像配置失败"), "err");
    } finally {
      setImageSaving(false);
    }
  }

  async function attachAccount(accountId: string) {
    if (!mountUrl || !runtimeId || !accountId) return;
    const key = `add:${accountId}`;
    setMemberBusyKey(key);
    try {
      await protocolSwitchAccountRuntime(mountUrl, accountId, {
        protocol_backend: "snowluma",
        runtime_mode: "existing",
        runtime_id: runtimeId,
      });
      pushConsoleToast(`已挂载账号 ${accountId}`, "ok");
      setAddAccountId("");
      onChanged?.();
    } catch (e) {
      pushConsoleToast(protocolApiErrorMessage(e, "挂载失败"), "err");
    } finally {
      setMemberBusyKey(null);
    }
  }

  async function detachAccount(accountId: string) {
    if (!mountUrl || !accountId) return;
    if (
      !(await confirm({
        title: "卸下账号",
        subtitle: `将账号 ${accountId} 从该 Runtime 卸下？`,
        warnings: ["会为其新建独立 Runtime，账号仍为 SnowLuma。"],
        confirmLabel: "卸下",
      }))
    ) {
      return;
    }
    const key = `rm:${accountId}`;
    setMemberBusyKey(key);
    try {
      await protocolSwitchAccountRuntime(mountUrl, accountId, {
        protocol_backend: "snowluma",
        runtime_mode: "new",
      });
      pushConsoleToast(`已卸下账号 ${accountId}`, "ok");
      onChanged?.();
    } catch (e) {
      pushConsoleToast(protocolApiErrorMessage(e, "卸下失败"), "err");
    } finally {
      setMemberBusyKey(null);
    }
  }

  async function startMemberQq(accountId: string) {
    if (!mountUrl || !accountId) return;
    const key = `qq-start:${accountId}`;
    setMemberBusyKey(key);
    try {
      await protocolStartAccount(mountUrl, accountId);
      pushConsoleToast(`已请求启动 QQ ${accountId}`, "ok");
      onChanged?.();
    } catch (e) {
      pushConsoleToast(protocolApiErrorMessage(e, "启 QQ 失败"), "err");
    } finally {
      setMemberBusyKey(null);
    }
  }

  async function stopMemberQq(accountId: string) {
    if (!mountUrl || !accountId) return;
    const key = `qq-stop:${accountId}`;
    setMemberBusyKey(key);
    try {
      await protocolStopAccount(mountUrl, accountId);
      pushConsoleToast(`已请求停止 QQ ${accountId}`, "warn");
      onChanged?.();
    } catch (e) {
      pushConsoleToast(protocolApiErrorMessage(e, "停 QQ 失败"), "err");
    } finally {
      setMemberBusyKey(null);
    }
  }

  function requestClose() {
    if (busy) return;
    again.clear();
    setAddAccountId("");
    onClose();
  }

  return (
    <>
      <Dialog
        open={open && Boolean(runtime)}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
      <DialogContent
        className="plugin-config-dialog protocol-runtime-config-dialog flex max-h-[min(720px,calc(100dvh-32px))] w-[min(560px,calc(100vw-32px))] max-w-[min(560px,calc(100vw-32px))] gap-0 overflow-hidden bg-card p-0"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader className="plugin-config-dialog__head border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 text-left sm:text-left">
          <div className="min-w-0 space-y-1.5 pr-6">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle id="protocol-runtime-config-dialog-title" className="text-left">
                {title}
              </DialogTitle>
              <span
                className={
                  runtime?.process_running
                    ? "data-conn-capsule data-conn-capsule--run"
                    : "data-conn-capsule data-conn-capsule--off"
                }
              >
                {runtime?.process_running ? "运行中" : "已停止"}
              </span>
              {!members.length ? (
                <span className="data-conn-capsule data-conn-capsule--off">空闲</span>
              ) : null}
            </div>
            <p className="muted break-all text-xs">{runtimeId}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="muted text-xs">{members.length} 个 QQ</span>
              {webuiPort ? (
                webuiHref ? (
                  <a
                    className="data-conn-capsule data-conn-capsule--on protocol-runtime-webui-link"
                    href={webuiHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`打开 WebUI :${webuiPort}`}
                  >
                    WebUI :{webuiPort}
                  </a>
                ) : (
                  <span className="data-conn-capsule data-conn-capsule--off">
                    WebUI :{webuiPort}
                  </span>
                )
              ) : null}
            </div>
            <DialogDescription className="muted text-xs">
              启停 QQ 不影响 Runtime 容器；卸下会为该号新建独立 Runtime。
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="plugin-config-dialog__bd protocol-runtime-config-dialog__bd min-h-[200px] flex-1 space-y-4 overflow-auto px-4 py-3">
          <section className="space-y-2">
            <div className="space-y-1">
              <h3 className="text-xs font-medium text-muted-foreground">Docker 镜像</h3>
              <p className="text-xs text-muted-foreground">仅保存配置，不会重启或重建当前 Runtime；下次启动时使用。</p>
            </div>
            <div className="protocol-runtime-attach">
              <div className="protocol-runtime-attach__picker">
                <ProtocolDockerImageSelect
                  mountUrl={mountUrl}
                  protocol="snowluma"
                  value={dockerImage}
                  onValueChange={setDockerImage}
                  disabled={busy}
                  placeholder="使用默认 SnowLuma 镜像"
                />
              </div>
              <Button type="button" size="sm" disabled={busy} onClick={() => void saveDockerImage()}>
                {imageSaving ? "保存中…" : "保存镜像"}
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">已挂载</h3>
            {members.length ? (
              <ul className="space-y-1.5">
                {members.map((id) => {
                  const account = accountById.get(id);
                  const label = account ? accountLabel(account) : id;
                  // 以 process_running 为准；running 含 connected，停 QQ 后仍可能为 true
                  const running =
                    account?.process_running !== undefined && account?.process_running !== null
                      ? coerceBoolean(account.process_running) === true
                      : coerceBoolean(account?.running) === true;
                  const detachBusy = memberBusyKey === `rm:${id}`;
                  const powerBusy =
                    memberBusyKey === `qq-start:${id}` || memberBusyKey === `qq-stop:${id}`;
                  return (
                    <li key={id} className="protocol-runtime-member">
                      <span className="protocol-runtime-member__name" title={label}>
                        {label}
                      </span>
                      <div className="protocol-runtime-member__actions">
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            running && again.isArmed(`qq-stop:${id}`)
                              ? "destructive"
                              : running
                                ? "outline"
                                : "default"
                          }
                          icon={Power}
                          title={
                            running
                              ? "停止该账号的 QQ 进程"
                              : "启动该账号的 QQ 进程"
                          }
                          aria-label={running ? `停 QQ ${label}` : `启 QQ ${label}`}
                          disabled={busy}
                          onClick={() => {
                            if (running) {
                              again.run(`qq-stop:${id}`, () => stopMemberQq(id));
                            } else {
                              void startMemberQq(id);
                            }
                          }}
                        >
                          {powerBusy
                            ? "…"
                            : running
                              ? again.label(`qq-stop:${id}`, "停 QQ")
                              : "启 QQ"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-rose-600 hover:text-rose-700"
                          title="从该 Runtime 卸下账号"
                          aria-label={`卸下 ${label}`}
                          disabled={busy}
                          onClick={() => void detachAccount(id)}
                        >
                          <UserMinus className="size-3.5" aria-hidden />
                          {detachBusy ? "卸下中…" : "卸下"}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted text-sm">暂无成员</p>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">添加账号</h3>
            {addOpts.length ? (
              <div className="protocol-runtime-attach">
                <div className="protocol-runtime-attach__picker">
                  <Combobox
                    value={addAccountId}
                    onValueChange={setAddAccountId}
                    options={addOpts}
                    placeholder="选择要挂载的账号"
                    emptyText="无匹配账号"
                    searchPlaceholder="搜索名称 / QQ…"
                    searchThreshold={1}
                    loading={accountsLoading}
                    loadingText="正在读取账号…"
                    ariaLabel={`向 ${title} 添加账号`}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className={cn("shrink-0 gap-1")}
                  disabled={!addAccountId || busy}
                  onClick={() => void attachAccount(addAccountId)}
                >
                  <UserPlus className="size-3.5" aria-hidden />
                  {memberBusyKey === `add:${addAccountId}` ? "挂载中…" : "挂载"}
                </Button>
              </div>
            ) : (
              <p className="muted text-sm">没有可再挂载的协议账号</p>
            )}
          </section>
        </div>

        <DialogFooter className="plugin-config-dialog__foot border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] px-4 py-3 sm:justify-end">
          <Button type="button" size="sm" variant="secondary" icon={X} iconMotion="close" disabled={busy} onClick={requestClose}>
            关闭
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}
