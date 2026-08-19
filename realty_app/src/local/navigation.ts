export type PrimaryTabKey = "home" | "find" | "map" | "market" | "profile";

export interface PrimaryTabDefinition {
  key: PrimaryTabKey;
  label: string;
  pagePath: string;
  iconPath: string;
  selectedIconPath: string;
}

export const PRIMARY_TABS: PrimaryTabDefinition[] = [
  {
    key: "home",
    label: "首页",
    pagePath: "pages/dashboard/dashboard",
    iconPath: "static/tabbar/home.png",
    selectedIconPath: "static/tabbar/home-active.png"
  },
  {
    key: "find",
    label: "找房",
    pagePath: "pages/listing-filter/listing-filter",
    iconPath: "static/tabbar/search.png",
    selectedIconPath: "static/tabbar/search-active.png"
  },
  {
    key: "map",
    label: "地图",
    pagePath: "pages/map-view/map-view",
    iconPath: "static/tabbar/map.png",
    selectedIconPath: "static/tabbar/map-active.png"
  },
  {
    key: "market",
    label: "行情",
    pagePath: "pages/market/market",
    iconPath: "static/tabbar/market.png",
    selectedIconPath: "static/tabbar/market-active.png"
  },
  {
    key: "profile",
    label: "我的",
    pagePath: "pages/settings/settings",
    iconPath: "static/tabbar/profile.png",
    selectedIconPath: "static/tabbar/profile-active.png"
  }
];

export type MarketSectionKey = "local" | "national" | "macro" | "tools";

export interface MarketSectionTab {
  key: MarketSectionKey;
  label: string;
}

export interface MarketEntry {
  key: string;
  section: MarketSectionKey;
  eyebrow: string;
  title: string;
  subtitle: string;
  path: string;
}

export const MARKET_SECTION_TABS: MarketSectionTab[] = [
  { key: "local", label: "本地" },
  { key: "national", label: "全国" },
  { key: "macro", label: "宏观" },
  { key: "tools", label: "工具" }
];

export const MARKET_ENTRIES: MarketEntry[] = [
  {
    key: "wangqian",
    section: "local",
    eyebrow: "每日更新",
    title: "政府网签",
    subtitle: "按城市和区域查看网签量，不与挂牌价混用。",
    path: "/pages/wangqian/wangqian"
  },
  {
    key: "supply",
    section: "local",
    eyebrow: "供应结构",
    title: "库存、供需与土地",
    subtitle: "集中查看库存、计划供应、保障房和土地成交。",
    path: "/pages/supply/supply"
  },
  {
    key: "stats70",
    section: "national",
    eyebrow: "国家统计局",
    title: "全国 70 城指数",
    subtitle: "查看新房、二手房价格指数及城市趋势。",
    path: "/pages/stats70/stats70"
  },
  {
    key: "rates",
    section: "macro",
    eyebrow: "资金成本",
    title: "利率与信贷",
    subtitle: "LPR、按揭利率、货币市场与融资条件。",
    path: "/pages/macro-rates/macro-rates"
  },
  {
    key: "fx",
    section: "macro",
    eyebrow: "外部环境",
    title: "汇市与跨境资金",
    subtitle: "人民币汇率、结售汇及国际收支数据。",
    path: "/pages/macro-fx/macro-fx"
  },
  {
    key: "industry",
    section: "macro",
    eyebrow: "产业周期",
    title: "产业与投资",
    subtitle: "房地产、工业、消费和投资相关指标。",
    path: "/pages/macro-industry/macro-industry"
  },
  {
    key: "region",
    section: "macro",
    eyebrow: "区域经济",
    title: "区域与城市基本面",
    subtitle: "区域金融、人口、收入和建设运行数据。",
    path: "/pages/macro-region/macro-region"
  },
  {
    key: "trade",
    section: "macro",
    eyebrow: "外贸环境",
    title: "贸易与外需",
    subtitle: "进出口、外贸景气及外部需求变化。",
    path: "/pages/macro-trade/macro-trade"
  },
  {
    key: "trend",
    section: "tools",
    eyebrow: "深度分析",
    title: "趋势可视化",
    subtitle: "从面积、朝向、楼层和小区象限分析市场。",
    path: "/pages/trend-analysis/trend-analysis"
  },
  {
    key: "map-analysis",
    section: "tools",
    eyebrow: "空间分析",
    title: "行政区行情地图",
    subtitle: "按行政区和社区查看价格与资源分布。",
    path: "/pages/map-analysis/map-analysis"
  },
  {
    key: "data-tools",
    section: "tools",
    eyebrow: "专业模式",
    title: "数据工具",
    subtitle: "查看衍生指标、数据状态和专业分析工具。",
    path: "/pages/data-tools/data-tools"
  }
];

export interface LegacyDashboardMigration {
  destination: string;
  capabilities: string[];
}

/** v1.122.0 旧首页专业长卡的去向；用于防止精简首页后能力失去入口。 */
export const LEGACY_DASHBOARD_MIGRATIONS: LegacyDashboardMigration[] = [
  {
    destination: "/pages/wangqian/wangqian",
    capabilities: ["政府网签"]
  },
  {
    destination: "/pages/stats70/stats70",
    capabilities: ["全国 70 城指数"]
  },
  {
    destination: "/pages/supply/supply",
    capabilities: ["库存、供需与土地"]
  },
  {
    destination: "/pages/macro-rates/macro-rates",
    capabilities: ["LPR + 房贷利率"]
  },
  {
    destination: "/pages/trend-analysis/trend-analysis",
    capabilities: [
      "区级近 8 周房价趋势",
      "区房价指数",
      "区涨幅榜",
      "户型 × 面积",
      "朝向 × 楼层",
      "装修 × 楼龄",
      "总价 × 单价 散点"
    ]
  },
  {
    destination: "/pages/map-analysis/map-analysis",
    capabilities: ["区/板块对比", "行政区域图"]
  },
  {
    destination: "/pages/data-tools/data-tools",
    capabilities: [
      "小区综合评分",
      "特征画像溢价",
      "标签组合热度",
      "房源新鲜度",
      "高学区评分房源",
      "房源标签云",
      "区情画像",
      "学区 5 维评分",
      "学区溢价榜",
      "教育事业",
      "通勤时长榜",
      "地铁步行通勤",
      "地铁规划受益",
      "生活便利度",
      "商业热度"
    ]
  }
];

export function marketEntriesFor(section: MarketSectionKey): MarketEntry[] {
  return MARKET_ENTRIES.filter((entry) => entry.section === section);
}

export function isPrimaryTabPath(path: string): boolean {
  const normalized = path.replace(/^\//, "");
  return PRIMARY_TABS.some((tab) => tab.pagePath === normalized);
}
