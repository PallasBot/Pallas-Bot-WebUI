export default function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card/50 p-3 sm:p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-medium tabular-nums sm:text-2xl">{value}</div>
    </div>
  );
}
