/* Hand-drawn circular percentage gauge — stroke-dasharray/dashoffset
   on a <circle>, no chart library. Rotated -90deg so progress starts
   at 12 o'clock; the percentage label is a normal (non-rotated)
   overlay <span>, not SVG text, so it doesn't inherit that rotation. */
export default function RadialGauge({ value, color, trackColor, size = 56, strokeWidth = 6 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-label-caps text-[11px] font-bold text-[var(--text)]">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}
