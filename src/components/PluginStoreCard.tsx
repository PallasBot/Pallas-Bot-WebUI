import { useEffect, useMemo, useRef, useState } from "react";
import PluginIcon from "@/components/PluginIcon";
import { cn } from "@/lib/utils";

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
  onOpen?: () => void;
  onInstall?: () => void;
  onUninstall?: () => void;
  onUpdate?: () => void;
  onMenuAction?: (id: string) => void;
};

function shortVersionLabel(value: string): string {
  const trimmed = value.trim();
  if (/^[0-9a-f]{6,40}$/i.test(trimmed)) return trimmed.slice(0, 5);
  return trimmed;
}

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
              {title}
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
                    {shortVersionLabel(chip.value)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {description ? (
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
                    "btn ui-btn plugin-store-card__foot-btn",
                    showUpdate ? "ui-btn--primary btn--primary" : "plugin-store-card__foot-btn--latest ui-btn--latest",
                  )}
                  disabled={footLocked || !showUpdate || updateQueued}
                  onClick={() => showUpdate && !updateQueued && onUpdate?.()}
                >
                  <svg className="ui-btn__ico plugin-store-card__foot-ico" viewBox="0 0 24 24" width={15} height={15} aria-hidden="true">
                    <path fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
                  </svg>
                  <span>
                    {updateBusy ? "更新中…" : updateQueued ? "排队中" : showUpdate ? updateLabel : latestLabel}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn ui-btn ui-btn--destructive btn--danger plugin-store-card__foot-btn"
                  disabled={footLocked}
                  onClick={() => onUninstall?.()}
                >
                  <svg className="ui-btn__ico plugin-store-card__foot-ico" viewBox="0 0 24 24" width={15} height={15} aria-hidden="true">
                    <path fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2m-1 14H9a2 2 0 0 1-2-2V8h10v10a2 2 0 0 1-2 2Z" />
                  </svg>
                  <span>{uninstallBusy ? "卸载中…" : uninstallLabel}</span>
                </button>
              </>
            ) : showInstall ? (
              <>
                <button
                  type="button"
                  className="btn ui-btn ui-btn--primary btn--primary plugin-store-card__foot-btn"
                  disabled={footLocked || installQueued}
                  onClick={() => !installQueued && onInstall?.()}
                >
                  <svg className="ui-btn__ico plugin-store-card__foot-ico" viewBox="0 0 24 24" width={15} height={15} aria-hidden="true">
                    <path fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
                  </svg>
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
