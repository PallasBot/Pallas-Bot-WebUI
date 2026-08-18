import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Settings2 } from "lucide-react";
import { axiosErrorDetail } from "@/api/http";
import { putPluginGovernance } from "@/api/fullConsole";
import type { PluginRow } from "@/api/pallasTypes";
import {
  pluginDisplayDescription,
  pluginDisplaySubtitle,
  pluginDisplayTitle,
  pluginResolvedId,
} from "@/utils/pluginDisplayMeta";
import {
  pluginLoadBadgeText,
  pluginLoadProcessTags,
  pluginLoadWhere,
} from "@/utils/pluginLoadRoleLabel";
import {
  pluginSourceBadgeVariant,
  pluginSourceDir,
  pluginSourceLabel,
  pluginVersionLabel,
} from "@/utils/pluginSourceLabel";
import BtnIco from "@/components/BtnIco";
import PluginIcon from "@/components/PluginIcon";
import { Badge } from "@/components/ui/badge";
import { usePluginFavorites } from "@/hooks/usePluginFavorites";
import { useConsoleConfirm } from "@/hooks/useConsoleConfirm";
import { pushConsoleToast } from "@/utils/consoleToast";
import { cn } from "@/lib/utils";

type Props = {
  plugin: PluginRow;
  iconUrl?: string | null;
  avatarUrl?: string | null;
  active?: boolean;
  /** 全局禁用名单 revision，用于乐观并发控制 */
  globalDisableRevision?: string;
  onSelect: () => void;
  onUninstall?: () => void;
};

function notifyOk(message: string) {
  pushConsoleToast(message, "ok");
}

function notifyErr(message: string) {
  pushConsoleToast(message || "操作失败", "err");
}

