# 全功能验收目录（FEATURE CATALOG）

> **强制流程**：[FEATURE_QA_PROCESS.md](./FEATURE_QA_PROCESS.md)  
> **怎么用**：改某功能前先搜功能 ID；新增功能必须**追加一条**再写代码。  
> **专题深挖**：主题 / 信息流 / 房价见文末「专题链接」。

图例：

| 列 | 含义 |
|----|------|
| 风险 | U=UI · F=功能 · L=逻辑 |
| 自动化 | core=进 `test:e2e:core`；ext=extended；unit=vitest；—=暂无（须有手工） |
| 状态 | ✅ 有门禁 · ⚠️ 偏弱须补 · ❌ 缺自动化（手工兜底） |

---

## 0. 发版总门禁（所有功能共用）

| ID | 名称 | 风险 | 期望 | 自动化 | 手工 |
|----|------|------|------|--------|------|
| F-GATE-01 | 类型检查 | L | `vue-tsc` 零错误 | `npm run type-check` | — |
| F-GATE-02 | 单元测试 | L | 全绿 | `npm test` | — |
| F-GATE-03 | Core E2E | U/F | core suite 全绿（需 H5） | `npm run test:e2e:core` | H5 `:5174` 已起 |
| F-GATE-04 | 一键脚本 | — | check.ps1 退出 0 | `scripts/check.ps1` | — |

---

## 0b. 五栏壳层、行情与本地资料库

### F-ENTRY-02 · 五个一级入口

| 项 | 内容 |
|----|------|
| 入口 | 原生 TabBar：`首页 / 找房 / 地图 / 行情 / 我的` |
| 风险 | U, F, L |
| 对照 | [APP_SHELL_ACCEPTANCE.md](./APP_SHELL_ACCEPTANCE.md) |

**期望**：五个 Tab 路由契约正确；学校旧深链兼容；浅/深主题和窄屏均可用。<br>
**不期望**：自绘重复底栏；Tab 页使用 `navigateTo`；非 Tab 页使用 `switchTab`。
**自动化**：unit `navigation.test.ts`；core `smoke_full_interactions.mjs` / `smoke_full_pages.mjs`。

### F-MKT-01 · 行情聚合页

| 项 | 内容 |
|----|------|
| 入口 | Tab「行情」→ `/pages/market/market` |
| 风险 | U, F, L |
| 对照 | [APP_SHELL_ACCEPTANCE.md](./APP_SHELL_ACCEPTANCE.md)、HOUSING_PRICE |

**期望**：网签、70 城、供需、宏观、趋势、工具均可达；来源/更新时间和 REAL/DERIVED 语义可见。<br>
**不期望**：复制完整长页；把指数或挂牌误标为成交均价。
**自动化**：unit `navigation.test.ts` / 页面映射门禁；core navigation/full-pages。

### F-MINE-01 · 本地收藏与浏览历史

| 项 | 内容 |
|----|------|
| 入口 | Tab「我的」→ 收藏 / 浏览历史 |
| 风险 | U, F, L |
| 对照 | [APP_SHELL_ACCEPTANCE.md](./APP_SHELL_ACCEPTANCE.md) |

**期望**：房源/小区/学校按 `type:id` 去重收藏；历史最多 100 条且仅保留 90 天；坏 storage 安全回空；仅成功详情写历史。<br>
**不期望**：暗示账号同步；无效 ID 写历史；重复访问堆重复行。
**自动化**：unit `userLibrary.test.ts`；core `smoke_full_interactions.mjs`。

---

## 1b. 供需独立页 `pages/supply/supply`

### F-SUPPLY-01 · 广州库存住宅 + 商业/办公/车位

| 项 | 内容 |
|----|------|
| 入口 | 首页搜索模式「找功能」输入「库存/土地」→ `/pages/supply/supply`（广州城）；v1.123.10 前为频道「供需」/ 金刚「库存」（v122 壳隐藏的死 DOM，已随旧 home-entry-card 一并删除） |
| 风险 | L, U |
| 对照 | [DATA_SOURCES.md](../DATA_SOURCES.md) 广州 `mrxjspfksxx` 等 |

**期望**
1. （L）可售/未售/签约住宅数字来自 CSV；商业/办公/车位来自同源接口分项，不为住宅之和  
2. （U）有非住宅数据时展示 `data-gz-inventory-nonres` KPI；无数据时不硬凑假数  
3. （L）历史日缺非住宅列时业态日环比不报虚假跳变  

**不期望**
1. 把商业/办公/车位标成挂牌价或网签均价  

**自动化**
- unit: `tests/gzNewHouseInventory.test.ts`；搜索路由可达性见 `homeEntry.test.ts`（`resolveHomeSearch("page","库存")`）
- smoke: ~~`tests/e2e/smoke_entry_supply.mjs`~~ 已随 v1.123.10 死 DOM 删除（点击目标本已不可见，不在任何 suite）

---

## 1. 总览壳层 `pages/dashboard/dashboard`

### F-DASH-01 · 市场数据工作台（城市/周期/来源/仅本市）· v1.123.8 实现已删除

| 项 | 内容 |
|----|------|
| 入口 | ~~总览顶卡~~ v1.122 起首页不再可见；城市选择由壳层 `[data-home-city]` / `pickCity` 接管 |
| 风险 | F, L |
| 状态 | ⛔ 已删除（v1.123.8 移除全部实现代码） |

