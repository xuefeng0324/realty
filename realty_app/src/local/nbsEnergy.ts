import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/nbs_energy.csv?raw";

/** 国家统计局月度能源生产（原煤/原油/天然气/发电量）；≠房价 */
export interface NbsEnergyRow {
  month: string;
  publishDate: string;
  coalYiT: number;
  coalYoyPct: number;
  oilWanT: number;
  oilYoyPct: number;
  gasYiM3: number;
  gasYoyPct: number;
  powerYiKwh: number;
  powerYoyPct: number;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}

function mapRow(row: Record<string, string>): NbsEnergyRow | null {
  const month = String(row.month ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month) || !sourceUrl.startsWith("https://www.stats.gov.cn/")) {
    return null;
  }
  const coalYoy = n(row.coal_yoy_pct);
  const powerYoy = n(row.power_yoy_pct);
  if (!Number.isFinite(coalYoy) && !Number.isFinite(powerYoy)) return null;
  return {
    month,
    publishDate: String(row.publish_date ?? "").trim(),
    coalYiT: n(row.coal_yi_t),
    coalYoyPct: coalYoy,
    oilWanT: n(row.oil_wan_t),
    oilYoyPct: n(row.oil_yoy_pct),
    gasYiM3: n(row.gas_yi_m3),
    gasYoyPct: n(row.gas_yoy_pct),
    powerYiKwh: n(row.power_yi_kwh),
    powerYoyPct: powerYoy,
    sourceUrl
  };
}

export function loadNbsEnergyFromCSV(text: string): NbsEnergyRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is NbsEnergyRow => !!r && (r.coalYiT > 0 || r.powerYiKwh > 0))
    .sort((a, b) => b.month.localeCompare(a.month));
}

let rows: NbsEnergyRow[] = loadNbsEnergyFromCSV(String(rawCsv ?? ""));

export function getNbsEnergyRows(): NbsEnergyRow[] {
  return [...rows];
}

export function getLatestNbsEnergy(): NbsEnergyRow | null {
  return rows[0] || null;
}

export function getNbsEnergyTrend(limit = 6): NbsEnergyRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function shortNbsEnergyMonthLabel(month: string): string {
  const m = month.match(/^\d{4}-(\d{2})$/);
  return m ? `${Number(m[1])}月` : month;
}

export function __setNbsEnergyForTest(next: NbsEnergyRow[]): void {
  rows = [...next].sort((a, b) => b.month.localeCompare(a.month));
}
