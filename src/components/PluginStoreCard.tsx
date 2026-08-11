import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpToLine, Download, PackageX } from "lucide-react";
import BtnIco from "@/components/BtnIco";
import NoticeDot from "@/components/NoticeDot";
import PluginIcon from "@/components/PluginIcon";
import { cn } from "@/lib/utils";
import { shortPluginVersionLabel } from "@/utils/pluginSourceLabel";

export type PluginStoreMenuItem = {
  id: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
};

type Props = {
  title: string;
  subtitle?: string;
  description?: string;
  author?: string;
  pluginId: string;
  iconUrl?: string | null;
  avatarUrl?: string | null;
  installed?: boolean;
  installBusy?: boolean;
  updateBusy?: boolean;
  uninstallBusy?: boolean;
  installQueued?: boolean;
  updateQueued?: boolean;
  busy?: boolean;
  repoUrl?: string | null;
  menuItems?: PluginStoreMenuItem[];
  showInstall?: boolean;
  showUninstall?: boolean;
  showUpdate?: boolean;
  installLabel?: string;
  uninstallLabel?: string;
  updateLabel?: string;
  latestLabel?: string;
  detailLabel?: string;
  canOpen?: boolean;
  metaLinkLabel?: string;
  metaLinkUrl?: string | null;
  installedVersionLabel?: string;
  progressPercent?: number | null;
  progressMessage?: string;
  /** 上新 / 可更新提醒圆点（标题旁） */
  showNotice?: boolean;
  onOpen?: () => void;
  onInstall?: () => void;
  onUninstall?: () => void;
  onUpdate?: () => void;
  onMenuAction?: (id: string) => void;
};