**现状**：v1.122 首页收敛为新版壳（`.home-v122-shell`）后工作台即不可见（壳层 CSS 对非壳层直子级 `display:none!important`），与 F-DASH-04 同性质；v1.123.8 删除全部实现——`data-home-workbench` 模板块（周期/来源/指标三个 picker、仅本市/含跨城切换、数据构成与周期注记）、`toggleCityScoped` / `pickPeriod` / `pickSource` / `pickMetric` / `periodHint` / `metricLabels` / `metricIndex` / `listingTrust` / `priceAxesHint`、`.filter-card` / `.filter-card-head` / `.data-trust-badge` / `.filter-actions` / `.period-hint` CSS，以及孤儿 e2e `smoke_topnav_period.mjs`（不在任何 suite、指向死端口 5188）。v1.123.9 续删同区块残留——`topnav-period` 周期切换 sticky 条（v0.49.0）、`week-bound-strip` 本周速览条、`week-ranking-card` 小区周榜卡，连同 `stepPeriod` / `currentPeriodIdx` / `ranking` / `rankingTotal` / dashboard 内 `getCommunityRanking` 调用与 `CommunityRankingItem` / `coverageText` 孤儿 import、`.topnav-*` 7 组 CSS；历史 buildIntegrity「v0.49.0 topnav-1」4 条断言随之删除，防回归门禁并入 `dataToolsEntry.test.ts`。保留：`cityScoped` / `applyCityScopedClass` / `crossCityRows`（7 处隐藏跨城块仍消费，行为不变）、`pickCity`（壳层城市按钮复用）、`periods` / `sourceOptions`（`loadAll` 默认周与来源校验仍消费）、`getCommunityRanking` 库函数（`apiWrappers.test.ts` / `pipeline.test.ts` 在测）、`summarizeListingTrust` 库函数（`listingTrustSummary.test.ts` 在测）。REAL 占比可见性验收在 F-SET-02 设置页。v1.123.10 续删旧 `home-entry-card` 死 DOM——与 v122 壳完全重复的城市 chip/搜索/频道横滚/金刚区模板块（v1.121.83 F-ENTRY-01 遗产，v122 起即被壳层 CSS 隐藏），连同 `onHomeChannel` / `onHomeKingkong` / `HOME_CHANNELS` / `HOME_KINGKONG` import 与 `.home-entry-card` ~ `.home-entry-hint` 共 20 组 CSS；孤儿 e2e `smoke_entry_supply.mjs`（点击目标本已不可见、不在任何 suite）一并删除，供需页真实入口改记到 F-SUPPLY-01。保留：`HOME_SEARCH_MODES` 等库定义（`homeEntry.test.ts` 库级在测）、`submitHomeSearch` / `jumpHomeAnchor` / `supplyEntryOwner` / `landEntryOwner`（壳层搜索与锚点仍消费）。v1.123.11 续删库级死定义——`HOME_CHANNELS` / `HOME_KINGKONG` / `homeKingkongCount` 及 `HomeChannel` / `HomeKingkongItem` / `HomeChannelKey` / `HomeEntryTone` / `HomeKingkongAction` / `HomeChannelAction` 类型（v1.123.10 起已无任何 UI/脚本消费者，仅剩库级自测）；保留 `HOME_SEARCH_MODES` / `resolveHomeSearch` / `resolveHomeScrollAnchor` / `homeSupplyEntryOwner` / `homeLandEntryOwner` / `setPendingFindMode` / `takePendingFindMode` / pending query 系列（v122 壳层搜索、锚点解析与 listing-filter / school 仍消费），`homeEntry.test.ts` 同步瘦身为搜索路由/锚点/pending 用例。v1.123.13 续删「医疗资源榜」隐藏死 DOM——v1.122 起被壳层 CSS 永久隐藏的 hospital-rank 卡（v1.121.12 接入、v1.121.15 坐标段）实现全删：模板约 260 行（三甲 KPI/分区 Top/等级优先/重点/中医/妇幼/专科名录/同名区对照/坐标覆盖段）+ hospitalCitySummary 等 18 个 computed + hospitalDisplayName + hospitalRanking/hospitalGeoAnalysis 两组 import + ADVANCED_CARDS 与 data-tools 卡片管理清单 hospital-rank 条目 + .hosp-geo-* CSS（.pc-* 保留）；hospitalCityName 因与周边商业/菜市场/今日要点共用而保留，hospitalRanking.ts / hospitalGeoAnalysis.ts 库与单测保留（同 getCommunityRanking 先例），listing-detail / community「周边医院」卡不受影响；DATA_SOURCES 医疗资源两条改记当前消费面。v1.123.14 续删「学区溢价榜」隐藏死 DOM——v0.11.0 接入、v1.122 起被壳层 CSS 永久隐藏的 school-premium-rank 卡实现全删：模板约 95 行（区溢价 Top8 奖牌榜 + 挂牌数分布 + 板块级跨区段）+ schoolPremiumOverview ref 与 loadAll 调用 + schoolPremiumDistrictTop/CrossName/Cross/CitySummaries 4 个 computed + formatPremium/premiumClass/medalText/medalClass 4 函数 + schoolPremiumRanking 整组 import 与 SchoolPremiumOverview/LocalSchoolPremiumDistrict/CrossCityDistrictEntry/CitySchoolPremiumDistrictSummary 类型引用 + .sp-row~.sp-neg 与 .medal-flat CSS（formatNum/spMedalClass/lpScoreClass/.sp-medal-mini/.medal-gold 系因 listing 学区溢价榜/区涨幅榜仍消费而保留）+ data-tools 卡片管理清单条目；孤儿 e2e smoke_school_premium.mjs（断言隐藏 DOM、不在任何 suite）一并删除；库 schoolPremiumRanking/queries.getSchoolPremiumRank 与单测保留（同 getCommunityRanking 先例），data-tools 学区评分卡与 listing 学区溢价榜不受影响。v1.123.15 续删「listing 学区溢价榜」隐藏死 DOM——v0.17.0 接入、v1.122 起被壳层 CSS 永久隐藏的 listing-school-premium 卡（🏫 高学区评分房源）实现全删：模板约 110 行（均溢价 KPI/4 桶分布/分区 Top/小区 Top/挂牌量 Top/房源行）+ listingPremiumOverview ref 与 loadAll 调用 + lspCitySummary/lspDist/lspDistrictTop/lspCommunityTop/lspCommunityByVolume 5 个 computed + lpScoreClass 函数（spMedalClass/formatNum/.sp-medal-mini/.medal-gold 系因区涨幅榜/商业热度榜仍消费而保留）+ listingSchoolPremiumRanking 整组 import 与 queries.getTopListingsBySchoolPremium/ListingSchoolPremiumOverview 引用 + ADVANCED_CARDS 与 data-tools 卡片管理清单条目；孤儿 e2e smoke_listing_premium.mjs（断言隐藏 DOM、不在任何 suite）一并删除；库 listingSchoolPremiumRanking/queries.getTopListingsBySchoolPremium 与单测保留（同 getCommunityRanking 先例），buildIntegrity「v0.17.0」卡渲染断言改锚地图分区 school 聚合（mapDistrictStats 仍消费 store.getListingSchoolPremiumByCity），data-tools 学区评分卡不受影响。v1.123.16 死库瘦身——v1.123.13–15 三轮死 DOM 删除后失去唯一消费者的派生库本轮清理：`listingSchoolPremiumRanking.ts`（5 函数 + 4 类型）与 `hospitalGeoAnalysis.ts`（10 函数）整库删除，孤儿单测 `listingSchoolPremiumRanking.test.ts`（6 用例）/ `hospitalGeoAnalysis.test.ts`（11 用例）一并删除，`adversarialRankingProbe` 摘除 2 条 hospitalGeo 探针用例；queries.ts 无消费者包装 `getTopListingsBySchoolPremium`（+ `ListingSchoolPremiumItem`/`Overview`）与 `getSchoolPremiumRank`（+ `SchoolPremiumItem`/`Overview`）同步删除，buildIntegrity「v0.17.0」对应断言移除；保留 store 数据面（`getListingSchoolPremia` / `getListingSchoolPremiumByCity` / `getSchoolPremiumRank` / `getHospitalGeos` 与 importer/seed 管道——mapDistrictStats 与 map-analysis 仍消费学区溢价，hospitalGeos 暂为纯数据面）、`schoolPremiumRanking.ts`（data-tools 学区评分卡在消费）、`hospitalRanking.ts`（下轮评估）；dataToolsEntry 加禁出现门禁。v1.123.17 死库瘦身续——`hospitalRanking.ts`（8 函数 + 4 类型：levelRank / summarizeHospitalByCity / summarizeHospitalByCityDistrict / getHospitalTopByLevelByCity / getHospitalByCityByType / getHospitalKeyFlagByCity / getHospitalByCityByDistrict / getHospitalCrossCityByDistrict + HospitalLevel / CityHospitalSummary / CityDistrictHospitalSummary / CrossCityHospitalEntry）整库删除，孤儿单测 `hospitalRanking.test.ts`（9 用例）一并删除；侦察确认 src/ 零 import，listing-detail / community「周边医院」卡走 http `getCommunityHospitals`（后端 API，不经此库），store 数据面 `snapshot.hospitals` 与 importer/seed 管道不受影响；buildIntegrity「医院清单完整性」断言针对 CSV 文件本身、与派生库无关，保持不变；dataToolsEntry 加禁出现门禁（existsSync=false + queries 源码断言）。  
**不期望**：把隐藏旧 DOM 存在当作当前 UI 验收通过证据；恢复工作台作为首页第二套筛选（同 X6）。  
**自动化**：unit `dataToolsEntry.test.ts`（断言 `data-home-workbench` / `toggleCityScoped` / `pickMetric` / `topnav-period` / `stepPeriod` / `week-ranking-card` 等不再出现）。  
**手工**：无需手工；城市切换验收见壳层 `[data-home-city]`。

---

### F-DASH-02 · 总览长页信息流（去分割缝）

| 项 | 内容 |
|----|------|
| 入口 | 总览整页滚动 |
| 风险 | U |
| 对照 | [DASHBOARD_FEED_ACCEPTANCE.md](./DASHBOARD_FEED_ACCEPTANCE.md) |

**期望**：相邻块无对比色宽沟；浅/深一致。  
**不期望**：大块 gutter 横切。  
**自动化**：core `smoke_dashboard_feed_seam.mjs`  
**手工**：慢滑 3～5 屏 × 浅/深。

---

### F-DASH-03 · Hero 轮播 + 今日要点

| 项 | 内容 |
|----|------|
| 入口 | 总览首屏下方 |
| 风险 | U, L |
| 对照 | [HOUSING_PRICE_ACCEPTANCE.md](./HOUSING_PRICE_ACCEPTANCE.md) |

**期望**
1. （L）单价文案为「挂牌中位单价」，不出现模式名「成交价」  
2. （F）要点含挂牌价 / 指数环比 / 网签套数等可区分三轴  
3. （U）浅色可读

**自动化**：unit `priceSemantics.test.ts`；core theme_visual 间接  
**手工**：看 Hero 文案含「挂牌」；网签 sub 含「非均价」类提示。

---

### F-DASH-04 · 专业 Tab（概览/价格/学区/通勤/地图）· v1.123.6 实现已删除

