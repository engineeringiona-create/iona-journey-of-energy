import { UI_TEXT } from './constants.js';
import RadialGauge from './RadialGauge.jsx';
import Sparkline from './Sparkline.jsx';
import StatTile from './StatTile.jsx';
import useBrandColors from './useBrandColors.js';
import useI18n from './useI18n.js';

// TODO: replace with real telemetry — component.stats is mock data (constants.js)

/* variant="floating" (default): the desktop 3D-anchored card, rendered
   inside <Html> next to the focused station. variant="sheet": mobile —
   rendered as a plain DOM sibling of <Canvas> (see DigitalTwinScene.jsx),
   pinned to the bottom of the viewport instead of floating at the
   station's 3D position, so it only ever covers the lower portion of
   the screen and never the whole model. */
export default function DataPanel({ component, visible, onClose, variant = 'floating' }) {
  const { brand } = useBrandColors();
  const t = useI18n();
  const isSheet = variant === 'sheet';

  const sparklineStat = component.stats.find((stat) => stat.kind === 'sparkline');
  const gaugeStat = component.stats.find((stat) => stat.kind === 'gauge');
  const kpiStats = component.stats.filter((stat) => stat.kind === 'kpi');

  const containerClassName = isSheet
    ? `fixed inset-x-0 bottom-0 z-[2000000001] max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-[var(--border-strong)] bg-[var(--surface)]/95 backdrop-blur-xl shadow-[0_-20px_50px_-20px_rgba(0,0,0,0.5)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[var(--text)] transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : 'translate-y-full pointer-events-none'
      }`
    : `w-80 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)]/90 backdrop-blur-xl shadow-[0_25px_60px_-25px_rgba(0,0,0,0.5)] p-5 text-[var(--text)] transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`;

  return (
    <div className={containerClassName}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-label-caps text-[13px] tracking-[0.08em] font-bold" style={{ color: brand }}>
          {t(component.labelKey)}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-200 leading-none text-[18px]"
          aria-label={t(UI_TEXT.close)}
        >
          &times;
        </button>
      </div>

      <p className="text-[13px] leading-relaxed text-[var(--text-muted)] mb-4">{t(component.descKey)}</p>

      <a
        href="#"
        onClick={(event) => event.preventDefault()}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-label-caps text-[11px] font-bold tracking-[0.06em] text-white mb-4 transition-transform duration-150 ease-out active:scale-[0.97]"
        style={{ background: brand }}
      >
        {t(UI_TEXT.learnMore)}
      </a>

      {sparklineStat && (
        <div className="mb-3">
          <div className="flex items-baseline justify-between mb-1">
            <span className="font-label-caps text-[10px] tracking-[0.08em] text-[var(--text-muted)]">{t(sparklineStat.labelKey)}</span>
            <span className="font-bold text-[13px] text-[var(--text)]">
              {sparklineStat.value}
              {sparklineStat.unit}
            </span>
          </div>
          <Sparkline series={sparklineStat.series} color={brand} width={272} height={40} />
        </div>
      )}

      <div className="flex items-center gap-3">
        {gaugeStat && (
          <div className="flex flex-col items-center gap-1 shrink-0">
            <RadialGauge value={gaugeStat.value} color={brand} trackColor="var(--border-strong)" />
            <span className="font-label-caps text-[9px] tracking-[0.06em] text-[var(--text-muted)] text-center leading-tight max-w-[64px]">
              {t(gaugeStat.labelKey)}
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 flex-1">
          {kpiStats.map((stat) => (
            <StatTile key={stat.labelKey} label={t(stat.labelKey)} value={stat.value} unit={stat.unit} series={stat.series} />
          ))}
        </div>
      </div>
    </div>
  );
}
