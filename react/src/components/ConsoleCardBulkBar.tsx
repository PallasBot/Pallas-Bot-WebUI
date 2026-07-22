export default function ConsoleCardBulkBar({
  pageAllSelected,
  selectedCount,
  deleteBusy,
  deleteDisabled,
  onToggleSelectAll,
  onClearSelection,
  onDelete,
}: {
  pageAllSelected: boolean;
  selectedCount: number;
  deleteBusy?: boolean;
  deleteDisabled?: boolean;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="inst-db-bulk-bar">
      <button type="button" className="btn btn--sm" onClick={onToggleSelectAll}>
        {pageAllSelected ? "取消全选" : "全选本页"}
      </button>
      <button type="button" className="btn btn--sm" disabled={selectedCount === 0} onClick={onClearSelection}>
        清除选择
      </button>
      <button
        type="button"
        className="btn btn--sm btn--danger"
        disabled={selectedCount === 0 || deleteBusy || deleteDisabled}
        onClick={onDelete}
      >
        {deleteBusy ? "删除中…" : `删除选中${selectedCount > 0 ? `（${selectedCount}）` : ""}`}
      </button>
    </div>
  );
}