| 项 | 内容 |
|----|------|
| 入口 | ~~`dash-tabs`~~ v1.122 起首页不再可见；能力由 F-MKT-01 行情聚合页接管 |
| 风险 | F, U |
| 状态 | ⛔ 已删除（v1.123.6 移除全部实现代码与历史测试） |

**现状**：v1.122 首页收敛为新版壳（`.home-v122-shell`）后旧专业 Tab 即不可见；v1.123.6 删除全部实现——`#dash-tabs` 模板条、`activeTab`/`setDashTab`/`DASHBOARD_TABS`/`applyTabClass`/`.page[data-dash-tab]` 过滤 CSS、`src/local/dashTabs.ts`、`homeEntry.ts` 的 `{kind:'tab'}` 动作变体（首页搜索「通勤/地铁」改导航数据工具页），以及历史测试 `dashboardTabs.test.ts`、`smoke_drill_down.mjs` 与 buildIntegrity v0.48.0 断言组。v1.123.7 清零残余：剥离遗留长卡与数据工具页的 `data-tab` 死属性（48 处），删除孤儿 `filterWorkbenchExpanded` 与 `homeEntry.ts` 无数据项的 `{kind:'period'}` 变体，断言 data-tab 配置的 `dashboardOverviewDataTabBudget.test.ts` 随之删除（防回归门禁并入 `dataToolsEntry.test.ts`）。不得恢复其作为首页第二套导航（验收 X6）。  
**不期望**：把隐藏旧 DOM 存在当作当前 UI 验收通过证据。  
**自动化**：unit `tests/homeEntry.test.ts`（旧价格入口迁行情接线门禁）与 `navigation.test.ts`（28 项迁移映射），对照 [DASHBOARD_TABS_ACCEPTANCE.md](./DASHBOARD_TABS_ACCEPTANCE.md)。注意：`smoke_dashboard_feature_matrix.mjs` 验收的是行情页（F-MKT-01），与本项无关。  
**手工**：无需手工；当前入口验收见 F-MKT-01。

---

### F-DASH-05 · 房价·挂牌聚合（区对比/趋势/指数/溢价/结构…）

| 项 | 内容 |
|----|------|
| 入口 | 总览 · 价格画像及概览相关卡 |
| 风险 | L, U |
| 对照 | HOUSING_PRICE |

**期望**
1. （L）所有「元/㎡」来自 listings，文案侧不冒充成交价  
2. （L）展示 REAL/DERIVED 构成提示（工作台）  
3. （F）有数据时卡可见；无数据空态不崩溃

**不期望**：把 DERIVED 写成「官方成交」。  
**自动化**：大量 `*Ranking.test.ts`；matrix；district_* smoke  
**手工**：价格 Tab 抽查 2 张卡数字与城市一致。

---

### F-DASH-06 · 房价·网签量（热度/周环比/入口卡）

| 项 | 内容 |
|----|------|
| 入口 | 总览网签相关卡 → `wangqian` |
| 风险 | L, F |
| 对照 | HOUSING_PRICE；DATA_SOURCES §2 |

**期望**：只谈套数/面积/活跃度；周聚合新鲜度跟得上 daily（CI 重建）。「近 4 周二手网签热度榜」卡 v1.123.2 起迁入数据工具页（`pages/data-tools/data-tools`，`[data-dt-wangqian-rank]`），入口：数据工具。  
**不期望**：出现「网签均价 XXX 元/㎡」当官方价。  
**自动化**：unit `dailyWangqian` / `wangqianTrendRanking`；ext `smoke_wangqian_heatmap`（v1.123.2 起断言 data-tools 页可见）  
**手工**：数据工具页打开网签热度榜卡看日期；进网签页核对全市套数。

---

### F-DASH-07 · 房价·70 城指数卡

| 项 | 内容 |
|----|------|
| 入口 | 总览 70 城卡 → `stats70` |
| 风险 | L |
| 对照 | hugohe3/70cityprice；HOUSING_PRICE |

**期望**：指数/涨跌；可跳转。  
**不期望**：把指数当成「均价 X 万」。  
**自动化**：unit `stats70*`  
**手工**：点进 stats70，切换新建/二手。

---

### F-DASH-08 · 学区 / 医疗 / 教育

| 项 | 内容 |
|----|------|
| 入口 | 总览 · 学区配套 |
| 风险 | F, L |

**期望**：列表可点进学校/小区（有 id 时）；城市过滤正确；**广深珠教育事业概览**有官方数据时展示（城市名须走同步 `store.getCityById`，不可等异步 cities）；深圳用「普通中小学」口径；珠海期间展示为「学年」非自然年「YYYY 年」；分项城市学校页仍展示幼儿园。「学区评分 Top 小区」卡（含区过滤/最低评分/排序控件）v1.123.2 起迁入数据工具页（`[data-dt-school-top]`）。  
**不期望**：跨城串数据；伪造在校生/民办；首屏因 `city#id` 占位丢卡。  
**自动化**：matrix（含「教育事业」+ `[data-education-overview]`）；unit `educationOverview` / `adversarialEducationBugs`；ext `smoke_school_community`（v1.123.2 起断言 data-tools 页可见）  
**手工**：三城切换看教育卡口径差异；数据工具页验证学区评分卡过滤/排序。

---

### F-DASH-09 · 地铁 / 通勤

| 项 | 内容 |
|----|------|
| 入口 | 总览 · 通勤地铁 |
| 风险 | F, L |

**期望**：通勤分钟与 CBD 名合理；规划线可区分状态。「地铁步行可达性」（metro_walk）与「地铁规划受益」（metro_benefit）卡已迁入数据工具页（`[data-dt-metro-walk]` / `[data-dt-plan-benefit]`），ext smoke 断言 data-tools 页可见。  
**自动化**：commute / metro_* smoke；unit metro* / commute  
**手工**：通勤 Tab 看 Top1 可点或有说明；数据工具页验证 metro_walk / metro_benefit 卡。

---

### F-DASH-10 · 商业 / 生活 / 天气

| 项 | 内容 |
|----|------|
| 入口 | 总览相关卡 |
| 风险 | F, L |

**期望**：无 Key/无数据时降级提示，不白屏。  
**不期望**：天气失败却显示假晴。  
**自动化**：commercial / life_convenience / weather smoke；unit poi*  
**手工**：断网或无 Key 时看提示（若可复现）。

---

### F-DASH-11 · 宏观 LPR / NBS / 广州库存

| 项 | 内容 |
|----|------|
| 入口 | 总览宏观卡 |
| 风险 | L |

