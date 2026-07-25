import { useCallback, useMemo, useState, type ClipboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createCommunityGalleryPost,
  deleteCommunityGalleryPost,
  fetchCommunityGallery,
  fetchInstances,
  fetchLocalCorpusHot,
} from "@/api/fullConsole";
import { axiosErrorDetail } from "@/api/http";
import type { BotRow } from "@/api/pallasTypes";
import BotSelectLabel from "@/components/BotSelectLabel";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { botPickerRowsFromInstances, botSelectDropdownLabel, qqAvatarUrl } from "@/utils/botDisplay";
import { pushConsoleToast } from "@/utils/consoleToast";
import { Images, List, Trash2 } from "lucide-react";

const GALLERY_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function pickClipboardImage(dt: DataTransfer | null): File | null {
  if (!dt) return null;
  for (const file of Array.from(dt.files || [])) {
    if (GALLERY_IMAGE_TYPES.has(file.type)) return file;
  }
  for (const item of Array.from(dt.items || [])) {
    if (item.kind !== "file" || !GALLERY_IMAGE_TYPES.has(item.type)) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return null;
}

export default function CommunityGallerySection() {
  const instQ = useQuery({ queryKey: ["instances"], queryFn: () => fetchInstances() });
  const mineQ = useQuery({
    queryKey: ["community-gallery-mine"],
    queryFn: () => fetchCommunityGallery({ mine: true, limit: 30 }),
  });
  const localHotQ = useQuery({
    queryKey: ["local-corpus-hot-gallery"],
    queryFn: () => fetchLocalCorpusHot({ limit: 40 }),
  });

  const botsVisible = useMemo(() => botPickerRowsFromInstances(instQ.data), [instQ.data]);
  const [selfIdStr, setSelfIdStr] = useState("");
  const [text, setText] = useState("");
  const [nickname, setNickname] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [source, setSource] = useState<"manual" | "local_corpus">("manual");
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);

  function profileNick(selfId: string): string {
    return instQ.data?.bot_profiles?.[selfId]?.nickname?.trim() || "";
  }

  function botOptionTitle(b: BotRow): string {
    return botSelectDropdownLabel(profileNick(b.self_id), b.self_id);
  }

  const selfIdNum = useMemo(() => {
    const n = parseInt(selfIdStr, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [selfIdStr]);

  const effectiveNick = useMemo(() => {
    if (nickname.trim()) return nickname.trim();
    if (!selfIdStr) return "牛牛";
    return profileNick(selfIdStr) || `牛牛${selfIdStr}`;
  }, [nickname, selfIdStr, instQ.data?.bot_profiles]);

  const onPickLocalAnswer = useCallback((message: string, kw: string) => {
    setText(message);
    setKeywords(kw);
    setSource("local_corpus");
  }, []);

  const applyImageFile = useCallback((file: File | null | undefined) => {
    if (!file) return;
    if (!GALLERY_IMAGE_TYPES.has(file.type)) {
      pushConsoleToast("仅支持 JPEG / PNG / WebP / GIF", "warn");
      return;
    }
    setImage(file);
  }, []);

  const onPasteImage = useCallback(
    (e: ClipboardEvent) => {
      const file = pickClipboardImage(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      applyImageFile(file);
    },
    [applyImageFile],
  );

  async function onSubmit() {
    if (!text.trim() && !image) {
      pushConsoleToast("请填写正文或拖入/粘贴图片", "warn");
      return;
    }
    setBusy(true);
    try {
      await createCommunityGalleryPost({
        text: text.trim(),
        nickname: effectiveNick,
        avatarUrl: selfIdNum != null ? qqAvatarUrl(selfIdNum) : "",
        botQq: selfIdNum,
        source,
        keywords,
        image,
      });
      pushConsoleToast("已投稿到社区中心", "ok");
      setText("");
      setImage(null);
      setKeywords("");
      setSource("manual");
      await mineQ.refetch();
    } catch (e) {
      pushConsoleToast(axiosErrorDetail(e), "err");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    try {
      await deleteCommunityGalleryPost(id);
      pushConsoleToast("已撤下", "ok");
      await mineQ.refetch();
    } catch (e) {
      pushConsoleToast(axiosErrorDetail(e), "err");
    } finally {
      setBusy(false);
    }
  }

  const localAnswers = useMemo(() => {
    const items = localHotQ.data?.items ?? [];
    const rows: Array<{ keywords: string; message: string }> = [];
    for (const item of items) {
      for (const ans of item.answers || []) {
        const msg = (ans.message || ans.answer_keywords || "").trim();
        if (!msg) continue;
        rows.push({ keywords: item.keywords, message: msg });
        if (rows.length >= 24) return rows;
      }
    }
    return rows;
  }, [localHotQ.data]);

  const selectedBotTitle = useMemo(() => {
    if (!selfIdStr) return undefined;
    const cur = botsVisible.find((b) => b.self_id === selfIdStr);
    return cur ? botOptionTitle(cur) : selfIdStr;
  }, [botsVisible, selfIdStr, instQ.data?.bot_profiles]);

  return (
    <section id="community-gallery" className="community-page__section flex flex-col gap-4">
      <Card onPaste={onPasteImage}>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <PanelTitleIcon icon={Images} />
            社区投稿
          </CardTitle>
          <CardDescription>
            可选 Bot 账号以带上头像昵称；也可只拖入/粘贴截图或填正文投稿。纯文字在社区主站以模拟发言卡展示，带图投稿直接展示截图。截图可能含群名或
            QQ，提交即公开展示。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gallery-bot">账号</Label>
              <Select
                value={selfIdStr || "__none__"}
                onValueChange={(v) => {
                  const next = v === "__none__" ? "" : v;
                  setSelfIdStr(next);
                  if (next && !nickname.trim()) {
                    setNickname(profileNick(next) || `牛牛${next}`);
                  }
                }}
              >
                <SelectTrigger id="gallery-bot" className="w-full" aria-label="当前 Bot 账号" title={selectedBotTitle}>
                  <SelectValue placeholder="可选 Bot…" />
                </SelectTrigger>
                <SelectContent align="start" className="min-w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="__none__">不指定账号</SelectItem>
                  {botsVisible.map((b) => (
                    <SelectItem key={b.self_id} value={b.self_id}>
                      <BotSelectLabel nickname={profileNick(b.self_id)} account={b.self_id} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gallery-nick">展示昵称</Label>
              <Input
                id="gallery-nick"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="可选；默认 牛牛 / 资料昵称"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gallery-text">正文</Label>
            <Textarea
              id="gallery-text"
              className="min-h-[96px]"
              value={text}
              maxLength={500}
              onChange={(e) => setText(e.target.value)}
              placeholder="输入有趣的牛牛发言…"
            />
          </div>

          <div className="space-y-2">
            <Label>图片（可选）</Label>
            <label
              tabIndex={0}
              className={cn(
                "flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-1",
                "rounded-[var(--radius-control,8px)] border border-dashed border-[var(--control-edge)]",
                "bg-muted/40 px-3 py-4 text-sm text-muted-foreground",
                "outline-none focus-visible:border-[color-mix(in_srgb,var(--accent)_16%,var(--control-border))]",
                "focus-visible:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_8%,transparent)]",
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                applyImageFile(e.dataTransfer.files?.[0]);
              }}
              onPaste={onPasteImage}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => applyImageFile(e.target.files?.[0])}
              />
              {image ? (
                <span className="text-foreground">
                  已选 {image.name}（{(image.size / 1024).toFixed(0)} KB）
                </span>
              ) : (
                <span>点击、拖入或粘贴截图（≤3MB）</span>
              )}
            </label>
            {image ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setImage(null)}>
                清除图片
              </Button>
            ) : null}
          </div>

          {localAnswers.length ? (
            <div className="space-y-2">
              <Label>从本机热词选取</Label>
              <div className="max-h-40 space-y-1 overflow-auto rounded-[var(--radius-control,8px)] border border-[var(--control-edge)] p-1.5">
                {localAnswers.map((row) => {
                  const active = text === row.message && keywords === row.keywords;
                  return (
                    <button
                      key={`${row.keywords}-${row.message}`}
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-2 rounded-[var(--radius-control,8px)] px-2.5 py-1.5 text-left text-xs",
                        "hover:bg-muted/60",
                        active && "bg-muted text-foreground",
                      )}
                      title={row.message}
                      onClick={() => onPickLocalAnswer(row.message, row.keywords)}
                    >
                      <span className="min-w-0 flex-1 truncate text-foreground">{row.message}</span>
                      <span className="shrink-0 text-muted-foreground">{row.keywords}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="button" disabled={busy} onClick={() => void onSubmit()}>
            {busy ? "提交中…" : "投稿到社区中心"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <PanelTitleIcon icon={List} />
            本部署已投稿
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!mineQ.data?.posts?.length ? (
            <p className="text-sm text-muted-foreground">暂无记录</p>
          ) : (
            <ul className="divide-y divide-border rounded-[var(--radius-control,8px)] border border-[var(--control-edge)]">
              {mineQ.data.posts.map((post) => (
                <li key={post.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{post.nickname}</div>
                    <div className="truncate text-xs text-muted-foreground">{post.text || "（仅图片）"}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    disabled={busy}
                    aria-label="撤下"
                    onClick={() => void onDelete(post.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
