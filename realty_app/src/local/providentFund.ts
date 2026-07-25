import { parseCSV, rowsToObjects } from "./csv";

export interface ProvidentFundRate {
  effectiveDate: string;
  first5yOrLess: number;
  firstOver5y: number;
  second5yOrLess: number;
  secondOver5y: number;
  sourceUrl: string;
}

let rates: ProvidentFundRate[] = [];

export function loadProvidentFundRatesFromCSV(text: string): ProvidentFundRate[] {
  rates = rowsToObjects<Record<string, string>>(parseCSV(text))
    .map((row) => ({
      effectiveDate: String(row.effective_date ?? "").trim(),
      first5yOrLess: numberField(row.first_5y_or_less),
      firstOver5y: numberField(row.first_over_5y),
      second5yOrLess: numberField(row.second_5y_or_less),
      secondOver5y: numberField(row.second_over_5y),
      sourceUrl: String(row.source_url ?? "").trim()
    }))
    .filter(isValidRate)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  return [...rates];
}

export function getLatestProvidentFundRate(): ProvidentFundRate | null {
  return rates[rates.length - 1] ?? null;
}

export function monthlyPayment(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || annualRatePct < 0 || years <= 0) return 0;
  const months = years * 12;
  const rate = annualRatePct / 100 / 12;
  if (rate === 0) return principal / months;
  const factor = (1 + rate) ** months;
  return principal * rate * factor / (factor - 1);
}

function isValidRate(row: ProvidentFundRate): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(row.effectiveDate)
    && row.first5yOrLess > 0
    && row.firstOver5y > 0
    && row.second5yOrLess >= row.first5yOrLess
    && row.secondOver5y >= row.firstOver5y
    && row.sourceUrl.startsWith("https://www.gov.cn/");
}

function numberField(value: string | undefined): number {
  const parsed = Number(value ?? NaN);
  return Number.isFinite(parsed) ? parsed : 0;
}
