import { useEffect, useState } from "react";
import { totalPages } from "@pallas-vue/utils/paginate";

export default function ConsolePagerBar({
  page,
  pageSize,
  total,
  unit = "条",
  embedded,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  unit?: string;
  embedded?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const maxPage = totalPages(total, pageSize);
  const [jumpStr, setJumpStr] = useState(String(page));

  useEffect(() => {
    setJumpStr(String(page));
  }, [page]);

  if (total <= 0) return null;

  function emitPage(next: number) {
    onPageChange(Math.min(maxPage, Math.max(1, next)));
  }

  function goJump() {
    const n = parseInt(jumpStr.trim(), 10);
    if (!Number.isFinite(n)) return;
    emitPage(n);
  }

  const sizeOptions = [...new Set([4, 8, 12, 16, 24, 36, 48, pageSize])].sort((a, b) => a - b);

  return (
    <div className={`console-pager${embedded ? " console-pager--embedded" : ""}`}>
      <div className="console-pager__bar">
        <div className="console-pager__meta">
          <span className="muted console-pager__total">
            共 {total} {unit}
          </span>
          <label className="muted console-pager__size">
            每页
            <select
              className="sel"
              value={pageSize}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (Number.isFinite(v)) onPageSizeChange(v);
              }}
            >
              {sizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="console-pager__nav">
          <button
            type="button"
            className="btn console-pager__btn-prev"
            disabled={page <= 1}
            onClick={() => emitPage(page - 1)}
          >
            上一页
          </button>
          <span className="muted console-pager__jump">
            第
            <input
              className="inp console-pager__jump-inp"
              type="number"
              min={1}
              max={maxPage}
              value={jumpStr}
              onChange={(e) => setJumpStr(e.target.value)}
              onBlur={goJump}
              onKeyDown={(e) => {
                if (e.key === "Enter") goJump();
              }}
            />
            / {maxPage} 页
          </span>
          <button
            type="button"
            className="btn console-pager__btn-next"
            disabled={page >= maxPage}
            onClick={() => emitPage(page + 1)}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
