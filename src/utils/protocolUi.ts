export function coerceBoolean(val: unknown): boolean | null {
  if (typeof val === "boolean") return val;
  if (typeof val === "number" && !Number.isNaN(val)) return val !== 0;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(s)) return true;
    if (["false", "0", "no", "n", "off"].includes(s)) return false;
  }
  return null;
}

export function protocolScalarText(val: unknown): string {
  if (val == null || val === "") return "—";
  return String(val);
}

export type ProtocolDisp =
  | { kind: "pill"; on: boolean; onLabel: string; offLabel: string }
  | { kind: "text"; text: string };

export function protocolDisp(v: unknown, onLabel: string, offLabel: string): ProtocolDisp {
  const b = coerceBoolean(v);
  if (b !== null) return { kind: "pill", on: b, onLabel, offLabel };
  return { kind: "text", text: protocolScalarText(v) };
}

export type ProtocolBackendKey = "napcat" | "snowluma";

export function protocolBackendKey(account: Record<string, unknown>): ProtocolBackendKey {
  const raw = String(account.protocol_backend ?? "napcat")
    .trim()
    .toLowerCase();
  return raw === "snowluma" ? "snowluma" : "napcat";
}

export function protocolBackendDisplayName(account: Record<string, unknown>): string {
  if (
    account.account_source === "external" ||
    String(account.protocol_backend ?? "").trim().toLowerCase() === "external"
  ) {
    const adapter = String(account.external_adapter ?? account.adapter ?? "").trim();
    return adapter || "OneBot";
  }
  return protocolBackendKey(account) === "snowluma" ? "SnowLuma" : "NapCat";
}

function coerceRuntimeModeToken(raw: unknown): string {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "docker" || s === "appimage" || s === "shell") return s;
  return "";
}

/** 账号是否以 Linux Docker 容器方式运行（无宿主进程 PID）。 */
export function protocolAccountIsLinuxDocker(account: Record<string, unknown> | null | undefined): boolean {
  if (!account) return false;
  return (
    coerceBoolean(account.snowluma_linux_docker) === true ||
    coerceBoolean(account.napcat_linux_docker) === true
  );
}

/** 账号实际运行方式（与协议内置页 docker / shell / appimage 一致） */
export function protocolRuntimeModeLabel(account: Record<string, unknown>): string {
  if (
    account.account_source === "external" ||
    String(account.protocol_backend ?? "").trim().toLowerCase() === "external"
  ) {
    return "—";
  }
  if (protocolAccountIsLinuxDocker(account)) return "Docker";
  const bk = protocolBackendKey(account);
  if (bk === "snowluma") {
    const mode =
      coerceRuntimeModeToken(account.global_snowluma_runtime_mode) ||
      coerceRuntimeModeToken(account.global_runtime_mode);
    if (mode) return mode === "appimage" ? "AppImage" : mode.charAt(0).toUpperCase() + mode.slice(1);
    return "Shell";
  }
  const mode =
    coerceRuntimeModeToken(account.global_napcat_runtime_mode) ||
    coerceRuntimeModeToken(account.global_runtime_mode);
  if (mode) return mode === "appimage" ? "AppImage" : mode.charAt(0).toUpperCase() + mode.slice(1);
  return "Shell";
}

export function protocolRuntimeVersionText(account: Record<string, unknown>): string {
  const v = String(account.runtime_version ?? "").trim();
  return v || "—";
}

/** 协议账号轮询：状态未变时不触发全局 /instances epoch */
export function protocolAccountsSignature(accounts: readonly Record<string, unknown>[]): string {
  return accounts
    .map((a) => {
      const id = String(a.id ?? a.qq ?? "").trim();
      const qq = String(a.qq ?? "").trim();
      const connected = a.connected === true ? "1" : "0";
      const running =
        coerceBoolean(a.process_running ?? a.running) === true ? "1" : "0";
      return `${id}:${qq}:${connected}:${running}`;
    })
    .join("|");
}
