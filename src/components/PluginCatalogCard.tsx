import { useEffect, useState } from "react";
import { PackageX, Settings2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

type Props = {
  plugin: PluginRow;
  iconUrl?: string | null;
  avatarUrl?: string | null;
  active?: boolean;
  onSelect: () => void;
  onUninstall?: () => void;
};

export default function PluginCatalogCard({ plugin, iconUrl, avatarUrl, active, onSelect, onUninstall }: Props) {
  const { favorites, toggleFavorite } = usePluginFavorites();
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);

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
  const uninstallLabel = plugin.uninstall_kind === "dir" || plugin.uninstall_kind === "community" ? "删除" : "卸载";

  const resolvedAvatarUrl =
    !avatarImageFailed && (avatarUrl || "").trim() ? (avatarUrl || "").trim() : null;

  useEffect(() => {
    setAvatarImageFailed(false);
  }, [iconUrl, avatarUrl]);

  return (
    <section
      className={cn(
        "ui-card ui-card--glass ui-card--interactive plugin-store-card plugin-catalog-card",
        active && "ui-card--active is-active",
      )}
    >
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

            {plugin.globally_disabled || loadBadge || loadProcessTags.length || sourceLabel || versionLabel ? (
              <div className="plugin-store-card__meta-row plugin-catalog-card__meta-row">
                {plugin.globally_disabled ? <Badge variant="neutral" size="compact">已禁用</Badge> : null}
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
        <button
          type="button"
          className="group btn ui-btn ui-btn--destructive btn--danger plugin-store-card__foot-btn"
          onClick={onUninstall}
        >
          <BtnIco icon={PackageX} motion="scale" className="plugin-store-card__foot-ico" />
          {uninstallLabel}
        </button>
        <button
          type="button"
          className="group btn btn--primary ui-btn ui-btn--primary plugin-store-card__foot-btn"
          onClick={onSelect}
        >
          <BtnIco icon={Settings2} motion="settings" className="plugin-store-card__foot-ico" />
          编辑配置
        </button>
      </div>
    </section>
  );
}
