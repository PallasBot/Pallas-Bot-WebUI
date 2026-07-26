import { cn } from "@/lib/utils";

export default function ConsoleTableEdit({
  disabled,
  label = "配置",
  variant = "default",
  onClick,
}: {
  disabled?: boolean;
  label?: string;
  variant?: "default" | "danger";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={cn("console-table-edit", variant === "danger" && "console-table-edit--danger")}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
