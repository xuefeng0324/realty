# 功能交付与验收标准流程（强制）

> 适用：`realty_app` 一切用户可见改动（功能、交互、主题、筛选、外链、OTA 等）。  
> 目的：禁止「只改代码、靠猜测说好了」；功能做完必须有**可执行的验收标准**，并按流程跑通。

## 必读（按顺序）

1. **[FEATURE_QA_PROCESS.md](./FEATURE_QA_PROCESS.md)** — 加功能→验收→测试的**强制 8 步**；UI / 功能 / 逻辑三类 bug 怎么挡  
2. **[FEATURE_CATALOG.md](./FEATURE_CATALOG.md)** — **全部功能**的验收标准与测试流程总目录（改前先搜功能 ID）  
3. 下方「专题」— 横切能力的深挖标准  

参考：本仓库 `AGENTS.md`、`scripts/check.ps1`、uni-app 官网（涉及平台能力时）。

---

## 1. 何时必须走本流程

满足任一条件即必须：

1. 用户可感知的 UI / 交互变化  
2. 跨端能力（主题、外链、权限、原生壳、Tab/导航栏）  
3. 数据展示口径变化（筛选、计数、城市隔离、分页、房价语义）  
4. 发版（`versionCode` +1）  
5. **新增页面 / 新模式 / 新 KPI**（必须先在 CATALOG 登记 ID）

纯注释 / 纯内部重构且用户不可见：可简化，但仍建议跑 type-check + unit。

---

## 2. 标准步骤（摘要；细节以 QA_PROCESS 为准）

| 步 | 动作 |
|----|------|
| A | 对照权威来源（官网 / 竞品 / DATA_SOURCES / CATALOG） |
| B | **先写验收**：更新 CATALOG 条目；需要则写/改专题 ACCEPTANCE |
| C | 克制实现（不夹带无关优化） |
| D | 验证：`check.ps1` + 相关 smoke；结果写入 changelog（禁止猜测） |
| E | bump + README + changelog + `commit.ps1` + AGENTS 五段汇报 |

没有 CATALOG/验收标准 → **不算完成**。

### 验收标准书写模板

见 [FEATURE_QA_PROCESS.md §5](./FEATURE_QA_PROCESS.md)（含 UI/功能/逻辑三类覆盖要求）。

---

## 3. 禁止事项

- 禁止用「我看代码逻辑应该对」代替跑测试  
- 禁止功能已合并但 changelog 无验收节、CATALOG 无登记  
- 禁止把「未跑 E2E」包装成优点  
- 禁止在未对照官网/竞品时，对跨端行为自创一套语义  
- 禁止把挂牌均价标成「成交价」（见房价专题）

---

## 4. 专题与目录

| 文档 | 用途 |
|------|------|
| [FEATURE_QA_PROCESS.md](./FEATURE_QA_PROCESS.md) | 强制流程 + DoD + Bug 分类 |
| [FEATURE_CATALOG.md](./FEATURE_CATALOG.md) | 全功能验收与测试流程 |
| [THEME_ACCEPTANCE.md](./THEME_ACCEPTANCE.md) | 浅色 / 深色 / 跟随系统 |
| [DASHBOARD_FEED_ACCEPTANCE.md](./DASHBOARD_FEED_ACCEPTANCE.md) | 总览长页去分割缝 |
| [HOUSING_PRICE_ACCEPTANCE.md](./HOUSING_PRICE_ACCEPTANCE.md) | 房价三轴（挂牌/网签量/指数） |

---

最后更新：2026-07-26
