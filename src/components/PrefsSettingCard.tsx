import type { ReactNode } from "react";

export default function PrefsSettingCard({
  title,
  lead,
  wide,
  cardId,
  headerAction,
  children,
}: {
  title: ReactNode;
  lead?: string;
  wide?: boolean;
  cardId?: string;
  /** 标题行右侧操作（如滑块复原） */
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={cardId || undefined}
      className={`prefs-setting-card panel${wide ? " prefs-setting-card--wide" : ""}`}
    >
      <header className="prefs-setting-card__hd">
        <div className="prefs-setting-card__head-text">
          <h3 className="panel__title prefs-setting-card__title">{title}</h3>
          {lead ? <p className="prefs-setting-card__lead muted">{lead}</p> : null}
        </div>
        {headerAction ? <div className="prefs-setting-card__head-action">{headerAction}</div> : null}
      </header>
      <div className="prefs-setting-card__bd">{children}</div>
    </section>
  );
}
