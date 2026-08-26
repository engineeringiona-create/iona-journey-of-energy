import { useEffect, useMemo, useRef, useState } from 'react';

const TABS = [
  { id: 'params', label: 'Genel', icon: 'speed' },
  { id: 'alerts', label: 'Uyarılar', icon: 'notifications' },
  { id: 'report', label: 'Raporlar', icon: 'summarize' }
];

const BASELINE = { methane: 58.4, temp: 38.2, power: 1180, flow: 425 };
const TICK_MS = 3000;
const CHART_W = 240;
const CHART_H = 56;
const MAX_TILT_DEG = 8;

function jitter(value, amount) {
  return value + (Math.random() - 0.5) * 2 * amount;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/* 24 points standing in for a day of gas-flow readings — a gentle wave
   plus noise, not real telemetry (there's no backend feeding this; see
   the module doc below). */
function buildInitialSparkline() {
  return Array.from({ length: 24 }, (_, i) => {
    const wave = Math.sin((i / 23) * Math.PI * 1.4) * 30;
    return Math.max(0, BASELINE.flow - 60 + wave + (Math.random() - 0.5) * 12);
  });
}

/* Returns both the SVG path string and the raw pixel coordinates behind
   it, so the hover tooltip can reuse the exact same x/y math instead of
   recomputing it (and risking the marker drifting off the line). */
function sparklineGeometry(points) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(1, max - min);
  const step = CHART_W / (points.length - 1);
  const coords = points.map((v, i) => ({
    x: i * step,
    y: CHART_H - ((v - min) / range) * CHART_H
  }));
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  return { path, coords };
}

/* Phase 68/71: a phone-shaped mockup of a hypothetical IonaFlux
   companion app, running entirely client-side. The numbers "ticking"
   every few seconds are a self-contained jitter simulation (setInterval
   nudging each metric a little from its baseline) — cosmetic realism
   for the marketing section this sits in, not a live feed from any real
   IonaFlux backend. No chart library: the sparkline is a hand-built SVG
   path from plain data, and the hover tooltip's "Xsa önce" labels are
   just an index-to-hours-ago mapping over that same simulated window,
   not real timestamps. */
