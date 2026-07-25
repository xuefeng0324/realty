/**
 * 房价三轴语义：挂牌价 / 网签量 / 价格指数
 * 对照：docs/HOUSING_PRICE_ACCEPTANCE.md
 * 开源：hugohe3/70cityprice（指数）、beike-lianjia（挂牌）、政府网签（量非价）
 */

export type PriceAxis = "listing_ask" | "wangqian_volume" | "stats70_index";

const FORBIDDEN_AS_LISTING_LABEL = ["成交价", "成交均价", "网签均价", "真实成交价"];

export function priceAxisLabel(axis: PriceAxis): string {
  switch (axis) {
    case "listing_ask":
      return "挂牌价";
    case "wangqian_volume":
      return "网签成交量";
    case "stats70_index":
      return "70城价格指数";
    default: {
      const _exhaustive: never = axis;
      return _exhaustive;
    }
  }
}

/** 地图/热力等：listings 聚合单价的对外短标签 */
export function listingUnitPriceHeatLabel(): string {
  return "挂牌均价";
}

/** Hero / KPI：城市中位单价 */
export function listingMedianUnitPriceLabel(): string {
  return "挂牌中位单价";
}

/** 网签 KPI 短标签（禁止「均价」） */
export function wangqianVolumeLabel(): string {
  return "网签套数";
}

/** 70 城 KPI 短标签 */
export function stats70IndexLabel(): string {
  return "二手价格指数";
}

/**
 * 校验展示文案是否把「挂牌均价」误写成成交价类用语。
 * 返回空数组 = 通过。
 */
export function auditListingPriceCopy(text: string): string[] {
  const hits: string[] = [];
  for (const word of FORBIDDEN_AS_LISTING_LABEL) {
    if (text.includes(word)) hits.push(word);
  }
  return hits;
}

/** 三轴一句话说明（设置/工作台可复用） */
export function priceAxesDisclaimer(): string {
  return "房价展示分三轴：挂牌价（卖方要价，元/㎡）、网签成交量（套数/面积，非政府成交均价）、70城价格指数（统计局相对指数，非元/㎡）。";
}
