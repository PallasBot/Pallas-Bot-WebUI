import { useCallback, useMemo, useState } from "react";
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
import ChromeField from "@/components/ChromeField";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import UiButton from "@/components/ui/UiButton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { botPickerRowsFromInstances, botSelectDropdownLabel, qqAvatarUrl } from "@/utils/botDisplay";
import { pushConsoleToast } from "@/utils/consoleToast";
import { Bot, Images, Trash2 } from "lucide-react";
import BotSelectLabel from "@/components/BotSelectLabel";

const ACCOUNT_SEL =
  "bot-acct-sel h-8 w-[9rem] min-w-[7.5rem] max-w-[9rem] shrink-0 overflow-hidden";

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
    if (!selfIdStr) return "";
    return profileNick(selfIdStr) || `牛牛${selfIdStr}`;
  }, [nickname, selfIdStr, instQ.data?.bot_profiles]);

  const onPickLocalAnswer = useCallback((message: string, kw: string) => {
    setText(message);
    setKeywords(kw);
    setSource("local_corpus");
  }, []);

  async function onSubmit() {
    if (selfIdNum == null) {
      pushConsoleToast("请先选择 Bot", "warn");
      return;
    }
    if (!effectiveNick) {
      pushConsoleToast("请填写昵称", "warn");
      return;
    }
    if (!text.trim() && !image) {
      pushConsoleToast("请填写正文或拖入图片", "warn");
      return;
    }
    setBusy(true);
    try {
      await createCommunityGalleryPost({
        text: text.trim(),
        nickname: effectiveNick,
        avatarUrl: qqAvatarUrl(selfIdNum),
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

  return (
    <section id="community-gallery" className="community-page__section">
      <div className="panel community-page__panel">
        <div className="panel__hd panel__hd--split community-page__panel-hd">
          <h2 className="panel__title community-page__section-title flex items-center gap-1.5">
            <PanelTitleIcon icon={Images} />
            社区投稿
          </h2>
        </div>
        <div className="panel__bd space-y-4">
          <p className="muted text-sm">
            选择本部署 Bot，填写金句或拖入截图后提交；社区主站会以该 Bot 头像/昵称渲染模拟发言卡。截图可能含群名或 QQ，提交即公开展示。
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <ChromeField label="账号" icon={Bot} className="shrink-0">
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
                <SelectTrigger
                  className={ACCOUNT_SEL}
                  aria-label="当前 Bot 账号"
                  title={
                    selfIdStr
                      ? (() => {
                          const cur = botsVisible.find((b) => b.self_id === selfIdStr);
                          return cur ? botOptionTitle(cur) : selfIdStr;
                        })()
                      : undefined
                  }
                >
                  <SelectValue placeholder="请选择 Bot…" />
                </SelectTrigger>
                <SelectContent align="start" className="min-w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="__none__">请选择 Bot…</SelectItem>
                  {botsVisible.map((b) => (
                    <SelectItem key={b.self_id} value={b.self_id}>
                      <BotSelectLabel nickname={profileNick(b.self_id)} account={b.self_id} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ChromeField>
            <ChromeField label="展示昵称">
              <input
                className="h-9 w-full rounded-[var(--radius-control,8px)] border border-[color-mix(in_srgb,var(--text)_12%,transparent)] bg-[var(--control-bg,#fff)] px-3 text-sm"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="默认资料昵称或 牛牛 + QQ"
              />
            </ChromeField>
          </div>

          <ChromeField label="正文">
            <textarea
              className="min-h-[96px] w-full rounded-[var(--radius-control,8px)] border border-[color-mix(in_srgb,var(--text)_12%,transparent)] bg-[var(--control-bg,#fff)] px-3 py-2 text-sm"
              value={text}
              maxLength={500}
              onChange={(e) => setText(e.target.value)}
              placeholder="输入有趣的牛牛发言…"
            />
          </ChromeField>

          <ChromeField label="图片（可选）">
            <label
              className="flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--radius-control,8px)] border border-dashed border-[color-mix(in_srgb,var(--text)_18%,transparent)] bg-[color-mix(in_srgb,var(--text)_3%,transparent)] px-3 py-4 text-sm text-[var(--text-muted)]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) setImage(file);
              }}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              />
              {image ? (
                <span className="text-[var(--text)]">
                  已选 {image.name}（{(image.size / 1024).toFixed(0)} KB）
                </span>
              ) : (
                <span>点击或拖入截图（≤3MB）</span>
              )}
            </label>
            {image ? (
              <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => setImage(null)}>
                清除图片
              </Button>
            ) : null}
          </ChromeField>

          {localAnswers.length ? (
            <div>
              <div className="mb-2 text-xs font-medium text-[var(--text-muted)]">从本机热词选取</div>
              <div className="flex max-h-40 flex-wrap gap-2 overflow-auto">
                {localAnswers.map((row) => (
                  <button
                    key={`${row.keywords}-${row.message}`}
                    type="button"
                    className="max-w-full truncate rounded-full border border-[var(--border)] bg-[var(--bg-card,var(--card))] px-2.5 py-1 text-left text-xs hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)]"
                    title={row.message}
                    onClick={() => onPickLocalAnswer(row.message, row.keywords)}
                  >
                    {row.message}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <UiButton type="button" disabled={busy} onClick={() => void onSubmit()}>
              {busy ? "提交中…" : "投稿到社区中心"}
            </UiButton>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">本部署已投稿</div>
            {!mineQ.data?.posts?.length ? (
              <p className="muted text-sm">暂无记录</p>
            ) : (
              <ul className="space-y-2">
                {mineQ.data.posts.map((post) => (
                  <li
                    key={post.id}
                    className="flex items-start justify-between gap-3 rounded-[var(--radius-control,8px)] border border-[var(--border)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{post.nickname}</div>
                      <div className="truncate text-xs text-[var(--text-muted)]">{post.text || "（仅图片）"}</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
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
          </div>
        </div>
      </div>
    </section>
  );
}
