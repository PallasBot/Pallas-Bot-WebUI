import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
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
import { hasPluginSource, pluginSourceDir, pluginSourceLabel } from "@/utils/pluginSourceLabel";
import BtnIco from "@/components/BtnIco";
import PluginIcon from "@/components/PluginIcon";
import { usePluginFavorites } from "@/hooks/usePluginFavorites";
import { cn } from "@/lib/utils";

function hasSource(plugin: PluginRow): boolean {
  return hasPluginSource(plugin);
}

type Props = {
  plugin: PluginRow;
  iconUrl?: string | null;
  avatarUrl?: string | null;
  active?: boolean;
  onSelect: () => void;
};

export default function PluginCatalogCard({ plugin, iconUrl, avatarUrl, active, onSelect }: Props) {
  const { favorites, toggleFavorite } = usePluginFavorites();
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);

  const title = pluginDisplayTitle(plugin);
  const subtitle = pluginDisplaySubtitle(plugin);
  const description = pluginDisplayDescription(plugin);
  const pluginIdValue = pluginResolvedId(plugin);
  const loadProcessTags = pluginLoadProcessTags(plugin);
  const loadBadge = pluginLoadBadgeText(plugin);
  const loadWhere = pluginLoadWhere(plugin);
  const isFavorite = favorites.has(pluginIdValue);

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

            {plugin.globally_disabled || loadBadge || hasSource(plugin) || loadProcessTags.length ? (
              <div className="plugin-store-card__meta-row plugin-catalog-card__meta-row">
                {plugin.globally_disabled ? <span className="data-pill data-pill--off">已禁用</span> : null}
                {loadBadge ? (
                  <span className="data-pill data-pill--warn" title={loadWhere}>
                    {loadBadge}
                  </span>
                ) : null}
                {hasSource(plugin) ? (
                  <span
                    className="plugin-store-card__meta-link plugin-store-card__meta-link--version"
                    title={pluginSourceDir(plugin) || pluginSourceLabel(plugin.plugin_source)}
                  >
                    {pluginSourceLabel(plugin.plugin_source)}
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
          className="group btn btn--primary ui-btn ui-btn--primary plugin-store-card__foot-btn"
          style={{ width: "100%" }}
          onClick={onSelect}
        >
          <BtnIco icon={Settings2} motion="settings" className="plugin-store-card__foot-ico" />
          编辑配置
        </button>
      </div>
    </section>
  );
}
