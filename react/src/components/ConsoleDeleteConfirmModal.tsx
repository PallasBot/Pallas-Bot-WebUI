import ConsoleModal from "@/components/ConsoleModal";

export type ConsoleDeleteListItem = {
  key: string;
  label: string;
};

type Props = {
  open: boolean;
  title: string;
  subtitle: string;
  items: ConsoleDeleteListItem[];
  busy?: boolean;
  error?: string;
  warnings?: string[];
  confirmLabel?: string;
  titleId?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ConsoleDeleteConfirmModal({
  open,
  title,
  subtitle,
  items,
  busy = false,
  error,
  warnings,
  confirmLabel,
  titleId,
  onClose,
  onConfirm,
}: Props) {
  const headingId = titleId || "console-delete-modal-title";

  return (
    <ConsoleModal
      open={open}
      titleId={headingId}
      busy={busy}
      onClose={onClose}
      header={
        <>
          <div className="console-modal__head-text">
            <h2 id={headingId} className="console-modal__title">
              {title}
            </h2>
            <p className="console-modal__subtitle muted">{subtitle}</p>
          </div>
          <button type="button" className="console-modal__close" aria-label="关闭" disabled={busy} onClick={onClose}>
            ×
          </button>
        </>
      }
    >
      {error ? (
        <p className="alert alert--err" style={{ margin: "0 0 12px" }}>
          {error}
        </p>
      ) : null}
      {(warnings ?? []).map((w, wi) => (
        <p key={`warn-${wi}`} className="alert alert--err" style={{ margin: "0 0 12px" }}>
          {w}
        </p>
      ))}
      <p className="muted" style={{ margin: "0 0 8px", fontSize: 13 }}>
        账号列表
      </p>
      <ul className="inst-delete-account-list muted">
        {items.map((item) => (
          <li key={item.key}>{item.label}</li>
        ))}
      </ul>
      <div className="row-actions" style={{ marginTop: 18, flexWrap: "wrap", gap: 8 }}>
        <button type="button" className="btn btn--danger" disabled={busy} onClick={onConfirm}>
          {busy ? "删除中…" : confirmLabel || "确认删除"}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onClose}>
          取消
        </button>
      </div>
    </ConsoleModal>
  );
}
