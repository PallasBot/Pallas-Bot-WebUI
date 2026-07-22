import type { ReactNode } from "react";

export default function StateBlock({
  loading,
  error,
  empty,
  emptyText = "暂无数据",
  children,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyText?: string;
  children: ReactNode;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">加载中…</p>;
  if (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return <p className="text-sm text-destructive">加载失败：{msg}</p>;
  }
  if (empty) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return <>{children}</>;
}
