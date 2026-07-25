# Realty App — 数据来源与可信度分级

本文档记录手机端 `realty_app` 的宏观数据、挂牌数据、派生样本和完整快照更新方式。所有单套房源必须通过 `source_kind` 明确区分真实挂牌与派生样本。

---

## 1. 国家统计局 70 城价格指数

| 属性 | 值 |
|------|-----|
| **脚本** | `scripts/crawl_stats_70.py` |
| **App CSV** | `static/stats_70.csv` |
| **加载模块** | `src/local/stats70.ts` |
| **维度** | 月度；同比 / 环比；新建 / 二手住宅价格指数 |
| **更新** | 手动跑脚本，或复用 hugohe3/70cityprice 第三方整理版 |

**窄表字段**：`date, city, fixed_base, new_idx, second_idx`

- `fixed_base`：`同比` 或 `环比`
- 指数基期 = 100，>100 上涨，<100 下跌

---

## 2. 深圳 / 广州每日网签（成交套数）

| 属性 | 值 |
|------|-----|
| **脚本** | `scripts/crawl_daily_wangqian.py` |
| **App CSV** | `static/daily_wangqian.csv` |
| **远端 meta** | `static/wangqian_meta.json`（`publish_wangqian_meta.py` 生成） |
| **App 刷新** | `src/local/wangqianDataRefresher.ts`；设置页「刷新网签」；启动时静默拉取 |
| **加载模块** | `src/local/dailyWangqian.ts` |
| **CI** | `.github/workflows/crawl-daily-wangqian.yml`（工作日 09:30 北京时间） |
| **维度** | 日更；全市 + 行政区；套数 + 面积（㎡） |

### 2.1 深圳 — 住建局 fdc 子站

| 类别 | Endpoint | 口径(scope) | 说明 |
|------|----------|------|------|
| 全市历史 | `POST …/getFjzsInfoData` `{startDate,endDate,dateType:""}` | 住宅 | 近 90 天可回溯；新房/二手套数+面积；走势页柱状图，Y 轴「商品住房成交量」 |
| 新房分区（最新日） | `POST …/getYsfCjxxGsDataNew` | 住宅 | 「商品住房成交套数」按区；**分区合计 = 走势新房（已实测 70=70）** |
| 二手分区（最新日） | `POST …/getEsfCjxxGsDataNew` | 全部 | 「二手房成交套数」按区（含非住宅）；**分区合计 = 全部二手 ≠ 走势住宅二手** |
| 新房月度分区 | `POST …/getYsfCjxxGsMonthDataNew` | 住宅 | 最近完整月「商品住房」按区累计（如 2026-06 全市 2413 套）；granularity=month/month_district |
| 二手月度分区 | `POST …/getEsfCjxxGsMonthDataNew` | 全部 | 最近完整月「二手房」按区累计（如 2026-06 全市 6214 套）；含全部 11 行政区 |

> 月度接口带全部 11 个行政区，是 App 里唯一能看到「全市各区」成交的来源
> （挂牌 listings 仅覆盖少数区）。

**两套口径为什么不同（已实测，非猜测）**

- 走势页 `getFjzsInfoData` 二手 = **住宅口径**（商品住房），如 2026-07-01 = **188 套**。
- 分区公示 `getEsfCjxxGsDataNew` 二手 = **全部口径**（含非住宅/商办），同日 = **239 套**。
- 差额 51 套即非住宅二手（套均约 69㎡，明显小于住宅套均 102㎡，与「小面积商办」一致）。
- 新房两套都是「商品住房（住宅）」，故一致（70=70）。

App 因此把二手拆成「住宅 / 全部」两列都展示，不再互相覆盖或隐藏。可用
`scripts/verify_sz_wangqian_apis.py` 复验两套接口。

- 趋势页：https://fdc.zjj.sz.gov.cn/public/marketInfo/housePriceTrendInfo.html
- 公示入口：http://zjj.sz.gov.cn/xxgk/ztzl/pubdata/
- 无需登录

### 2.1.1 暂不可用（需登录）

| 资源 | 说明 |
|------|------|
| `zjj.sz.gov.cn:8004` 房源库 | 预售/现售/二手房源明细，办事平台 |
| `fdc…/szfdccommon/#/publicInfo` | 预售许可等，`/szfdccommon/api/publicInfo/list` 返回 401 |

### 2.2 广州 — 商品房销售统计