export default function PluginStoreCard({
  title,
  description = "",
  author = "",
  pluginId,
  iconUrl = null,
  avatarUrl = null,
  installed = false,
  installBusy = false,
  updateBusy = false,
  uninstallBusy = false,
  installQueued = false,
  updateQueued = false,
  busy = false,
  repoUrl = null,
  menuItems = [],
  showInstall = false,
  showUninstall = false,
  showUpdate = false,
  installLabel = "安装",
  uninstallLabel = "卸载",
  updateLabel = "更新",
  latestLabel = "最新",
  detailLabel = "详情",
  canOpen = true,
  metaLinkLabel = "",
  metaLinkUrl = null,
  installedVersionLabel = "",
  progressPercent = null,
  progressMessage = "",
  showNotice = false,
  onOpen,
  onInstall,
  onUninstall,
  onUpdate,
  onMenuAction,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const menuRootRef = useRef<HTMLDivElement | null>(null);

  const resolvedAvatarUrl = avatarImageFailed ? null : (avatarUrl || "").trim() || null;
  const cardBusy = Boolean(
    busy || installBusy || updateBusy || uninstallBusy || installQueued || updateQueued,
  );
  const footLocked = Boolean(
    updateBusy || uninstallBusy || installBusy || busy || installQueued || updateQueued,
  );
  const showInlineProgress = Boolean(
    (installBusy || updateBusy || uninstallBusy || busy)
      && ((progressMessage || "").trim() || progressPercent != null),
  );
  const clampedProgress =
    progressPercent == null ? null : Math.max(0, Math.min(100, Math.round(Number(progressPercent) || 0)));
  const hasMenu = menuItems.some((item) => !item.disabled);
  const hasMetaLink = Boolean((metaLinkLabel || "").trim() && (metaLinkUrl || "").trim());
  const versionChips = useMemo(() => {
    const chips: Array<{ key: string; value: string }> = [];
    const installedVer = (installedVersionLabel || "").trim();
    if (installedVer) chips.push({ key: "installed", value: installedVer });
    return chips;
  }, [installedVersionLabel]);

  useEffect(() => {
    setAvatarImageFailed(false);
  }, [iconUrl, avatarUrl]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocumentClick(event: MouseEvent) {
      const root = menuRootRef.current;
      if (root && !root.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [menuOpen]);

  function onCardClick() {
    if (!canOpen) return;
    onOpen?.();
  }

  function onMenuItem(item: PluginStoreMenuItem) {
    if (item.disabled) return;
    setMenuOpen(false);
    onMenuAction?.(item.id);
  }

  return (
    <article
      className={cn(
        "plugin-store-card ui-card ui-card--glass",
        installed && "plugin-store-card--installed",
        cardBusy && "plugin-store-card--busy",
        canOpen && "plugin-store-card--clickable ui-card--interactive",
      )}
      onClick={onCardClick}
    >
      {hasMenu ? (
        <div ref={menuRootRef} className="plugin-store-card__menu-corner">
          <button
            type="button"
            className="btn ui-btn ui-btn--ghost ui-btn--sm plugin-store-card__menu-trigger"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="更多操作"
            disabled={footLocked}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            ⋯
          </button>
          {menuOpen ? (
            <div className="plugin-store-card__menu" role="menu">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className={cn(
                    "plugin-store-card__menu-item",
                    item.danger && "plugin-store-card__menu-item--danger",
                  )}
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMenuItem(item);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="ui-card__content">
        <div className="plugin-store-card__layout">
          <div className="plugin-store-card__media">
            <div className="plugin-store-card__cover">
              <PluginIcon pluginId={pluginId} iconUrl={iconUrl} size="xl" />
            </div>
            {resolvedAvatarUrl ? (
              <div className="plugin-store-card__avatar">
                <img
                  src={resolvedAvatarUrl}
                  alt={author || title}
                  loading="lazy"
                  onError={() => setAvatarImageFailed(true)}
                />
              </div>
            ) : null}
          </div>

          <div className="plugin-store-card__info">
            <h3 className="plugin-store-card__title" title={title}>
              <span className="plugin-store-card__title-text">{title}</span>
              {showNotice ? <NoticeDot className="plugin-store-card__notice-dot" /> : null}
            </h3>
            {author ? (
              <p className="plugin-store-card__byline muted" title={author}>
                {author}
              </p>
            ) : null}
            {hasMetaLink || versionChips.length ? (
              <div className="plugin-store-card__meta-row">
                {hasMetaLink ? (
                  <a
                    className="plugin-store-card__meta-link"
                    href={metaLinkUrl || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {metaLinkLabel}
                  </a>
                ) : null}
                {versionChips.map((chip) => (
                  <span
                    key={chip.key}
                    className="plugin-store-card__meta-link plugin-store-card__meta-link--version"
                    title={chip.value}
                  >
                    {shortPluginVersionLabel(chip.value)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {showInlineProgress ? (
            <div className="plugin-store-card__summary plugin-store-card__summary--progress">
              <p className="plugin-store-card__progress-msg muted" title={progressMessage || undefined}>
                {(progressMessage || "").trim() || "处理中…"}
              </p>
              <div className="plugin-store-card__progress-row">
                <div className="plugin-store-card__progress-track" aria-hidden="true">
                  <div
                    className="plugin-store-card__progress-fill"
                    style={{ width: `${clampedProgress ?? 8}%` }}
                  />
                </div>
                {clampedProgress != null ? (
                  <span className="plugin-store-card__progress-pct muted">{clampedProgress}%</span>
                ) : null}
              </div>
            </div>
          ) : description ? (
            <div className="plugin-store-card__summary">
              <p className="plugin-store-card__desc muted" title={description}>
                {description}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="ui-card__footer">
        <div className="plugin-store-card__foot" onClick={(e) => e.stopPropagation()}>
          <div className="plugin-store-card__foot-main">
            {showUninstall ? (
              <>
                <button
                  type="button"
                  className={cn(
                    "group btn ui-btn plugin-store-card__foot-btn",
                    showUpdate ? "ui-btn--primary btn--primary" : "plugin-store-card__foot-btn--latest ui-btn--latest",
                  )}
                  disabled={footLocked || !showUpdate || updateQueued}
                  onClick={() => showUpdate && !updateQueued && onUpdate?.()}
                >
                  <BtnIco
                    icon={ArrowUpToLine}
                    motion="up"
                    busy={updateBusy}
                    className="plugin-store-card__foot-ico"
                  />
                  <span>
                    {updateBusy ? "更新中…" : updateQueued ? "排队中" : showUpdate ? updateLabel : latestLabel}
                  </span>
                </button>
                <button
                  type="button"
                  className="group btn ui-btn ui-btn--destructive btn--danger plugin-store-card__foot-btn"
                  disabled={footLocked}
                  onClick={() => onUninstall?.()}
                >
                  <BtnIco
                    icon={PackageX}
                    motion="scale"
                    busy={uninstallBusy}
                    className="plugin-store-card__foot-ico"
                  />
                  <span>{uninstallBusy ? "卸载中…" : uninstallLabel}</span>
                </button>
              </>
            ) : showInstall ? (
              <>
                <button
                  type="button"
                  className="group btn ui-btn ui-btn--primary btn--primary plugin-store-card__foot-btn"
                  disabled={footLocked || installQueued}
                  onClick={() => !installQueued && onInstall?.()}
                >
                  <BtnIco
                    icon={Download}
                    motion="down"
                    busy={installBusy || busy}
                    className="plugin-store-card__foot-ico"
                  />
                  <span>{installBusy || busy ? "安装中…" : installQueued ? "排队中" : installLabel}</span>
                </button>
                {repoUrl ? (
                  <a
                    className="btn ui-btn plugin-store-card__foot-btn"
                    href={repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {detailLabel}
                  </a>
                ) : canOpen ? (
                  <button type="button" className="btn ui-btn plugin-store-card__foot-btn" onClick={() => onOpen?.()}>
                    {detailLabel}
                  </button>
                ) : null}
              </>
            ) : canOpen ? (
              <button
                type="button"
                className="btn ui-btn plugin-store-card__foot-btn plugin-store-card__foot-btn--full"
                onClick={() => onOpen?.()}
              >
                {detailLabel}
              </button>
            ) : repoUrl ? (
              <a
                className="btn ui-btn plugin-store-card__foot-btn plugin-store-card__foot-btn--full"
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {detailLabel}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
