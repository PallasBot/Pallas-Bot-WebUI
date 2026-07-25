import { useCallback, useEffect, useMemo, useState, type ClipboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createCommunityGalleryPost,
  deleteCommunityGalleryPost,
  fetchCommunityGallery,
  fetchInstances,
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
import type { CommunityGalleryPost } from "@/api/consoleApi";

const GALLERY_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function shortPostTime(unix: number): string {
  if (!unix) return "";
  try {
    return new Date(unix * 1000).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** 是否绑定了 Bot 身份（社区主站带图会直接放图，无 Bot 的本机列表也用截图瓦片） */
function galleryPostHasBot(post: CommunityGalleryPost): boolean {
  const qq = post.qq;
  if (qq != null && Number(qq) > 0) return true;
  return Boolean((post.avatar_url || "").trim());
}

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

  const botsVisible = useMemo(() => botPickerRowsFromInstances(instQ.data), [instQ.data]);
  const [selfIdStr, setSelfIdStr] = useState("");
  const [text, setText] = useState("");
  const [nickname, setNickname] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const imagePreviewUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => {
    if (!imagePreviewUrl) return;
    return () => URL.revokeObjectURL(imagePreviewUrl);
  }, [imagePreviewUrl]);

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
        source: "manual",
        image,
      });
      pushConsoleToast("已投稿到社区中心", "ok");
      setText("");
      setImage(null);
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
            可选 Bot 账号以带上头像昵称（社区主站渲染发言卡）；不指定账号的带图投稿在社区主站直接展示截图。截图可能含群名或
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
                "flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-2",
                "rounded-[var(--radius-control,8px)] border border-dashed border-[var(--control-edge)]",
                "bg-muted/40 px-3 py-4 text-sm text-muted-foreground",
                "outline-none focus-visible:border-[color-mix(in_srgb,var(--accent)_16%,var(--control-border))]",
                "focus-visible:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_8%,transparent)]",
                imagePreviewUrl && "items-stretch",
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
              {image && imagePreviewUrl ? (
                <>
                  <img
                    src={imagePreviewUrl}
                    alt="投稿预览"
                    className="mx-auto max-h-56 w-auto max-w-full rounded-[var(--radius-control,8px)] object-contain"
                  />
                  <span className="truncate text-center text-xs text-muted-foreground">
                    {image.name}（{(image.size / 1024).toFixed(0)} KB）· 点击可更换
                  </span>
                </>
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
            <ul className="grid gap-3 sm:grid-cols-2">
              {mineQ.data.posts.map((post) => {
                const asShot = Boolean(post.image_url) && !galleryPostHasBot(post);
                if (asShot) {
                  return (
                    <li
                      key={post.id}
                      className="relative overflow-hidden rounded-[var(--radius-control,8px)] border border-[var(--control-edge)] bg-muted/30"
                    >
                      <a
                        href={post.image_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                        title="查看原图"
                      >
                        <img
                          src={post.image_url!}
                          alt=""
                          className="mx-auto max-h-48 w-full object-contain"
                          loading="lazy"
                        />
                      </a>
                      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/45 to-transparent p-2">
                        <span className="rounded px-1.5 py-0.5 text-[11px] text-white/90">
                          {shortPostTime(post.created_unix) || "截图"}
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="size-8 shrink-0 bg-background/90"
                          disabled={busy}
                          aria-label="撤下"
                          onClick={() => void onDelete(post.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      {post.text ? (
                        <p className="border-t border-[var(--control-edge)] px-2.5 py-1.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                          {post.text}
                        </p>
                      ) : null}
                    </li>
                  );
                }

                return (
                  <li
                    key={post.id}
                    className="flex flex-col gap-2 rounded-[var(--radius-control,8px)] border border-[var(--control-edge)] bg-muted/20 p-3"
                  >
                    <div className="flex items-start gap-2">
                      {post.avatar_url ? (
                        <img
                          src={post.avatar_url}
                          alt=""
                          className="size-7 shrink-0 rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="size-7 shrink-0 rounded-full bg-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
                          aria-hidden
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium leading-tight">
                          {post.nickname || "牛牛"}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {shortPostTime(post.created_unix)}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        disabled={busy}
                        aria-label="撤下"
                        onClick={() => void onDelete(post.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    {post.text ? (
                      <p className="rounded-[4px_10px_10px_10px] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2.5 py-1.5 text-xs leading-snug text-foreground [overflow-wrap:anywhere]">
                        {post.text}
                      </p>
                    ) : null}
                    {post.image_url ? (
                      <a
                        href={post.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-[var(--radius-control,8px)] border border-[var(--control-edge)] bg-muted/40"
                        title="查看原图"
                      >
                        <img
                          src={post.image_url}
                          alt=""
                          className="mx-auto max-h-40 w-full object-contain"
                          loading="lazy"
                        />
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
