# Realty App — 数据来源与可信度分级

本文档记录手机端 `realty_app` 的宏观数据、挂牌数据、派生样本和完整快照更新方式。所有单套房源必须通过 `source_kind` 明确区分真实挂牌与派生样本。

> **房价怎么理解？** 本 App 的「房价」不是单一官方成交均价，而是三轴并列。计划与验收见 [docs/HOUSING_PRICE_ACCEPTANCE.md](./docs/HOUSING_PRICE_ACCEPTANCE.md)。
>
> | 轴 | 含义 | 单位 | 主文件 |
> |----|------|------|--------|
> | 挂牌价 | 卖方公开挂牌要价（开源贝壳/链家爬虫同类） | 元/㎡、万元 | `seed/listings.csv` |
> | 网签成交量 | 政府公示成交套数/面积（**无单价**） | 套、㎡ | `daily_wangqian.csv` |
> | 70城价格指数 | 统计局相对指数（[hugohe3/70cityprice](https://github.com/hugohe3/70cityprice) 同类） | 基期=100 | `stats_70.csv` |

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
- 同页面另有 `mrxjspfksxx`（可售）、`mrxjspfwsxx`（未售），已由 `crawl_gz_new_house_inventory.py` 写入 `gz_new_house_inventory.csv`
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
| `static/sz_provident_annual.csv` | `szProvidentAnnual.ts` + 公积金卡「深圳年报」KPI | `crawl_sz_provident_annual.py`（**周更 CI**；**按年 merge**，保留列表暂缺年份种子） | 深圳市住房公积金**年度报告**正文：发放贷款笔数/金额、支持购建房面积、缴存余额等；**非成交均价**。**2024**：`qtsj` 公开列表暂无完整年报 HTML，种子由 **2025 年报同比反推 + 政府/媒体通稿核验**；公租房计提字段 2024=0（未披露） |
| `static/gz_provident_annual.csv` | `gzProvidentAnnual.ts` + 公积金卡「广州年报」KPI | `crawl_gz_provident_annual.py`（**周更 CI**；本机常 SSL 失败则保留种子） | 广州市住房公积金**年度报告**正文（2023/2024 种子已核；公租房计提 2024=42.46 亿）；字段对齐深圳年报；**非成交均价** |
| `static/zh_provident_dynamics.csv` | `zhProvidentDynamics.ts` + 公积金卡「珠海动态」KPI | `crawl_zh_provident_dynamics.py`（**周更 CI**） | 珠海公积金中心「住房公积金动态(YYYY年1-N月)」：缴存/提取/发放贷款/个贷率；含 2025 全年 + **同月末对照**；完整年报正文若未公开则以动态为准；**非成交均价** |
| `static/gd_provident_annual.csv` | `gdProvidentAnnual.ts` + 公积金卡「省年报」KPI（**默认折叠**） | `crawl_gd_provident_annual.py`（**周更 CI**） | 广东省住房公积金年报全省指标；官方 HTML **无稳定分市表**（分市见媒体解读）；**非成交均价** |
| `static/gd_real_estate_brief.csv` | `gdRealEstateBrief.ts` + 仪表盘「广东房地产市场运行」卡（**多期默认折叠**） | `crawl_gd_real_estate_brief.py`（**周更 CI**；住建厅 tjxx + **统计局 tjkx185** 双列表；正文偶发断连则保留种子） | 省住建厅/统计局「房地产市场运行简况」多期：全省/珠三角投资与新建商品房销售面积·销售额及同比；派生全省合同均价；**≠城市挂牌/网签均价、≠70城指数** |
| `static/gd_fa_investment.csv` | `gdFaInvestment.ts` + 仪表盘「广东固定资产投资」卡（**多期默认折叠**） | `crawl_gd_fa_investment.py`（**周更 CI**） | 省统计局「固定资产投资运行简况」：全省/产业/工业·制造/分区域 **名义同比**（正文通常无绝对额）；统计范围含全部房地产开发项目投资；**≠房价均价** |
| `static/gd_construction.csv` | `gdConstruction.ts` + 仪表盘「广东建筑业生产运行」卡（**多期默认折叠**） | `crawl_gd_construction.py`（**周更 CI**） | 省住建厅「建筑业生产运行简况」：资质企业总产值/房屋建筑业/土木/珠三角产值及同比；**房屋建筑业产值 ≠ 商品房销售/挂牌均价** |
| `static/gd_economy.csv` | `gdEconomy.ts` + 仪表盘「广东经济运行」卡（**多期默认折叠**） | `crawl_gd_economy.py`（**周更 CI**；多页列表；仅入库含 GDP 的期次） | 省统计局「经济运行简况」：不变价 GDP/三产；规上工业、社消零、固投、房开、CPI；人均可支配收入；**年报另含常住人口/城镇化率**；**≠城市挂牌/网签均价**；月度无 GDP 则跳过 |
| `static/seed/lpr_history.csv` | LPR 卡 / 组合贷 | `compute_lpr_history.py`（基线）+ `crawl_lpr_history.py`（**月更 CI**） | 央行 PBOC 公告 1Y/5Y LPR；房贷加点沿用示意 bp |
| `static/seed/mlf_history.csv` | `mlfHistory.ts` + dashboard「🏛️ 中期借贷便利（MLF）」 | `crawl_mlf_history.py`（**周/月更 CI**） | 央行「开展情况」公告：中标利率/操作量/余额；**2025-03 起多重价位中标，专栏多为招标量无单一利率**；**≠房价**；与 LPR 对照 |
| `static/seed/omo_rr_history.csv` | `omoRrHistory.ts` + dashboard「🏦 公开市场逆回购」 | `crawl_omo_rr.py`（**周/月更 CI**） | 央行「公开市场业务交易公告」7 天期逆回购利率/中标量；**≠房价**；可与 LPR/MLF 对照 |
| `static/seed/pbc_fin_stats.csv` | `pbcFinStats.ts` + dashboard「📊 金融统计（社融/M2）」 | `crawl_pbc_fin_stats.py`（**周/月更 CI**） | 央行「金融统计数据报告」：社融存量/增量、M2/M1、人民币贷款、住户及中长期贷款、质押式回购利率；早期月报可无社融段；**≠房价**；住户中长期贷≠按揭成交 |
| `static/seed/pbc_region_sf.csv` | `pbcRegionSf.ts` + dashboard「🗺️ 广东社融增量」 | `crawl_pbc_region_sf.py`（**周/月更 CI**；XLSX zip+xml） | 央行「地区社会融资规模增量统计表」广东行：社融增量/人民币贷款/企业债/政府债/股票；**省级流量 ≠ 城市挂牌/网签/70城** |
| `static/nbs_real_estate.csv` | `nbsRealEstate.ts` | `scripts/crawl_nbs_real_estate.py`（**月更 CI** 随 `crawl-monthly-stats70`） | 国家统计局全国房地产市场基本情况；**多期 merge**（`period` 主键）；来源须为 `stats.gov.cn`；仪表盘展示销售面积/销售额/投资/到位资金同比多期、**房屋/住宅施工·新开工·竣工**、**住宅销售/待售/投资分项**、**到位资金拆分（国内贷款/定金预收款/个人按揭/自筹）**、**销售额÷面积派生全国合同均价（含住宅派生，多期）**、以及 **待售÷销售节奏粗算可售月数（多期）**（均 ≠城市挂牌/网签均价、≠70城指数、≠城市去化周期） |
| `static/nbs_fa_investment.csv` | `nbsFaInvestment.ts` + 仪表盘「全国固定资产投资」卡（**多期默认折叠**） | `scripts/crawl_nbs_fa_investment.py`（**月更 CI** 随 `crawl-monthly-stats70`） | 国家统计局「全国固定资产投资基本情况」：累计绝对额亿元 + 民间/产业/制造/设备/知产同比；**不含农户**；**≠房价均价**；房开投资仍见 `nbs_real_estate` |
| `static/nbs_income.csv` | `nbsIncome.ts` + 仪表盘「全国居民收支」卡（**多期默认折叠**） | `scripts/crawl_nbs_income.py`（**月更 CI** 探测；季/半年/年报） | 国家统计局「居民收入和消费支出情况」：人均可支配收入（全国/城/乡，名义+实际）、消费支出、**居住消费**；已回填 2025 全年及分季；**居住消费 ≠ 房价**；可与广东收入对照 |
| `static/nbs_cpi.csv` | `nbsCpi.ts` + 仪表盘「全国 CPI」卡（**多期默认折叠**） | `scripts/crawl_nbs_cpi.py`（**月更 CI**） | 国家统计局月度 CPI：同比/环比 + **居住** + **租赁房房租**同比；**房租 ≠ 房价均价** |
| `static/nbs_ppi.csv` | `nbsPpi.ts` + 仪表盘「全国 PPI」卡（**多期默认折叠**） | `scripts/crawl_nbs_ppi.py`（**月更 CI**） | 国家统计局月度 PPI：同比/环比 + **购进** + **非金属矿物制品业**（建材相关）同比；**PPI/建材 ≠ 房价均价** |
| `static/nbs_retail.csv` | `nbsRetail.ts` + 仪表盘「社消装潢/家具」卡（**多期默认折叠**） | `scripts/crawl_nbs_retail.py`（**月更 CI**） | 国家统计局社消：限额以上 **建筑及装潢材料类**、**家具类**（当月+累计）；**装潢/家具零售 ≠ 房价** |

| `static/gz_new_house_inventory.csv` | `gzNewHouseInventory.ts` + `gzInventoryFreshness.ts` | `scripts/crawl_gz_new_house_inventory.py`（**日更 CI** 随 `crawl-daily-wangqian`） | 广州新房可售/未售/签约分区库存；>3 天未更新时总览标明滞后 |
| `static/seed/hospitals.csv` | `hospitalRanking.ts` + dashboard「🏥 医疗资源」 | （名录整理） | 三城医院名录；v1.121.12 起仪表盘展示三甲占比 / 分区密度 / 等级 Top |
| `static/seed/hospitals_geo.csv` | `hospitalGeoAnalysis.ts` + 医疗卡坐标段 | （高德文本检索） | v1.121.15：置信度 / 地址分区 / 最近医院对 |
| `static/seed/poi_commercial.csv` | `poiCommercialRanking.ts` + dashboard「🏪 周边商业」 | （高德周边） | v1.121.15：餐饮/银行/便利店与步行分 |
| `static/seed/poi_market.csv` | `poiMarketRanking.ts` + dashboard「🥬 菜市场」 | （高德周边） | v1.121.15：最近/最远菜市场小区榜 |
| `static/seed/metro_planning.csv` | `metroPlanningRanking.ts` + dashboard「🛤️ 规划地铁」 | （公开规划整理） | 线路本体概览；v1.121.14 仪表盘 KPI / 开通年 / 里程 Top |
| `static/seed/listing_tags_summary.csv` | `listingTagsComparison.ts` + dashboard「🔖 挂牌标签」 | `compute_listing_tags_summary` | 城市级标签渗透；v1.121.14 仪表盘 Top + 特色标签 |
| `static/seed/listing_keyword.csv` | `listingKeyword.ts` + dashboard「🔖 挂牌标签」关键词段 | `compute_listing_keyword.py` | 标题关键词热度（南北通透等）；v1.121.24 仪表盘本市榜 + 跨城「南北通透」 |
| `static/education_overview.csv` | `educationOverview.ts`（模块内 `?raw`）+ dashboard「📚 教育事业」 | `crawl_gz_education_overview.py` + `crawl_sz_education_overview.py` + `crawl_zh_education_overview.py`（**周更 CI**） | 广州公报（含小学/初中）；深圳「普通中小学」合计；珠海基础教育学校数官方 XLSX（在校生未公布=0）；均不伪造 |
| `static/sz_planned_supply.csv` | `szPlannedSupply.ts`（模块内 `?raw`）+ dashboard「🏗️ 深圳计划入市」 | `crawl_sz_planned_supply.py`（**周更 CI**） | 深圳市住建局季度「计划入市」公示正文摘要（套数/面积/业态）；**非成交、非可售库存**；不解析 PDF 附件 |
| `static/gz_housing_plan.csv` | `gzHousingPlan.ts`（模块内 `?raw`）+ dashboard「📋 广州住房发展计划」 | `crawl_gz_housing_plan.py`（**周更 CI**） | 广州市住建局《住房发展年度计划》公文附件（.doc/.docx）指标：计划批准预售面积、商品住宅用地、保障性住房筹建；**年更计划口径** |
| `static/gz_land_deals.csv` | `gzLandDeals.ts`（模块内 `?raw`）+ dashboard「🗺️ 广州居住用地成交」 | `crawl_gz_land_deals.py`（**周更 CI**，默认 12 页） | 广州市规自局成交公示中用途含 **居住/R2/安置** 的地块；土地价款≠房价均价；地表单价未除容积率；卡内含分月汇总 |
| `static/sz_land_deals.csv` | `szLandDeals.ts`（模块内 `?raw`）+ dashboard「🗺️ 深圳居住用地（已成交）」 | `crawl_sz_land_deals.py`（**周更 CI**） | 深圳公共资源交易中心 `szggzy.com/cms/.../land-list`；`landUseLike=居住` + 已成交；**金额为列表起始价**（非成交总价、非房价均价）；`pageNum` 从 0 起 |
| （深圳土地成交总价） | （未接入） | `szggzy` land-list / detail / clinch SPA | 2026-07-26 复测：列表 `amount` 恒空；detail 空/404；不接第三方付费 API |
| `static/zh_affordable_progress.csv` | `zhAffordableProgress.ts` + dashboard「🏗️ 珠海安居工程进展」 | `crawl_zh_affordable_progress.py`（**周更 CI**，需 `xlrd`） | 珠海住建局月度「保障性安居工程建设进展情况快报表」**.xls**；年内累计 + **保租房/配售型/公租房** 大类分项；**非商品房成交、非房价** |
| `static/gz_affordable_projects.csv` | `gzAffordableProjects.ts` + dashboard「🏗️ 广州保障房项目清单」 | `crawl_gz_affordable_projects.py`（**周更 CI**，需 `xlrd`） | 市住建局保障性住房项目公开 **已筹建/已竣工** XLS 汇总套数与项目数；含配售型/保障房/棚改；**非商品房成交、非房价** |
| `static/gz_affordable_targets.csv` | `gzAffordableTargets.ts` + 同上卡「筹集/竣工目标进度」 | `crawl_gz_affordable_targets.py`（**周更 CI**，需 `xlrd`） | 「任务量完成」表头年度目标 + 实际；缺省回退「筹集建设计划」合计，并用同年清单已筹建套数算进度；**非商品房成交、非房价** |
| `static/sz_affordable_projects.csv` | `szAffordableProjects.ts` + dashboard「🏗️ 深圳保障房项目表」 | `crawl_sz_affordable_projects.py`（**周更 CI**，需 `pypdf`） | 市住建局项目建设信息 PDF/XLSX：建设筹集 / 基本建成；筹集表可拆 **建设/筹集**；**非商品房成交、非房价**；旧年扫描型 PDF 可能解析失败则跳过 |
| `static/seed/admin_districts.csv` | `adminDistrictRanking.ts` + dashboard「🗺️ 行政区划」 | （国标整理） | v1.121.16：主城/郊区/新区与区码列表；v1.121.19：×规划地铁文案交叉 |
| `static/seed/community_commercial.csv` | `communityCommercialRanking.ts` + 分区商业/密度桶 | （派生） | v1.121.17 分区均分；v1.121.19 餐饮密度×距离桶（按 city 过滤） |
| `static/seed/listing_school_premium.csv` | `listingSchoolPremiumRanking.ts` + 高学区房源卡 | `compute_listing_school_premium` | v1.121.16：溢价分桶与分区 Top |
| `static/school_source_audit.json` | 审计用（测试/脚本） | `scripts/audit_school_sources.py` | 学校来源分级审计结果，不直接驱动 UI 排名 |
| `static/zh_bdc_registration.csv` | `zhBdcRegistration.ts` + dashboard「📋 珠海不动产登记季报」 | `list_zh_bdc_registration_posts.py`（对照缺口；**人工抄录** PNG 合计） | 珠海不动产登记中心季度「新增商品房登记 / 存量房转移登记」**合计行**；官方正文为 PNG；**≠日更网签、≠挂牌均价** |
| `static/zh_bdc_registration_district.csv` | 同上模块分区明细 | `seed_zh_bdc_registration_district.py`（人工抄录五区） | **2025Q1–2026Q2**；与合计同行同期；住宅套数之和须对齐全市合计 |
| `static/zh_price_filing.csv` | `zhPriceFiling.ts` + dashboard「📑 珠海商品房价格备案」 | `crawl_zh_price_filing.py`（**周更 CI**） | 住建局专栏 HTML 表摘要（套数/建筑面积均价/套内均价 + 地址推断分区）；**备案价 ≠ 挂牌价、≠ 成交价、≠ 网签、≠ 70城** |
| （珠海不动产公开页） | （已由上表覆盖合计） | `bdc.zhuhai.gov.cn/zwgk/sjfb/` | 季度登记统计页仅为 **PNG**（已探针确认无 HTML 表/XLSX）；合计行人工抄录进 CSV；暂不 OCR |
| （珠海商品房价格备案公示） | `static/zh_price_filing.csv` | `zjj.zhuhai.gov.cn/.../spfjgbags/` | **已接入**（v1.121.102）；详情页 HTML 表可解析；列表 `index.html`…`index_N.html`；预售专网仍超时 |
| （广州月度批准预售专栏） | （未接入明细） | `zfcj.gz.gov.cn/.../xjspfpzystjxx/` | 月度正文多为 **PNG**；专栏路径 2026-07-26 复测 **404**；年更计划已由 `gz_housing_plan.csv` 覆盖核心指标 |
| （广州存量房交易登记月报） | （未接入） | `zfcj.gz.gov.cn/.../clfjydjtjxx/` | 2026-07-26 探针：正文多为 **PNG**、无 HTML 表/XLS；暂不 OCR |
| （广州房屋租赁登记备案月报） | （未接入） | `zfcj.gz.gov.cn/.../fwzldjbatjxx/` + 阳光租房 | 2026-07-26 探针：专栏正文为 **PNG**（如 `.../10899179.png`）；阳光租房首页无稳定公开统计 API；暂不 OCR |
| （珠海不动产登记季度统计表） | `static/zh_bdc_registration.csv` | `bdc.zhuhai.gov.cn/zwgk/sjfb/` | **已接入合计**（v1.121.99）；正文仍为 PNG；用 `list_zh_bdc_registration_posts.py` 查新季缺口 |
| （深圳二手房上月成交量专栏） | （未接入独立源） | `zjj.sz.gov.cn/.../sjcx/ersfsy/` | 2026-07-26 探针本机 **403**；深圳二手成交已由 `daily_wangqian` 覆盖 |
| （广东规上工业/消费品单独简况） | （未单独建卡） | `stats.gd.gov.cn/tjkx185/` | 2026-07-26：工业/社消零 HTML 可解析，但与「经济运行」重叠且与房价弱相关；GDP/房开/人均可支配收入已由 `gd_economy.csv` 覆盖核心宏观 |
| （佛山/东莞住建公开页） | （未接入） | `fszj.foshan.gov.cn` / `zjj.dg.gov.cn` | 2026-07-26 探针本机 **Timeout**；暂无可用结构化 endpoint |
| （国家统计局全国固投） | `static/nbs_fa_investment.csv` | `stats.gov.cn/sj/zxfb/`「固定资产投资基本情况」 | **已接入**（v1.121.85）；与广东固投卡对照；≠房价 |
| （广州公积金年报） | `static/gz_provident_annual.csv` | `gjj.gz.gov.cn` 年报正文 | **已接入**（v1.121.72）；本机 SSL 常失败，CI/可达网络用 `crawl_gz_provident_annual.py` 刷新；种子来自官方年报正文 |

#### 4.1 国家统计局房地产多期回填

```bash
cd realty_app
# 回填已知 2026 归档（1—2 … 1—6）并按 period merge
python scripts/crawl_nbs_real_estate.py --backfill --no-latest
# 仅刷新首页最新一期（merge，不抹掉历史）
python scripts/crawl_nbs_real_estate.py
# 全国固投（1—4…1—6 已回填；月更 merge）
python scripts/crawl_nbs_fa_investment.py --backfill --no-latest
python scripts/crawl_nbs_fa_investment.py
```

---

## 5. 数据与 App 模块关系

```
stats_70.csv                 → stats70.ts / TrendAnalysis → 70 城指数 + 近月序列/离散度（v1.121.17）
daily_wangqian.csv           → dailyWangqian.ts      → 深广网签（日更）
wangqian_district_weekly.csv → wangqianTrendRanking  → 周环比 / 突增（dashboard v1.121.13）
provident_fund_rates.csv     → providentFund.ts      → 公积金利率 / 月供
sz_provident_annual.csv      → szProvidentAnnual.ts  → 深圳公积金年报
gz_provident_annual.csv      → gzProvidentAnnual.ts  → 广州公积金年报
zh_provident_dynamics.csv    → zhProvidentDynamics.ts → 珠海公积金动态
zh_bdc_registration.csv      → zhBdcRegistration.ts  → 珠海不动产登记季报（量能备选）
gd_provident_annual.csv      → gdProvidentAnnual.ts  → 广东全省公积金年报
gd_real_estate_brief.csv     → gdRealEstateBrief.ts  → 广东房地产运行简况
gd_fa_investment.csv         → gdFaInvestment.ts     → 广东固定资产投资简况
gd_construction.csv          → gdConstruction.ts     → 广东建筑业生产运行
gd_economy.csv               → gdEconomy.ts          → 广东经济运行（GDP/收入/人口）
nbs_real_estate.csv          → nbsRealEstate.ts      → 全国房地产开销宏观（含住宅/按揭）
nbs_fa_investment.csv        → nbsFaInvestment.ts    → 全国固定资产投资
nbs_income.csv               → nbsIncome.ts          → 全国居民收入/消费/居住
nbs_cpi.csv                  → nbsCpi.ts             → 全国 CPI/居住/房租
nbs_ppi.csv                  → nbsPpi.ts             → 全国 PPI/购进/建材分项
nbs_retail.csv               → nbsRetail.ts          → 社消装潢/家具零售
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
school_dimensions.csv        → schoolDimensionRanking → 重点学校维度（dashboard v1.121.17）
gz_new_house_inventory.csv   → gzNewHouseInventory    → 广州库存 + 日环比（dashboard v1.121.18）
layout_distribution.csv      → layout / distribution → 挂牌结构占比 + 3室/精装跨城（v1.121.18–20）
bedroom_area.csv             → distributionRanking   → 3室×面积跨城均价（v1.121.20）
metro_planning_geo.csv       → metroPlanningGeoAnalysis → 弯曲 + 覆盖率 + 手工兜底（v1.121.18–20）
lpr_history.csv              → lprHistoryAnalysis     → 利差 / 调息 / 同比 / 全期均值（v1.121.18–21）
hospitals_geo.csv            → hospitalGeoAnalysis   → 坐标 + CBD 半径医疗（v1.121.15/19–21）
wangqian_district_weekly.csv → wangqianTrendRanking  → 周环比 / 突增 / CV 波动（v1.121.13/21）
commute.csv                  → commuteRanking        → 通勤榜 + 快慢分裂（v0.24 / v1.121.21）
poi_commercial.csv           → poiCommercialRanking  → 周边商业 + 银行覆盖（v1.121.15/21）
metro_planning.csv           → metroPlanningRanking  → 规划地铁 + 快线（v1.121.14/21）
listing_tags_summary.csv     → listingTagsComparison → 标签热度 + 跨城渗透（v1.121.14/21）
admin_districts.csv          → adminDistrictRanking  → 区划 + ×地铁交叉（v1.121.16/19）
community_commercial.csv     → communityCommercial   → 分区均分 + 密度桶（v1.121.17/19）
static/seed/*.csv            → seedSnapshot / snapshotLoader → 完整业务快照
```

宏观数据与业务快照相互独立，在 `App.vue` 启动时分别注入内存（教育概览由模块 import 时解析）。

### 5.1 已知缺口（下一优先）

| 缺口 | 候选源 | 状态 |
|------|--------|------|
| 珠海日更网签 | [商品房预(销)售专网](https://zhfc.zhszjj.com/zhysouter) | 无稳定公开 API；TLS 超时；季报量能已由 `zh_bdc_registration` 覆盖 |
| 房源详情图集 | 链家/贝壳/安居客 | 链家 CAPTCHA；安居客 m 站 SPA 无静态 sale 链；`cover_url` 接线已备 |
| MLF 单一利率（2025-03+） | 央行 MLF 专栏 | 改多重价位中标后公开页多为招标量；利率样本止于「开展情况」期 |

详情页挂牌标签 pill 已接 `listing_tags.csv` / `tags_json`（v1.121.98）。

---

## 6. 免责声明

政府数据以官网公布为准；真实挂牌以来源页面当时展示为准；`DERIVED` / `ESTIMATED` 数据仅用于产品演示和方法研究，不构成真实房源、成交记录或投资建议。请遵守数据来源网站使用条款。
