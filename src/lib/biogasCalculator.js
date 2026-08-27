import { openQuoteModal } from './quoteModal.js';

/* Rule-of-thumb industry averages, not IONA's own measured plant data —
   the results panel and quote prefill both say so explicitly. Swap
   these for IONA's real per-project engineering figures whenever
   they're available; nothing else in this file needs to change.
   yieldM3PerTon: biogas (not pure methane) yield per wet ton of
   feedstock. ch4: methane fraction of that biogas by volume. Both are
   commonly-cited ranges for each substrate, picked mid-range. */
const WASTE_PROFILES = {
  cattle: { label: 'Büyükbaş Hayvan Gübresi', yieldM3PerTon: 25, ch4: 0.6 },
  poultry: { label: 'Kanatlı Gübresi', yieldM3PerTon: 45, ch4: 0.6 },
  silage: { label: 'Tarımsal / Mısır Silajı', yieldM3PerTon: 190, ch4: 0.52 },
  industrial: { label: 'Organik Endüstriyel Atık', yieldM3PerTon: 100, ch4: 0.55 },
};

/* Lower heating value of pure methane, kWh per normal m³ — a physical
   constant, not a tunable assumption. */
const CH4_LHV_KWH_PER_M3 = 9.94;
/* Typical biogas CHP genset electrical/thermal efficiency split (the
   remainder is losses) and a typical annual uptime/availability factor
   for a well-run plant. */
const CHP_ELECTRICAL_EFFICIENCY = 0.4;
const CHP_THERMAL_EFFICIENCY = 0.45;
const ANNUAL_AVAILABILITY = 0.92;
/* Approximate Turkey grid average emission factor (tCO2 avoided per MWh
   of electricity generated in place of grid draw) — a commonly-cited
   round figure, not a live/official value. */
const GRID_CO2_FACTOR_TON_PER_MWH = 0.45;

function computeYield(tonsPerDay, profile) {
  const dailyBiogasM3 = tonsPerDay * profile.yieldM3PerTon;
  const dailyEnergyKWh = dailyBiogasM3 * profile.ch4 * CH4_LHV_KWH_PER_M3;
  const installedElectricalKWe = (dailyEnergyKWh * CHP_ELECTRICAL_EFFICIENCY) / 24;
  const installedThermalKWth = (dailyEnergyKWh * CHP_THERMAL_EFFICIENCY) / 24;
  const annualElectricityMWh = (installedElectricalKWe * 8760 * ANNUAL_AVAILABILITY) / 1000;
  const annualCO2AvoidedTon = annualElectricityMWh * GRID_CO2_FACTOR_TON_PER_MWH;
  return { installedElectricalKWe, installedThermalKWth, annualElectricityMWh, annualCO2AvoidedTon };
}

function formatPower(kw) {
  if (kw >= 1000) return `${(kw / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} MWe`;
  return `${kw.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} kWe`;
}

function formatThermal(kw) {
  return `${kw.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} kWth`;
}

function formatMWh(mwh) {
  return `${mwh.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} MWh/yıl`;
}

function formatTon(ton) {
  return `${ton.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} Ton/yıl`;
}

/* Phase 117: reactive fill for the ring/bars — one shared percentage
   (the slider's own position in its 10-500 range) rather than a
   separate invented "typical max" per metric. All four outputs scale
   linearly with tonsPerDay for a fixed waste profile, so this single
   number stays visually honest for each of them. */
const TON_MIN = 10;
const TON_MAX = 500;
const RING_CIRCUMFERENCE = 2 * Math.PI * 34;

function fillPercent(tonsPerDay) {
  return ((tonsPerDay - TON_MIN) / (TON_MAX - TON_MIN)) * 100;
}

export function initBiogasCalculator() {
  const section = document.getElementById('biogaz-hesaplayici');
  if (!section) return;

  const pillsContainer = document.getElementById('biogaz-atik-pills');
  const slider = document.getElementById('biogaz-ton-slider');
  const numberInput = document.getElementById('biogaz-ton-input');
  const tonValueLabel = document.getElementById('biogaz-ton-value');
  const outPower = document.getElementById('biogaz-out-power');
  const outElectricity = document.getElementById('biogaz-out-electricity');
  const outThermal = document.getElementById('biogaz-out-thermal');
  const outCo2 = document.getElementById('biogaz-out-co2');
  const powerRing = document.getElementById('biogaz-out-power-ring');
  const electricityBar = document.getElementById('biogaz-out-electricity-bar');
  const thermalBar = document.getElementById('biogaz-out-thermal-bar');
  const co2Bar = document.getElementById('biogaz-out-co2-bar');
  const ctaButton = document.getElementById('biogaz-cta');
  if (!pillsContainer || !slider || !numberInput || !ctaButton) return;

  let wasteKey = 'cattle';
  let tonsPerDay = Number(slider.value) || 50;

  function recalculate() {
    const profile = WASTE_PROFILES[wasteKey];
    const result = computeYield(tonsPerDay, profile);
    outPower.textContent = formatPower(result.installedElectricalKWe);
    outThermal.textContent = formatThermal(result.installedThermalKWth);
    outElectricity.textContent = formatMWh(result.annualElectricityMWh);
    outCo2.textContent = formatTon(result.annualCO2AvoidedTon);

    const pct = fillPercent(tonsPerDay);
    slider.style.setProperty('--iona-slider-fill', `${pct}%`);
    if (powerRing) {
      powerRing.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - pct / 100));
    }
    [electricityBar, thermalBar, co2Bar].forEach((bar) => {
      if (bar) bar.style.setProperty('--iona-fill', `${pct}%`);
    });
  }

  function setTons(value) {
    const clamped = Math.min(500, Math.max(10, Number(value) || 10));
    tonsPerDay = clamped;
    slider.value = String(clamped);
    numberInput.value = String(clamped);
    tonValueLabel.textContent = String(clamped);
    recalculate();
  }

  pillsContainer.querySelectorAll('.biogaz-atik-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      wasteKey = pill.dataset.waste;
      pillsContainer.querySelectorAll('.biogaz-atik-pill').forEach((p) => {
        p.setAttribute('aria-pressed', String(p === pill));
      });
      recalculate();
    });
  });

  slider.addEventListener('input', () => setTons(slider.value));
  numberInput.addEventListener('input', () => setTons(numberInput.value));

  ctaButton.addEventListener('click', () => {
    const profile = WASTE_PROFILES[wasteKey];
    const result = computeYield(tonsPerDay, profile);
    openQuoteModal({
      project: `Biyogaz Tesisi — ${profile.label}, ${tonsPerDay} Ton/Gün (yaklaşık ${formatPower(result.installedElectricalKWe)})`,
      notes: `Hesaplayıcıdan gelen yaklaşık tahmin: ${formatPower(result.installedElectricalKWe)} kurulu güç, ${formatMWh(result.annualElectricityMWh)} yıllık elektrik üretimi, ${formatThermal(result.installedThermalKWth)} termal geri kazanım, ${formatTon(result.annualCO2AvoidedTon)} CO2 azaltımı.`,
    });
  });

  recalculate();
}