export default function PhoneMockup() {
  const [tab, setTab] = useState('params');
  const [metrics, setMetrics] = useState(BASELINE);
  const [sparkline, setSparkline] = useState(buildInitialSparkline);
  const [clock, setClock] = useState(() => new Date());
  const [tick, setTick] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [islandHovering, setIslandHovering] = useState(false);
  const [islandPinned, setIslandPinned] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => {
      setMetrics((m) => ({
        methane: clamp(jitter(m.methane, 0.3), 0, 99.9),
        temp: clamp(jitter(m.temp, 0.15), 0, 99.9),
        power: Math.round(clamp(jitter(m.power, 15), 0, 9999)),
        flow: Math.round(clamp(jitter(m.flow, 8), 0, 9999))
      }));
      setSparkline((s) => [...s.slice(1), clamp(jitter(s[s.length - 1], 10), 0, 9999)]);
      setClock(new Date());
      setTick((t) => t + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const { path: sparklinePath, coords: sparklineCoords } = useMemo(() => sparklineGeometry(sparkline), [sparkline]);
  const timeLabel = clock.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const islandExpanded = islandHovering || islandPinned;

  /* 3D parallax tilt: cursor position relative to the phone's own
     center, normalized to [-1, 1] on each axis, mapped to a small
     rotation range. Deliberately NOT reset-then-retrigger on every
     move — just recomputed continuously — so a fast mouse doesn't
     fight a mid-flight transition. */
  function handlePointerMove(e) {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: clamp(-py * 2, -1, 1) * MAX_TILT_DEG, y: clamp(px * 2, -1, 1) * MAX_TILT_DEG });
  }

  function handlePointerLeave() {
    setTilt({ x: 0, y: 0 });
  }

  function handleChartMove(e) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const fraction = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    setHoverIndex(Math.round(fraction * (sparkline.length - 1)));
  }

  const hoverPoint = hoverIndex !== null ? sparklineCoords[hoverIndex] : null;
  const hoverValue = hoverIndex !== null ? Math.round(sparkline[hoverIndex]) : null;
  const hoursAgo = hoverIndex !== null ? sparkline.length - 1 - hoverIndex : null;

  return (
    <div className="ionaflux-phone-stage">
      <div className="ionaflux-demo-badge">✨ İnteraktif Canlı Demo — Sekmelere Dokunun</div>

      <div className="ionaflux-phone-ground" aria-hidden="true" />

      <div
        ref={wrapRef}
        className="ionaflux-phone"
        onMouseMove={handlePointerMove}
        onMouseLeave={handlePointerLeave}
      >
        <div className="ionaflux-phone-frame" style={{ transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}>
          <div className="ionaflux-phone-btn ionaflux-phone-btn-action" aria-hidden="true" />
          <div className="ionaflux-phone-btn ionaflux-phone-btn-volume" aria-hidden="true" />
          <div className="ionaflux-phone-btn ionaflux-phone-btn-power" aria-hidden="true" />
          <div className="ionaflux-phone-speaker" aria-hidden="true" />

          <button
            type="button"
            className={`ionaflux-dynamic-island ${islandExpanded ? 'is-expanded' : ''}`}
            onMouseEnter={() => setIslandHovering(true)}
            onMouseLeave={() => setIslandHovering(false)}
            onClick={() => setIslandPinned((p) => !p)}
            aria-label="Dinamik Ada — canlı metan oranı"
          >
            <span className="ionaflux-live-dot" />
            {islandExpanded && <span className="ionaflux-island-text">{metrics.methane.toFixed(1)}% CH4 Live</span>}
            <span className="ionaflux-island-lens" aria-hidden="true" />
          </button>

          <div className="ionaflux-phone-screen" role="img" aria-label="IonaFlux mobil uygulama önizlemesi">
            <div className="ionaflux-status-bar">
              <span>{timeLabel}</span>
              <span className="ionaflux-status-icons">
                5G <span className="material-symbols-outlined text-[13px] leading-none">battery_full</span>
              </span>
            </div>

            <div className="ionaflux-app-header">
              <span className="ionaflux-app-title">IONA Flux Cloud</span>
              <span className="ionaflux-live-badge">
                <span className="ionaflux-live-dot" /> Canlı Veri Aktif
              </span>
            </div>

            <div className="ionaflux-app-body">
              <div key={tab} className="ionaflux-tab-panel">
                {tab === 'params' && (
                  <>
                    <div className="ionaflux-metric-grid">
                      <div className="ionaflux-metric-card">
                        <span className="ionaflux-metric-icon" aria-hidden="true">🟢</span>
                        <span key={`methane-${tick}`} className="ionaflux-metric-value ionaflux-flash">
                          {metrics.methane.toFixed(1)}% <span className="ionaflux-metric-unit">CH4</span>
                        </span>
                        <span className="ionaflux-metric-label">Metan Oranı · Optimal</span>
                      </div>
                      <div className="ionaflux-metric-card">
                        <span className="ionaflux-metric-icon" aria-hidden="true">🌡️</span>
                        <span key={`temp-${tick}`} className="ionaflux-metric-value ionaflux-flash">
                          {metrics.temp.toFixed(1)} <span className="ionaflux-metric-unit">°C</span>
                        </span>
                        <span className="ionaflux-metric-label">Reaktör Sıcaklığı · Mezofilik</span>
                      </div>
                      <div className="ionaflux-metric-card">
                        <span className="ionaflux-metric-icon" aria-hidden="true">⚡</span>
                        <span key={`power-${tick}`} className="ionaflux-metric-value ionaflux-flash">
                          {metrics.power.toLocaleString('tr-TR')} <span className="ionaflux-metric-unit">kWe</span>
                        </span>
                        <span className="ionaflux-metric-label">Elektrik Üretimi</span>
                      </div>
                      <div className="ionaflux-metric-card">
                        <span className="ionaflux-metric-icon" aria-hidden="true">💨</span>
                        <span key={`flow-${tick}`} className="ionaflux-metric-value ionaflux-flash">
                          {metrics.flow.toLocaleString('tr-TR')} <span className="ionaflux-metric-unit">m³/h</span>
                        </span>
                        <span className="ionaflux-metric-label">Gaz Debisi</span>
                      </div>
                    </div>
                    <div className="ionaflux-sparkline-card">
                      <span className="ionaflux-metric-label ionaflux-sparkline-label">Son 24 Saat Gaz Trendi</span>
                      <div className="ionaflux-chart-wrap">
                        <svg
                          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                          className="w-full h-14"
                          onMouseMove={handleChartMove}
                          onMouseLeave={() => setHoverIndex(null)}
                        >
                          <path d={sparklinePath} fill="none" stroke="#78dc77" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          {hoverPoint && (
                            <>
                              <line x1={hoverPoint.x} y1="0" x2={hoverPoint.x} y2={CHART_H} stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
                              <circle cx={hoverPoint.x} cy={hoverPoint.y} r="3.5" fill="#78dc77" stroke="#0b0f19" strokeWidth="1.5" />
                            </>
                          )}
                        </svg>
                        {hoverPoint && (
                          <div
                            className="ionaflux-chart-tooltip"
                            style={{ left: `${(hoverPoint.x / CHART_W) * 100}%` }}
                          >
                            <strong>{hoverValue} m³/h</strong>
                            <span>{hoursAgo === 0 ? 'Şimdi' : `${hoursAgo}sa önce`}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {tab === 'alerts' && (
                  <div className="ionaflux-alerts-list">
                    <div className="ionaflux-alert-item">✅ Besleme Pompası 1: Planlı dozaj tamamlandı</div>
                    <div className="ionaflux-alert-item">🛡️ H2S Filtresi: 14 ppm (Güvenli Eşik)</div>
                  </div>
                )}

                {tab === 'report' && (
                  <div className="ionaflux-report-card">
                    <span className="ionaflux-metric-label ionaflux-report-label">Günlük Biyogaz Verimi</span>
                    <span className="ionaflux-report-value">10.240 m³</span>
                    <span className="ionaflux-metric-label">Hedefin %104'ü</span>
                  </div>
                )}
              </div>
            </div>

            <div className="ionaflux-bottom-nav">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`ionaflux-nav-btn ${tab === t.id ? 'is-active' : ''}`}
                >
                  <span className="material-symbols-outlined text-[17px] leading-none">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
