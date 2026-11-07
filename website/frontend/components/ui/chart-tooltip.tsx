export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/95">
      <p className="mb-1 font-semibold text-slate-800 dark:text-zinc-200">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500 dark:text-zinc-400 capitalize">{p.name}:</span>
          <span className="text-slate-900 dark:text-zinc-100 font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