**期望**：数字来自对应 CSV；空则隐藏或空态；官方宏观卡按 **全国 / 广东** 分组（`macro-kicker`），脚注短句、城乡人口进折叠；**NBS 多期销售面积/销售额/投资/到位资金同比可并列展示（默认折叠）**；**NBS 房屋施工/新开工/竣工面积（官方表，多期同比）**；**NBS 住宅施工/新开工/竣工 + 住宅施工占比（派生）**；**NBS 住宅销售面积/销售额/待售/投资（官方表「其中」分项）**；**NBS 到位资金拆分：国内贷款/定金及预收款/个人按揭/自筹**；**NBS 销售额÷面积派生全国合同均价（含住宅派生，多期）+ 粗算可售月数（多期；明示非城市均价/去化）**；**NBS 全国固定资产投资基本情况（累计额+民间/制造/设备/三产同比，多期默认折叠；≠房价）**；**NBS 居民收入和消费（含居住消费，季/半年/年报；≠房价）**；**NBS 月度 CPI（含居住/租赁房房租同比；房租≠房价）**；**NBS 月度 PPI（含购进/非金属矿物制品业建材分项；PPI≠房价）**；**NBS 社消装潢材料/家具零售（限额以上；≠房价）**；**NBS 规上工业增加值（当月同比/环比/累计 + 三大门类；≠房价；可与 PMI 对照）**；**NBS 规上工业企业利润（累计利润/营收/利润率 + 三大门类；通常滞后约 1 个月；≠房价）**；**70城当前城市 Top% 细进度条**；广州库存卡新鲜度与分区可售占比；**保障房同年棚改竣工脚注（不同口径，不并排 KPI）**；深圳计划入市；广州住房发展计划；**广州保障房已筹建/已竣工清单汇总**；**广州保障房任务量目标进度（筹集/竣工）**；**深圳保障房建设筹集/基本建成项目表**；**深圳/广州公积金年报（深圳含上年对照）+ 珠海公积金动态（含同月末对照）+ 广东全省年报（默认折叠）**；**广东房地产市场运行简况（多期默认折叠；含省统计局上半年/累月）**；**广东固定资产投资简况（同比多期默认折叠）**；**广东建筑业生产运行（产值多期默认折叠）**；**广东经济运行（GDP/房开/收入/年报人口·城镇化多期默认折叠）**；**广州居住用地成交**（仅 R2/居住，土地价款≠房价）；**深圳居住用地已成交**（列表起始价≠成交总价≠房价）；**珠海安居工程进展**（年内累计开工/竣工，非成交）；**珠海不动产登记季报**（新增商品房/存量房转移住宅合计，PNG 人工抄录；≠日更网签）；**珠海商品房价格备案**（住建局 HTML 表摘要；备案价≠挂牌/成交/70城）；**央行 MLF 开展情况（中标利率/操作量/余额；≠房价；可与 LPR 对照）**；**央行公开市场 7 天期逆回购（利率/中标量；≠房价）**；**中债国债收益率（关键期限 + 10Y−1Y 利差；≠房价；可与 LPR/MLF/逆回购对照）**；**Shibor 同业拆放利率（隔夜～1Y；≠房价；可与 LPR/国债收益率对照）**；**回购定盘利率 FR/FDR（含 FDR007；≠房价；可与 Shibor/逆回购对照）**；**央行金融统计数据报告（社融/M2/住户及中长期贷款结构；≠房价；住户中长期贷≠按揭成交）**；**广东地区社融增量（省级 XLSX；含占全国同期社融派生占比 + 苏浙京沪同期对照；≠城市挂牌/网签/70城）**；**外管局外汇储备规模（月末亿美元/环比；≠房价；可与金融统计外储对照）**；**外管局银行结售汇（结汇/售汇/派生顺差；含代客涉外收入/付款；≠房价）**；**外管局外汇市场交易概况（总成交/即期/衍生品万亿元；≠房价）**；**外管局美元中间价日度（含本月均价；≠房价）**；涨跌色涨红跌绿；网签/70城/城市标签须同步 store（不可等异步 cities）。  
**自动化**：unit `gzHousingPlan` / `gzAffordableTargets` / `szProvidentAnnual` / `gzProvidentAnnual` / `zhProvidentDynamics` / `zhBdcRegistration` / `mlfHistory` / `omoRrHistory` / `chinaBondYield` / `shibor` / `repoFixing` / `pbcFinStats` / `pbcRegionSf` / `safeForex` / `safeSettle` / `safeFxMarket` / `safeUsdMid` / `safeOra` / `safeBopTrade` / `safeIip` / `safeBop` / `nbsTrade` / `nbsPmi` / `nbsIndustrial` / `nbsIndustrialProfit` / `gdProvidentAnnual` / `gdRealEstateBrief` / `gdFaInvestment` / `gdConstruction` / `gzLandDeals` / `nbsRealEstate` / `nbsFaInvestment` / `nbsIncome` / `nbsCpi` / `nbsPpi` / `nbsRetail` / `adversarialColorCitySupply` / city-sync adversarial  
**手工**：广州城见住房计划 + 居住用地成交卡 + 公积金年报/动态；珠海城见不动产登记季报；切换城市时网签卡不闪空。

---

## 2. 房源 Tab + 详情 + 小区

### F-LIST-01 · 多维筛选与命中计数

| 项 | 内容 |
|----|------|
| 入口 | Tab「房源」 |
| 风险 | F, L, U |
| 专题 | [LISTING_FILTER_ACCEPTANCE.md](./LISTING_FILTER_ACCEPTANCE.md) · [TEST_ACCEPTANCE.md](./TEST_ACCEPTANCE.md) P-LIST-* |

**期望**
1. （F）区/总价/面积/关键字/类型/装修应用后列表变化  
2. （L）「共 N 套」与列表一致；分页可加载更多（有数据时）  
3. （U）筛选条可点、可重置；关键字输入框可见；空结果有条件说明  
4. （L）`districtName` 过滤后 total ≤ 全市，且条目属该区  
5. （L）`keyword` 匹配标题/小区名/行政区后 total ≤ 全市；首页「房源」搜索可写入 pending 并自动应用  
6. （L）「二手房」「新房」与种子 `listing_type` 对齐且互斥；二者筛选均须有命中  
7. （L）装修选项含精装/豪装/普装/简装/毛坯；高频装修选中后 total>0  

**不期望**：只有二手没有新房分类；选类型无故清空；装修缺豪装/普装。  
**自动化**：`listingFilterTypeDecorate.test.ts` / `listingFilterDistrict.test.ts` / `listingFilterKeyword.test.ts` / `homeEntry.test.ts` / `uiVerticalAlign.test.ts`；`smoke_listings.mjs`  
**手工**：见 LISTING_FILTER_ACCEPTANCE §4。

---

### F-LIST-02 · 洞察卡（流动性 / 标签 / 性价比）

| 项 | 内容 |
|----|------|
| 入口 | 房源页上部 |
| 风险 | L, U |

**期望**：洞察基于当前城市筛选；可点进详情。  
**自动化**：listing_* smoke（部分）  
**手工**：切换城市后洞察文案城市名变化。

---

### F-LIST-03 · 房源详情

| 项 | 内容 |
|----|------|
| 入口 | 列表项 / 深链 `listing-detail?id=` |
| 风险 | F, L, U |

**期望**：价/面积/小区名展示；DERIVED 有黄标；同小区在售可点；底栏「查看参考页面/复制链接」文字垂直居中。  
**不期望**：无 id 白屏无说明。  
**自动化**：`smoke_full_pages` id=1227；`uiVerticalAlign.test.ts`；unit 相关  
**手工**：打开 1227，看派生标（若为 DERIVED）；确认底栏文案居中。

---

### F-LIST-04 · 外链 / 唤起贝壳·安居客

| 项 | 内容 |
|----|------|
| 入口 | 详情底栏「去贝壳查看」 |
| 风险 | F |
| 对照 | 贝壳/链家 Android：`Intent.ACTION_VIEW` + `setPackage(com.lianjia.beike)` 打开 `https://*.ke.com`；渗透公开 scheme `lianjiabeike://web/main?url=`；详情底栏主 CTA |

**期望**：单击直接唤起 App（https+包名 → 原生 scheme → App WebView）；失败再选浏览器/复制；详情有贝壳式价区+底栏。  
**不期望**：默认复制链接或静默只开系统浏览器。  
**自动化**：unit `openExternal.test.ts`  
**手工**：真机装贝壳后点底栏「去贝壳查看」。

---

### F-COMM-01 · 小区详情

| 项 | 内容 |
|----|------|
| 入口 | `community?id=` |
| 风险 | F, L, U |

**期望**：五维/趋势/房源列表；城市一致。  
**自动化**：page；ext `community_metrics`  
**手工**：id=24 打开，返回总览不丢城市。

---

## 3. 学校

### F-SCH-01 · 学校列表与搜索

| 项 | 内容 |
|----|------|
| 入口 | Tab「学校」 |
| 风险 | F, U |

**期望**：关键字过滤；空关键字显示列表或引导。  
**自动化**：page；v097 等  
**手工**：搜一校名，列表缩短。

---

### F-SCH-02 · 学校详情

| 项 | 内容 |
|----|------|
| 入口 | `school-detail?id=` |
| 风险 | F, L |

**期望**：评分构成可读；返回学校/总览可用。  
**自动化**：core `smoke_school_detail.mjs`  
**手工**：进详情再回列表。

---

## 4. 地图 Tab

### F-MAP-01 · 五模式切换

| 项 | 内容 |
|----|------|
| 入口 | Tab「地图」图层按钮 `data-map-mode` |
| 风险 | F, U, L |
| 对照 | [MAP_ACCEPTANCE.md](./MAP_ACCEPTANCE.md)、HOUSING_PRICE |

**期望**
1. （F）挂牌热力 / 挂牌均价 / 挂牌点 / POI / 地铁 可切换
2. （L）均价模式文案为「挂牌均价」，非「成交价」
3. （U）图例与模式一致；挂牌均价时底图仍可读（非黑糊）
4. （L）图例区间禁止全表 `0k-0k`；price 模式只画有均价社区

**自动化**：core `smoke_map_controls`；`smoke_price_heatmap`；`mapMath.test.ts`；poi/metro/cluster smoke  
**手工**：见 MAP_ACCEPTANCE 真机路径。

