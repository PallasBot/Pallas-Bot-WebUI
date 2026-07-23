import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { axiosErrorDetail } from "@/api/http";
import { fetchCommunityCorpusHot, fetchLocalCorpusHot } from "@/api/fullConsole";
import type { CommunityCorpusHotData, CommunityHotTab } from "@/api/pallasTypes";
import { rankHotItems, type HotTagNode } from "@/utils/hotBubbleLayout";
import { cn } from "@/lib/utils";

const communityTabs: Array<{ key: CommunityHotTab; label: string }> = [
  { key: "fleet", label: "机群" },
  { key: "pool", label: "高频池" },
  { key: "month", label: "本月" },
];

function pillClasses(node: HotTagNode, selected: string | null): string {
  const classes = ["corpus-hot__pill", `corpus-hot__pill--${node.sizeClass}`];
  if (node.rank <= 3) classes.push(`corpus-hot__pill--top${node.rank}`);
  if (node.item.keywords === selected) classes.push("corpus-hot__pill--active");
  return classes.join(" ");
}

export default function CorpusWordCloud({
  source = "community",
  reloadToken = 0,
}: {
  source?: "community" | "local";
  reloadToken?: number;
}) {
  const [tab, setTab] = useState<CommunityHotTab>("fleet");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState<CommunityCorpusHotData | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<string | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudEntering, setCloudEntering] = useState(false);
  const enterTimerRef = useRef<number | null>(null);

  const tabLabel = communityTabs.find((row) => row.key === tab)?.label || "机群";

  const scopeLabel =
    source === "local"
      ? "本机累计"
      : tab === "fleet"
        ? "近24h机群叠加"
        : tab === "pool"
          ? "社区高频池"
          : `${tabLabel}近期活跃`;

  const statusHint =
    source === "local" || tab === "fleet" ? "越大越热 · 点选查看" : "越大越热 · 点选看回复";

  const items = data?.items || [];
  const rankedNodes = useMemo(() => rankHotItems(items), [items]);
  const selectedItem = items.find((item) => item.keywords === selectedKeywords) || null;
  const selectedRank =
    selectedKeywords != null
      ? rankedNodes.find((node) => node.item.keywords === selectedKeywords)?.rank ?? null
      : null;

  const triggerCloudEnter = useCallback(() => {
    setCloudEntering(true);
    if (enterTimerRef.current != null) window.clearTimeout(enterTimerRef.current);
    enterTimerRef.current = window.setTimeout(() => {
      setCloudEntering(false);
      enterTimerRef.current = null;
    }, 640);
  }, []);

  const loadHot = useCallback(
    async (bypassCache = false) => {
      const tabSwitch = cloudLoading;
      setBusy(true);
      setErr("");
      try {
        const next =
          source === "local"
            ? await fetchLocalCorpusHot({ bypassCache })
            : await fetchCommunityCorpusHot(tab, { bypassCache });
        setData(next);
        if (selectedKeywords && !next.items.some((item) => item.keywords === selectedKeywords)) {
          setSelectedKeywords(null);
        }
        if (tabSwitch && rankHotItems(next.items).length) {
          triggerCloudEnter();
        }
      } catch (e) {
        setData(null);
        setSelectedKeywords(null);
        setErr(axiosErrorDetail(e));
      } finally {
        setBusy(false);
        setCloudLoading(false);
      }
    },
    [cloudLoading, selectedKeywords, source, tab, triggerCloudEnter],
  );

  useEffect(() => {
    void loadHot();
  }, [source, tab]);

  useEffect(() => {
    if (reloadToken > 0) void loadHot(true);
  }, [reloadToken]);

  useEffect(
    () => () => {
      if (enterTimerRef.current != null) window.clearTimeout(enterTimerRef.current);
    },
    [],
  );

  function selectTab(next: CommunityHotTab) {
    if (next === tab || busy) return;
    if (items.length) setCloudLoading(true);
    setTab(next);
    setSelectedKeywords(null);
  }

  function toggleKeyword(keywords: string) {
    setSelectedKeywords((cur) => (cur === keywords ? null : keywords));
  }

  return (
    <div className="corpus-hot">
      {source === "community" ? (
        <div className="corpus-hot__tabs console-view-toggle" role="tablist" aria-label="热词统计范围">
          {communityTabs.map((row) => (
            <button
              key={row.key}
              type="button"
              className={cn(tab === row.key && "is-on")}
              role="tab"
              aria-selected={tab === row.key}
              disabled={busy}
              onClick={() => selectTab(row.key)}
            >
              {row.label}
            </button>
          ))}
        </div>
      ) : null}

      {busy && !items.length ? (
        <p className="muted corpus-hot__status">加载{scopeLabel}热词…</p>
      ) : err ? (
        <p className="alert alert--warn corpus-hot__status">热词加载失败：{err}</p>
      ) : !items.length ? (
        <p className="muted corpus-hot__status">
          {source === "local"
            ? "暂无本机语料热词。日常接话学习后，这里会展示本部署累计最热触发词。"
            : tab === "fleet"
              ? "暂无机群热词。各部署开启语料贡献并上报心跳后，这里会展示近24h热词叠加榜。"
              : tab === "pool"
                ? "暂无共享语料高频词。接入并贡献语料后，这里会展示社区累计最热触发词。"
                : "该时段暂无近期活跃热词。可切换到「机群」或「高频池」查看。"}
        </p>
      ) : (
        <p className="muted corpus-hot__status">
          {scopeLabel} · {statusHint}
        </p>
      )}

      {items.length ? (
        <div
          className={cn("corpus-hot__canvas", cloudLoading && "corpus-hot__canvas--loading")}
          aria-label="共享语料热词云"
        >
          <div
            className={cn(
              "corpus-hot__cloud",
              selectedKeywords && "corpus-hot__cloud--selected",
              cloudEntering && "corpus-hot__cloud--tab-enter",
            )}
            role="list"
          >
            {rankedNodes.map((node, index) => (
              <button
                key={node.item.keywords}
                type="button"
                className={pillClasses(node, selectedKeywords)}
                style={
                  {
                    "--heat": node.scoreRatio.toFixed(3),
                    "--pill-i": String(index),
                  } as CSSProperties
                }
                role="listitem"
                aria-pressed={node.item.keywords === selectedKeywords}
                title={`${node.item.keywords} · 热度 ${node.item.score}`}
                onClick={() => toggleKeyword(node.item.keywords)}
              >
                {node.rank <= 3 ? (
                  <span className="corpus-hot__pill-rank" aria-hidden="true">
                    {node.rank}
                  </span>
                ) : null}
                <span className="corpus-hot__pill-word">{node.item.keywords}</span>
                <span className="corpus-hot__pill-score">{node.item.score}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {selectedItem ? (
        <div className="corpus-hot__detail" aria-live="polite">
          <div className="corpus-hot__detail-panel">
            <div className="corpus-hot__detail-hd">
              <div className="corpus-hot__detail-heading">
                {selectedRank != null && selectedRank <= 3 ? (
                  <span className="corpus-hot__detail-rank">#{selectedRank}</span>
                ) : null}
                <h3 className="corpus-hot__detail-title">{selectedItem.keywords}</h3>
                <p className="corpus-hot__detail-meta muted">
                  {source === "local" || tab === "pool"
                    ? `累计热度 ${selectedItem.score}`
                    : tab === "fleet"
                      ? `机群叠加热度 ${selectedItem.score}`
                      : `${tabLabel}热度 ${selectedItem.score}`}
                </p>
              </div>
              <button type="button" className="corpus-hot__detail-close" aria-label="收起详情" onClick={() => setSelectedKeywords(null)}>
                收起
              </button>
            </div>
            <ul className="corpus-hot__reply-list">
              {!selectedItem.answers.length ? (
                <li className="corpus-hot__reply corpus-hot__reply--empty muted">
                  {tab === "fleet" ? "机群榜不含代表回复" : "暂无代表回复"}
                </li>
              ) : (
                selectedItem.answers.map((answer, idx) => (
                  <li key={`${selectedItem.keywords}-${idx}`} className="corpus-hot__reply">
                    <p className="corpus-hot__reply-text">{answer.message || answer.answer_keywords || "（无文案）"}</p>
                    <p className="corpus-hot__reply-hint muted">引用 {answer.count} 次</p>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
