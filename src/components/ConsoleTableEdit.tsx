export default function ConsoleTableEdit({
  disabled,
  label = "配置",
  onClick,
}: {
  disabled?: boolean;
  label?: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="console-table-edit" disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}