---

### F-MAP-02 · 底图降级与重试

| 项 | 内容 |
|----|------|
| 入口 | 地图加载失败条 |
| 风险 | F, U |

**期望**：慢加载有提示与重试，不整页死；占位浅色非纯黑。  
**自动化**：map_controls 间接  
**手工**：弱网或禁地图 Key 时看提示（可配置时）。

---

### F-MAP-03 · 挂牌均价热力可读性

| 项 | 内容 |
|----|------|
| 入口 | 地图 → 💰 挂牌均价 |
| 风险 | U, L, F |
| 对照 | [MAP_ACCEPTANCE.md](./MAP_ACCEPTANCE.md) |

**期望**：半透明 8 位 hex 热力；图例 5 档有效；不铺无价灰圆。  
**自动化**：`smoke_price_heatmap` + `mapMath.test.ts`  
**手工**：截图须能辨认道路。

---

### F-MAP-04 · 地图找房主路径（贝壳式）

| 项 | 内容 |
|----|------|
| 入口 | Tab「地图」默认「找房」 |
| 风险 | F, U, L |
| 对照 | [MAP_ACCEPTANCE.md](./MAP_ACCEPTANCE.md) §4 |

**期望**：总价/户型筛选；点小区→房源底栏；点房源→详情；可跳转小区全部列表。  
**自动化**：`mapFind.test.ts` + `smoke_map_find.mjs`  
**手工**：见 MAP_ACCEPTANCE 真机路径。

---

## 5. 设置 / OTA / 政府页

### F-SET-01 · 主题三态

| 项 | 内容 |
|----|------|
| 入口 | 设置 · 外观 |
| 风险 | U, F |
| 对照 | [THEME_ACCEPTANCE.md](./THEME_ACCEPTANCE.md) |

**期望**：浅/深/跟随切换后内容与壳层一致；持久化。  
**自动化**：core `smoke_theme_visual` / `smoke_theme_buttons`；unit `theme.test.ts`  
**手工**：按 THEME_ACCEPTANCE §4 真机。

---

### F-SET-02 · 数据源 / 快照刷新

| 项 | 内容 |
|----|------|
| 入口 | 设置 · 数据 |
| 风险 | F, L |

**期望**：刷新成功有反馈；失败保留旧数据；**可见 REAL 占比与真实挂牌最新 crawl_date**（房价 Phase C）。  
**自动化**：unit `dataRefresher`；`listingTrustSummary.test.ts`  
**手工**：打开设置看「挂牌可信度」一行；点刷新看 toast。

---

### F-SET-03 · 政府网签刷新

| 项 | 内容 |
|----|------|
| 入口 | 设置 · 网签 |
| 风险 | F, L |

**期望**：CDN 刷新后网签页日期更新或明确失败。  
**自动化**：unit `wangqianDataRefresher`  
**手工**：刷新后打开网签页。

---

### F-SET-04 · 政府外链 → WebView

| 项 | 内容 |
|----|------|
| 入口 | 设置政府入口 → `gov-webview` |
| 风险 | F, U |

**期望**：标题正确；加载失败有兜底。  
**自动化**：unit `govLinks`；page  
**手工**：点一条政府链接看能否打开。

---

### F-CSV-FRESHNESS · 全站 CSV 数据陈旧度统一扫描

| 项 | 内容 |
|----|------|
| 入口 | `.github/workflows/check-csv-freshness.yml`（每天 02:30 UTC）+ `scripts/check_csv_freshness.py` |
| 风险 | L |
| 状态 | ✅ 有门禁（cron 退出码 0=全 OK，1=WARN，2=STALE） |

**期望**：
- 扫 `realty_app/static/*.csv` 共 43 个文件，按各自表头日期字段（`date` / `publish_date` / `as_of_date` / `effective_date` / `report_date` 等）算陈旧天数；
- 三档分级（v1.122.51 起）：`OK < 90 天`、`WARN 90..180 天`、`STALE ≥ 180 天`；
- 退出码与等级挂钩：CI 红时用户会收到与 e2e 一致的邮件告警；
- 输出 markdown 表格进 `GITHUB_STEP_SUMMARY`，artifact 归档 30 天；
- EXEMPT 白名单（v1.122.51 起，当前共 13 项）：`gz/sz/gd_provident_annual.csv`、`provident_fund_rates.csv`、`zh_provident_dynamics.csv`、`education_overview.csv`、`zh_bdc_registration.csv`、`zh_price_filing.csv`、`nbs_avg_wage.csv`、`stats_70.csv`、`gd_construction.csv`、`gz_housing_plan.csv`、`mlf_history.csv`。**警告**：EXEMPT 项 cron 邮件不报警，扩 EXEMPT 会掩盖真信号（v1.122.51 changelog 诚实记录）。

**为什么需要**：
- 之前 wangqian 抓取连续 21 天陈旧没人发现，是因为只盯单一数据源；
- 仓库里 43 个 CSV 各自有爬取脚本，绝大部分陈旧是静默的；
- 这个工具一次性把全部 43 个数据源暴露在统一视图里，杜绝下一个"21 天陈旧没人发现"。

**不期望**：
- 半夜被自动 issue 轰炸（**故意不开**自动开 issue，由人在 PR / workflow 摘要里看到）；
- 取代各 crawl_*.py 本身的 fetch + commit 流程（只负责**侦测**，不负责修复）。

**自动化**：
- `python scripts/check_csv_freshness.py --only-stale` 看本月需要补的源；
- `python scripts/check_csv_freshness.py --json` 给 CI / 外部分析用；
- `python scripts/check_csv_freshness.py --today 2026-08-25` 测试模式（隔离过去某天）。

**手工**：看 workflow run 的 `GITHUB_STEP_SUMMARY` markdown 表格即可，无需额外动作。

---

### F-OTA-01 · 检查更新与升级弹层

| 项 | 内容 |
|----|------|
| 入口 | 设置检查更新 / 启动检测 → `upgrade-popup` |
| 风险 | F, U |

**期望**：有新版本展示 versionCode/说明；进度可见；可稍后。  
**不期望**：弹窗闪烁抢焦点（历史 bug）。  
**自动化**：unit `appUpdate`  
**手工**：真机检查更新（有 OTA 清单时）。

---

## 6. 独立行情页

### F-S70-01 · 全国 70 城页

| 项 | 内容 |
|----|------|
| 入口 | `stats70` |
| 风险 | L, F |
| 对照 | HOUSING_PRICE Phase D |

**期望**：排序/切换新建二手生效；洞察不冒充均价；**展示新鲜度（截至月 / 是否跟上发布节奏）**；**城市过滤框**子串匹配生效、筛选后 `#N` 仍是全表原始名次、无匹配有空态提示、可一键清空。  
**自动化**：page；unit `stats70*`（含过滤框契约）/ `stats70Freshness`；ext `smoke_stats70_filter.mjs`（过滤框交互：收窄/名次保持/空态/清空）；月更 CI `crawl-monthly-stats70`  
**手工**：打开 stats70 看「截至…已跟上」；设置页同文案；过滤框输入「深圳」只看深/读名次，清空恢复 70 行。

---

### F-WQ-01 · 政府每日网签全页

| 项 | 内容 |
|----|------|
| 入口 | `wangqian` |
| 风险 | L, F, U |
| 对照 | DATA_SOURCES；HOUSING_PRICE |

**期望**：深/广套数面积；分区表；无「成交均价」KPI。  
**自动化**：page；ext wangqian_heatmap  
**手工**：下拉刷新；核对待区合计口径说明。

---

### F-DTOOLS-01 · 数据工具页锚点分组导航

| 项 | 内容 |
|----|------|
| 入口 | `data-tools` 顶部吸顶导航 `[data-dt-nav]` |
| 风险 | U, F |
| 对照 | 17 张 `[data-dt-*]` 卡（Batch 1-6 迁入 16 张 + 行政区划） |

