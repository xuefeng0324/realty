# 总览长度预算（DASHBOARD_OVERVIEW_BUDGET）

> 强制协议。每次新增数据源 / 卡片，必须**先**确认「能放进 overview 卡的配额」有没有；
> 没有就→ 创建/找到对应的子页。

---

## 1. 量化目标

| 维度 | 限 | 取值逻辑 |
|------|----|----------|
| `overview` tab 内「独立 macro-card」最大数 | **≤ 8** | 贝壳首页同屏可见 2–3 张；本地 3–4 屏到 footer |
| `overview` tab 内「所有 .card 的 `<view>` 直系子元素」最大数 | **≤ 12** | 含 8 张 macro-card + 搜索/筛选/三轴/footer 上限 |
| `dashboard.vue` 总行数 | **≤ 8 000**（远期） | 当前 16 746；先把每新增卡移到子页后逐步缩 |
| 单个 macro-card HTML 字节数 | **≤ 6 KB** | 防止"看似一张卡实则塞 50 行 v-for" |
| 「市场风向」Compact 卡内指标栅格数 | **2 × 3 = 6** | 由你定的目标（贝壳"政策/资负"卡片化） |
| 多期序列默认展开条件 | `trend.length > 6` 才允许默认展开 | 防"灌水展示" |

---

## 2. 路由分配（default，**待用户确认**）

> 默认方案即上一轮抛出的方案一。如果用户回 B 改数字，**只改这张表**，不动其它文件。

| Tab / 子页 | 承载 | 新增页（缺则建） |
|------------|------|-----------------|
| `overview`（≤ 8 宏卡） | 三轴·城市·学校·通勤·地图·市场风向 Compact（6 项挑 1）·当前城市动态 | 现有 |
| `pages/macro-rates/*.vue` | LPR / MLF / 逆回购 / 国债 / Shibor / 回购 FR/FDR | 新建 |
| `pages/macro-fx/*.vue` | 外储 / 官方储备 / 美元中间价 / 外汇市场 / 外汇结售汇 / BOP / IIP / 安全货服贸易 | 新建 |
| `pages/macro-industry/*.vue` | NBS 工业增加值 / 工业利润 / CPI / PPI / 固投 / 居民收支 / PMI | 新建 |
| `pages/macro-trade/*.vue` | NBS 货服贸易（货物进出口） | 新建 |
| `pages/macro-region/*.vue` | 广东 房地产简况 / 经济运行 / 固投 / 施工产值 | 新建（2026-07-26 补） |
| 金刚区入口 | 「宏观·利率 / 宏观·汇市 / 宏观·产业 / 宏观·区域」四个新增 | `home-kingkong` |

---

## 3. 门禁（CI / 单测）

