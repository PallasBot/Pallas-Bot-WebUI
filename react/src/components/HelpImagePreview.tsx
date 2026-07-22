import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosErrorDetail } from "@/api/http";
import { fetchHelpPreviewBlob, buildHelpPreviewUrl } from "@/api/fullConsole";
import { fetchPlugins } from "@/api/console";
import {
  listHelpPreviewFunctionOptions,
  listHelpPreviewPluginOptions,
  pickDefaultHelpPreviewFunction,
} from "@/utils/helpPreviewOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Level = "menu" | "plugin" | "function";

type Props = {
  embedded?: boolean;
  defaultPlugin?: string;
};

export default function HelpImagePreview({ embedded = false, defaultPlugin = "help" }: Props) {
  const [level, setLevel] = useState<Level>("menu");
  const [page, setPage] = useState(1);
  const [plugin, setPlugin] = useState(defaultPlugin.trim() || "help");
  const [functionName, setFunctionName] = useState("1");
  const [cacheBust, setCacheBust] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErr, setPreviewErr] = useState("");

  const pluginsQ = useQuery({ queryKey: ["plugins"], queryFn: () => fetchPlugins() });
  const pluginRows = pluginsQ.data || [];

  const pluginOptions = useMemo(() => listHelpPreviewPluginOptions(pluginRows), [pluginRows]);
  const selectedPluginRow = useMemo(
    () => pluginRows.find((row) => row.name === plugin) ?? null,
    [pluginRows, plugin],
  );
  const functionOptions = useMemo(
    () => listHelpPreviewFunctionOptions(selectedPluginRow),
    [selectedPluginRow],
  );

  const previewUrlRef = useRef<string | null>(null);

  function revokePreviewUrl() {
    if (previewUrlRef.current?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = null;
    setPreviewUrl(null);
  }

  useEffect(() => {
    if (!pluginOptions.length) return;
    if (!pluginOptions.some((item) => item.value === plugin)) {
      const preferred = defaultPlugin.trim() || "help";
      setPlugin(pluginOptions.some((item) => item.value === preferred) ? preferred : pluginOptions[0].value);
    }
  }, [pluginOptions, plugin, defaultPlugin]);

  useEffect(() => {
    if (level !== "function") return;
    setFunctionName((cur) => pickDefaultHelpPreviewFunction(functionOptions, cur));
  }, [level, functionOptions]);

  useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      setPreviewLoading(true);
      setPreviewErr("");
      revokePreviewUrl();
      try {
        const blob = await fetchHelpPreviewBlob({
          level,
          page: level === "menu" ? page : undefined,
          plugin: level !== "menu" ? plugin : undefined,
          function: level === "function" ? functionName : undefined,
        });
        if (cancelled) return;
        if (!blob.type.startsWith("image/")) {
          const text = await blob.text();
          try {
            const parsed = JSON.parse(text) as { detail?: string };
            setPreviewErr(parsed.detail || text || "预览返回非图片");
          } catch {
            setPreviewErr(text || "预览返回非图片");
          }
          return;
        }
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
      } catch (e) {
        if (!cancelled) setPreviewErr(axiosErrorDetail(e));
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }
    void loadPreview();
    return () => {
      cancelled = true;
    };
    // cacheBust triggers manual refresh
  }, [level, page, plugin, functionName, cacheBust]);

  useEffect(() => () => revokePreviewUrl(), []);

  return (
    <section
      className={embedded ? "space-y-3" : "space-y-3 rounded-lg border p-3"}
      aria-label="帮助图预览"
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-wrap gap-1 rounded-md border p-1" role="tablist" aria-label="帮助图预览级别">
          {(
            [
              ["menu", "菜单"],
              ["plugin", "插件"],
              ["function", "功能"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              className={`rounded px-2 py-1 text-sm ${level === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              aria-selected={level === id}
              onClick={() => setLevel(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {level === "menu" ? (
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">页码</span>
            <Input
              type="number"
              min={1}
              className="w-20"
              value={page}
              onChange={(e) => setPage(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
            />
          </label>
        ) : null}

        {level === "plugin" || level === "function" ? (
          <label className="grid min-w-[10rem] flex-1 gap-1 text-sm">
            <span className="text-muted-foreground">插件</span>
            <select
              className="h-9 rounded-md border bg-background px-3"
              value={plugin}
              disabled={pluginsQ.isLoading || !pluginOptions.length}
              onChange={(e) => setPlugin(e.target.value)}
            >
              {pluginsQ.isLoading ? <option value="">加载插件列表…</option> : null}
              {pluginOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {level === "function" ? (
          <label className="grid min-w-[10rem] flex-1 gap-1 text-sm">
            <span className="text-muted-foreground">功能</span>
            <select
              className="h-9 rounded-md border bg-background px-3"
              value={functionName}
              disabled={!functionOptions.length}
              onChange={(e) => setFunctionName(e.target.value)}
            >
              {!functionOptions.length ? (
                <option value="1" disabled>
                  该插件暂无功能项
                </option>
              ) : null}
              {functionOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <Button size="sm" variant="outline" disabled={previewLoading} onClick={() => setCacheBust(Date.now())}>
          {previewLoading ? "加载中…" : "刷新预览"}
        </Button>
        <a
          className="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted/50"
          href={buildHelpPreviewUrl({
            level,
            page: level === "menu" ? page : undefined,
            plugin: level !== "menu" ? plugin : undefined,
            function: level === "function" ? functionName : undefined,
            cacheBust,
          })}
          target="_blank"
          rel="noreferrer"
        >
          新标签打开
        </a>
      </div>

      {pluginsQ.error ? (
        <p className="text-sm text-muted-foreground">插件列表加载失败：{axiosErrorDetail(pluginsQ.error)}</p>
      ) : null}

      <div className="flex min-h-[10rem] items-center justify-center rounded-lg border bg-muted/30 p-3">
        {previewLoading && !previewUrl ? (
          <p className="text-sm text-muted-foreground">正在生成预览…</p>
        ) : previewErr ? (
          <p className="text-sm text-destructive" role="alert">
            {previewErr}
          </p>
        ) : previewUrl ? (
          <img src={previewUrl} alt="帮助图预览" className="max-h-[28rem] w-full max-w-3xl object-contain" />
        ) : (
          <p className="text-sm text-muted-foreground">暂无预览</p>
        )}
      </div>
    </section>
  );
}
