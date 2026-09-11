import { describe, expect, it } from "vitest";
import {
  normalizeDataMode,
  type DataMode
} from "../src/local/dataMode";
import {
  normalizeListingSourceKind,
  listingSourceKindLabel
} from "../src/local/listingSource";
import {
  DECORATE_FILTER_OPTIONS,
  LISTING_TYPE_FILTER_OPTIONS,
  matchesListingTypeFilter,
  matchesDecorateTypeFilter
} from "../src/local/listingFilterMatch";
import {
  DASH_TAB_KEYS,
  cardVisibleOnDashTab,
  dashTabSwitchFeedback
} from "../src/local/dashTabs";

/**
 * 本文件覆盖 src/local/ 4 个小 helper 文件（都是纯函数，无 uni 依赖）。
 *  - dataMode.ts (17 行)
 *  - listingSource.ts (21 行)
 *  - listingFilterMatch.ts (38 行)
 *  - dashTabs.ts (39 行)
 *
 * 合计 33 个用例覆盖。
 */
describe("local/dataMode", () => {
  it("normalizeDataMode 'csv-url' → 'csv-url'", () => {
    expect(normalizeDataMode("csv-url")).toBe("csv-url");
  });

  it("normalizeDataMode 'seed' → 'seed'", () => {
    expect(normalizeDataMode("seed")).toBe("seed");
  });

  it("normalizeDataMode 其它字符串 → 'seed' fallback", () => {
    expect(normalizeDataMode("foo")).toBe<DataMode>("seed");
    expect(normalizeDataMode("")).toBe<DataMode>("seed");
  });

  it("normalizeDataMode null / undefined / number / object → 'seed' fallback", () => {
    expect(normalizeDataMode(null)).toBe<DataMode>("seed");
    expect(normalizeDataMode(undefined)).toBe<DataMode>("seed");
    expect(normalizeDataMode(42)).toBe<DataMode>("seed");
    expect(normalizeDataMode({})).toBe<DataMode>("seed");
  });
});

describe("local/listingSource", () => {
  describe("normalizeListingSourceKind", () => {
    it("REAL / DERIVED / ESTIMATED 直接识别", () => {
      expect(normalizeListingSourceKind("REAL")).toBe("REAL");
      expect(normalizeListingSourceKind("DERIVED")).toBe("DERIVED");
      expect(normalizeListingSourceKind("ESTIMATED")).toBe("ESTIMATED");
    });

    it("大小写不敏感（toUpperCase）", () => {
      expect(normalizeListingSourceKind("real")).toBe("REAL");
      expect(normalizeListingSourceKind("Real")).toBe("REAL");
      expect(normalizeListingSourceKind("real  ")).toBe("REAL"); // trim
    });

    it("label 含 '派生|样本|住建局公开成交' → DERIVED", () => {
      expect(normalizeListingSourceKind("", "派生样本")).toBe("DERIVED");
      expect(normalizeListingSourceKind(null, "住建局公开成交")).toBe("DERIVED");
      expect(normalizeListingSourceKind(null, "派生")).toBe("DERIVED");
    });

    it("label 含 '链家|安居客' → REAL", () => {
      expect(normalizeListingSourceKind("", "链家")).toBe("REAL");
      expect(normalizeListingSourceKind(null, "安居客")).toBe("REAL");
    });

    it("未匹配 → UNKNOWN", () => {
      expect(normalizeListingSourceKind("")).toBe("UNKNOWN");
      expect(normalizeListingSourceKind(null)).toBe("UNKNOWN");
      expect(normalizeListingSourceKind(null, "未识别源")).toBe("UNKNOWN");
    });
  });

  describe("listingSourceKindLabel", () => {
    it("REAL → 真实挂牌", () => {
      expect(listingSourceKindLabel("REAL")).toBe("真实挂牌");
    });

    it("DERIVED → 派生样本", () => {
      expect(listingSourceKindLabel("DERIVED")).toBe("派生样本");
    });

    it("ESTIMATED → 估算数据", () => {
      expect(listingSourceKindLabel("ESTIMATED")).toBe("估算数据");
    });

    it("UNKNOWN → 来源未分级", () => {
      expect(listingSourceKindLabel("UNKNOWN")).toBe("来源未分级");
    });
  });
});

