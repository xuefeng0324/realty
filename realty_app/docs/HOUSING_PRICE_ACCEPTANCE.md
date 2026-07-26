# 房价数据计划与验收标准

> 流程总则：[FEATURE_ACCEPTANCE.md](./FEATURE_ACCEPTANCE.md)  
> 数据口径总表：[../DATA_SOURCES.md](../DATA_SOURCES.md)

## 0. 对照来源（开源 / 官方，禁止臆造成交价）

| 来源 | 做法 | 本仓对应 |
|------|------|----------|
| [hugohe3/70cityprice](https://github.com/hugohe3/70cityprice) / [changao1/70-China-cities…](https://github.com/changao1/70-China-cities-housing-index-data-by-national-bureau-of-statistics) | 吃**国家统计局** 70 城商品住宅价格指数（环比/同比，基期=100），**不是元/㎡** | `static/stats_70.csv` + `crawl_stats_70.py` |
| [Crush0nyou/beike-lianjia](https://github.com/Crush0nyou/beike-lianjia) 等挂牌爬虫 | 抓贝壳/链家**挂牌均价/二手在售**（卖方要价） | `listings.csv` + `crawl_lianjia_*` / `crawl_anjuke.py`（反爬导致 REAL 少） |
| 深住建 fdc / 广州住建公开 API | **成交套数+面积**，深圳 2019-04 后不公单套成交价 | `daily_wangqian.csv`（无单价列） |
| 贝壳/链家 App 首页 | 首页并列「挂牌均价 / 成交量 / 行情指数」，文案不混称 | 产品应对齐：三轴分开展示 |

**结论（产品硬约束）**：在拿不到政府「成交均价 元/㎡」前，App **不得**把挂牌均价标成「成交价」。房价能力 = **挂牌价轴 + 网签量轴 + 70 城指数轴**。  
珠海无日更网签时，用不动产登记**季报套数**作量能备选（`zh_bdc_registration`），文案必须写清 ≠ 日更网签、≠ 挂牌均价；入口不得静默跳到深圳网签（见 [BEIKE_COMPARISON_ACCEPTANCE.md](./BEIKE_COMPARISON_ACCEPTANCE.md) P-ZH-WQ-*）。

---

## 1. 计划（分阶段）

### Phase A — 语义与可信度（本迭代必做）

1. 统一文案：地图/Hero/要点区分「挂牌」「网签套数」「价格指数」  
2. 提供 `priceSemantics` 工具与单测，防止再写「成交价」误用  
3. 文档固化三轴与开源对照  

### Phase B — 管线新鲜度（本迭代必做一部分）

1. 日更网签 CI 末尾重建 `wangqian_district_weekly.csv`（量热度跟 daily）  
2. 本地重建并提交落后的周聚合  

### Phase C — 真实挂牌增量（本迭代部分完成）

1. 安居客周 CI：`< min-rows` abort（不覆盖）；成功写入后校验至少 1 条 REAL  
2. 链家仅作补充；反爬失败时保持 REAL 存量，不掺 DERIVED 冒充  
3. ✅ REAL 占比与最新 `crawl_date` 在设置「数据源」与总览工作台可见（`listingTrustSummary`）

### Phase D — 指数月更（本迭代落地管线）

1. ✅ 参照 hugohe3：`crawl-monthly-stats70.yml` 每月 16–20 日自动 `download`  
2. ✅ `check_stats70_freshness.py` + `stats70Freshness.ts` 新鲜度门禁（publishDay=18）  
3. ✅ 设置 / 总览 / stats70 页展示「截至…是否跟上」  
4. ⚠️ 七月指数约 8 月中发布；当前仓内与 hugohe3 均为 **2026/6**（已达标）

### Phase E — 配套官方库存 / 宏观日更·月更（本迭代）

1. ✅ 日更 CI（`crawl-daily-wangqian.yml`）附带 `crawl_gz_new_house_inventory.py`，按 date+district merge  
2. ✅ 月更 CI 附带 `crawl_nbs_real_estate.py`（period merge，不抹历史）  
3. ✅ `gzInventoryFreshness`：源站超过 3 自然日未更新时总览卡标明滞后  
4. ⚠️ 深圳 opendata 一手/二手成交需 `OPENDATA_SZ_TOKEN`，未配置前不进 CI  

### 明确不做

- 用 DERIVED 样本声称「本市成交均价」  
- 把网签 `area_sqm/units` 伪造成「成交单价」并对外展示为官方价（套均面积可作分析备注，不可当房价）  
- 无合规授权的大规模商业反爬上线为「日更房价」  

---

## 2. 验收标准

### 期望

1. UI 凡展示「元/㎡」来自 listings 聚合的，文案含 **挂牌**（或「卖方挂牌」），不含「成交价」  
2. 网签卡只谈 **套数/面积/活跃度**，不出现「成交均价」  
3. 70 城卡只谈 **指数/涨跌**，不出现「均价 X 万」  
4. `priceSemantics` 单测覆盖三轴标签与禁用词  
5. `wangqian_district_weekly` 的最大 `week_end` ≥ daily 最近周日（重建后）  
6. type-check / vitest 通过  

### 不期望

1. 为「看起来有房价」伪造成交均价序列  
2. 改动其它无关模块视觉体系  
3. 把 Phase C/D 未完成包装成本迭代完成  

### 自动化

- [x] `tests/priceSemantics.test.ts`
- [x] 源码门禁：`map-view` 模式标签为「挂牌均价」；Hero 使用 `listingMedianUnitPriceLabel`
- [x] `npm run type-check` / `npm test`（含 buildIntegrity 改名断言）
- [x] 网签周聚合重建：`wangqian_district_weekly` week_end 覆盖至最近周日
- [x] 日更 CI 末尾调用 `build_wangqian_heatmap.py`
- [x] `tests/listingTrustSummary.test.ts`（REAL 占比 / 最新 crawl_date）
- [x] 周爬 CI：成功路径校验 REAL≥1；`<min-rows` abort 不覆盖
- [x] `tests/stats70Freshness.test.ts` + `scripts/check_stats70_freshness.py`
- [x] `.github/workflows/crawl-monthly-stats70.yml` 月更管线
- [x] 日更 CI 含广州库存 merge；月更 CI 含 NBS merge
- [x] `tests/gzInventoryFreshness.test.ts`

### 手工

1. 打开地图 → 模式按钮为「挂牌均价」而非「成交价」  
2. 总览 Hero / 今日要点：单价相关文案含「挂牌」  
3. 网签页仍只显示套数面积  

---

## 3. 验证记录

见对应 changelog「验证」节。

---

最后更新：2026-07-26
