# 功能清单（FEATURES）

> 面向：**产品 / 用户 / Agent** 快速知道「App 能干什么」。  
> 验收细节与自动化映射见 [FEATURE_CATALOG.md](./FEATURE_CATALOG.md)。  
> 测试流程总入口：[TEST_ACCEPTANCE.md](./TEST_ACCEPTANCE.md)。

房价口径（强制）：**挂牌价 / 网签量 / 70城指数** 三轴分立，禁止把挂牌写成「成交均价」。详见 [HOUSING_PRICE_ACCEPTANCE.md](./HOUSING_PRICE_ACCEPTANCE.md)。

---

## 1. 总览（Dashboard）

| 能力 | 说明 | 功能 ID |
|------|------|---------|
| 多入口 | 城市 + 搜索 + 频道 + 金刚区 | F-ENTRY-01 |
| 今日要点 | 本市挂牌/指数等首屏速览 | F-DASH-* |
| 70城指数卡 | 全国指数入口 + 本市读数 | F-DASH / F-STAT |
| 政府网签 | 深广日度网签量（非均价） | F-WQ |
| 官方宏观 | NBS / 广东统计等公开指标 | F-DASH-11 等 |
| 供需/库存 | 广州可售、深圳计划入市等（按城） | F-DASH |
| 土地 | 广/深居住用地成交样本 | F-DASH |
| 学区/通勤/便利度等榜 | 派生排行与下钻 | 见 CATALOG trend/map |

---

## 2. 房源（Listing）

| 能力 | 说明 | 功能 ID |
|------|------|---------|
| 多维筛选 | 区、总价、面积、**类型(在售/成交)**、**装修**、关键字、评分 | F-LIST-01 |
| 命中计数 | 「共 N 套」与列表一致 | F-LIST-01 |
| 洞察卡 | 流动性 / 标签横评 / 性价比等 | F-LIST-02 |
| 详情 | 价区、维度分、同小区、周边 POI | F-LIST-03 |
| 外链唤起 | 去贝壳/安居客 App（优先于浏览器） | F-LIST-04 |

**类型语义（重要）**

- **二手房** = 二手挂牌（含链家 REAL + 派生二手样本）  
- **新房** = 新盘/期房派生样本（参考链指向贝壳 loupan）  
- **成交** = 成交样本；当前种子库通常无此类行，允许 0 套但须有空态说明  

装修选项须覆盖样本高频：精装 / 豪装 / 普装 / 简装 / 毛坯。详见 [LISTING_FILTER_ACCEPTANCE.md](./LISTING_FILTER_ACCEPTANCE.md)。

---

## 3. 学校 / 地图 / 设置

| 模块 | 能力摘要 |
|------|----------|
| 学校 | 列表检索、维度评分、与房源关联 |
| 地图 | 挂牌点 / 热力 / POI 等模式 |
| 设置 | 主题（浅/深/跟随系统，见 [THEME_ACCEPTANCE.md](./THEME_ACCEPTANCE.md)）、关于、检查更新 / OTA |
| 网签子页 | 深广政府网签明细 |

---

## 4. 数据与可信度

| 能力 | 说明 |
|------|------|
| REAL / DERIVED | 真实挂牌 vs 派生样本黄标 |
| 快照 / CSV | `static/seed` + 爬虫脚本；刷新见设置或启动加载 |
| 口径脚注 | 宏观/土地/保障房等卡片脚注「≠房价均价」 |

数据源总表：[DATA_SOURCES.md](./DATA_SOURCES.md)（若路径变更以仓库内实际文件为准）。

---

## 5. 维护约定

- 新用户可见能力：先登记 CATALOG 功能 ID，再改代码（[FEATURE_QA_PROCESS.md](./FEATURE_QA_PROCESS.md)）。  
- 本文件只做**索引级**描述；细则以 CATALOG + 专题 ACCEPTANCE 为准。

最后更新：2026-07-26