| 类别 | Endpoint | 说明 |
|------|----------|------|
| 新房签约 | `GET https://zfcj.gz.gov.cn/ysqgk/Api/WebApi/mrxjspfqyxx.ashx` | 住宅 `zhuZaiTaoShu` / `zhuZaiArea`（按区） |

- 入口页面：<https://zfcj.gz.gov.cn/zfcj/tjxx/spfxstjxx>
- 同页面另有 `mrxjspfksxx`（可售）、`mrxjspfwsxx`（未售），本 App **未使用**
- 广州二手房月度统计为图片公告（存量房交易登记统计信息），**暂无日更 API**

### 2.3 CSV 字段

`date, city, category, scope, district, units, area_sqm, granularity, source_url`

| 字段 | 说明 |
|------|------|
| `date` | `YYYY-MM-DD` 交易日 |
| `city` | `深圳` / `广州` |
| `category` | `新房` / `二手` |
| `scope` | `住宅`（走势页 getFjzsInfoData，可回溯 90 天）/ `全部`（分区公示，含非住宅二手，仅最新日） |
| `district` | `全市` 或行政区名 |
| `units` | 成交套数 |
| `area_sqm` | 成交面积（平方米） |
| `granularity` | `city` 全市汇总 / `district` 分区 |
| `source_url` | 政府公示页链接 |

> 旧 CSV 无 `scope` 列时，加载器按 `source_url`（含 `housePriceTrendInfo` → 住宅）与
> `category+granularity`（二手+district → 全部）自动推断，向后兼容。

### 2.4 本地 / CI 更新

```bash
cd realty_app

# 抓取最新交易日（覆盖写）
python scripts/crawl_daily_wangqian.py fetch

# 与已有 CSV 去重合并（推荐每日定时）
python scripts/crawl_daily_wangqian.py fetch --merge

# 仅抓单城
python scripts/crawl_daily_wangqian.py fetch --city 深圳 --merge
```

---

## 3. 房源数据与可信度分级

`static/seed/listings.csv` 增加 `source_kind` 字段：

| 值 | 含义 | 当前数据 |
|---|---|---|
| `REAL` | 从公开挂牌页面解析到的真实挂牌记录 | 链家在售 60 条；每周安居客刷新成功后也使用此等级 |
| `DERIVED` | 用公开城市指数、市场参考价和固定随机种子生成的分析样本 | 内置包 1226 条；不代表真实逐套挂牌或成交 |
| `ESTIMATED` | 距离、通勤等启发式估算数据 | 主要用于 `metro_walk.csv` 等配套指标 |
| `UNKNOWN` | 历史或外部 CSV 未提供可信度等级 | UI 显示“来源未分级” |

派生样本由 `scripts/seed_real_data.py` 生成。其小区名和城市级参考口径来自公开资料，但面积、户型、楼层、装修及单套价格扰动是程序生成值，不能标记为“住建局逐套成交”。详情页会显示黄色“派生样本”提示。

### 3.1 完整快照更新

远程刷新不再只替换 `listings.csv`。流程如下：

1. `crawl_anjuke.py` 更新真实挂牌；
2. `rebuild_listing_derivatives.py` 重建所有受房源影响的趋势、标签、评分和画像 CSV；
3. `publish_csv.py` 为整个 `static/seed/*.csv` 生成 `snapshot_sha256`、schema 版本和逐文件行数；
4. App 下载并验证整套快照，全部成功后才一次性替换内存数据。

这样可以避免新 listings 混用旧的 `district_trend.csv`、`listing_tags.csv` 或 `community_score.csv`。

---

## 4. 其他官方宏观 CSV（v0.60+）

