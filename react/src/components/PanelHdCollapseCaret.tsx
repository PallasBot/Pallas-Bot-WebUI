export default function PanelHdCollapseCaret({
  expanded,
  label,
  onToggle,
}: {
  expanded: boolean;
  label: string;
  onToggle: () => void;
}) {
  const ariaLabel = expanded ? `收起${label}` : `展开${label}`;
  return (
    <button
      type="button"
      className="panel-hd-collapse-caret"
      aria-expanded={expanded}
      aria-label={ariaLabel}
      onClick={onToggle}
    >
      <span className="panel-hd-collapse-caret-ico" aria-hidden="true" />
    </button>
  );
}
