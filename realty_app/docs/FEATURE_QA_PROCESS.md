# 功能交付强制流程：加功能 → 验收 → 测试

> **地位**：本文件是 `realty_app` 新增/改动用户可见能力的**强制流程**。  
> **目录**：全部功能的验收标准与测试流程见 [FEATURE_CATALOG.md](./FEATURE_CATALOG.md)。  
> **总则入口**：[FEATURE_ACCEPTANCE.md](./FEATURE_ACCEPTANCE.md)。

目的：把「UI bug / 功能 bug / 逻辑 bug」挡在合并前，而不是靠用户反馈发现。

---

## 1. 三类 Bug（验收时必须按类覆盖）

| 类型 | 定义 | 典型例子 | 验收怎么抓 |
|------|------|----------|------------|
| **UI** | 看得见但不对：布局、主题、文案、对比度、分割缝、错位、截断 | 浅色仍像深色；长页宽缝；按钮看不清 | 视觉 smoke + 浅/深切换 + 截图对照 |
| **功能** | 点了没反应 / 进不去 / 选了无效 / 外链失败 | 周切换无反馈；筛选不生效；唤起 App 失败 | 手工最短路径 + 交互 smoke |
| **逻辑** | 「看起来有数据」但口径错 / 城市串 / 假成交价 / 空数据当成功 | 挂牌标成成交价；跨城泄漏；0 条爬取仍绿勾 | 单测断言口径 + 源码门禁 + 数据校验 |

任一类型未写进验收标准 → **该功能不算可合并**。

---

## 2. 新增或改功能：固定 8 步（不可跳）

```text
① 对照权威来源（官网 / 竞品 / DATA_SOURCES / 已有 CATALOG 条目）
② 在 FEATURE_CATALOG 登记或更新条目（功能 ID、三类 bug 验收点）
③ 若跨专题：补/改专题 ACCEPTANCE（主题/房价/信息流…）或新建专题 MD
④ 写自动化：unit 优先；涉及交互再补 smoke_*.mjs；纳入 run_suite 的说明写进条目
⑤ 实现代码（克制；不夹带无关「优化」）
⑥ 跑门禁：check.ps1（或 type-check + test）；相关 smoke 真跑并记结果
⑦ bump + changelog「验收标准」节 + README 版本行
⑧ commit.ps1 推送；AGENTS.md 五段汇报
```

**顺序硬约束**：②③ 必须在 ⑤ 之前完成初稿；⑥ 失败禁止 ⑦⑧。

---

## 3. Definition of Done（合并清单）

发版或合并用户可见改动前，作者自检：

- [ ] CATALOG 有对应 **功能 ID**（新建则已追加）
- [ ] 验收覆盖 **UI / 功能 / 逻辑** 至少各 1 条「期望」或「不期望」
- [ ] changelog 写了对照来源 + 验收摘要 + 验证结果（禁止「应该没问题」）
- [ ] `npm run type-check` ✅
- [ ] `npm test` ✅
- [ ] 相关 smoke：✅ 或 ⚠️ 写明未跑原因（无 H5 / 无真机 / 无 Key）
- [ ] 未引入新的「成交价」类误标（见房价三轴）
- [ ] 未扩大改动范围到无关页面

缺一项 → **不算完成**。

---

## 4. 测试金字塔（本仓约定）

| 层 | 工具 | 测什么 | 谁必须有 |
|----|------|--------|----------|
| L0 类型 | `vue-tsc` | 接口/空值 | 每次发版 |
| L1 逻辑 | `vitest` | 口径、聚合、语义、门禁字符串 | 数据/逻辑改动 |
| L2 交互 | `tests/e2e/smoke_*.mjs` | 点击路径、可见文案、主题 | UI/交互改动 |
| L3 真机 | 手工（CATALOG 步骤） | 原生壳、OTA、外链、性能 | 跨端/壳层 |

一键：

```powershell
powershell -File realty_app/scripts/check.ps1 -SkipSmoke   # 无 H5 时
# H5 已起（常见 :5174）：
$env:E2E_BASE_URL="http://127.0.0.1:5174"; npm run test:e2e:core
```

---

## 5. 验收标准最小模板（每条功能）

复制到 CATALOG 或专题 MD：

```markdown
### F-XXXX · <名称>

| 项 | 内容 |
|----|------|
| 入口 | 页面路径 / Tab / 按钮 |
| 风险 | UI / 功能 / 逻辑（可多选） |
| 对照 | 文档或竞品链接 |

**期望**
1. （功能）…
2. （逻辑）…
3. （UI）…

**不期望**
1. …

**自动化**
- unit: `tests/….test.ts`
- smoke: `tests/e2e/….mjs`（是否进 core：是/否）

**手工（≤8 步）**
1. …
通过：…；失败：阻断发版。
```

---

## 6. 对抗式找 Bug（AI 协作约定）

业界常见「多角色辩论」流程（Hunter → Skeptic），本仓落地为：

```text
Hunter：列可达缺陷（竞态、错误口径、脆弱解析、页签漏测）
Skeptic：只保留可复现 / 可写断言的项；证伪即丢弃
Fix：最小修复 + adversarial*.test.ts / smoke 门禁钉死错误行为
```

规则：

- **禁止**把「感觉还有 bug」当成任务；必须写出复现条件或失败断言
- **禁止**把产品预期（如 NBS 全国口径）误报成 bug
- 新增对抗用例放 `tests/adversarial*.test.ts`，命名写明 P0/P1/P2

本仓已用该流程修过：教育卡首屏丢卡、CSV 逗号错列、珠海学年误标（见 v1.121.53）。

---

## 7. 与现有文档关系

| 文档 | 职责 |
|------|------|
| [TEST_ACCEPTANCE.md](./TEST_ACCEPTANCE.md) | **测试验收总册** + 关键路径矩阵 |
| [FEATURES.md](./FEATURES.md) | 功能清单（用户/Agent 索引） |
| **本文件** | 强制流程 + Bug 分类 + DoD + 对抗式找 bug |
| [FEATURE_CATALOG.md](./FEATURE_CATALOG.md) | **全部功能**验收标准与测试流程总表 |
| [FEATURE_ACCEPTANCE.md](./FEATURE_ACCEPTANCE.md) | 简版总则 + 专题索引 |
| [LISTING_FILTER_ACCEPTANCE.md](./LISTING_FILTER_ACCEPTANCE.md) | 房源类型/装修筛选 |
| 专题 `*_ACCEPTANCE.md` | 深挖某一横切能力（主题/房价/信息流…） |
| `changelog/…` | 单次发版的验收快照与验证记录 |

新增横切能力（影响多页）→ **必须**新建或扩展专题 ACCEPTANCE，并在 CATALOG 链过去。  
会清空列表的筛选 → **必须**按 [TEST_ACCEPTANCE.md](./TEST_ACCEPTANCE.md) §3/§4 补路径与单测（禁止只测 mock 字面相等）。

---

## 8. 禁止事项

- 禁止「先上线再补验收」
- 禁止只用截图、不写可重复步骤
- 禁止把 DERIVED / 空爬取结果包装成「数据已更新」
- 禁止在 CATALOG 未登记的情况下合并新 Tab/新模式/新口径
- 禁止 AI/人工用「我看代码应该对」代替门禁结果
- 禁止 Hunter 清单未经 Skeptic 就整批「优化」

---

最后更新：2026-07-26
