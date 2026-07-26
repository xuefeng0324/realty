# 测试与验收总册（TEST_ACCEPTANCE）

> **地位**：`realty_app` 测试 / 验收的**总入口**。  
> 用户或 Agent 在改功能、修 bug、发版前，先读本文件，再按链接下钻。

相关：

| 文档 | 用途 |
|------|------|
| [FEATURES.md](./FEATURES.md) | **功能清单**（用户可读） |
| [FEATURE_CATALOG.md](./FEATURE_CATALOG.md) | 每条功能的验收点 + 自动化映射 |
| [FEATURE_QA_PROCESS.md](./FEATURE_QA_PROCESS.md) | 加功能→验收→测试 **强制 8 步** |
| [FEATURE_ACCEPTANCE.md](./FEATURE_ACCEPTANCE.md) | 总则与专题索引 |
| [LISTING_FILTER_ACCEPTANCE.md](./LISTING_FILTER_ACCEPTANCE.md) | 房源筛选专题（在售/成交/装修等） |

---

## 1. 验收原则（不可破）

1. **有数据字段 ≠ 有筛选语义**：UI 选项必须与 CSV/API 实际取值对齐（见房源「在售」vs「二手房」事故）。
2. **空结果必须可解释**：0 套时说明是哪个条件导致，禁止静默空白。
3. **自动化必须覆盖会清空列表的组合**：在售、成交、装修、区、关键字及至少一组交叉组合。
4. **未跑的测试不得写成已通过**；changelog / AGENTS 汇报写清 ✅ / ❌ / ⚠️ 原因。

---

## 2. 标准测试流程（每次用户可见改动）

```text
L0  npm run type-check
L1  npm test                     # 或针对模块：npm test -- --run tests/xxx.test.ts
L2  （有 H5）相关 smoke_*.mjs
L3  （跨端）真机最短路径手工（CATALOG「手工」节）
DoD 对照 FEATURE_QA_PROCESS §3 勾选
```

一键（推荐）：

```powershell
powershell -File realty_app/scripts/check.ps1 -SkipSmoke   # 无 H5
# H5 已起：
$env:E2E_BASE_URL="http://127.0.0.1:5174"; npm run test:e2e:core
```

---

## 3. 关键路径验收矩阵（最低集）

| 路径 ID | 操作 | 期望 | 自动化 |
|---------|------|------|--------|
| P-HOME-01 | 总览金刚「库存」 | 滚到本市供应卡或 toast | `homeEntry.test.ts` |
| P-LIST-01 | 房源 → 类型「二手房」 | total > 0 | `listingFilterTypeDecorate.test.ts` |
| P-LIST-01b | 房源 → 类型「新房」 | total > 0 | 同上 |
| P-LIST-02 | 房源 → 类型「成交」 | 可 0，空态说明无成交样本 | 同上 + 空态门禁 |
| P-LIST-03 | 房源 → 装修「精装/豪装/普装/毛坯」 | 各自 total > 0 | 同上 |
| P-LIST-04 | 二手房 + 精装 | total > 0 | 同上 |
| P-LIST-05 | 选区 / 关键字 | total ≤ 全市 | `listingFilterDistrict` / `Keyword` |
| P-DET-01 | 详情「去贝壳查看」 | App 优先唤起 | `openExternal.test.ts` |
| P-PRICE-01 | 任意房价文案 | 不出现误标「成交均价」 | `priceSemantics.test.ts` |
| P-MAP-01 | 地图 → 五模式切换 | 各模式 overlay>0 | `smoke_map_controls.mjs` |
| P-MAP-02 | 地图 → 挂牌均价 | 底图可读；图例非 0k-0k；半透明热力 | `mapMath.test.ts` + `smoke_price_heatmap.mjs` |

新增会改变列表/计数的筛选时：**必须新增或扩展本表一行 + 对应 unit**。

---

## 4. 写用例的最低要求

每个会改变「有/无数据」的功能，单元测试至少包含：

1. **正向**：真实种子上选该条件 → 有结果（或文档声明允许 0）  
2. **语义别名**：UI 文案与字段值不一致时的映射（如 在售↔二手房）  
3. **组合**：至少 1 个与其它高频筛选的交叉  
4. **门禁**：页面选项数组与 `listingFilterMatch` 常量一致（防 UI 漏选项）

模板见 [FEATURE_QA_PROCESS.md §5](./FEATURE_QA_PROCESS.md)。

---

## 5. Bug 复盘模板（并入 changelog）

```markdown
### 复盘
- 现象：…
- 根因：UI 选项 / 字段取值 / 别名（选一）
- 修复：…
- 新增用例：tests/….test.ts（列出 it 标题）
- 验收：对照 TEST_ACCEPTANCE 路径 ID …
```

---

最后更新：2026-07-26
