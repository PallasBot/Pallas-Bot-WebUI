import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCommonConfigSections } from "@/api/fullConsole";
import CommonConfigForm from "@/components/CommonConfigForm";
import PageHeader from "@/components/PageHeader";
import StateBlock from "@/components/StateBlock";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

export default function CommonConfigPage() {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"form" | "raw">("form");

  const sectionsQ = useQuery({
    queryKey: ["common-config-sections"],
    queryFn: fetchCommonConfigSections,
  });

  const filtered = useMemo(() => {
    const list = sectionsQ.data || [];
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((x) => `${x.id} ${x.title}`.toLowerCase().includes(s));
  }, [sectionsQ.data, q]);

  if (!sectionId) {
    return (
      <div className="common-config-page console-hub-page">
        <PageHeader title="通用配置" description="控制台 common-config 各段；点击进入编辑。" />
        <div className="console-hub-page__search-wrap mb-4 max-w-md">
          <input
            className="inp console-hub-page__search-input"
            placeholder="搜索段…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <StateBlock loading={sectionsQ.isLoading} error={sectionsQ.error} empty={!filtered.length}>
          <div className="common-config-page__grid">
            {filtered.map((s) => (
              <Link key={s.id} to={`/common-config/${encodeURIComponent(s.id)}`} className="common-config-page__card-link">
                <section className="panel common-config-page__card">
                  <div className="panel__bd">
                    <div className="common-config-page__card-title">{s.title}</div>
                    <div className="muted common-config-page__card-id">{s.id}</div>
                  </div>
                </section>
              </Link>
            ))}
          </div>
        </StateBlock>
      </div>
    );
  }

  return (
    <div className="common-config-page console-hub-page">
      <PageHeader
        title={sectionId}
        description="通用配置段编辑"
        actions={
          <button type="button" className="btn" onClick={() => navigate("/common-config")}>
            返回列表
          </button>
        }
      />
      <section className="panel common-config-page__card mb-4">
        <div className="panel__hd panel__hd--split">
          <h2 className="panel__title">编辑模式</h2>
        </div>
        <div className="panel__bd">
          <div className="console-view-toggle">
            <button type="button" className={cn(mode === "form" && "is-on")} onClick={() => setMode("form")}>
              表单
            </button>
            <button type="button" className={cn(mode === "raw" && "is-on")} onClick={() => setMode("raw")}>
              Raw TOML
            </button>
          </div>
        </div>
      </section>
      <section className="panel common-config-page__card">
        <div className="panel__bd">
          <CommonConfigForm sectionId={sectionId} mode={mode} savedMessage={mode === "raw" ? "原始配置已保存" : "已保存"} />
        </div>
      </section>
    </div>
  );
}
