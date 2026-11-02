# 行情聚合与旧 Dashboard Tabs 迁移验收

> 当前功能 ID：**F-MKT-01** · v1.122 行情聚合页与旧能力迁移
>
> 历史功能 ID：**F-DASH-04** · 首页专业 Tabs（**v1.123.6 实现已删除**，本文仅保留迁移映射与当前验收）
>
> 总流程：[TEST_ACCEPTANCE.md](./TEST_ACCEPTANCE.md) · [FEATURE_QA_PROCESS.md](./FEATURE_QA_PROCESS.md)

## 0. v1.122 结论

v1.122 将首页收敛为用户入口与市场摘要，原 F-DASH-04 的
`概览 / 价格画像 / 学区配套 / 通勤地铁 / 地图视图` 五个专业 Tabs 不再作为
首页可见导航。当前入口由 F-MKT-01「行情」聚合页接管：

- 原生 TabBar「行情」和首页「行情」入口均进入 `/pages/market/market`；
- 行情页先区分挂牌价、网签量、70 城指数，再按「本地 / 全国 / 宏观 / 工具」
  四类提供二级入口；
- 旧专业卡片的每项能力必须在 `LEGACY_DASHBOARD_MIGRATIONS` 中有唯一去向，
  且该去向必须同时存在于 `MARKET_ENTRIES`。

当前实现的单一事实来源：

- `src/local/navigation.ts`：`MARKET_SECTION_TABS`、`MARKET_ENTRIES`、
  `LEGACY_DASHBOARD_MIGRATIONS`；
- `src/pages/market/market.vue`：行情页的真实可见 UI；
- `src/pages.json`：页面注册与原生五栏配置。

## 1. 历史说明：F-DASH-04（实现已删除）

v1.122 之前，F-DASH-04 使用首页专业 Tabs（`overview / price / school / transit / map`）
控制长页卡片集合：根节点绑定 `.page[data-dash-tab]`，`data-tab` 含当前 Tab 或 `all`
的卡可见，否则被全局 CSS 隐藏。

**v1.123.6 已删除全部实现**，包括：

- `dashboard.vue` 的 `#dash-tabs` 模板条、`activeTab` / `setDashTab` /
  `DASHBOARD_TABS` / `applyTabClass` 与 body 属性同步、`.page[data-dash-tab]`
  过滤 CSS、HeroSlide 的 `tab` 字段与 `heroClick`，以及只服务于旧 Tab 跳转的
  `jumpOverviewGroup` 等概览分组死函数；
- `src/local/dashTabs.ts`（`DashTabKey` / `DASH_TAB_KEYS` /
  `cardVisibleOnDashTab` / `dashTabSwitchFeedback`）；
- `homeEntry.ts` 三个动作联合类型中的 `{ kind: "tab" }` 变体（首页搜索「通勤/地铁」
  改为导航 `/pages/data-tools/data-tools`）；
- 历史测试 `tests/dashboardTabs.test.ts`（price-tab 迁移接线门禁迁入
  `tests/homeEntry.test.ts`）、`tests/e2e/smoke_drill_down.mjs`（旧 5189 端口
  死脚本）与 `buildIntegrity.test.ts` 的 v0.48.0 Tab 断言组；
- 遗留长卡上的 `data-tab` 属性暂保留（已无消费者，后续轮次再清理）。

不得让历史选择器重新成为首页入口（验收 X6 仍然有效）。

## 2. v1.122 迁移映射

下表必须与 `src/local/navigation.ts` 中的 `LEGACY_DASHBOARD_MIGRATIONS`
保持一致。能力名称不得重复，目标页必须是 `MARKET_ENTRIES` 中的可见入口。

| 当前目标页 | 接管的旧 Dashboard 能力 |
|---|---|
| `/pages/wangqian/wangqian` | 政府网签 |
| `/pages/stats70/stats70` | 全国 70 城指数 |
| `/pages/supply/supply` | 库存、供需与土地 |
| `/pages/macro-rates/macro-rates` | LPR + 房贷利率 |
| `/pages/trend-analysis/trend-analysis` | 区级近 8 周房价趋势、区房价指数、区涨幅榜、户型 × 面积、朝向 × 楼层、装修 × 楼龄、总价 × 单价 散点 |
| `/pages/map-analysis/map-analysis` | 区/板块对比、行政区域图 |
| `/pages/data-tools/data-tools` | 小区综合评分、特征画像溢价、标签组合热度、房源新鲜度、高学区评分房源、房源标签云、区情画像、学区 5 维评分、学区溢价榜、教育事业、通勤时长榜、地铁步行通勤、地铁规划受益、生活便利度、商业热度 |

当前共覆盖 **28 项**旧能力、7 个目标页；单测按集合精确相等验证，新增、删除或改名时
必须同时更新映射、行情入口和验收用例。

## 3. 当前验收矩阵

### UI（U）

| # | Given | When | Then | 自动化 |
|---|---|---|---|---|
| U1 | 打开 v1.122 首页 | 查看首屏 | 可见新版首页壳、3 个市场指标、5 个核心入口和推荐内容；旧专业 Tabs 不作为可见入口 | `smoke_dashboard_compact.mjs` |
| U2 | 首页已加载 | 点首页「行情」 | 到达 `/pages/market/market`，不是切换隐藏的 `price` Tab | `smoke_dashboard_compact.mjs`、`smoke_theme_buttons.mjs` |
| U3 | 行情页已加载 | 查看指标区 | 分别显示「挂牌价 / 网签量 / 70 城指数」，不得混写为成交均价 | `smoke_dashboard_feature_matrix.mjs` |
| U4 | 行情页已加载 | 切换分类 | 「本地 / 全国 / 宏观 / 工具」四类均可见且激活态正确 | `smoke_dashboard_feature_matrix.mjs` |
| U5 | 任一行情分类 | 查看入口列表 | 当前共 11 个迁移入口，标题与分类一致，不能依赖隐藏旧 DOM | `smoke_dashboard_feature_matrix.mjs` |

