# 总览专业 Tab 验收（DASHBOARD_TABS_ACCEPTANCE）

> 功能 ID：**F-DASH-04** · 入口含金刚区「价格」与 `dash-tabs`  
> 总流程：[TEST_ACCEPTANCE.md](./TEST_ACCEPTANCE.md) · [FEATURE_QA_PROCESS.md](./FEATURE_QA_PROCESS.md)

## 0. 合格线

1. 点金刚区「价格」或 Tab「价格画像」后，**可见卡片集合必须变化**（相对概览）。  
2. 过滤在 **App 与 H5** 均生效：依赖页面根 `.page[data-dash-tab]`，**禁止**仅 `document.body`（App 无 document → 表现为「点了没反应」）。  
3. 切换后有可感知反馈：Tab 高亮 + toast「已切换到…」+ 滚到 `#dash-tabs`（金刚区入口时）。  
4. `dash-tabs` 须在首屏工作区附近（首页入口卡之后），不得埋在长页中部导致「点了像没动」。

## 1. 用例矩阵（必须对着测）

### UI（U）

| # | Given | When | Then | 自动化 |
|---|-------|------|------|--------|
| U1 | 总览已加载 | 看首屏下方 | `#dash-tabs` 可见；5 个 Tab 文案含概览/价格画像/学区配套/通勤地铁/地图视图 | unit 源码 + smoke |
| U2 | 默认态 | — | `activeTab=overview`；`.dash-tab--active` 为概览；`.page[data-dash-tab=overview]` | unit + smoke |
| U3 | 任意 Tab | 点「价格画像」 | 该 Tab `--active`；`.page[data-dash-tab=price]` | smoke / unit 接线 |
| U4 | 金刚区 | 点 `[data-home-king=price-tab]` | 同 U3；出现 toast 含「价格画像」；页面滚近 `#dash-tabs` | unit 反馈契约 + smoke |

### 功能（F）

| # | Given | When | Then | 自动化 |
|---|-------|------|------|--------|
| F1 | overview | 切 price | 可见 `.card` 数量 ≠ overview（过滤生效） | smoke_dashboard_tabs |
| F2 | price | 切 school / transit / map / overview | 每次可见集合相对变化；可切回概览 | smoke |
| F3 | App 语义 | 模拟无 document | 仍能通过 `.page[data-dash-tab]` CSS 选择器隐藏无关卡 | unit：源码含 `.page[data-dash-tab` |

### 逻辑（L）

| # | Given data-tab | activeTab | visible? | 自动化 |
|---|----------------|-----------|----------|--------|
| L1 | （空/无） | 任意 | true | `cardVisibleOnDashTab` |
| L2 | `all,price` | school | true（含 all） | 同上 |
| L3 | `overview,price` | price | true | 同上 |
| L4 | `overview,price` | school | false | 同上 |
| L5 | `overview,school` | price | false | 同上 |
| L6 | `overview` | price | false | 同上 |
| L7 | `all,map` | price | true | 同上 |

### 不期望

| # | 现象 |
|---|------|
| X1 | 点「价格」无高亮、无 toast、首屏卡片集合不变（App 历史 bug） |
| X2 | 过滤只写在 `body[data-dash-tab]` 且无 `.page[data-dash-tab]` 同步 |
| X3 | 金刚区 price 的 action 不是 `{ kind:"tab", tab:"price" }` |

## 2. 测试流程（对着本表执行）

```powershell
# L* + U 接线门禁（必须全绿才算本功能验证成功）
npm test -- --run tests/dashboardTabs.test.ts tests/homeEntry.test.ts

# H5 视觉/集合变化（有 dev server 时）
# npm run test:e2e:core 或单独：
# node tests/e2e/smoke_dashboard_tabs.mjs
```

任一条失败 → **先修 bug，再重跑本表**；不得用「源码看起来对」替代失败用例。

## 3. 手工（App 真机）

1. 打开总览，确认 Tab 条在搜索/金刚区下方可见。  
2. 点金刚区「价格」→ toast「已切换到价格画像」；价格画像 Tab 高亮；再点「学区配套」集合再变。  
3. 点 Tab「价格画像」本身同样生效。
