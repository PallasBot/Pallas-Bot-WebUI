export default function PluginStoreCardSkeleton() {
  return (
    <div className="plugin-store-card plugin-store-card--skeleton ui-card ui-card--glass" aria-hidden="true">
      <div className="ui-card__content">
        <div className="plugin-store-card__layout">
          <div className="plugin-store-card__media">
            <div className="plugin-store-card__cover plugin-store-card__skel plugin-store-card__skel--round" />
          </div>
          <div className="plugin-store-card__info">
            <div className="plugin-store-card__skel plugin-store-card__skel--title" />
            <div className="plugin-store-card__skel plugin-store-card__skel--line plugin-store-card__skel--short" />
          </div>
          <div className="plugin-store-card__summary">
            <div className="plugin-store-card__skel plugin-store-card__skel--line" />
            <div className="plugin-store-card__skel plugin-store-card__skel--line plugin-store-card__skel--short" />
          </div>
        </div>
      </div>
      <div className="ui-card__footer">
        <footer className="plugin-store-card__foot">
          <div className="plugin-store-card__skel plugin-store-card__skel--btn" />
        </footer>
      </div>
    </div>
  );
}
