import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PenLine, Search, ArrowLeft } from "lucide-react";
import { fetchCommonConfigSections } from "@/api/fullConsole";
import CommonConfigForm from "@/components/CommonConfigForm";
import ChromeTools, { CHROME_SEARCH_INPUT } from "@/components/ChromeTools";
import PageMasthead from "@/components/PageMasthead";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import SegTabs from "@/components/SegTabs";
import StateBlock from "@/components/StateBlock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <PageMasthead title="通用配置" description="通用配置各段。" />
        <ChromeTools>
          <div className="relative min-w-[8rem] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--text-muted)]"
              strokeWidth={1.75}
              aria-hidden
            />
            <Input
              type="search"
              className={CHROME_SEARCH_INPUT}
              placeholder="搜索配置…"
              aria-label="搜索配置"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </ChromeTools>
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
      <PageMasthead
        title={sectionId}
        description="通用配置段编辑"
        actions={
          <Button type="button" variant="ghost" size="sm" icon={ArrowLeft} iconMotion="back" onClick={() => navigate("/common-config")}>
            返回列表
          </Button>
        }
      />
      <section className="panel common-config-page__card">
        <div className="panel__hd panel__hd--split">
          <h2 className="panel__title flex items-center gap-1.5">
            <PanelTitleIcon icon={PenLine} />
            编辑模式
          </h2>
        </div>
        <div className="panel__bd">
          <SegTabs
            ariaLabel="编辑模式"
            value={mode}
            onValueChange={(v) => setMode(v === "raw" ? "raw" : "form")}
            options={[
              { value: "form", label: "表单" },
              { value: "raw", label: "Raw TOML" },
            ]}
          />
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