describe("local/listingFilterMatch", () => {
  it("DECORATE_FILTER_OPTIONS 含 6 项（不限 / 精装 / 豪装 / 普装 / 简装 / 毛坯）", () => {
    expect(DECORATE_FILTER_OPTIONS).toEqual([
      "不限", "精装", "豪装", "普装", "简装", "毛坯"
    ]);
  });

  it("LISTING_TYPE_FILTER_OPTIONS 含 4 项（全部 / 二手房 / 新房 / 成交）", () => {
    expect(LISTING_TYPE_FILTER_OPTIONS).toEqual([
      "全部", "二手房", "新房", "成交"
    ]);
  });

  describe("matchesListingTypeFilter", () => {
    it("filter 为空 / 'all' / '全部' → 总是 true", () => {
      expect(matchesListingTypeFilter("二手房", "")).toBe(true);
      expect(matchesListingTypeFilter("二手房", undefined)).toBe(true);
      expect(matchesListingTypeFilter("二手房", "all")).toBe(true);
      expect(matchesListingTypeFilter("二手房", "全部")).toBe(true);
    });

    it("actual 为 null/空字符串 → false", () => {
      expect(matchesListingTypeFilter(null, "二手房")).toBe(false);
      expect(matchesListingTypeFilter("", "二手房")).toBe(false);
    });

    it("exact match → true", () => {
      expect(matchesListingTypeFilter("二手房", "二手房")).toBe(true);
      expect(matchesListingTypeFilter("新房", "新房")).toBe(true);
    });

    it("filter '二手房' / '二手' 走 USED 别名（含 在售/挂牌/挂牌在售）", () => {
      expect(matchesListingTypeFilter("二手", "二手房")).toBe(true);
      expect(matchesListingTypeFilter("在售", "二手房")).toBe(true);
      expect(matchesListingTypeFilter("挂牌", "二手房")).toBe(true);
      expect(matchesListingTypeFilter("挂牌在售", "二手房")).toBe(true);
      // 新房不应被 match
      expect(matchesListingTypeFilter("新房", "二手房")).toBe(false);
    });

    it("filter '新房' 走 NEW_HOME 别名（含 新盘/期房/楼盘）", () => {
      expect(matchesListingTypeFilter("新盘", "新房")).toBe(true);
      expect(matchesListingTypeFilter("期房", "新房")).toBe(true);
      expect(matchesListingTypeFilter("楼盘", "新房")).toBe(true);
      // 二手不应被 match
      expect(matchesListingTypeFilter("二手", "新房")).toBe(false);
    });

    it("filter '在售' / '挂牌在售' 走 USED + NEW_HOME 并集", () => {
      expect(matchesListingTypeFilter("在售", "在售")).toBe(true);
      expect(matchesListingTypeFilter("二手", "挂牌在售")).toBe(true);
      expect(matchesListingTypeFilter("新盘", "挂牌在售")).toBe(true);
      // 成交不应被 match
      expect(matchesListingTypeFilter("成交样本", "在售")).toBe(false);
    });

    it("filter '成交' / '成交样本' 走 SOLD 别名", () => {
      expect(matchesListingTypeFilter("已成交", "成交")).toBe(true);
      expect(matchesListingTypeFilter("成交房", "成交样本")).toBe(true);
      expect(matchesListingTypeFilter("网签成交", "成交")).toBe(true);
    });

    it("未识别的 filter 值 → false（不会 fallback 到 true）", () => {
      expect(matchesListingTypeFilter("二手房", "未知")).toBe(false);
    });
  });

  describe("matchesDecorateTypeFilter", () => {
    it("filter 为空 / '不限' → 总是 true", () => {
      expect(matchesDecorateTypeFilter("精装", "")).toBe(true);
      expect(matchesDecorateTypeFilter("精装", undefined)).toBe(true);
      expect(matchesDecorateTypeFilter("精装", "不限")).toBe(true);
    });

    it("actual 为 null/空 → false", () => {
      expect(matchesDecorateTypeFilter(null, "精装")).toBe(false);
      expect(matchesDecorateTypeFilter("", "精装")).toBe(false);
    });

    it("exact match（trim 后）→ true", () => {
      expect(matchesDecorateTypeFilter("精装", "精装")).toBe(true);
      expect(matchesDecorateTypeFilter("  精装  ", "精装")).toBe(true);
    });

    it("不 match → false（不走 alias）", () => {
      expect(matchesDecorateTypeFilter("简装", "精装")).toBe(false);
    });
  });
});

describe("local/dashTabs", () => {
  it("DASH_TAB_KEYS 含 5 个 Tab（overview/price/school/transit/map）", () => {
    expect(DASH_TAB_KEYS).toEqual(["overview", "price", "school", "transit", "map"]);
  });

  describe("cardVisibleOnDashTab", () => {
    it("无 dataTabAttr → 始终可见", () => {
      expect(cardVisibleOnDashTab(null, "price")).toBe(true);
      expect(cardVisibleOnDashTab(undefined, "price")).toBe(true);
      expect(cardVisibleOnDashTab("", "price")).toBe(true);
      expect(cardVisibleOnDashTab("   ", "price")).toBe(true); // 纯空格
    });

    it("dataTabAttr 含 'all' → 全 Tab 可见", () => {
      expect(cardVisibleOnDashTab("all", "price")).toBe(true);
      expect(cardVisibleOnDashTab("overview,all,transit", "school")).toBe(true);
    });

    it("dataTabAttr 含当前 activeTab → 可见", () => {
      expect(cardVisibleOnDashTab("price", "price")).toBe(true);
      expect(cardVisibleOnDashTab("overview,price,transit", "price")).toBe(true);
    });

    it("dataTabAttr 不含当前 activeTab → 不可见", () => {
      expect(cardVisibleOnDashTab("overview", "price")).toBe(false);
      expect(cardVisibleOnDashTab("school,transit", "price")).toBe(false);
    });

    it("空格分隔的多值列表", () => {
      expect(cardVisibleOnDashTab("  price  ,  transit  ", "price")).toBe(true);
    });
  });

  describe("dashTabSwitchFeedback", () => {
    it("overview → '已切换到概览' + '#dash-tabs'", () => {
      expect(dashTabSwitchFeedback("overview")).toEqual({
        toast: "已切换到概览",
        scrollSelector: "#dash-tabs"
      });
    });

    it("price / school / transit / map 各对应正确 label", () => {
      expect(dashTabSwitchFeedback("price").toast).toBe("已切换到价格画像");
      expect(dashTabSwitchFeedback("school").toast).toBe("已切换到学区配套");
      expect(dashTabSwitchFeedback("transit").toast).toBe("已切换到通勤地铁");
      expect(dashTabSwitchFeedback("map").toast).toBe("已切换到地图视图");
    });

    it("scrollSelector 固定 #dash-tabs", () => {
      expect(dashTabSwitchFeedback("overview").scrollSelector).toBe("#dash-tabs");
      expect(dashTabSwitchFeedback("map").scrollSelector).toBe("#dash-tabs");
    });
  });
});