**期望**
1. （U）导航吸顶于 `uni-page-head` 下方（`top: var(--window-top)`），滚动不丢失  
2. （F）chip 按「市场 / 交通 / 学区 / 挂牌」四组排列 + ⚙️ 卡片管理；点击平滑滚动到对应 `[data-dt-*]` 卡，卡顶不被吸顶导航遮挡（让出导航高度 + 8px）  
3. （F）目标卡无数据（v-if 未渲染）时 toast「该卡片暂无数据」，不静默失败  
4. （U, F）v1.123.4 起滚动反选：可视带状区（导航下方 ~ 视口 60%）最靠上的卡对应 chip 高亮（`dt-nav-chip--active`）；点击 chip 即高亮，纯滚动也跟随；keep-alive 返回（onShow）后仍生效  
5. （U, F）v1.123.5 起高亮 chip 自动横滚进可视区：active 变化时 `scroll-into-view` 指向该 chip（`dt-nav-chip-<anchor>`），纯滚动到右侧组（如学区）后导航条跟随，高亮 chip 完整落在导航视口内  

**不期望**：chip 顺序与卡片语义分组错乱；滚动后卡顶被吸顶导航/uni-page-head 盖住；滚动时无当前位置高亮或高亮与实际可视卡不符；高亮 chip 被横滚条挡在可视区外。  
**自动化**：ext `smoke_data_tools_nav.mjs`（吸顶可见 + 点击 chip 滚动 + 卡顶让位断言 + 点击/纯滚动 active 反选断言 + 高亮 chip 横滚进导航视口断言）  
**手工**：数据工具页点「网签热度」chip，页面滚到热度榜且标题完整可见。

---

## 7. 横切语义

### F-X-01 · 房价三轴语义门禁

| 项 | 内容 |
|----|------|
| 入口 | 全局文案 |
| 风险 | L |
| 对照 | HOUSING_PRICE；`priceSemantics.ts` |

**期望**：map 模式标签「挂牌均价」；禁把挂牌写成成交价模式名。  
**自动化**：unit `priceSemantics` + `buildIntegrity` 地图节  
**手工**：地图按钮文字目视。

---

### F-X-02 · 可信度 source_kind

| 项 | 内容 |
|----|------|
| 入口 | 详情 / 工作台构成 |
| 风险 | L |
| 对照 | DATA_SOURCES §3 |

**期望**：REAL/DERIVED 可区分。  
**自动化**：unit / seed 相关  
**手工**：派生样本详情有黄标。

---

### F-X-03 · 响应式 / 边缘 / 全页冒烟

| 项 | 内容 |
|----|------|
| 入口 | 多页 |
| 风险 | U, F |

**期望**：核心页可打开不白屏；小屏无明显横向撑破。  
**自动化**：core `smoke_full_pages` / `responsive_layout` / `edge_cases` / `content_scaling`  
**手工**：抽 3 页旋转或窄屏。

---

## 8. 专题链接（深挖）

| 专题 | 文档 | 覆盖 CATALOG |
|------|------|----------------|
| 强制流程 | [FEATURE_QA_PROCESS.md](./FEATURE_QA_PROCESS.md) | 全部 |
| 主题 | [THEME_ACCEPTANCE.md](./THEME_ACCEPTANCE.md) | F-SET-01 |
| 总览专业 Tab | [DASHBOARD_TABS_ACCEPTANCE.md](./DASHBOARD_TABS_ACCEPTANCE.md) | F-DASH-04 |
| 总览去缝 | [DASHBOARD_FEED_ACCEPTANCE.md](./DASHBOARD_FEED_ACCEPTANCE.md) | F-DASH-02 |
| 房价三轴 | [HOUSING_PRICE_ACCEPTANCE.md](./HOUSING_PRICE_ACCEPTANCE.md) | F-DASH-03/05/06/07, F-MAP-01, F-X-01, F-S70, F-WQ |
| 五栏壳层与本地资料库 | [APP_SHELL_ACCEPTANCE.md](./APP_SHELL_ACCEPTANCE.md) | F-ENTRY-02 / F-MKT-01 / F-MINE-01 |

---

## 9. 新增功能登记表（追加区）

> 新功能复制一行模板追加到对应章节，并分配新 ID（`F-<域>-<序号>`）。

