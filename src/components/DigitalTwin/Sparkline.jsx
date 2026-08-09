/* Hand-drawn line+area sparkline — no chart library. `series` is
   normalized to the given box and rendered as one <path> for the
   stroke and one closed <path> (same points, dropped to the baseline)
   for the fill. */
export default function Sparkline({ series, color, width = 120, height = 36 }) {
  if (!series || series.length < 2) return null;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const stepX = width / (series.length - 1);

  const points = series.map((value, i) => [i * stepX, height - ((value - min) / range) * height]);

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${height} L${points[0][0].toFixed(1)},${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block overflow-visible">
      <path d={areaPath} fill={color} fillOpacity={0.16} stroke="none" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
