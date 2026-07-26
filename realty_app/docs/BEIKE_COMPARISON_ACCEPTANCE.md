# 对照贝壳 / 链家：产品差距与验收矩阵

> 用途：整体过一遍 UI / 功能 / 数据时，用竞品主路径当尺子。  
> 本产品定位是**分析 + 挂牌样本 + 官方量能**，不是完整交易 App；能对标的对齐，不能对标的写清「不做」。

相关：

| 文档 | 范围 |
|------|------|
| [LISTING_DETAIL_ACCEPTANCE.md](./LISTING_DETAIL_ACCEPTANCE.md) | 详情图集/价区/标签/底栏 |
| [LISTING_FILTER_ACCEPTANCE.md](./LISTING_FILTER_ACCEPTANCE.md) | 列表筛选 |
| [MAP_ACCEPTANCE.md](./MAP_ACCEPTANCE.md) | 地图找房 |
| [HOUSING_PRICE_ACCEPTANCE.md](./HOUSING_PRICE_ACCEPTANCE.md) | 挂牌 / 网签量 / 70 城 |
| [TEST_ACCEPTANCE.md](./TEST_ACCEPTANCE.md) | 路径矩阵总册 |

---

## 1. 主路径对照（找房闭环）

| 步骤 | 贝壳 / 链家 | 本产品 | 验收 | 状态 |
|------|-------------|--------|------|------|
| 进地图找房 | 默认地图找房图层 | 默认 `listings`（找房） | MAP F4-1 | ✅ |
| 筛总价/户型 | 顶部芯片 | 地图芯片 | MAP F4-2 | ✅ |
| 点小区出列表 | 底栏房源行 | `data-find-sheet` | MAP F4-3 | ✅ |
| 点房源进详情 | 详情页 | `listing-detail?id=` | MAP F4-4 | ✅ |
| 列表卡片信息 | 总价/单价/户型/标签/图 | 总价大字+单价+室卫+面积+挂牌 pill；**无真图缩略图** | LISTING_FILTER 卡片 U* | 🟡 图集待真源 |
| 详情图集 | 多图轮播 | **空态说明**（不伪造） | LISTING_DETAIL U1–U2 | ✅ 空态 |
| 详情标签 | 近地铁/精装… | `getListingTagLabels` | LISTING_DETAIL U3 | ✅ |
| 底栏去贝壳 | 唤起 App | `openHousingSourceUrl` | F-LIST-04 | ✅ |
| 经纪带看 | 有 | **不做** | — | N/A |

---

## 2. 房价 / 量能对照（禁止误导）

| 竞品常见说法 | 本产品口径 | 验收 |
|--------------|------------|------|
| 「成交均价」日更 | **不提供**官方日成交均价；挂牌均价 / 网签量 / 70 城三轴 | HOUSING_PRICE |
| 深广网签套数 | `daily_wangqian` 日更 | F-DASH-06 |
| 珠海量能 | **无日更**；不动产登记**季报**（PNG 抄录） | F-DASH-11；路径 P-ZH-WQ-01 |
| 地图「城市均价」 | 文案须为「样本小区挂牌均价」，非成交 | MAP 文案门禁 |

### 珠海路径（易回归）

| ID | 操作 | 期望 | 自动化 |
|----|------|------|--------|
| P-ZH-WQ-01 | 总览切珠海 | 日更空态；可见 `data-zh-bdc-registration` | unit + 模板门禁 |
| P-ZH-WQ-02 | 点「政府每日网签」或金刚「网签」 | **不**跳到深圳网签页；滚到季报或 toast | `homeEntry` 锚点解析 |
| P-ZH-WQ-03 | 网签子页选珠海 | 空态说明 + 季报摘要卡 | `wangqian.vue` 门禁 |

---

## 3. 本轮已修问题（2026-07-26 验收过）

| 问题 | 修复 |
|------|------|
| 列表卡片缺单价/户型/贝壳式标签；迷你维度 CSS 掉在 `</style>` 外 | 卡片价区 + pill；CSS 收回 scoped |
| 详情无图集空态；同小区按钮无点击；无价房源被过滤；无 URL 无底栏 | 图集空态；滚动锚点；放宽列表；辅 CTA |
| 地图文案「点小区气泡」与找房图层不符；marker 误开小区 | 文案修正；未知 marker toast |
| 珠海点网签落到深圳；空态仍可点进子页 | 按城跳转/滚季报；无日更去掉误导 foot |
| 频道「网签」在珠海锚点缺失 | `resolveHomeScrollAnchor` → `entry-zh-bdc-registration` |

---

## 4. 仍待（诚实清单）

| 项 | 原因 | 建议 |
|----|------|------|
| 详情/列表真图集 | 链家详情 CAPTCHA；无稳定封面字段 | 仅 REAL 源有 URL 再接 |
| 地图找房户型筛与列表页不一致 | 列表未接室数筛选 | ~~复用 mapFind~~ **v1.121.101 已对齐** |
| 珠海登记历史季分区 | 仅 2026Q2 抄录 | ~~补历史季~~ **v1.121.101 已补 2025Q1–2026Q2** |
| 真 E2E 珠海路径 | 需 H5 | `smoke` 加 P-ZH-WQ-* |

---

最后更新：2026-07-26（v1.121.101）
