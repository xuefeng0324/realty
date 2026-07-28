import { parseCSV, rowsToObjects } from "./csv";
// @ts-ignore
import rawCsv from "../../static/mot_transport.csv?raw";

/** 交通运输部经济运行；货运/港口 ≠ 房价 */
export interface MotTransportRow {
  period: string;
  label: string;
  publishDate: string;
  freightYiT: number;
  freightYoyPct: number;
  roadFreightYiT: number | null;
  roadFreightYoyPct: number | null;
  waterFreightYiT: number | null;
  waterFreightYoyPct: number | null;
  portYiT: number | null;
  portYoyPct: number | null;
  containerYiTeu: number | null;
  containerYoyPct: number | null;
  passengerYiTrips: number | null;
  passengerYoyPct: number | null;
  investYiYuan: number | null;
  sourceUrl: string;
}

function n(v: string | undefined): number {
  const x = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}

function nOrNull(v: string | undefined): number | null {
  const t = String(v ?? "").replace(/,/g, "").trim();
  if (!t) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
}

function periodSortKey(period: string): [number, number] {
  const m = String(period).match(/^(20\d{2})(?:-(Q1|H1|9M)|-(\d{2}))?$/);
  if (!m) return [0, 0];
  const year = Number(m[1]);
  if (m[2]) {
    const order: Record<string, number> = { Q1: 3, H1: 6, "9M": 9 };
    return [year, order[m[2]] ?? 0];
  }
  if (m[3]) return [year, Number(m[3])];
  return [year, 12];
}

function mapRow(row: Record<string, string>): MotTransportRow | null {
  const period = String(row.period ?? "").trim();
  const sourceUrl = String(row.source_url ?? "").trim();
  if (!period || (!sourceUrl.includes("mot.gov.cn") && !sourceUrl.includes("xxgk.mot.gov.cn"))) {
    return null;
  }
  if (!sourceUrl.startsWith("https://")) return null;
  const freightYiT = n(row.freight_yi_t);
  if (freightYiT <= 0) return null;
  return {
    period,
    label: String(row.label ?? "").trim() || period,
    publishDate: String(row.publish_date ?? "").trim(),
    freightYiT,
    freightYoyPct: n(row.freight_yoy_pct),
    roadFreightYiT: nOrNull(row.road_freight_yi_t),
    roadFreightYoyPct: nOrNull(row.road_freight_yoy_pct),
    waterFreightYiT: nOrNull(row.water_freight_yi_t),
    waterFreightYoyPct: nOrNull(row.water_freight_yoy_pct),
    portYiT: nOrNull(row.port_yi_t),
    portYoyPct: nOrNull(row.port_yoy_pct),
    containerYiTeu: nOrNull(row.container_yi_teu),
    containerYoyPct: nOrNull(row.container_yoy_pct),
    passengerYiTrips: nOrNull(row.passenger_yi_trips),
    passengerYoyPct: nOrNull(row.passenger_yoy_pct),
    investYiYuan: nOrNull(row.invest_yi_yuan),
    sourceUrl
  };
}

export function loadMotTransportFromCSV(text: string): MotTransportRow[] {
  return rowsToObjects<Record<string, string>>(parseCSV(text))
    .map(mapRow)
    .filter((r): r is MotTransportRow => !!r)
    .sort((a, b) => {
      const [ay, ao] = periodSortKey(a.period);
      const [by, bo] = periodSortKey(b.period);
      if (by !== ay) return by - ay;
      return bo - ao;
    });
}

let rows: MotTransportRow[] = loadMotTransportFromCSV(String(rawCsv ?? ""));

export function getMotTransportRows(): MotTransportRow[] {
  return [...rows];
}

export function getLatestMotTransport(): MotTransportRow | null {
  return rows[0] || null;
}

export function getMotTransportTrend(limit = 6): MotTransportRow[] {
  return rows.slice(0, Math.max(0, limit));
}

export function shortMotTransportPeriodLabel(period: string): string {
  const m = String(period).match(/^(20\d{2})(?:-(Q1|H1|9M)|-(\d{2}))?$/);
  if (!m) return period;
  const yy = m[1].slice(2);
  if (m[2] === "Q1") return `${yy}Q1`;
  if (m[2] === "H1") return `${yy}H1`;
  if (m[2] === "9M") return `${yy}前三季`;
  if (m[3]) return `${yy}/${m[3]}`;
  return period;
}

export function __setMotTransportForTest(next: MotTransportRow[]): void {
  rows = [...next].sort((a, b) => {
    const [ay, ao] = periodSortKey(a.period);
    const [by, bo] = periodSortKey(b.period);
    if (by !== ay) return by - ay;
    return bo - ao;
  });
}