| CSV | 加载模块 | 脚本 | 说明 |
|-----|----------|------|------|
| `static/provident_fund_rates.csv` | `providentFund.ts` | （人工维护 / 国务院公告） | 住房公积金贷款利率档位；`App.vue` 启动 `?raw` 加载 |
| `static/nbs_real_estate.csv` | `nbsRealEstate.ts` | `scripts/crawl_nbs_real_estate.py` | 国家统计局房地产开发投资与销售；来源须为 `stats.gov.cn` |
| `static/gz_new_house_inventory.csv` | `gzNewHouseInventory.ts` | `scripts/crawl_gz_new_house_inventory.py` | 广州新房可售/未售/签约分区库存 |
| `static/seed/hospitals.csv` | `hospitalRanking.ts` + dashboard「🏥 医疗资源」 | （名录整理） | 三城医院名录；v1.121.12 起仪表盘展示三甲占比 / 分区密度 / 等级 Top |
| `static/seed/hospitals_geo.csv` | `hospitalGeoAnalysis.ts` + 医疗卡坐标段 | （高德文本检索） | v1.121.15：置信度 / 地址分区 / 最近医院对 |
| `static/seed/poi_commercial.csv` | `poiCommercialRanking.ts` + dashboard「🏪 周边商业」 | （高德周边） | v1.121.15：餐饮/银行/便利店与步行分 |
| `static/seed/poi_market.csv` | `poiMarketRanking.ts` + dashboard「🥬 菜市场」 | （高德周边） | v1.121.15：最近/最远菜市场小区榜 |
| `static/seed/metro_planning.csv` | `metroPlanningRanking.ts` + dashboard「🛤️ 规划地铁」 | （公开规划整理） | 线路本体概览；v1.121.14 仪表盘 KPI / 开通年 / 里程 Top |
| `static/seed/listing_tags_summary.csv` | `listingTagsComparison.ts` + dashboard「🔖 挂牌标签」 | `compute_listing_tags_summary` | 城市级标签渗透；v1.121.14 仪表盘 Top + 特色标签 |
| `static/seed/listing_keyword.csv` | （未接入 App） | `compute_listing_keyword.py` | 标题关键词热度，仅 ~10 行且与标签摘要重叠，暂不入快照 |
| `static/education_overview.csv` | `educationOverview.ts`（模块内 `?raw`）+ dashboard「📚 教育事业」 | `scripts/crawl_gz_education_overview.py` | 广州教育事业概览；深圳/珠海无数据时返回空，不伪造；v1.121.16 仪表盘展示 |
| `static/seed/admin_districts.csv` | `adminDistrictRanking.ts` + dashboard「🗺️ 行政区划」 | （国标整理） | v1.121.16：主城/郊区/新区与区码列表 |
| `static/seed/listing_school_premium.csv` | `listingSchoolPremiumRanking.ts` + 高学区房源卡 | `compute_listing_school_premium` | v1.121.16：溢价分桶与分区 Top |
| `static/school_source_audit.json` | 审计用（测试/脚本） | `scripts/audit_school_sources.py` | 学校来源分级审计结果，不直接驱动 UI 排名 |

---

## 5. 数据与 App 模块关系

```
stats_70.csv                 → stats70.ts            → 70 城价格指数（月度）
daily_wangqian.csv           → dailyWangqian.ts      → 深广网签（日更）
wangqian_district_weekly.csv → wangqianTrendRanking  → 周环比 / 突增（dashboard v1.121.13）
provident_fund_rates.csv     → providentFund.ts      → 公积金利率 / 月供
nbs_real_estate.csv          → nbsRealEstate.ts      → 全国房地产开销宏观
gz_new_house_inventory.csv   → gzNewHouseInventory.ts → 广州新房库存
education_overview.csv       → educationOverview.ts  → 教育事业概览（dashboard v1.121.16）
hospitals.csv                → hospitalRanking.ts    → 医疗资源榜（dashboard v1.121.12）
hospitals_geo.csv            → hospitalGeoAnalysis   → 医疗坐标覆盖（dashboard v1.121.15）
poi_commercial.csv           → poiCommercialRanking  → 周边商业（dashboard v1.121.15）
poi_market.csv               → poiMarketRanking      → 菜市场可达（dashboard v1.121.15）
metro_planning.csv           → metroPlanningRanking  → 规划地铁概览（dashboard v1.121.14）
listing_tags_summary.csv     → listingTagsComparison → 挂牌标签热度（dashboard v1.121.14）
admin_districts.csv          → adminDistrictRanking  → 行政区划（dashboard v1.121.16）
listing_school_premium.csv   → listingSchoolPremium  → 学区挂牌溢价分布（dashboard v1.121.16）
static/seed/*.csv            → seedSnapshot / snapshotLoader → 完整业务快照
```

宏观数据与业务快照相互独立，在 `App.vue` 启动时分别注入内存（教育概览由模块 import 时解析）。

---

## 6. 免责声明

政府数据以官网公布为准；真实挂牌以来源页面当时展示为准；`DERIVED` / `ESTIMATED` 数据仅用于产品演示和方法研究，不构成真实房源、成交记录或投资建议。请遵守数据来源网站使用条款。