### `tests/dashboardOverviewBudget.test.ts`（新建）

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("总览长度预算 DASHBOARD_OVERVIEW_BUDGET", () => {
  const root = resolve(process.cwd(), "src/pages/dashboard/dashboard.vue");
  const src = readFileSync(root, "utf8");

  // overview 区段：从 first data-tab="overview,price" 到下一个 data-tab 不同处
  // 这里做粗略测试：所有 class="card macro-card" 的数量
  const overviewCards = (src.match(/class="card[^"]*macro-card[^"]*"\s+data-tab="overview,price"/g) ?? []).length;

  it("overview 内 macro-card ≤ 8", () => {
    expect(overviewCards).toBeLessThanOrEqual(8);
  });

  it("dashboard.vue 总行数 ≤ 25000（收紧中）", () => {
    const lines = src.split("\n").length;
    expect(lines).toBeLessThanOrEqual(25000);
  });

  it("禁止在 overview tab 下新增孤立的 data-* 卡片（除非登记 macroBudget）", () => {
    // 抽出所有 overview tab 下的 data- attribute，作为增量配额
    const newAdds = (src.match(/data-tab="overview,price"/g) ?? []).length;
    expect(newAdds).toBeLessThanOrEqual(12);
  });
});
```

**失败硬规则**：以上任何一项 fail → 卡住 `npm test`。下次加数据前必须先放进子页。

---

## 4. 卡片进入 overview 的硬性判定

| 想加什么 | 满足全部才能进 overview | 否则 |
|----------|--------------------------|------|
| 跨城/省级/全球宏观（LPR/MLF/外储/PMI/…） | ① ≤ 6 项；② 单卡 ≤ 3 KPI；③ 进「市场风向」Compact 内 1× 单元格 | 进 `pages/macro-*/` 子页 |
| 城市/小区/学校榜（房产三轴衍生） | 紧贴「三轴」单卡或「行情·Top 区」 | 保留在 `overview` |
| 居住消费/CPI 房租 | 不进 overview（已并入全国 CPI 子页） | 子页 |
| 同一份数据的"多期序列" | `trend.length > 6` 才允许默认展开；≤ 6 默认收起 | 单卡多期隐藏 |

---

## 5. 老卡现状（按"是否属于房价三轴"分类）

### 留在 `overview`（房价三轴相关，最多 ≤ 8 张）

- NBS 全国房地产（macro-nbs-macro，含销售/投资/资金/合同均价/可售月数多期）
- 70城指数当前城市（已有）
- 网签（已有）
- 担保房/库存（广州新房库存）
- ...剩余 ≤ 4 个口子留给后续真三轴衍生

### 移到子页（`pages/macro-rates`/`fx`/`industry`/`trade`/`region`）

- LPR / MLF / 逆回购 / 国债 / Shibor / 回购 FR/FDR → `pages/macro-rates/index.vue`
- 外储 / 官方储备 / 美元中间价 / 外汇市场 / 结售汇 / BOP / IIP / 货服贸易 → `pages/macro-fx/index.vue`
- 工业增加值 / 工业利润 / CPI / PPI / 固投 / 居民收支 / PMI → `pages/macro-industry/index.vue`
- 货物进出口 → `pages/macro-trade/index.vue`
- 广东 房地产简况 / 经济运行 / 固投 / 施工产值 → `pages/macro-region/index.vue`

---

## 6. 流程（每次新数据）

1. 查本文件 §4 → 决定进 overview 还是子页。  
2. 进子页 → 写子页 + dashboard 加金刚区入口（≤ 1 个 new entry）。  
3. 进 overview → 先看 §3 门禁测试：若 overviewCards + 1 > 8 → **不让加**，必须先迁老卡出去。  
4. 文档同步：FEATURE_CATALOG + DATA_SOURCES + budget 行计数；CHANGELOG 列入。

---

## 7. 用户待拍板

1. 卡片目标 ≤ 8 是否同意？或 ≥ 改数。
2. "市场风向"Compact 是否 6 格？或 4/8？
3. 是否接受 §5 的老卡迁移路线？
4. 是否要新增 `pages/macro-rates` 这三文件，还是另命名？

---

## 8. 后续瘦身 todo（v1.121.131+，本轮未完成）

> 用户指令「未完成的项记得写进md里面」 — 全部 pending 项归集如下。

| ID | 描述 | 收益 | 优先级 |
|----|------|------|--------|
| T-001 | **nbs-macro 卡重构**：20 KPI 太满。拆成「主 4 KPI + 「查看完整管线」按钮 → 跳转子页」 | -150 行 + 单卡 ≤ 6 KB | **不做**（违反房价三轴紧贴 overview 原则） |
| T-002 | dashboard 剩余 KPI 铺 MacroKpiCell | -300 行 | **不做**（剩余 cell-label 130 个多为房价三轴，硬塞 MacroKpiCell 语义错位；应新建通用 `KpiCell.vue`，属 T-004 范畴） |
| T-003 | **3 个 macro 子页用 MacroKpiCell 重写** | -600 行跨文件 | ✅ **v1.121.132 完成**（实测 -245） |
| T-007 | **macro-fx 子页从骨架升级为 8 张汇市卡** | +430 行（子页增加） | ✅ **v1.121.134 完成**（23 → 453 行） |
| T-004 | **非宏卡瘦身**：114 张非宏卡抽组件 | -3000 行（理论上限） | 低（架构大改） |
| T-005 | **加「市场风向」Compact 6 格** | +1 张宏卡 | **待用户拍板**（与「弄短首页」指令冲突） |
| T-006 | **nbs-macro 多期序列再缩 6 → 4**（删面积同比/投资同比，保留均价/可售月/销售额同比/资金同比） | -12 行 | ✅ **v1.121.133 完成**（实测 -12） |

### 本轮实际收益（v1.121.130 → v1.121.131 draft）

| 版本 | dashboard 行数 | 宏卡数 | 备注 |
|------|---------------|--------|------|
| v1.121.128 | 16,747 | 13 | 迁移前基线 |
| v1.121.129 | 16,747 | 14 | 立门禁（无 UI 变化） |
| v1.121.130 | 15,555 | 1 | 迁出 13 张宏卡 + 抽 5 个 helper |
| v1.121.131 draft | **15,404** | 1 | + nbs-macro 多期精简 + MacroKpiCell 铺 nbs-macro 16 KPI |

---

## 7. 用户待拍板

1. 卡片目标 ≤ 8 是否同意？或 ≥ 改数。  
2. "市场风向"Compact 是否 6 格？或 4/8？  
3. 是否接受 §5 的老卡迁移路线？  
4. 是否要新增 `pages/macro-rates` 这三文件，还是另命名？

