import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { changeConsoleLogin, fetchConsoleSetupStatus } from "@/api/fullConsole";
import PageHeader from "@/components/PageHeader";

function setupSatisfied(data: Awaited<ReturnType<typeof fetchConsoleSetupStatus>> | undefined): boolean {
  if (!data) return false;
  return !data.requires_setup && !data.default_password_active;
}

export default function SetupWizardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pwdErr, setPwdErr] = useState("");
  const [pwdOk, setPwdOk] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  const setupQ = useQuery({ queryKey: ["auth-setup"], queryFn: fetchConsoleSetupStatus });

  const redirectTarget = useMemo(() => {
    const raw = searchParams.get("redirect");
    if (raw && raw.startsWith("/")) return raw;
    return "/";
  }, [searchParams]);

  const redirectTargetLabel = useMemo(() => {
    if (redirectTarget === "/") return "仪表盘";
    if (redirectTarget === "/instances") return "实例与连接";
    if (redirectTarget.startsWith("/plugin")) return "插件";
    if (redirectTarget.startsWith("/ai")) return "AI 相关页";
    return redirectTarget;
  }, [redirectTarget]);

  const setupCompleted = setupSatisfied(setupQ.data);
  const requiresSetup = Boolean(setupQ.data?.requires_setup);
  const canEnter = setupQ.isSuccess && setupCompleted;

  async function submitPassword() {
    setPwdErr("");
    setPwdOk("");
    if (p1.length < 8) {
      setPwdErr("新口令至少 8 位。");
      return;
    }
    if (p1 !== p2) {
      setPwdErr("两次输入不一致。");
      return;
    }
    setPwdBusy(true);
    try {
      const result = await changeConsoleLogin(p1);
      setPwdOk(result.message || "已更新。");
      setP1("");
      setP2("");
      await setupQ.refetch();
    } catch (e) {
      setPwdErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPwdBusy(false);
    }
  }

  return (
    <div className="console-hub-page setup-wizard-page">
      <PageHeader
        title="首次 Setup Wizard"
        description="改密为必做项；协议端与插件扩展为推荐项。"
        actions={
          <button type="button" className="btn" disabled={setupQ.isFetching} onClick={() => void setupQ.refetch()}>
            重新检查
          </button>
        }
      />

      {requiresSetup ? (
        <div className="alert alert--warn">
          当前仍处于首次引导阶段，其他页面会先收口到这里。
          {setupQ.data?.default_password_active ? <span> 默认口令仍有效，请立即改密。</span> : null}
        </div>
      ) : setupCompleted ? (
        <div className="alert alert--ok">控制台首次引导已完成，可以继续进入其它页面。</div>
      ) : null}

      <section className="setup-wizard-page__grid">
        <div className="panel setup-wizard-page__card">
          <div className="setup-wizard-page__card-head">
            <div>
              <h3 className="setup-wizard-page__title">步骤 1 · 改控制台口令</h3>
              <p className="muted setup-wizard-page__lead">口令至少 8 位；保存后会自动刷新 setup 状态。</p>
            </div>
            <span className={`setup-wizard-page__pill${setupCompleted ? " is-done" : requiresSetup ? " is-warn" : ""}`}>
              {setupCompleted ? "已完成" : "待处理"}
            </span>
          </div>
          {pwdErr ? <div className="alert alert--err setup-wizard-page__inline-alert">{pwdErr}</div> : null}
          {pwdOk ? <div className="alert alert--ok setup-wizard-page__inline-alert">{pwdOk}</div> : null}
          <div className="setup-wizard-page__field">
            <label className="setup-wizard-page__label">新口令</label>
            <input className="inp" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} />
          </div>
          <div className="setup-wizard-page__field">
            <label className="setup-wizard-page__label">确认口令</label>
            <input className="inp" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
          </div>
          <div className="setup-wizard-page__actions">
            <button type="button" className="btn btn--primary" disabled={pwdBusy} onClick={() => void submitPassword()}>
              {pwdBusy ? "提交中…" : "保存口令"}
            </button>
            <Link to="/preferences#console-password" className="btn">
              前往偏好页
            </Link>
          </div>
        </div>

        <div className="panel setup-wizard-page__card">
          <div className="setup-wizard-page__card-head">
            <div>
              <h3 className="setup-wizard-page__title">步骤 2 · 连接协议端</h3>
              <p className="muted setup-wizard-page__lead">在 NapCat / SnowLuma 等协议端创建账号并连上 Bot。</p>
            </div>
            <span className="setup-wizard-page__pill">推荐</span>
          </div>
          <div className="setup-wizard-page__action-stack">
            {canEnter ? (
              <>
                <Link to="/protocol" className="btn btn--block">
                  打开协议端管理
                </Link>
                <Link to="/instances" className="btn btn--block">
                  查看实例与连接
                </Link>
              </>
            ) : (
              <>
                <button type="button" className="btn" disabled>
                  完成改密后可配置协议端
                </button>
                <button type="button" className="btn" disabled>
                  完成改密后可查看实例
                </button>
              </>
            )}
          </div>
        </div>

        <div className="panel setup-wizard-page__card">
          <div className="setup-wizard-page__card-head">
            <div>
              <h3 className="setup-wizard-page__title">步骤 3 · 扩展与插件</h3>
              <p className="muted setup-wizard-page__lead">按需安装官方扩展；语料复读与群玩法不依赖 AI 服务。</p>
            </div>
            <span className="setup-wizard-page__pill">推荐</span>
          </div>
          <div className="setup-wizard-page__action-stack">
            {canEnter ? (
              <>
                <Link to="/plugin-store" className="btn btn--block">
                  打开插件商店
                </Link>
                <Link to="/plugins" className="btn btn--block">
                  查看已加载插件
                </Link>
              </>
            ) : (
              <>
                <button type="button" className="btn" disabled>
                  完成改密后可安装扩展
                </button>
                <button type="button" className="btn" disabled>
                  完成改密后可查看插件
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="panel setup-wizard-page__card">
        <div className="setup-wizard-page__card-head">
          <div>
            <h3 className="setup-wizard-page__title">完成后去哪里</h3>
            <p className="muted setup-wizard-page__lead">如果你是从其他页面被收口过来的，完成后可以直接回去。</p>
          </div>
        </div>
        <div className="setup-wizard-page__actions">
          <button type="button" className="btn btn--primary" disabled={!canEnter} onClick={() => navigate(redirectTarget)}>
            继续到 {redirectTargetLabel}
          </button>
          <Link to="/" className="btn">
            回到仪表盘
          </Link>
        </div>
      </div>
    </div>
  );
}
