import { type FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { postConsoleAuthLogin, sanitizeConsoleNext } from "@/api/consoleAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyShellTheme, readPrefs, writePrefs, type ThemeMode } from "@/theme/applyShellTheme";
import { PALLAS_BOT_DOC } from "@/utils/pallasExternalLinks";

const LOGIN_REASON_MESSAGES: Record<string, string> = {
  password_changed: "登录密码已更新，请使用新密码重新登录。",
};

function brandAvatarSrc(): string {
  const base = ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
  return `${base}/assets/brand-avatar.png`;
}

function resolveReason(raw: string | null): string {
  const key = (raw || "").trim();
  if (!key) return "";
  return LOGIN_REASON_MESSAGES[key] || key;
}

function cycleTheme(mode: ThemeMode): ThemeMode {
  if (mode === "light") return "dark";
  if (mode === "dark") return "system";
  return "light";
}

function themeButtonLabel(mode: ThemeMode): string {
  if (mode === "dark") return "深色";
  if (mode === "light") return "浅色";
  return "跟随系统";
}

/** 控制台登录（SPA）：密码经 /api/auth/login 写入会话 cookie。 */
export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => resolveReason(searchParams.get("reason")));
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readPrefs().theme);

  const nextTarget = useMemo(
    () => sanitizeConsoleNext(searchParams.get("next")),
    [searchParams],
  );

  function toggleTheme() {
    const next = cycleTheme(themeMode);
    writePrefs({ theme: next });
    applyShellTheme();
    setThemeMode(next);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const token = password.trim();
    if (!token) {
      setError("请输入控制台密码。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await postConsoleAuthLogin(token);
      window.location.assign(nextTarget);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="login-page min-h-dvh bg-[var(--bg-deep)] text-[var(--text)]">
      <button
        type="button"
        className="login-page__theme-btn fixed right-4 top-4 z-10 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] shadow-sm hover:text-[var(--text)]"
        title="切换浅色/深色"
        onClick={toggleTheme}
      >
        {themeButtonLabel(themeMode)}
      </button>

      <div className="flex min-h-dvh items-center justify-center p-6">
        <section
          className="w-full max-w-[22rem] rounded-[var(--radius-lg,14px)] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-sm"
          aria-labelledby="loginTitle"
        >
          <header className="flex items-center gap-3">
            <div
              className="size-11 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg-deep)]"
              aria-hidden
            >
              <img
                className="size-full object-cover"
                src={brandAvatarSrc()}
                alt=""
                decoding="async"
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="text-[1.15rem] font-bold tracking-tight text-[var(--text)]" id="loginTitle">
                  Pallas-Bot
                </span>
                <span className="text-[0.75rem] font-semibold tracking-wide text-[var(--text-muted)]">
                  控制台
                </span>
              </div>
              <p className="m-0 mt-0.5 text-[0.8125rem] leading-snug text-[var(--text-muted)]">
                输入控制台密码以继续。
              </p>
            </div>
          </header>

          {error ? (
            <p className="alert alert--err mt-3.5 text-center text-[0.8125rem]" role="alert">
              {error}
            </p>
          ) : null}

          <form className="mt-5 flex flex-col gap-3" onSubmit={(e) => void onSubmit(e)}>
            <div className="relative">
              <Input
                type={showPwd ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                autoFocus
                placeholder="控制台密码"
                aria-label="控制台密码"
                value={password}
                disabled={busy}
                className="h-10 pr-16"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-1.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)] hover:text-[var(--text)]"
                onClick={() => setShowPwd((v) => !v)}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
                {showPwd ? "隐藏" : "显示"}
              </button>
            </div>
            <Button type="submit" className="h-10 w-full font-semibold" icon={LogIn} iconMotion="forward" disabled={busy}>
              {busy ? "登录中…" : "进入"}
            </Button>
            <p className="m-0 text-center text-[0.75rem] leading-snug text-[var(--text-muted)]">
              忘记密码？见{" "}
              <a
                className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                href={PALLAS_BOT_DOC.faqConsolePassword}
                target="_blank"
                rel="noopener noreferrer"
              >
                FAQ
              </a>
            </p>
          </form>

          <p className="mt-5 mb-0 text-center text-[0.75rem] text-[var(--text-muted)]">
            © {new Date().getFullYear()} Pallas-Bot
          </p>
        </section>
      </div>
    </div>
  );
}
