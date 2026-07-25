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

## 1. 总览壳层 `pages/dashboard/dashboard`

### F-DASH-01 · 市场数据工作台（城市/周期/来源/仅本市）

| 项 | 内容 |
|----|------|
| 入口 | 总览顶卡 |
| 风险 | F, L |
| 对照 | 贝壳首页筛选；本仓 cityScoped |

**期望**
1. （F）点城市/周期/来源弹出可选列表并生效  
2. （L）默认「仅本市」时跨城块不可见；「含跨城」后可见  
3. （F）刷新后卡片数字与所选周一致（本周速览类）

**不期望**：周切换无 toast/滚动反馈；跨城默认混进本市。

**自动化**：unit 相关 store/query；smoke: `smoke_topnav_period.mjs`、`smoke_dashboard_tabs.mjs`（未全进 core 则手工补）  
**手工**：广州→深圳→改周期→看「本周速览」数字变化；切「含跨城」再切回。

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

### F-DASH-04 · 专业 Tab（概览/价格/学区/通勤/地图）

| 项 | 内容 |
|----|------|
| 入口 | `dash-tabs` |
| 风险 | F, U |

**期望**：点 Tab 后仅相关卡可见；`data-dash-tab` 过滤正确。  
**不期望**：切到「价格」仍堆满无关卡且无法滚动到目标。  
**自动化**：`smoke_dashboard_tabs.mjs`；core `smoke_dashboard_feature_matrix.mjs`  
**手工**：五 Tab 各点一次，确认标题集合符合矩阵。

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

**期望**：只谈套数/面积/活跃度；周聚合新鲜度跟得上 daily（CI 重建）。  
**不期望**：出现「网签均价 XXX 元/㎡」当官方价。  
**自动化**：unit `dailyWangqian` / `wangqianTrendRanking`；ext `smoke_wangqian_heatmap`  
**手工**：打开网签卡看日期；进网签页核对全市套数。

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

**期望**：列表可点进学校/小区（有 id 时）；城市过滤正确。  
**不期望**：深圳数据出现在广州 Tab 未开跨城时。  
**自动化**：matrix；school_* / hospital smoke；unit school*  
**手工**：学区 Tab 点一条下钻再返回。

---

### F-DASH-09 · 地铁 / 通勤

| 项 | 内容 |
|----|------|
| 入口 | 总览 · 通勤地铁 |
| 风险 | F, L |

**期望**：通勤分钟与 CBD 名合理；规划线可区分状态。  
**自动化**：commute / metro_* smoke；unit metro* / commute  
**手工**：通勤 Tab 看 Top1 可点或有说明。

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

**期望**：数字来自对应 CSV；空则隐藏或空态。  
**自动化**：unit `lprHistory` / `nbsRealEstate` / `gzNewHouseInventory`  
**手工**：核对 LPR 月份与设置说明一致。

---

## 2. 房源 Tab + 详情 + 小区

### F-LIST-01 · 多维筛选与命中计数

| 项 | 内容 |
|----|------|
| 入口 | Tab「房源」 |
| 风险 | F, L, U |

**期望**
1. （F）区/总价/面积等条件应用后列表变化  
2. （L）「共 N 套」与列表一致；分页可加载更多（有数据时）  
3. （U）筛选条可点、可重置

**不期望**：选了区仍显示全区且计数不变。  
**自动化**：page；`smoke_listings.mjs` 等  
**手工**：深圳→选一区→看 N 变小→重置恢复。

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

**期望**：价/面积/小区名展示；DERIVED 有黄标；同小区在售可点。  
**不期望**：无 id 白屏无说明。  
**自动化**：`smoke_full_pages` id=1227；unit 相关  
**手工**：打开 1227，看派生标（若为 DERIVED）。

---

### F-LIST-04 · 外链 / 唤起贝壳·安居客

| 项 | 内容 |
|----|------|
| 入口 | 详情参考来源 |
| 风险 | F |
| 对照 | FEATURE 外链惯例；`openExternal` |

**期望**：ActionSheet 选项清晰；未装 App 时有降级。  
**自动化**：unit `openExternal.test.ts`  
**手工**：真机点「在浏览器/App 打开」看是否唤起或提示。

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
| 对照 | HOUSING_PRICE |

**期望**
1. （F）挂牌热力 / 挂牌均价 / 挂牌点 / POI / 地铁 可切换  
2. （L）均价模式文案为「挂牌均价」，非「成交价」  
3. （U）图例与模式一致

**自动化**：core `smoke_map_controls`；`smoke_price_heatmap`；poi/metro/cluster smoke  
**手工**：五模式各切一次看 legend。

---

### F-MAP-02 · 底图降级与重试

| 项 | 内容 |
|----|------|
| 入口 | 地图加载失败条 |
| 风险 | F, U |

**期望**：慢加载有提示与重试，不整页死。  
**自动化**：map_controls 间接  
**手工**：弱网或禁地图 Key 时看提示（可配置时）。

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

**期望**：刷新成功有反馈；失败保留旧数据。  
**自动化**：unit `dataRefresher`  
**手工**：点刷新看 toast；失败不丢列表。

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
| 对照 | HOUSING_PRICE |

**期望**：排序/切换新建二手生效；洞察不冒充均价。  
**自动化**：page；unit stats70*  
**手工**：切换指标看榜变化。

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
| 总览去缝 | [DASHBOARD_FEED_ACCEPTANCE.md](./DASHBOARD_FEED_ACCEPTANCE.md) | F-DASH-02 |
| 房价三轴 | [HOUSING_PRICE_ACCEPTANCE.md](./HOUSING_PRICE_ACCEPTANCE.md) | F-DASH-03/05/06/07, F-MAP-01, F-X-01, F-S70, F-WQ |

---

## 9. 新增功能登记表（追加区）

> 新功能复制一行模板追加到对应章节，并分配新 ID（`F-<域>-<序号>`）。

| 日期 | ID | 标题 | 发版 version | 备注 |
|------|-----|------|--------------|------|
| 2026-07-26 | （初始化） | 全量首登 | 1.121.45 | 本文件建立 |

---

最后更新：2026-07-26