### 功能（F）

| # | Given | When | Then | 自动化 |
|---|---|---|---|---|
| F1 | 五栏配置 | 点原生「行情」 | 使用 `switchTab` 到达 `/pages/market/market` | `navigation.test.ts`、`smoke_full_interactions.mjs` |
| F2 | `MARKET_SECTION_TABS` | 遍历四类 | 每类至少一个 `MARKET_ENTRIES` 入口 | `navigation.test.ts` |
| F3 | `MARKET_ENTRIES` | 校验路由 | 每个目标都在 `pages.json` 注册，行情页本身也已注册 | `navigation.test.ts`、`smoke_full_pages.mjs` |
| F4 | 旧能力清单 | 展平迁移映射 | 28 项能力无重复、无缺失，集合与测试基线完全一致 | `navigation.test.ts` |
| F5 | 每组迁移 | 检查目标页 | 目标页必须同时存在于 `MARKET_ENTRIES`，避免只有代码映射而没有用户入口 | `navigation.test.ts` |
| F6 | 行情「工具」 | 点「数据工具」 | 可到达 `/pages/data-tools/data-tools` | `smoke_dashboard_compact.mjs` |

### 逻辑与口径（L）

| # | 规则 | 自动化 |
|---|---|---|
| L1 | `LEGACY_DASHBOARD_MIGRATIONS` 的能力名全局唯一 | `navigation.test.ts` |
| L2 | 映射能力集合精确等于 28 项验收基线 | `navigation.test.ts` |
| L3 | 四个行情分类均非空 | `navigation.test.ts` |
| L4 | 挂牌价、网签量、70 城指数在 UI 中分开呈现 | `smoke_dashboard_feature_matrix.mjs` |
| L5 | 旧 `price-tab` 只能迁往行情一级 Tab（v1.123.6 起 `{kind:'tab'}` 动作类型已删除） | `homeEntry.test.ts` |

## 4. 不期望

| # | 现象 |
|---|---|
| X1 | 把隐藏的旧 `.card[data-tab]` 数量或 `[data-home-channel]` 当成 v1.122 当前 UI 通过证据 |
| X2 | 首页「行情」仍切旧 Tab 状态，而不是进入 `/pages/market/market`（v1.123.6 起 `{kind:'tab'}` 已从类型层面移除） |
| X3 | `LEGACY_DASHBOARD_MIGRATIONS` 中存在能力，但其目标不在 `MARKET_ENTRIES`，用户实际不可达 |
| X4 | 同一旧能力被映射到多个目标，或旧卡片能力没有迁移记录 |
| X5 | 将挂牌价、网签量或 70 城指数标成同一类“成交均价” |
| X6 | 恢复旧专业 Tabs 作为首页第二套导航，造成五栏 IA 与长页工作台并存 |
| X7 | 用历史 `smoke_dashboard_tabs.mjs`（已删除）的结果替代当前行情页 E2E |

## 5. 自动化验证

### 单元与源码契约

```powershell
npx vitest run tests/navigation.test.ts tests/homeEntry.test.ts
```

- `tests/navigation.test.ts`：当前五栏、22 个页面、行情四分类、入口注册和 28 项迁移映射的主门禁。
- `tests/homeEntry.test.ts`：旧价格入口迁往行情一级 Tab 的接线门禁（v1.123.6 起承接原 `dashboardTabs.test.ts`）。

### 当前 E2E

在 H5 dev server 已启动时执行：

```powershell
node tests/e2e/smoke_dashboard_compact.mjs
node tests/e2e/smoke_dashboard_feature_matrix.mjs
node tests/e2e/smoke_theme_buttons.mjs
node tests/e2e/smoke_full_interactions.mjs
node tests/e2e/smoke_full_pages.mjs
```

对应范围：

- `smoke_dashboard_compact.mjs`：新版首页、首页行情入口、行情「工具」到数据工具闭环；
- `smoke_dashboard_feature_matrix.mjs`：3 类核心口径、4 个分类、11 个真实入口；
- `smoke_theme_buttons.mjs`：主题切换后原生五栏与首页行情入口仍可用；
- `smoke_full_interactions.mjs`：五栏、找房、详情、地图、我的、行情的跨页闭环；
- `smoke_full_pages.mjs`：22 个页面可加载且无 console error。

也可运行 core 套件：

```powershell
npm run test:e2e:core
```

## 6. 手工验收（App 真机）

1. 打开首页，确认首屏只有新版用户入口；不要以隐藏旧专业 Tabs 是否存在判断结果。
2. 分别从首页「行情」和原生 TabBar「行情」进入，确认都到达行情聚合页。
3. 核对挂牌价、网签量、70 城指数三种口径分开展示。
4. 依次切换「本地 / 全国 / 宏观 / 工具」，确认每类入口可见且点击可到真实页面。
5. 至少抽查政府网签、70 城、供需、利率、趋势、行政区地图、数据工具 7 个迁移目标。
6. 在浅色、深色主题各重复一次首页 → 行情 → 二级页返回流程，确认原生 TabBar 状态正确。

任一当前验收点失败时，应先修复当前入口、迁移映射或目标页；不得通过恢复旧首页 Tabs、
点击隐藏 DOM 或放宽能力集合来绕过失败。
