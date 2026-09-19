import { computeYield, WASTE_PROFILES, normalizeTons } from './biogasMath.js';
import { openQuoteModal } from './quoteModal.js';

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

    slider.setAttribute('aria-valuetext', `${tonsPerDay} ton/gün`);
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
    const clamped = normalizeTons(value, tonsPerDay);
    tonsPerDay = clamped;
    slider.value = String(clamped);
    numberInput.value = String(clamped);
    tonValueLabel.textContent = String(clamped);
    recalculate();
  }

  pillsContainer.querySelectorAll('.biogaz-atik-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      if (!Object.hasOwn(WASTE_PROFILES, pill.dataset.waste)) return;
      wasteKey = pill.dataset.waste;
      pillsContainer.querySelectorAll('.biogaz-atik-pill').forEach((p) => {
        p.setAttribute('aria-pressed', String(p === pill));
      });
      recalculate();
    });
  });

  slider.addEventListener('input', () => setTons(slider.value));
  // Keep the draft intact while typing; do not turn '1' into '10' mid-entry.
  numberInput.addEventListener('input', () => {
    const draft = numberInput.valueAsNumber;
    if (numberInput.value !== '' && numberInput.validity.valid && Number.isFinite(draft)) {
      tonsPerDay = draft;
      slider.value = String(draft);
      tonValueLabel.textContent = String(draft);
      recalculate();
    }
  });
  numberInput.addEventListener('change', () => setTons(numberInput.value));
  numberInput.addEventListener('blur', () => setTons(numberInput.value));
  numberInput.addEventListener('keydown', event => { if (event.key === 'Enter') setTons(numberInput.value); });

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
