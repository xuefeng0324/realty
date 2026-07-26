import { parseCSV, rowsToObjects } from "./csv";

export interface NbsRealEstateSnapshot {
  period: string;
  publishDate: string;
  investmentCny100m: number;
  investmentYoyPct: number;
  /** 其中：住宅投资（亿元） */
  residentialInvestmentCny100m: number;
  residentialInvestmentYoyPct: number;
  /** 房屋施工面积（万㎡） */
  constructionArea10kSqm: number;
  constructionAreaYoyPct: number;
  /** 房屋新开工面积（万㎡） */
  newStartsArea10kSqm: number;
  newStartsAreaYoyPct: number;
  /** 房屋竣工面积（万㎡） */
  completedArea10kSqm: number;
  completedAreaYoyPct: number;
  salesArea10kSqm: number;
  salesAreaYoyPct: number;
  /** 其中：住宅销售面积（万㎡） */
  residentialSalesArea10kSqm: number;
  residentialSalesAreaYoyPct: number;
  salesAmountCny100m: number;
  salesAmountYoyPct: number;
  /** 其中：住宅销售额（亿元） */
  residentialSalesAmountCny100m: number;
  residentialSalesAmountYoyPct: number;
  inventoryArea10kSqm: number;
  inventoryAreaYoyPct: number;
  /** 其中：住宅待售面积（万㎡） */
  residentialInventoryArea10kSqm: number;
  residentialInventoryAreaYoyPct: number;
  fundsCny100m: number;
  fundsYoyPct: number;
  /** 个人按揭贷款（亿元） */
  mortgageFundsCny100m: number;
  mortgageFundsYoyPct: number;
  sourceUrl: string;
}

let snapshots: NbsRealEstateSnapshot[] = [];

const numeric = (value: string | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`国家统计局房地产字段不是有效数字：${value ?? ""}`);
  return parsed;
};

export function loadNbsRealEstateFromCSV(text: string): NbsRealEstateSnapshot[] {
  snapshots = rowsToObjects<Record<string, string>>(parseCSV(text)).map((row) => {
    const sourceUrl = String(row.source_url ?? "").trim();
    if (!sourceUrl.startsWith("https://www.stats.gov.cn/")) {
      throw new Error(`国家统计局房地产来源链接无效：${sourceUrl}`);
    }
    return {
      period: String(row.period ?? "").trim(),
      publishDate: String(row.publish_date ?? "").trim(),
      investmentCny100m: numeric(row.investment_cny_100m),
      investmentYoyPct: numeric(row.investment_yoy_pct),
      residentialInvestmentCny100m: numeric(row.residential_investment_cny_100m),
      residentialInvestmentYoyPct: numeric(row.residential_investment_yoy_pct),
      constructionArea10kSqm: numeric(row.construction_area_10k_sqm),
      constructionAreaYoyPct: numeric(row.construction_area_yoy_pct),
      newStartsArea10kSqm: numeric(row.new_starts_area_10k_sqm),
      newStartsAreaYoyPct: numeric(row.new_starts_area_yoy_pct),
      completedArea10kSqm: numeric(row.completed_area_10k_sqm),
      completedAreaYoyPct: numeric(row.completed_area_yoy_pct),
      salesArea10kSqm: numeric(row.sales_area_10k_sqm),
      salesAreaYoyPct: numeric(row.sales_area_yoy_pct),
      residentialSalesArea10kSqm: numeric(row.residential_sales_area_10k_sqm),
      residentialSalesAreaYoyPct: numeric(row.residential_sales_area_yoy_pct),
      salesAmountCny100m: numeric(row.sales_amount_cny_100m),
      salesAmountYoyPct: numeric(row.sales_amount_yoy_pct),
      residentialSalesAmountCny100m: numeric(row.residential_sales_amount_cny_100m),
      residentialSalesAmountYoyPct: numeric(row.residential_sales_amount_yoy_pct),
      inventoryArea10kSqm: numeric(row.inventory_area_10k_sqm),
      inventoryAreaYoyPct: numeric(row.inventory_area_yoy_pct),
      residentialInventoryArea10kSqm: numeric(row.residential_inventory_area_10k_sqm),
      residentialInventoryAreaYoyPct: numeric(row.residential_inventory_area_yoy_pct),
      fundsCny100m: numeric(row.funds_cny_100m),
      fundsYoyPct: numeric(row.funds_yoy_pct),
      mortgageFundsCny100m: numeric(row.mortgage_funds_cny_100m),
      mortgageFundsYoyPct: numeric(row.mortgage_funds_yoy_pct),
      sourceUrl
    };
  }).filter((row) => row.period && /^\d{4}-\d{2}-\d{2}$/.test(row.publishDate));
  snapshots.sort((a, b) => b.publishDate.localeCompare(a.publishDate));
  return [...snapshots];
}

export function getLatestNbsRealEstate(): NbsRealEstateSnapshot | null {
  return snapshots[0] ?? null;
}

/** 按 publishDate 降序的历史快照（最新在前） */
export function getNbsRealEstateHistory(limit = 12): NbsRealEstateSnapshot[] {
  return snapshots.slice(0, Math.max(0, limit));
}

