export const WASTE_PROFILES = {
  cattle: { label: 'Büyükbaş Hayvan Gübresi', yieldM3PerTon: 25, ch4: 0.6 },
  poultry: { label: 'Kanatlı Gübresi', yieldM3PerTon: 45, ch4: 0.6 },
  silage: { label: 'Tarımsal / Mısır Silajı', yieldM3PerTon: 190, ch4: 0.52 },
  industrial: { label: 'Organik Endüstriyel Atık', yieldM3PerTon: 100, ch4: 0.55 },
};


const CH4_LHV_KWH_PER_M3 = 9.94;

const CHP_ELECTRICAL_EFFICIENCY = 0.4;
const CHP_THERMAL_EFFICIENCY = 0.45;
const ANNUAL_AVAILABILITY = 0.92;

const GRID_CO2_FACTOR_TON_PER_MWH = 0.45;

export function computeYield(tonsPerDay, profile) {
  const dailyBiogasM3 = tonsPerDay * profile.yieldM3PerTon;
  const dailyEnergyKWh = dailyBiogasM3 * profile.ch4 * CH4_LHV_KWH_PER_M3;
  const installedElectricalKWe = (dailyEnergyKWh * CHP_ELECTRICAL_EFFICIENCY) / 24;
  const installedThermalKWth = (dailyEnergyKWh * CHP_THERMAL_EFFICIENCY) / 24;
  const annualElectricityMWh = (installedElectricalKWe * 8760 * ANNUAL_AVAILABILITY) / 1000;
  const annualCO2AvoidedTon = annualElectricityMWh * GRID_CO2_FACTOR_TON_PER_MWH;
  return { installedElectricalKWe, installedThermalKWth, annualElectricityMWh, annualCO2AvoidedTon };
}


export function normalizeTons(value, fallback = 50) {
  if (value === '' || !Number.isFinite(Number(value))) return fallback;
  return Math.round(Math.min(500, Math.max(10, Number(value))) / 5) * 5;
}
