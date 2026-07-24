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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SegTabs from "@/components/SegTabs";

type Level = "menu" | "plugin" | "function";

const LEVEL_OPTIONS = [
  { value: "menu", label: "菜单" },
  { value: "plugin", label: "插件" },
  { value: "function", label: "功能" },
] as const;

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
        <SegTabs
          ariaLabel="帮助图预览级别"
          value={level}
          onValueChange={(v) => setLevel(v as Level)}
          options={[...LEVEL_OPTIONS]}
        />

        {level === "menu" ? (
          <label className="inline-flex shrink-0 items-center gap-1 text-sm">
            <span className="text-muted-foreground whitespace-nowrap">页码</span>
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
            <Select
              value={pluginsQ.isLoading ? "__loading__" : plugin}
              disabled={pluginsQ.isLoading || !pluginOptions.length}
              onValueChange={setPlugin}
            >
              <SelectTrigger className="w-full" aria-label="插件">
                <SelectValue placeholder="选择插件" />
              </SelectTrigger>
              <SelectContent>
                {pluginsQ.isLoading ? (
                  <SelectItem value="__loading__" disabled>
                    加载插件列表…
                  </SelectItem>
                ) : null}
                {!pluginsQ.isLoading &&
                plugin &&
                !pluginOptions.some((item) => item.value === plugin) ? (
                  <SelectItem value={plugin}>{plugin}</SelectItem>
                ) : null}
                {pluginOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ) : null}

        {level === "function" ? (
          <label className="grid min-w-[10rem] flex-1 gap-1 text-sm">
            <span className="text-muted-foreground">功能</span>
            <Select
              value={functionOptions.length ? functionName : "__empty__"}
              disabled={!functionOptions.length}
              onValueChange={setFunctionName}
            >
              <SelectTrigger className="w-full" aria-label="功能">
                <SelectValue placeholder="选择功能" />
              </SelectTrigger>
              <SelectContent>
                {!functionOptions.length ? (
                  <SelectItem value="__empty__" disabled>
                    该插件暂无功能项
                  </SelectItem>
                ) : null}
                {functionOptions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ) : null}

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-[13px]"
            disabled={previewLoading}
            onClick={() => setCacheBust(Date.now())}
          >
            {previewLoading ? "加载中…" : "刷新预览"}
          </Button>
          <Button size="sm" variant="outline" className="text-[13px]" asChild>
            <a
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
          </Button>
        </div>
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
