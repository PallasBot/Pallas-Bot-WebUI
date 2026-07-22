/** 对齐 Vue ConsolePageSkeleton：加载时用面板占位，避免整页空白。 */
export default function ConsolePageSkeleton({ panels = 3 }: { panels?: number }) {
  const count = Math.max(1, Math.min(6, panels));
  return (
    <div className="console-page-skel" aria-busy="true" aria-label="加载中">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="console-page-skel__panel">
          <div className="console-page-skel__hd skel-pulse" />
          <div className="console-page-skel__bd">
            <div className="console-page-skel__line skel-pulse" />
            <div className="console-page-skel__line skel-pulse console-page-skel__line--mid" />
            {i < 2 ? (
              <div className="console-page-skel__line skel-pulse console-page-skel__line--short" />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