export type NbsYoyTrendPoint = {
  period: string;
  /** 短标签，如 1—6 */
  shortLabel: string;
  salesAreaYoyPct: number;
  salesAmountYoyPct: number;
  investmentYoyPct: number;
  fundsYoyPct: number;
  constructionAreaYoyPct: number;
  newStartsAreaYoyPct: number;
  completedAreaYoyPct: number;
  residentialSalesAreaYoyPct: number;
  mortgageFundsYoyPct: number;
};

function shortPeriodLabel(period: string): string {
  const m = period.match(/(\d{4})-01_to_\1-(\d{2})$/);
  if (!m) return period;
  return `1—${Number(m[2])}`;
}

/** 销售面积/销售额/投资/到位资金/施工·新开工·竣工/住宅·按揭同比序列（官方累计口径，非成交均价） */
export function getNbsYoyTrend(limit = 6): NbsYoyTrendPoint[] {
  return getNbsRealEstateHistory(limit)
    .slice()
    .reverse()
    .map((s) => ({
      period: s.period,
      shortLabel: shortPeriodLabel(s.period),
      salesAreaYoyPct: s.salesAreaYoyPct,
      salesAmountYoyPct: s.salesAmountYoyPct,
      investmentYoyPct: s.investmentYoyPct,
      fundsYoyPct: s.fundsYoyPct,
      constructionAreaYoyPct: s.constructionAreaYoyPct,
      newStartsAreaYoyPct: s.newStartsAreaYoyPct,
      completedAreaYoyPct: s.completedAreaYoyPct,
      residentialSalesAreaYoyPct: s.residentialSalesAreaYoyPct,
      mortgageFundsYoyPct: s.mortgageFundsYoyPct
    }));
}

/**
 * 全国新建商品房合同均价（销售额÷销售面积）派生值，单位元/㎡。
 * 累计合同口径，≠城市挂牌均价、≠网签均价、≠70城价格指数。
 */
export function getNbsImpliedContractUnitPrice(
  snapshot?: NbsRealEstateSnapshot | null
): number | null {
  const s = snapshot === undefined ? getLatestNbsRealEstate() : snapshot;
  if (!s || !(s.salesArea10kSqm > 0) || !Number.isFinite(s.salesAmountCny100m)) return null;
  // 亿元 / 万㎡ → 元/㎡ = (亿元×1e8) / (万㎡×1e4) = 亿元×1e4 / 万㎡
  return Math.round((s.salesAmountCny100m * 10000) / s.salesArea10kSqm);
}

/**
 * 全国新建商品住宅合同均价（住宅销售额÷住宅销售面积），单位元/㎡。
 * 累计合同口径，≠城市挂牌/网签/70城。
 */
export function getNbsImpliedResidentialUnitPrice(
  snapshot?: NbsRealEstateSnapshot | null
): number | null {
  const s = snapshot === undefined ? getLatestNbsRealEstate() : snapshot;
  if (
    !s ||
    !(s.residentialSalesArea10kSqm > 0) ||
    !Number.isFinite(s.residentialSalesAmountCny100m)
  ) {
    return null;
  }
  return Math.round((s.residentialSalesAmountCny100m * 10000) / s.residentialSalesArea10kSqm);
}

export type NbsUnitPriceTrendPoint = {
  period: string;
  shortLabel: string;
  unitPriceYuanPerSqm: number;
};

/** 多期合同均价（时间升序）；累计口径，勿直接当作月度环比房价 */
export function getNbsImpliedUnitPriceTrend(limit = 6): NbsUnitPriceTrendPoint[] {
  return getNbsRealEstateHistory(limit)
    .slice()
    .reverse()
    .map((s) => {
      const unitPriceYuanPerSqm = getNbsImpliedContractUnitPrice(s);
      if (unitPriceYuanPerSqm == null) return null;
      return {
        period: s.period,
        shortLabel: shortPeriodLabel(s.period),
        unitPriceYuanPerSqm
      };
    })
    .filter((x): x is NbsUnitPriceTrendPoint => !!x);
}

/**
 * 全国待售面积相对销售节奏的粗算「可售月数」：
 * 待售面积 ÷（累计销售面积 / 累计月数）。
 * 宏观派生，≠城市去化周期。
 */
export function getNbsImpliedInventoryMonths(
  snapshot?: NbsRealEstateSnapshot | null
): number | null {
  const s = snapshot === undefined ? getLatestNbsRealEstate() : snapshot;
  if (!s || !(s.salesArea10kSqm > 0) || !(s.inventoryArea10kSqm > 0)) return null;
  const m = s.period.match(/(\d{4})-01_to_\1-(\d{2})$/);
  const months = m ? Number(m[2]) : 0;
  if (!(months > 0)) return null;
  return Math.round((s.inventoryArea10kSqm * months * 10) / s.salesArea10kSqm) / 10;
}

export type NbsInventoryMonthsTrendPoint = {
  period: string;
  shortLabel: string;
  inventoryMonths: number;
};

/** 多期粗算可售月数（时间升序）；累计口径，勿直接当作城市去化环比 */
export function getNbsImpliedInventoryMonthsTrend(limit = 6): NbsInventoryMonthsTrendPoint[] {
  return getNbsRealEstateHistory(limit)
    .slice()
    .reverse()
    .map((s) => {
      const inventoryMonths = getNbsImpliedInventoryMonths(s);
      if (inventoryMonths == null) return null;
      return {
        period: s.period,
        shortLabel: shortPeriodLabel(s.period),
        inventoryMonths
      };
    })
    .filter((x): x is NbsInventoryMonthsTrendPoint => !!x);
}
