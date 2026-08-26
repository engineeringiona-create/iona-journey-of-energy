import { useEffect, useMemo, useState } from 'react';

const TABS = [
  { id: 'params', label: 'Genel', icon: 'speed' },
  { id: 'alerts', label: 'Uyarılar', icon: 'notifications' },
  { id: 'report', label: 'Raporlar', icon: 'summarize' }
];

const BASELINE = { methane: 58.4, temp: 38.2, power: 1180, flow: 425 };
const TICK_MS = 3000;

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

function sparklinePathFor(points) {
  const w = 240;
  const h = 56;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(1, max - min);
  const step = w / (points.length - 1);
  return points
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(' ');
}

/* Phase 68: a phone-shaped mockup of a hypothetical IonaFlux companion
   app, running entirely client-side. The numbers "ticking" every few
   seconds are a self-contained jitter simulation (setInterval nudging
   each metric a little from its baseline) — cosmetic realism for the
   marketing section this sits in, not a live feed from any real
   IonaFlux backend. No chart library: the sparkline is a hand-built SVG
   path from plain data. */
export default function PhoneMockup() {
  const [tab, setTab] = useState('params');
  const [metrics, setMetrics] = useState(BASELINE);
  const [sparkline, setSparkline] = useState(buildInitialSparkline);
  const [clock, setClock] = useState(() => new Date());

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
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const sparklinePath = useMemo(() => sparklinePathFor(sparkline), [sparkline]);
  const timeLabel = clock.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="ionaflux-phone">
      <div className="ionaflux-phone-frame">
        <div className="ionaflux-phone-notch" aria-hidden="true" />
        <div className="ionaflux-phone-buttons" aria-hidden="true" />
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
            {tab === 'params' && (
              <>
                <div className="ionaflux-metric-grid">
                  <div className="ionaflux-metric-card">
                    <span className="ionaflux-metric-icon" aria-hidden="true">🟢</span>
                    <span className="ionaflux-metric-value">
                      {metrics.methane.toFixed(1)}% <span className="ionaflux-metric-unit">CH4</span>
                    </span>
                    <span className="ionaflux-metric-label">Metan Oranı · Optimal</span>
                  </div>
                  <div className="ionaflux-metric-card">
                    <span className="ionaflux-metric-icon" aria-hidden="true">🌡️</span>
                    <span className="ionaflux-metric-value">
                      {metrics.temp.toFixed(1)} <span className="ionaflux-metric-unit">°C</span>
                    </span>
                    <span className="ionaflux-metric-label">Reaktör Sıcaklığı · Mezofilik</span>
                  </div>
                  <div className="ionaflux-metric-card">
                    <span className="ionaflux-metric-icon" aria-hidden="true">⚡</span>
                    <span className="ionaflux-metric-value">
                      {metrics.power.toLocaleString('tr-TR')} <span className="ionaflux-metric-unit">kWe</span>
                    </span>
                    <span className="ionaflux-metric-label">Elektrik Üretimi</span>
                  </div>
                  <div className="ionaflux-metric-card">
                    <span className="ionaflux-metric-icon" aria-hidden="true">💨</span>
                    <span className="ionaflux-metric-value">
                      {metrics.flow.toLocaleString('tr-TR')} <span className="ionaflux-metric-unit">m³/h</span>
                    </span>
                    <span className="ionaflux-metric-label">Gaz Debisi</span>
                  </div>
                </div>
                <div className="ionaflux-sparkline-card">
                  <span className="ionaflux-metric-label ionaflux-sparkline-label">Son 24 Saat Gaz Trendi</span>
                  <svg viewBox="0 0 240 56" className="w-full h-14" aria-hidden="true">
                    <path d={sparklinePath} fill="none" stroke="#78dc77" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
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
  );
}
