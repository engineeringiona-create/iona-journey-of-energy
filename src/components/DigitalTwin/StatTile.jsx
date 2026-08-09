/* Trend percentage is derived from the stat's own series (last vs.
   first reading) rather than stored as a separate hardcoded field —
   one fewer thing in constants.js that could drift out of sync with
   the numbers actually shown. */
export default function StatTile({ label, value, unit, series }) {
  const trendPercent =
    series && series.length >= 2 && series[0] !== 0
      ? ((series[series.length - 1] - series[0]) / series[0]) * 100
      : null;
  const isUp = trendPercent !== null && trendPercent > 0.05;
  const isDown = trendPercent !== null && trendPercent < -0.05;

  return (
    <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)]/70 px-3 py-2.5">
      <div className="font-label-caps text-[10px] tracking-[0.08em] text-[var(--text-muted)] mb-1 truncate">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-bold text-[15px] text-[var(--text)]">
          {value}
          {unit}
        </span>
        {(isUp || isDown) && (
          <span className={`text-[10px] font-bold ${isUp ? 'text-[var(--brand)]' : 'text-[var(--text-muted)]'}`}>
            {isUp ? '▲' : '▼'} {Math.abs(trendPercent).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