| 日期 | ID | 标题 | 发版 version | 备注 |
|------|-----|------|--------------|------|
| 2026-11-03 | F-DTOOLS-01 | 数据工具页锚点分组导航（吸顶 + 17 卡四组 chips + 滚动让位） | 1.123.3 | `[data-dt-nav]`；ext smoke_data_tools_nav；H5 自算 scrollTop（uni offset 不透传） |
| 2026-07-29 | F-DASH-11 | 交通运输部货运/港口经济运行建卡 | 1.121.157 | ≠房价；macro-industry；MOT xxgk |
| 2026-07-29 | F-DASH-11 | NBS 服务业生产指数建卡（含租赁商务分项） | 1.121.156 | ≠房价；macro-industry；可与 gd_services 对照 |
| 2026-07-29 | F-DASH-11 | NBS 城镇调查失业率建卡（国民经济运行通稿） | 1.121.155 | 就业弱相关≠房价；macro-industry；附 GDP 前三季度回填 |
| 2026-07-29 | F-DASH-11 | NBS GDP 初步核算建卡（含建筑业/房地产业增加值） | 1.121.154 | ≠房价；macro-industry；季更探测 |
| 2026-07-29 | F-DASH-11 | NBS 城镇单位年平均工资建卡（含房地产/建筑业） | 1.121.153 | 支付力弱相关≠房价；macro-industry |
| 2026-07-29 | F-DASH-11 | NBS 能源生产月报建卡（macro-industry） | 1.121.152 | 原煤/原油/气/电；≠房价；月更 CI |
| 2026-07-29 | F-DASH-11 | NBS PPI 补建材购进 + 黑色金属冶炼出厂分项 | 1.121.151 | ≠房价；macro-industry |
| 2026-07-29 | F-DASH-11 | NBS 工业增加值通稿补水泥/钢材/平板玻璃/粗钢产量 | 1.121.150 | 建材弱相关≠房价；macro-industry |
| 2026-07-29 | F-DASH-11 | 广东规上服务业专栏建卡（macro-region；租赁/房地产服务） | 1.121.149 | ≠房价、≠开发销售；周更 CI |
| 2026-07-29 | F-DASH-11 / F-SUPPLY-01 | 消费品 Q3 回填 + 家具/装潢分项；供需页业态分区 | 1.121.148 | ≠房价 |
| 2026-07-29 | F-DASH-11 | 广东规上工业 + 消费品市场专栏建卡（macro-region） | 1.121.147 | ≠房价；周更 CI |
| 2026-07-29 | F-SUPPLY-01 | 广州库存接入商业/办公/车位分项（同源可售接口） | 1.121.146 | ≠房价；供需页 KPI；历史日非住宅列可空 |
| 2026-07-29 | F-ENTRY-01 | 总览首屏精简：次要入口迁设置「首页与分析」 | 1.121.145 | versionCode 266 |
| 2026-07-29 | F-ENTRY-01 | 去掉概览折叠/滚锚点；进阶分析改跳独立页 | 1.121.144 | 禁折叠；versionCode 265 |
| 2026-07-28 | F-ENTRY-01 | 频道/金刚改为独立页跳转：供需页 + 工具/宏观/网签/70城 navigate；概览归档库存土地卡 | 1.121.143 | DASHBOARD_ENTRY_IA；禁本页长滚；smoke_entry_supply |
| 2026-07-26 | F-PAGES-MACRO-06 | 第二批迁移：迁 4 张广东卡 → macro-region | 1.121.130 | gd-real-estate-brief / gd-economy / gd-fa-investment / gd-construction |
| 2026-07-26 | F-PAGES-MACRO-07 | 第二批迁移：迁 8 张产业卡 → macro-industry | 1.121.130 | nbs-fa-investment / nbs-income / nbs-cpi / nbs-pmi / nbs-industrial / nbs-industrial-profit / nbs-ppi / nbs-retail |
| 2026-07-26 | F-PAGES-MACRO-08 | 第二批迁移：迁 1 张贸易卡 → macro-trade | 1.121.130 | nbs-trade |
| 2026-07-27 | F-PAGES-FX-01 | macro-fx 子页从 23 行骨架升级为 8 张汇市卡（safeForex/safeOra/safeUsdMid/safeFxMarket/safeSettle/safeBop/safeIip/safeBopTrade）；全部用 MacroKpiCell；新增 formatForexYi/formatPctDelta/formatDelta/bandFromDelta/safeOraPct 5 个 helper | 1.121.134 | macro-fx 23 → 453 行（+430）；8 data-* 属性 + 8 getter 引用齐全；macroPages 测试 +1 用例（12/12 通过） |
| 2026-07-27 | F-PAGES-RATES-01 | macro-rates 子页从 25 行骨架升级为 6 张利率卡（LPR/MLF/逆回购/Shibor/中债国债/回购定盘 FR/FDR）+ 38 KPI；全部用 MacroKpiCell；新增 formatBpDelta/bandFromBp/bandFromDelta/formatDelta 4 个 helper | 1.121.135 | macro-rates 25 → 390 行（+365）；6 data-* 属性 + 6 getter 引用齐全；macroPages 测试 +1 用例（13/13 通过） |
| 2026-07-27 | F-PAGES-DELETE-01 | dashboard.vue **真删** 15 张宏卡的 HTML + script refs/computed + imports（MLF/OMO/Shibor/国债/FR-FDR/央行金融统计/广东社融/8 张外汇）；迁入 macro-rates 或 macro-fx 子页；macro-fx 新增 2 张卡（pbcFinStats/pbcRegionSf）+ 补 2 个 KPI（HKD/涉外收入） | 1.121.136 | dashboard 15,392 → 14,186 行（-1,206 行 / -7.8%）；子页 KPI +42；预算硬规则收紧到 ≤ 4 宏卡 / ≤ 14.5k 行；15 个 macro 测试断言位置迁移 |
| 2026-07-27 | F-PAGES-DT-01 | 新增 `pages/data-tools/data-tools.vue` 独立页（设置入口式导航）；dashboard 加 21 张派生卡折叠（7 张学校/通勤/行政区划类 + 14 张区情画像/特征溢价/挂牌标签类），通过 `derivedExpanded` ref 控制；新增 `goDataTools` / `toggleDerivedCards` 方法；新增 2 个 dashboard 入口卡（折叠按钮 + 数据工具独立页入口） | 1.121.137 | dashboard.vue 14,186 → 14,239 行（+53 行入口卡 + ref/方法）；首屏默认不渲染 21 张派生卡（v-if false）；pages.json 加 data-tools 路由；5 个新测试用例 |
| 2026-07-27 | F-COMP-KPI-03 | nbs-macro 多期序列精简 6 → 4 v-for（删面积同比/投资同比，保留均价/可售月/销售额同比/资金同比） | 1.121.133 | dashboard 15,404 → 15,392 行（-12）；T-006 完成；gzAffordableProjects 测试断言兼容 |
| 2026-07-27 | F-COMP-KPI-02 | 3 个 macro 子页（macro-region / industry / trade）共 52 KPI 改 MacroKpiCell 组件；macroTrendBand 替换 macroTrendClass；import 同步 | 1.121.132 | 子页合计 1,269 → 1,024 行（-245 行 / -19.3%）；T-003 完成 |
| 2026-07-27 | F-COMP-KPI-01 | MacroKpiCell.vue 单 KPI 单元格组件（label/value/sub/subTrendClass）；dashboard nbs-macro 卡 16 KPI 改用组件；nbs-macro 多期序列精简 14 → 6 块 | 1.121.131 | dashboard 15,555 → 15,404 行；累计两轮 -8.0%；后续 T-001 ~ T-006 |
| 2026-07-26 | F-PAGES-MACRO-09 | 预算硬规则收紧到 ≤ 8 / ≤ 16k；dashboard 16,746 → 15,555 行 | 1.121.130 | overview 14 张 → 1 张（nbsMacro） |
| 2026-07-26 | F-PAGES-MACRO-01 | 宏观 5 子页骨架 + MacroTabNav 共用 tab + 金刚区「宏观」入口改 navigate | 1.121.129 | 本轮仅骨架；下轮按子页分批迁 12 张宏卡（14 → 8） |
| 2026-07-26 | F-PAGES-MACRO-02 | pages.json 注册 macro-rates/fx/industry/region/trade 5 路由 | 1.121.129 | 与 skeleton 同包 |
| 2026-07-26 | F-PAGES-MACRO-03 | tests/macroPages.test.ts 子页骨架 smoke 测试（5 文件存在 + active prop + 路由注册 + 入口 navigate） | 1.121.129 | 锁住：后续迁卡 → 重跑绿 |
| 2026-07-26 | F-PAGES-MACRO-04 | tests/dashboardOverviewBudget.test.ts 硬规则收紧（≤ 14 锁 + 远期 ≤ 8 + ≤ 25k 行） | 1.121.129 | 下轮迁完收紧 |
| 2026-07-26 | F-PAGES-MACRO-05 | docs/DASHBOARD_OVERVIEW_BUDGET.md §2 补 macro-region 子页路由 | 1.121.129 | 消除文档漏洞 |
| 2026-07-26 | F-DASH-11 | 采购经理指数（含建筑业） | 1.121.123 | 临界点50；建筑业≠房价 |
| 2026-07-26 | F-DASH-11 | 海关货物进出口（经 NBS） | 1.121.122 | 海关 WAF；国民经济通稿；≠房价 |
| 2026-07-26 | F-DASH-11 | 国际收支平衡表季报 | 1.121.121 | 经常账户+资本金融；≠房价 |
| 2026-07-26 | F-DASH-11 | 国际投资头寸季报 | 1.121.120 | 资产/负债/净资产；≠房价 |
| 2026-07-26 | F-DASH-11 | 国际收支货物和服务贸易月度 | 1.121.119 | 货/服顺差；≠房价 |
| 2026-07-26 | F-DASH-11 | 官方储备资产分项（黄金/SDR/合计） | 1.121.118 | gfcbzc；≠房价 |
| 2026-07-26 | F-DASH-04 / F-ENTRY-01 | 价格 Tab/金刚区 App 可达 + 验收用例 | 1.121.117 | DASHBOARD_TABS_ACCEPTANCE |
| 2026-07-26 | F-DASH-11 | 汇率中间价扩欧元/港元/日元 | 1.121.116 | RMBQuery 多列；≠房价 |
| 2026-07-26 | F-LIST-01 / F-LIST-03 | 搜索框与详情底栏垂直居中 + 门禁 | 1.121.115 | uiVerticalAlign |
| 2026-07-26 | F-MAP-04 | 地图找房主路径（筛/底栏/详情） | 1.121.97 | 对照贝壳；mapFind |
| 2026-07-26 | F-MAP-03 | 挂牌均价热力可读性（禁黑糊/0k-0k） | 1.121.96 | MAP_ACCEPTANCE + mapMath |
| 2026-07-26 | F-DASH-11 | 美元中间价日度 + 外储 2022-11 补缺 | 1.121.114 | RMBQuery；≠房价 |
| 2026-07-26 | F-DASH-11 | 外汇市场成交概况 + 外储扩至 2022 | 1.121.113 | 月度万亿元；≠房价 |
| 2026-07-26 | F-DASH-11 | 结售汇补涉外收付款；外储数字空格解析 | 1.121.112 | 同通稿扩字段 |
| 2026-07-26 | F-DASH-11 | 银行结售汇月度 + 外储历史扩样 | 1.121.111 | 顺差派生；≠房价 |
| 2026-07-26 | F-DASH-11 | 外管局外汇储备规模 + 库存入口 smoke | 1.121.110 | ≠房价；通稿优先于 XLSX |
| 2026-07-26 | F-LIST-01 / F-DASH-11 | 备案扩样分区；挂牌 cover_url 接线 | 1.121.103 | 封面 CAPTCHA 仍空 |
| 2026-07-26 | F-DASH-11 | 珠海商品房价格备案 HTML 摘要 | 1.121.102 | ≠挂牌/成交/网签/70城 |
| 2026-07-26 | F-LIST-01 / F-DASH-11 | 列表户型筛对齐地图；珠海登记五区回填六季 | 1.121.101 | bedroomBand；60 区行对齐 |
| 2026-07-26 | F-LIST / F-MAP / F-DASH | 对照贝壳整体验收：列表详情地图 + 珠海网签入口 | 1.121.100 | BEIKE_COMPARISON + beikePathGate |
| 2026-07-26 | F-DASH-11 | 珠海不动产登记季报（PNG 合计人工抄录） | 1.121.99 | ≠日更网签；list 脚本查缺口 |
| 2026-07-26 | F-DASH-11 | NBS 住宅施工/新开工/竣工分项 | 1.121.92 | 同源表；含施工占比派生 |
| 2026-07-26 | F-DASH-11 | NBS 到位资金拆分（贷款/定金/按揭/自筹） | 1.121.91 | 同源表；住宅行改展示投资 |
| 2026-07-26 | F-DASH-11 | NBS 住宅分项与个人按揭贷款 | 1.121.90 | 同源表扩展；住宅合同均价派生 |
| 2026-07-26 | F-DASH-11 | NBS 工业生产者价格（PPI，含建材） | 1.121.89 | 购进+非金属矿物制品业；≠房价 |
| 2026-07-26 | F-DASH-11 | NBS 居民消费价格（含居住/房租） | 1.121.88 | 房租≠房价；收入回填2025 |
| 2026-07-26 | F-DASH-11 | 国家统计局全国居民收入消费 | 1.121.87 | 含居住消费；≠房价 |
| 2026-07-26 | F-DASH-11 | NBS 房地产补施工/新开工/竣工 | 1.121.86 | 同源表扩展 |
| 2026-07-26 | F-LIST-01 | 二手房/新房分类 + 筛选别名 + 验收总册 | 1.121.94 | enrich + TEST/FEATURES MD |
| 2026-07-26 | F-DASH-11 | 国家统计局全国固定资产投资 | 1.121.85 | 与广东固投对照；≠房价 |
| 2026-07-26 | F-LIST-01 | 房源关键字筛选 + 首页搜索贯通 | 1.121.84 | pending listing query |
| 2026-07-26 | F-ENTRY-01 | 总览多入口（搜索+频道+金刚区） | 1.121.83 | 见 DASHBOARD_ENTRY_IA |
| 2026-07-26 | F-DASH-11 | 官方宏观卡分组与脚注精简 | 1.121.82 | UI；无新源 |
| 2026-07-26 | F-DASH-11 | 经济运行补常住人口/城镇化 + Q3 | 1.121.81 | 人口多为年报；NBS固投候选 |
| 2026-07-26 | F-DASH-11 | 广东经济运行补人均可支配收入 | 1.121.80 | 住户调查口径；≠房价 |
| 2026-07-26 | F-DASH-11 | 广东经济运行简况（GDP） | 1.121.79 | 仅含 GDP 期次；房开≠房价 |
| 2026-07-26 | F-DASH-11 | 广东建筑业生产运行简况 | 1.121.78 | 产值≠成交均价 |
| 2026-07-26 | F-DASH-11 | 广东固投简况 + RE 统计局累月补齐 | 1.121.77 | 租赁/存量房仍 PNG |
| 2026-07-26 | F-DASH-11 | 广东运行简况多期回填+默认折叠 | 1.121.76 | 含统计局上半年 |
| 2026-07-26 | F-DASH-11 | 省年报折叠 + 深圳2024种子 + 广东运行简况 | 1.121.75 | qtsj 无2024全文 |
| 2026-07-26 | F-DASH-11 | 规上工业企业利润（累计） | 1.121.128 | 滞后约 1 月；≠房价 |
| 2026-07-26 | F-DASH-11 | 规上工业增加值（当月/环比/累计） | 1.121.127 | ≠房价；与 PMI 对照 |
| 2026-07-26 | F-DASH-11 | 回购定盘 FR / 银银间 FDR | 1.121.126 | FDR007 基于 DR；≠房价 |
| 2026-07-26 | F-DASH-11 | Shibor 同业拆放利率 | 1.121.125 | ≠房价；与 LPR/国债收益率对照 |
| 2026-07-26 | F-DASH-11 | 中债国债收益率（关键期限+利差） | 1.121.124 | ≠房价；与 LPR/MLF/逆回购对照 |
| 2026-07-26 | F-DASH-11 | 珠海同月末对照 + 广东全省公积金年报 | 1.121.74 | 省报告无分市表 |
| 2026-07-26 | F-DASH-11 | 珠海公积金动态 + 广州公租房计提补全 | 1.121.73 | 三城公积金齐 |
| 2026-07-26 | F-DASH-11 | 广州公积金年报 + NBS 多期默认折叠 | 1.121.72 | 种子 CSV；CI 刷新 |
| 2026-07-26 | F-DASH-11 | NBS 可售月数多期 + 销售额/投资/资金同比串 | 1.121.71 | 广州公积金站仍不可达 |
| 2026-07-26 | F-DASH-11 | NBS 多期合同均价/可售月数 + 棚改竣工脚注 | 1.121.70 | 累计口径勿环比 |
| 2026-07-26 | F-DASH-11 | 地区社融扩苏浙京沪对照 | 1.121.109 | 同表多省；≠房价 |
| 2026-07-26 | F-DASH-11 | 广东社融占全国派生 + 外储/汇率字段 | 1.121.108 | 占比明示派生；≠房价 |
| 2026-07-26 | F-DASH-11 | 广东地区社融增量 + 金融统计旧期补齐 | 1.121.107 | XLSX 广东行；M2-only 月报 |
| 2026-07-26 | F-DASH-11 | 央行金融统计（社融/M2/住户贷款结构） | 1.121.106 | ≠房价；中长期贷≠按揭成交 |
| 2026-07-26 | F-DASH-11 | 央行 MLF + 公开市场 7 天逆回购 + 库存入口 smoke | 1.121.105 | ≠房价；与 LPR 对照 |
| 2026-07-26 | F-DASH-11 | NBS 合同均价派生 + 70城 Top% 条 + 库存分区占比 | 1.121.69 | 明示非城市均价 |
| 2026-07-26 | （初始化） | 全量首登 | 1.121.45 | 本文件建立 |
| 2026-07-26 | F-SET-02 / F-LIST-01 | REAL 可信度可见 + 区筛选单测 | 1.121.46 | Phase C 部分 |
| 2026-07-26 | F-S70-01 / F-DASH-07 | 70城月更 CI + 新鲜度展示 | 1.121.47 | Phase D |
| 2026-07-26 | F-DASH-11 | NBS 全国房地产多期回填 | 1.121.48 | 1—4/1—5/1—6 |
| 2026-07-26 | F-DASH-11 | 广州库存日更 CI + 新鲜度；NBS 月更 merge | 1.121.49 | Phase E |
| 2026-07-26 | F-DASH-08 / F-SCH-01 | 深圳教育事业概况接入 | 1.121.50 | 普通中小学口径 |
| 2026-07-26 | F-DASH-08 / F-SCH-01 | 珠海基础教育学校数 XLSX 接入 | 1.121.51 | 在校生未公布不伪造 |
| 2026-07-26 | F-DASH-11 | 库存 Top 区占比 + 土地分月样本均价 | 1.121.68 | 展示优化 |
| 2026-07-26 | F-DASH-11 | 土地样本均价/日期 + 计划入市相邻季环比 | 1.121.67 | 住宅占比条；目标脚注同年 |
| 2026-07-26 | F-DASH-11 | 保障房同口径对齐 + 目标进度条 + 公积金派生比率 | 1.121.66 | 不新增源 |
| 2026-07-26 | F-DASH-11 | 深圳公积金年报 + LPR 月更爬虫 | 1.121.65 | 年报正文；PBOC merge |
| 2026-07-26 | F-DASH-11 | 广州保障房筹集计划目标对齐清单进度 | 1.121.64 | 2025 计划 2448；同年回填 |
| 2026-07-26 | F-DASH-11 | 广州保障房任务量目标进度（筹集/竣工） | 1.121.63 | 任务量完成 XLS；非成交 |
| 2026-07-26 | F-DASH-11 | 深圳建设/筹集分项 + 珠海安居业态拆解 | 1.121.62 | 2024 合计断言 |
| 2026-07-26 | F-DASH-11 | 深圳保障房筹集/建成 PDF 汇总接入 | 1.121.61 | pypdf；跳过扫描件 |
| 2026-07-26 | F-DASH-11 | 广州保障房已筹建/已竣工 XLS 汇总接入 | 1.121.60 | 配售型优先；非成交 |
| 2026-07-26 | F-DASH-11 | 珠海安居工程进展 XLS；深圳成交总价仍不可抓 | 1.121.59 | 年内累计；环比同年 |
| 2026-07-26 | F-DASH-11 | 广州土地分月 + 深圳居住用地（起始价）接入；城市标签 store 回退 | 1.121.58 | szggzy `/cms` land-list；pageNum=0 |
| 2026-07-26 | F-DASH-11 | 广州居住用地历史扩样 + 用途门禁；深圳土地暂不可抓 | 1.121.57 | 15 宗；SZ 412/DNS |

---

最后更新：2026-07-27
