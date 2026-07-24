export default function StatCard({
  label,
  value,
  hint,
  dense = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  dense?: boolean;
}) {
  return (
    <div className={`ui-card stat-card${dense ? " stat-card--dense" : ""}`}>
      <div className="ui-card__content">
        <div className="card__body">
          <div className="stat-card__label">{label}</div>
          <div className="stat-card__value">{value}</div>
          {hint ? <div className="stat-card__hint">{hint}</div> : null}
        </div>
      </div>
    </div>
  );
}
