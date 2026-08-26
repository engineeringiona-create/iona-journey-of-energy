import { useEffect, useMemo, useRef, useState } from 'react';

const TABS = [
  { id: 'scada', label: 'SCADA', icon: 'precision_manufacturing' },
  { id: 'logistics', label: 'Lojistik', icon: 'local_shipping' },
  { id: 'lab', label: 'Laboratuvar', icon: 'science' },
  { id: 'alerts', label: 'Uyarılar', icon: 'warning' }
];

/* SCADA tab's live-ticking values — everything else in this file (truck
   fleet, lab readings, alert log) is static content, matching what the
   task actually asked to animate (Tab 1 only). */
const BASELINE = {
  methane: 58.5,
  temp: 37.6,
  pressure: 14.2,
  h2s: 12,
  motorLoad: 96.4,
  motorPower: 1196,
  gasStorage: 82
};
const TICK_MS = 3000;
const CHART_W = 240;
const CHART_H = 56;
const MAX_TILT_DEG = 8;
const LOAD_RING_R = 26;
const LOAD_RING_CIRC = 2 * Math.PI * LOAD_RING_R;

const TRUCKS = [
  {
    plate: '06 ABC 412',
    farm: 'Yeşil Vadi Mandırası',
    waste: '24.8 Ton Sıvı Sığır Gübresi',
    time: 'Giriş: 15:24 · 14 dk alım süresi',
    status: 'unloading',
    statusLabel: 'Boşaltılıyor - Çukur 1'
  },
  {
    plate: '06 IONA 88',
    farm: 'Anadolu Çiftliği',
    waste: '18.2 Ton Mısır Silajı',
    time: 'Giriş: 14:10 · Çıkış: 14:38 (28 dk)',
    status: 'done',
    statusLabel: 'Tamamlandı - Kantar'
  },
  {
    plate: '34 KM 109',
    farm: 'Doğu Mandıra Grubu',
    waste: '21.0 Ton Peyniraltı Suyu',
    time: 'ETA 16:15',
    status: 'enroute',
    statusLabel: 'Yolda - ETA 16:15'
  }
];

const LAB_ROWS = [
  { label: 'FOS/TAC Oranı', value: '0.26', note: 'Optimal Aralık: 0.20 - 0.30 · Asitlenme Riski Yok' },
  { label: 'pH Değeri', value: '7.78', note: 'Stabil Mezofilik Aralık' },
  { label: 'Kuru Madde (KM / TS)', value: '%9.4', note: 'Organik KM (oTS): %78.2' },
  { label: 'Amonyum Azotu (NH4-N)', value: '2.450 mg/L', note: 'Güvenli Bölge' }
];

const ALERTS = [
  { severity: 'warn', text: 'Digester 2 Mikser 2 akım değeri 18.4A (Normal limit: 20A)' },
  { severity: 'ok', text: 'Kojenerasyon yağ basıncı nominal seviyede' }
];