export default function PluginCatalogCard({
  plugin,
  iconUrl,
  avatarUrl,
  active,
  globalDisableRevision,
  onSelect,
  onUninstall,
}: Props) {
  const { favorites, toggleFavorite } = usePluginFavorites();
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConsoleConfirm();
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRootRef = useRef<HTMLDivElement | null>(null);

  const title = pluginDisplayTitle(plugin);
  const subtitle = pluginDisplaySubtitle(plugin);
  const description = pluginDisplayDescription(plugin);
  const pluginIdValue = pluginResolvedId(plugin);
  const loadProcessTags = pluginLoadProcessTags(plugin);
  const loadBadge = pluginLoadBadgeText(plugin);
  const loadWhere = pluginLoadWhere(plugin);
  const sourceLabel = pluginSourceLabel(plugin.plugin_source);
  const versionLabel = pluginVersionLabel(plugin);
  const isFavorite = favorites.has(pluginIdValue);
  const globallyDisabled = Boolean(plugin.globally_disabled);
  const disableProtected = Boolean(plugin.global_disable_protected);
  const uninstallLabel = plugin.uninstall_kind === "dir" || plugin.uninstall_kind === "community" ? "删除" : "卸载";

  const resolvedAvatarUrl =
    !avatarImageFailed && (avatarUrl || "").trim() ? (avatarUrl || "").trim() : null;

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

  const toggleDisable = useMutation({
    mutationFn: (next: boolean) =>
      putPluginGovernance(plugin.name, {
        global_disable: next,
        global_disable_revision: globalDisableRevision,
      }),
    onSuccess: async () => {
      notifyOk(globallyDisabled ? "已启用插件" : "已禁用插件");
      await qc.invalidateQueries({ queryKey: ["plugins"] });
      await qc.invalidateQueries({ queryKey: ["plugins-global-disable"] });
    },
    onError: (e) => notifyErr(axiosErrorDetail(e)),
  });

  async function toggleGlobalDisable() {
    const next = !globallyDisabled;
    if (disableProtected || toggleDisable.isPending) return;
    if (next) {
      const ok = await confirm({
        title: "禁用此插件",
        subtitle: `确定全局禁用「${title}」？`,
        warnings: ["所有实例、所有群都不会再运行此插件；白名单群除外。"],
        confirmLabel: "禁用",
      });
      if (!ok) return;
    }
    await toggleDisable.mutateAsync(next);
  }

  const menuItems = plugin.uninstallable ? [{ id: "uninstall", label: uninstallLabel, danger: true }] : [];

  return (
    <section
      className={cn(
        "ui-card ui-card--glass ui-card--interactive plugin-store-card plugin-catalog-card",
        active && "ui-card--active is-active",
      )}
    >
      <div ref={menuRootRef} className="plugin-catalog-card__corner">
        <button
          type="button"
          className="plugin-catalog-card__fav"
          aria-pressed={isFavorite}
          title={isFavorite ? "取消收藏" : "收藏"}
          aria-label={isFavorite ? `取消收藏「${title}」` : `收藏「${title}」`}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(pluginIdValue);
          }}
        >
          ★
        </button>
        {menuItems.length ? (
          <>
            <button
              type="button"
              className="btn ui-btn ui-btn--ghost ui-btn--sm plugin-store-card__menu-trigger plugin-catalog-card__menu-trigger"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="更多操作"
              disabled={toggleDisable.isPending}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onUninstall?.();
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="ui-card__content">
        <button type="button" className="plugin-catalog-card__hit" onClick={onSelect}>
          <div className="plugin-store-card__layout">
            <div className="plugin-store-card__media">
              <div className="plugin-store-card__cover">
                <PluginIcon pluginId={pluginIdValue} iconUrl={iconUrl} size="xl" />
              </div>
              {resolvedAvatarUrl ? (
                <div className="plugin-store-card__avatar">
                  <img
                    src={resolvedAvatarUrl}
                    alt={title}
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
              {subtitle ? (
                <p className="plugin-store-card__byline muted" title={subtitle}>
                  {subtitle}
                </p>
              ) : null}
            </div>

            {globallyDisabled || loadBadge || loadProcessTags.length || sourceLabel || versionLabel ? (
              <div className="plugin-store-card__meta-row plugin-catalog-card__meta-row">
                {globallyDisabled ? <Badge variant="neutral" size="compact">已禁用</Badge> : null}
                {loadBadge ? (
                  <Badge variant="warn" size="compact" title={loadWhere}>
                    {loadBadge}
                  </Badge>
                ) : null}
                {sourceLabel ? (
                  <Badge
                    variant={pluginSourceBadgeVariant(plugin.plugin_source)}
                    size="compact"
                    title={pluginSourceDir(plugin) || pluginSourceLabel(plugin.plugin_source)}
                  >
                    {sourceLabel}
                  </Badge>
                ) : null}
                {versionLabel ? (
                  <span
                    className="plugin-store-card__meta-link plugin-store-card__meta-link--version"
                    title={versionLabel}
                  >
                    {versionLabel}
                  </span>
                ) : null}
                {loadProcessTags.map((tag) => (
                  <span
                    key={tag}
                    className="plugin-store-card__meta-link plugin-store-card__meta-link--version"
                    title={`${tag} 进程`}
                  >
                    {tag} 进程
                  </span>
                ))}
              </div>
            ) : null}

            {description ? (
              <div className="plugin-store-card__summary">
                <p className="plugin-store-card__desc muted" title={description}>
                  {description}
                </p>
              </div>
            ) : null}
          </div>
        </button>
      </div>

      <div className="ui-card__footer">
        <div className="plugin-store-card__foot plugin-store-card__foot-main plugin-catalog-card__foot">
          <button
            type="button"
            className="group btn ui-btn ui-btn--default plugin-store-card__foot-btn"
            disabled={disableProtected || toggleDisable.isPending}
            onClick={(e) => {
              e.stopPropagation();
              void toggleGlobalDisable();
            }}
          >
            <BtnIco
              icon={Ban}
              motion="scale"
              busy={toggleDisable.isPending}
              className="plugin-store-card__foot-ico"
            />
            <span>
              {toggleDisable.isPending ? "处理中…" : disableProtected ? "不可禁用" : globallyDisabled ? "启用" : "禁用"}
            </span>
          </button>
          <button
            type="button"
            className="group btn btn--primary ui-btn ui-btn--primary plugin-store-card__foot-btn"
            onClick={onSelect}
          >
            <BtnIco icon={Settings2} motion="settings" className="plugin-store-card__foot-ico" />
            编辑
          </button>
        </div>
      </div>

      {confirmDialog}
    </section>
  );
}