function jitter(value, amount) {
  return value + (Math.random() - 0.5) * 2 * amount;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/* 24 points standing in for a day of gas/power generation readings — a
   gentle wave plus noise, not real telemetry (there's no backend
   feeding this; see the module doc below). */
function buildInitialSparkline() {
  return Array.from({ length: 24 }, (_, i) => {
    const wave = Math.sin((i / 23) * Math.PI * 1.4) * 30;
    return Math.max(0, BASELINE.motorPower - 60 + wave + (Math.random() - 0.5) * 12);
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

/* Phase 68/71/75: a phone-shaped mockup of a hypothetical IonaFlux
   companion app, running entirely client-side. The numbers "ticking"
   every few seconds are a self-contained jitter simulation (setInterval
   nudging each metric a little from its baseline) — cosmetic realism
   for the marketing section this sits in, not a live feed from any real
   IonaFlux backend. No chart library: the sparkline is a hand-built SVG
   path from plain data, and the hover tooltip's "Xsa önce" labels are
   just an index-to-hours-ago mapping over that same simulated window,
   not real timestamps. Truck fleet / lab readings / alert log are
   static example content, not simulated live feeds — nothing in the
   task asked those to tick, only the SCADA tab's own metrics. */
export default function PhoneMockup() {
  const [tab, setTab] = useState('scada');
  const [metrics, setMetrics] = useState(BASELINE);
  const [sparkline, setSparkline] = useState(buildInitialSparkline);
  const [clock, setClock] = useState(() => new Date());
  const [tick, setTick] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [islandHovering, setIslandHovering] = useState(false);
  const [islandPinned, setIslandPinned] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [reportDownloaded, setReportDownloaded] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => {
      setMetrics((m) => ({
        methane: clamp(jitter(m.methane, 0.3), 0, 99.9),
        temp: clamp(jitter(m.temp, 0.15), 0, 99.9),
        pressure: clamp(jitter(m.pressure, 0.4), 0, 99.9),
        h2s: Math.round(clamp(jitter(m.h2s, 2), 0, 99)),
        motorLoad: clamp(jitter(m.motorLoad, 1.2), 0, 100),
        motorPower: Math.round(clamp(jitter(m.motorPower, 15), 0, 9999)),
        gasStorage: clamp(jitter(m.gasStorage, 1.5), 0, 100)
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
  const loadRingOffset = LOAD_RING_CIRC * (1 - metrics.motorLoad / 100);

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

  function handleDownloadReport() {
    setReportDownloaded(true);
    setTimeout(() => setReportDownloaded(false), 2200);
  }

  const hoverPoint = hoverIndex !== null ? sparklineCoords[hoverIndex] : null;
  const hoverValue = hoverIndex !== null ? Math.round(sparkline[hoverIndex]) : null;
  const hoursAgo = hoverIndex !== null ? sparkline.length - 1 - hoverIndex : null;
  /* Phase 76.1: same translateX-slide technique as the real app's own
     FloatingTabBar (layout.tsx) — one highlight pill, moved behind
     whichever tab is active, instead of 4 buttons independently
     tracking their own "am I active" background. */
  const activeTabIndex = TABS.findIndex((t) => t.id === tab);

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

            <div className="ionaflux-app-body ionaflux-scroll">
              <div key={tab} className="ionaflux-tab-panel">
                {tab === 'scada' && (
                  <>
                    {/* Mini plant schematic: Digester 1/2 + CHP motor, with a
                       pulsing fault pin on Digester 2. */}
                    <div className="ionaflux-sparkline-card ionaflux-schematic-card">
                      <span className="ionaflux-metric-label ionaflux-sparkline-label">Tesis Şeması</span>
                      <div className="ionaflux-schematic">
                        <div className="ionaflux-schematic-node">
                          <span className="material-symbols-outlined" aria-hidden="true">propane_tank</span>
                          <span>Çürütücü 1</span>
                        </div>
                        <span className="ionaflux-schematic-link" aria-hidden="true" />
                        <div className="ionaflux-schematic-node ionaflux-schematic-node-fault">
                          <span className="ionaflux-fault-pin" aria-hidden="true">⚠️</span>
                          <span className="material-symbols-outlined" aria-hidden="true">propane_tank</span>
                          <span>Çürütücü 2</span>
                        </div>
                        <span className="ionaflux-schematic-link" aria-hidden="true" />
                        <div className="ionaflux-schematic-node">
                          <span className="material-symbols-outlined" aria-hidden="true">bolt</span>
                          <span>CHP Motor</span>
                        </div>
                      </div>
                      <p className="ionaflux-fault-note">⚠️ Mikser #2: Akım Eşiği %85</p>
                    </div>

                    <div className="ionaflux-widget-grid">
                      <div className="ionaflux-metric-card ionaflux-load-widget">
                        <svg viewBox="0 0 64 64" className="ionaflux-load-ring-svg" aria-hidden="true">
                          <circle cx="32" cy="32" r={LOAD_RING_R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" />
                          <circle
                            cx="32" cy="32" r={LOAD_RING_R} fill="none" stroke="#2eae73" strokeWidth="5"
                            strokeLinecap="round" strokeDasharray={LOAD_RING_CIRC} strokeDashoffset={loadRingOffset}
                            transform="rotate(-90 32 32)" className="ionaflux-load-ring-progress"
                          />
                          <text x="32" y="37" textAnchor="middle" className="ionaflux-load-ring-text">{metrics.motorLoad.toFixed(0)}%</text>
                        </svg>
                        <div>
                          <span className="ionaflux-metric-label">🟢 Motor Çalışma Yükü</span>
                          <span key={`motor-${tick}`} className="ionaflux-metric-value ionaflux-flash ionaflux-metric-value-sm">
                            {metrics.motorPower.toLocaleString('tr-TR')} kWe · 1500 RPM
                          </span>
                        </div>
                      </div>
                      <div className="ionaflux-metric-card ionaflux-balloon-widget">
                        <span className="ionaflux-balloon-icon" aria-hidden="true">🎈</span>
                        <div>
                          <span className="ionaflux-metric-label">Gaz Depolama / Balon</span>
                          <span key={`storage-${tick}`} className="ionaflux-metric-value ionaflux-flash ionaflux-metric-value-sm">
                            %{metrics.gasStorage.toFixed(0)} Doluluk
                          </span>
                          <span className="ionaflux-metric-label">1.840 m³ Gaz Hazır</span>
                        </div>
                      </div>
                    </div>

                    <div className="ionaflux-metric-grid">
                      <div className="ionaflux-metric-card">
                        <span className="ionaflux-metric-icon" aria-hidden="true">🟢</span>
                        <span key={`methane-${tick}`} className="ionaflux-metric-value ionaflux-flash">
                          {metrics.methane.toFixed(1)}% <span className="ionaflux-metric-unit">CH4</span>
                        </span>
                        <span className="ionaflux-metric-label">Metan Oranı</span>
                      </div>
                      <div className="ionaflux-metric-card">
                        <span className="ionaflux-metric-icon" aria-hidden="true">🌡️</span>
                        <span key={`temp-${tick}`} className="ionaflux-metric-value ionaflux-flash">
                          {metrics.temp.toFixed(1)} <span className="ionaflux-metric-unit">°C</span>
                        </span>
                        <span className="ionaflux-metric-label">Sıcaklık</span>
                      </div>
                      <div className="ionaflux-metric-card">
                        <span className="ionaflux-metric-icon" aria-hidden="true">📈</span>
                        <span key={`pressure-${tick}`} className="ionaflux-metric-value ionaflux-flash">
                          {metrics.pressure.toFixed(1)} <span className="ionaflux-metric-unit">mbar</span>
                        </span>
                        <span className="ionaflux-metric-label">Basınç</span>
                      </div>
                      <div className="ionaflux-metric-card">
                        <span className="ionaflux-metric-icon" aria-hidden="true">🛡️</span>
                        <span key={`h2s-${tick}`} className="ionaflux-metric-value ionaflux-flash">
                          {metrics.h2s} <span className="ionaflux-metric-unit">ppm</span>
                        </span>
                        <span className="ionaflux-metric-label">H2S</span>
                      </div>
                    </div>

                    <div className="ionaflux-sparkline-card">
                      <span className="ionaflux-metric-label ionaflux-sparkline-label">24s Gaz &amp; Güç Üretim Trendi</span>
                      <div className="ionaflux-chart-wrap">
                        <svg
                          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                          className="w-full h-14"
                          onMouseMove={handleChartMove}
                          onMouseLeave={() => setHoverIndex(null)}
                        >
                          <path d={sparklinePath} fill="none" stroke="#2eae73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          {hoverPoint && (
                            <>
                              <line x1={hoverPoint.x} y1="0" x2={hoverPoint.x} y2={CHART_H} stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
                              <circle cx={hoverPoint.x} cy={hoverPoint.y} r="3.5" fill="#2eae73" stroke="#0b0f19" strokeWidth="1.5" />
                            </>
                          )}
                        </svg>
                        {hoverPoint && (
                          <div className="ionaflux-chart-tooltip" style={{ left: `${(hoverPoint.x / CHART_W) * 100}%` }}>
                            <strong>{hoverValue} kWe</strong>
                            <span>{hoursAgo === 0 ? 'Şimdi' : `${hoursAgo}sa önce`}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {tab === 'logistics' && (
                  <>
                    <div className="ionaflux-sparkline-card ionaflux-intake-summary">
                      <span className="ionaflux-metric-label">Günlük Girdi Özeti</span>
                      <span className="ionaflux-metric-value ionaflux-metric-value-sm">Toplam Girdi: 284.5 Ton</span>
                      <span className="ionaflux-metric-label">12 Sefer</span>
                    </div>
                    <div className="ionaflux-truck-list">
                      {TRUCKS.map((truck) => (
                        <div key={truck.plate} className="ionaflux-metric-card ionaflux-truck-card">
                          <div className="ionaflux-truck-header">
                            <span>🚛 {truck.plate}</span>
                            <span className={`ionaflux-status-badge ionaflux-status-${truck.status}`}>{truck.statusLabel}</span>
                          </div>
                          <span className="ionaflux-metric-label ionaflux-truck-farm">{truck.farm}</span>
                          <span className="ionaflux-truck-waste">{truck.waste}</span>
                          <span className="ionaflux-metric-label">{truck.time}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {tab === 'lab' && (
                  <>
                    <div className="ionaflux-lab-list">
                      {LAB_ROWS.map((row) => (
                        <div key={row.label} className="ionaflux-metric-card ionaflux-lab-row">
                          <span className="ionaflux-metric-label">{row.label}</span>
                          <span className="ionaflux-metric-value ionaflux-metric-value-sm">{row.value}</span>
                          <span className="ionaflux-metric-label ionaflux-lab-note">{row.note}</span>
                        </div>
                      ))}
                    </div>
                    <p className="ionaflux-metric-label ionaflux-lab-footer">
                      Numune Saati: 14:00 · Onaylayan: Kimya/Biyoloji Lab
                    </p>
                  </>
                )}

                {tab === 'alerts' && (
                  <>
                    <div className="ionaflux-alerts-list">
                      {ALERTS.map((alert) => (
                        <div key={alert.text} className="ionaflux-alert-item ionaflux-alert-item-severity">
                          <span className={`ionaflux-status-badge ionaflux-status-${alert.severity === 'warn' ? 'unloading' : 'done'}`}>
                            {alert.severity === 'warn' ? '⚠️ Uyarı' : '✅ Sistem'}
                          </span>
                          <span>{alert.text}</span>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="ionaflux-report-download" onClick={handleDownloadReport}>
                      {reportDownloaded ? '✓ İndirildi' : '📄 Günlük Üretim Raporu İndir (PDF)'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="ionaflux-bottom-nav">
              <div className="ionaflux-nav-highlight" style={{ transform: `translateX(${activeTabIndex * 100}%)` }} aria-hidden="true" />
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
