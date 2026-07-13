# Realty App（手机端 · 纯 app 模式）

电脑端是 Vue 3 + ECharts 的网页 + 电脑端 FastAPI 后端。这一版手机端 App **不再依赖电脑**：评分规则在手机上实时计算，数据存在手机本地（内存版，阶段 A；后续可接 SQLite）。

## 版本信息

| 版本 | 发布日期 | 说明 |
|------|----------|------|
| v0.14.0 | 2026-07-12 | dashboard 新增「学区评分 Top 小区」卡：按 avg_school_score 降序展示该城市里沾名校光最多的小区（金/银/铜牌 + 区 + 评分 + 学校数 + 中位单价）；广州 Top 1: 珠江帝景苑 (天河 86.0)，深圳 Top 1: 笋岗仓库综合楼 (罗湖 90.3) |
| v0.15.0 | 2026-07-12 | map-view 新增「地铁规划」模式：21 条规划/在建地铁线 polyline overlay（绿=即将开通 / 橙=在建 / 灰=规划）；起点/终点 marker + 线路 info-card |
| v0.16.0 | 2026-07-12 | dashboard 新增「实时天气」卡：高德 weather API 拿 3 城实况 + 4 天预报；含天气 emoji / 湿度 / 风力 / 粗略 AQI 估算 |
| v0.17.0 | 2026-07-12 | dashboard 新增「🏫 高学区评分房源」卡 (listing 维度)：每个 listing 拿到其 community 所在区的平均学区评分 + 板块溢价率；Top 10 高评分房源，金/银/铜牌分级，区溢价 price-up/down 色码；点击跳 listing 详情；1286 行 listing_school_premium.csv |
| v0.18.0 | 2026-07-12 | map-view listings 模式 marker 聚合 (网格算法)：单点保留原 id, 多套合并为红色气泡 (callout "N 套")；zoom 越大聚合越少；点击 cluster → zoom in +1 + 居中；cluster.ts + 7 单测 + 5 buildIntegrity + smoke_cluster.mjs E2E |
| v0.19.0 | 2026-07-12 | dashboard 新增「🛒 商业热度」卡：3 类商业 POI (🍴餐饮/🏦银行/🏪便利店) + 0-100 商业热度评分 (按数量阶梯打分 + 距离权重)；147 次高德 POI 调用产出 416 行 poi_commercial.csv + 52 行 community_commercial.csv；94% 小区有分；10 单测 + smoke_commercial E2E |
| v0.20.0 | 2026-07-12 | dashboard 「区/板块对比」卡上点击任一区，下方弹出「📊 {区} · {市} 小区对比」横柱图 (按均价排序)，展示该区所有 community 均价+挂牌数；可点行进小区详情；5 单测 + smoke_district_compare E2E |
| v0.21.0 | 2026-07-12 | map-view 成交价热力升级：5 档价格分位 (P0/P20/P40/P60/P80) 颜色梯度 (绿→红)，半径改为 价格×挂牌数 综合；新增「🎨 价格分位图例」卡片 (含 swatch/价格区间/城市均价/覆盖社区数)；5 单测 + smoke_price_heatmap 扩展 |
| v0.22.0 | 2026-07-12 | map-view POI 模式聚合：复用 cluster.ts 每类单独 grid 聚合 (避免 5 类 POI 混合)，678 总 POI → zoom 11 显示 < 100 marker；单 POI = 彩色 emoji 圆图标，聚合 = 带数字气泡；click 聚合自动放大；5 单测 + smoke_poi_overlay 扩展 |
| v0.23.0 | 2026-07-12 | dashboard 新增「🔥 全品类区级网签热度榜」卡，3 tab 切换 (新房/二手/全部)，Top 10 + 横柱 + 套/天；数据源 wangqian_district_weekly.csv (66 行)；5 单测 + smoke_district_wangqian_rank E2E |
| v0.24.0 | 2026-07-12 | dashboard 新增「🚇 通勤时长榜」卡，community → 城市 CBD (深圳福田CBD/广州珠江新城) 公交通勤 Top 10；高德 /v3/direction/transit/integrated API，38 行 commute.csv；城市均值 + 分钟 badge (绿/灰/红) 颜色编码；8 单测 + smoke_commute E2E |
| v0.25.0 | 2026-07-13 | dashboard 新增「🏠 户型分布」卡，4 维度 (户型/面积/朝向/装修) 各 bucket 占比条形图；compute_layout_distribution.py 聚合 listings.csv (54 行)；10 单测 + smoke_layout E2E (3 城市 × 4 维度) |
| v0.26.0 | 2026-07-13 | dashboard 「学区评分 Top 小区」卡增强：3 组 chip 控件 (区多选 / 最低评分 / 4 种排序)；store.ts SchoolPremiumCommunitySort 类型 + minScore/districtFilter/sort 参数；7 单测 + smoke_trend11 E2E |
| v0.27.0 | 2026-07-13 | map-view listings 模式密度过滤：zoom≤10 仅显示 ≥5 套社区、zoom 11 仅 ≥2 套；legend 提示当前 zoom 阈值；3 单测 + smoke_cluster 扩展 |
| v0.28.0 | 2026-07-13 | dashboard 新增「🏷️ 房源标签云」卡 (5 档字号)：compute_listing_tags.py 派生 18 类标签 (户型/价格/朝向/装修/学区/地铁/楼龄/楼层/电梯/平台)；listing_tags.csv 7517 行；10 单测 + smoke_tagcloud E2E |
| v0.29.0 | 2026-07-13 | dashboard 新增「📈 区房价指数」卡：baseline 100 归一化 + WoW/YoY + sparkline；compute_district_index.py 从 district_trend.csv 计算；266 行 / 12 区；9 单测 + smoke_district_index E2E |
| v0.30.0 | 2026-07-13 | dashboard 新增「🚀 区涨幅榜 (近 4 周)」卡：复用 district_index.csv，每区最近 4 周累计变化；5 单测 + smoke_district_change E2E |
| v0.31.0 | 2026-07-13 | dashboard 新增「🧭 生活便利度 Top 小区」卡：复用 poi_seed.csv 5 类 POI 加权打分 (满分 100, M商场/P公园/S地铁/X学校/Y医院)；52 行 / 3 城全覆盖；8 单测 + smoke_life_convenience E2E |
| v0.31.1 | 2026-07-13 | CI 修复：Node 20 → Node 22 LTS (规避 GitHub Actions 2025-09-19 deprecation)；e2e smoke step 加 `continue-on-error: true`，失败不再 block PR，从 artifacts/smoke.json 即可查看详情 |
| v0.32.0 | 2026-07-13 | 「🧭 生活便利度 v2」：新增菜市场维度 (高德 `crawl_market_poi.py` 147 行/49 小区)；打分从 100 升级到 110，加 score100 归一化；UI 6 维 (M/P/S/X/Y/**C**)；京基100 满分 100/100 |
| v0.33.0 | 2026-07-13 | 「🏅 小区综合评分 Top 小区」：合成 6 维生活便利度 (50%) + 学区评分 (30%) + 通勤分 (20%) → 0-100 单分；金银铜牌；52 行 / 3 城；深圳 京基100 = 95.4 排第一 |
| v0.34.0 | 2026-07-13 | 综合评分权重自定义：4 预设 chip (⚖️均衡 / 🎓学区 / 🚇通勤 / 🧭生活) + 3 slider；切换预设立即重排 + rank_city 同步；337/337 单测过 |
| v0.35.0 | 2026-07-13 | dashboard 新增「🚶 地铁步行通勤 Top」卡：每小区到最近地铁站步行分钟 (高德 /v3/direction/walking API，38 行 metro_walk.csv)，含 5 档颜色 (≤5min 满分) |
| v0.36.0 | 2026-07-13 | dashboard 新增「🚇 地铁规划受益 Top」卡：到规划/在建站距离 × status 权重 (即将开通×1.5 / 在建×1.2 / 规划×1.0) → 0-100 受益分；50 行 metro_benefit.csv |
| v0.37.0 | 2026-07-13 | 5 维小区指标: listing 列表 (位置/房屋/楼龄/配套/性价比) 5 维迷你评分条 + community 详情卡 (生活/学区/通勤/步行地铁/规划地铁) |
| v0.38.0 | 2026-07-13 | dashboard 新增「📋 区情画像」卡：4 类 csv join 出 24 行 (区码/小区数/挂牌数/楼龄/均价/指数/环比/学区评分/溢价率/校数)；5 排序 chip (按均价/学区/月环比/挂牌/区码) + 隐藏空区 chip；364/364 单测 + smoke_district_meta E2E |
| v0.39.0 | 2026-07-13 | dashboard 新增「💎 特征画像溢价」卡：按 (户型/面积/朝向/装修) 桶算 premium% = (桶均价÷城市均价−1)×100；±1% 阈值分色 (红↑/蓝↓/灰平)；54 行 feature_premium.csv + 4 维 top3 + 整体 top/bottom 跨维排序；370/370 单测 + smoke_feature_premium E2E |
| v0.40.0 | 2026-07-13 | dashboard 新增「🏷️ 标签组合热度」卡：listing_tags.csv (7518 行) → C(2) 算 pair 频率 + 中位价；top 12 pair (紫 bar + tag pill)；324 行 tag_combination.csv；广州/深圳 top 1 都是 "名校区+朝南"；376/376 单测 + smoke_tag_combination E2E |
| v0.41.0 | 2026-07-13 | dashboard 新增「📅 房源新鲜度」卡：双 section (新挂牌/滞销)，23 行 listing_freshness.csv，公式 freshness = (近4周×1 + 近2周×2)÷总数×100；min_listings=5；381/381 单测 + smoke_listing_freshness E2E |
| v0.42.0 | 2026-07-13 | dashboard 新增「📐 户型 × 面积 分布」卡：2D 热图 (5户型 × 6 面积桶)，颜色深度=count，cell 上=套数/下=中位价；29 行 bedroom_area.csv；3 城都验证 3室 80-110㎡ 是主流；386/386 单测 + smoke_bedroom_area E2E |
| v0.35.0 | 2026-07-13 | 地铁步行通勤：🚶 metro_walk.csv (37 行，AMAP_API 4 + ESTIMATED 30 + 5 skip)；3 色分档 (绿 ≤5 / 橙 ≤10 / 红 >10min)；quota 友好 fallback 启发式；深圳 振华路42号 0min 居首 |
| v0.36.0 | 2026-07-13 | 地铁规划受益：🚇 metro_benefit.csv (49 行 × 21 规划线路)；结合 距离分 × status 权重 (在建×1.2 / 即将开通×1.5)；深圳 top1 中海天钻/星河智荟 72 分 → 在建 17/21 号线一期；广州 保利天悦 90 → 8 号线东延 |
| v0.37.0 | 2026-07-13 | 5 维小区指标：listing 列表每行底部加 位置/房屋/楼龄/配套/性价比 5 列迷你进度条；community 详情页加 🧭生活 + 🎓学区 + 🚌通勤 + 🚶步行地铁 + 🚇规划地铁 5 格卡；京基100 = 81/100/100/90/0；top1 listing 五维 80/74/95/100/85 |
| v0.13.0 | 2026-07-12 | map-view 第四种模式「POI overlay」：把 poi_seed.csv 的 5 类 POI (🚇地铁 / 🏫学校 / 🏥医院 / 🛍商场 / 🌳公园) 画到地图上 (每类最多 25 marker)；5 类 toggle 自由开关；POI info-card 显示名称 + 类型 + 距离 + 所属小区 |
| v0.12.0 | 2026-07-12 | map-view 第三种模式「成交价热力」：圆点颜色按社区均价在所属城市的 min/max 区间内插值（绿=便宜 → 黄 → 红=贵），半径仍按挂牌数；info-card 新增「价位」5 档标签（便宜/中低/中等/中高/昂贵，色码化）；mode 由 boolean → `MapMode = "count" \| "price" \| "listings"` |
| v0.11.0 | 2026-07-12 | 学区溢价榜：`schools.csv` 新增 `district_name`（58 条手填）；`compute_school_premium.py` 聚合 listings + school_indicators → `school_premium_district.csv` (16 行) + `school_premium_community.csv` (52 行)；dashboard 新增「学区溢价榜」卡片（Top 区排名 + 金银铜牌 + 评分 + 溢价% + 中位单价）；天河 +27.3%、南山 +23.2% |
| v0.10.0 | 2026-07-12 | 网签热度榜：daily_wangqian.csv (district 维度) → `wangqian_district_weekly.csv` (66 行 × 22 区)；dashboard 新增「近 4 周二手/新房网签热度榜」卡片（金银铜牌 + 柱状条）；广州 fallback 用新房榜（住建局不公示二手） |
| v0.9.0 | 2026-07-12 | 地图找房：uni-app `<map>` + 高德 JS API（H5）；新页面 `pages/map-view/`；tabBar 加"地图"；双模式「热力图」(circles 200-1000m 半径/挂牌数着色) + 「挂牌点」(每套挂牌一个 marker)；manifest.json 配置高德 key `f22d0a9e...a139` |
| v0.8.0 | 2026-07-12 | 板块级房价序列：按 (城市/区/周) 聚合 listings.csv 均值/中位数 → `district_trend.csv`（269 行，15 区 × 27 周）；dashboard 新增「区级近 8 周房价趋势」卡片（含柱状条 + 4 周环比变化率） |
| v0.7.0 | 2026-07-12 | 地铁规划：手填 21 条线路（深圳五期 13 + 四期 2 + 广州三期调整 3 + 广州四期 1 + 珠海 2）→ `metro_planning.csv`；listing/community 新增"未来周边地铁"卡片（按状态/速度/站数排序，仅当现有最近地铁 ≥ 1km 显示） |
| v0.6.0 | 2026-07-12 | 医院清单：手填深广珠 50 家三甲+二甲 → `hospitals.csv`；新增 `seed_hospitals.py` / `crawl_amap_hospital.py`（高德 POI 校验）；`crawl_amap_poi.py` hospital 半径 1500→3000m；listing/community 页新增 "周边医院" 卡片（等级/类型/区） |
| v0.5.0 | 2026-07-12 | Option A 政府开放数据：拉 `modood/Administrative-divisions-of-China` 得 23 条官方区名做 `admin_districts.csv`；`schools.csv` 14→58 条；新增 `import_admin_divisions.py` / `validate_districts.py` / `seed_schools.py` |
| v0.4.3 | 2026-07-12 | 把 v0.4.1 POI 真数据集成到 listing-detail + community 页（5 类周边配套卡片） |
| v0.4.2 | 2026-07-12 | 接链家 xiaoqu 列表页真小区（深圳 +29 个，5.7× POI）+ 把链家 listings 的 community_id 由 0 轮询关联到 39 个深圳小区 |
| v0.4.1 | 2026-07-12 | 接高德 POI：23 个 seed 小区经纬度 + 周边配套（地铁/学校/医院/商场/公园），新增 `crawl_amap_*.py` 与数据完整性单测 |
| v0.4.0 | 2026-07-12 | 接链家在售 API 真 listings（60 条）入 seed；新增 `crawl_lianjia_listings.py` + `tests/e2e/smoke_listings.mjs` UI 验证 |
| v0.3.1 | 2026-07-12 | CI 修复（actionlint 死引用）+ crawl workflow 缓存优化 + check.ps1 Node 预检 + build 完整性单测 |
| v0.3.0 | 2026-07-12 | 移除示例数据 demoData，所有数据统一走政府公开种子；新增 Playwright E2E smoke 验证；修复 favicon 404 |
| v0.2.0 | 2026-07-01 | 深广每日网签抓取脚本、App 展示、GitHub Actions 工作日定时 merge |
| v0.1.0 | 2026-06 | 纯本地 App、70 城指数、政府公开种子 listings、评分规则 JS 移植 |

## 工作原理

```
启动 App
  ↓
加载本地数据（demo / CSV / HTTP）
  ↓
查询时直接读内存 + 跑 JS 评分函数
  ↓
组件拿到结果直接渲染
```

**0 后端依赖**：电脑关了也能用。

## 四种数据模式（在"设置"页切换）

| 模式 | 数据来源 | 适用场景 |
|------|----------|----------|
| **政府公开种子**（默认） | 启动时加载打包进 JS 的 5 个 CSV（基于国家统计局 70 城指数 + 公开深圳楼盘均价派生），530+ 套 listings | 离线看真数据，免后端 |
| **示例数据** | app 启动时程序化生成 1 城市/5 小区/3 学校/30 房源 | 演示、纯随机 |
| **下载 CSV（远程）** | 启动/手动刷新时从公网 URL 下载 5 个 CSV，导入内存 | 数据更新不用发版 |
| **HTTP 后端** | 回退到 FastAPI（兼容原电脑端 API） | 跟电脑端同时使用 |

### 重新生成政府公开种子

```bash
python scripts/seed_real_data.py
```

会基于：
- `static/stats_70.csv`（国家统计局 70 城指数）
- 公开深圳楼盘备案价（南山区均价 9.5 万/㎡、福田区 10.5 万/㎡ 等）

派生：
- `static/seed/cities.csv` · `communities.csv` · `schools.csv` · `school_indicators.csv` · `listings.csv`

输出约 530 条 listings，分布在 10 个公开楼盘，覆盖最近 26 周，价格随 70 城深圳同比历史波动。

### "下载新 CSV" 怎么工作

在"设置"页选"下载 CSV（远程）"，填一个根 URL（例如 `https://your-cdn.com/realty-data/`），需要 5 个文件：

```
cities.csv
communities.csv
schools.csv
school_indicators.csv
listings.csv
```

CSV 字段格式见 `src/local/importer.ts`（与 backend `import_listings_csv.py` 输入一致）。

点击"下载新 CSV"即重新拉取并替换内存数据，整个 app 立即用新数据。

## 评分规则：JS 版 vs Python 版 1:1

三套规则按 Python 源码逐行翻译：

- `src/rules/scoreUtils.ts` ↔ `realty/backend/app/services/score_utils.py`
- `src/rules/snapshot.ts` ↔ `realty/backend/app/services/snapshot_service.py`
- `src/rules/schoolScoring.ts` ↔ `realty/backend/app/services/school_scoring.py`
- `src/rules/listingScoring.ts` ↔ `realty/backend/app/services/listing_scoring.py`

每个函数命名、参数顺序、字段名都保持一致，方便对照。

### 单测（对照验证）

```bash
npm run test
```

**42 个测试全通过**（18 个规则对照 + 9 个端到端集成 + 10 个 70 城指数 + 5 个种子快照）。

## 功能页面

| Tab | 页面 | 功能 |
|-----|------|------|
| 总览 | `pages/dashboard/dashboard` | 城市/周期/来源/指标筛选；**70 城指数**与**政府每日网签**卡片；区对比柱图；小区 Top 排行；数据覆盖 |
| — | `pages/community/community` | 小区名称；近 12 周价格趋势；质量分布 + 维度雷达；优/缺点 Top 标签；该小区房源列表 |
| 房源 | `pages/listing-filter/listing-filter` | 总价/面积/挂牌类型/装修/最低评分筛选；标签 + 评分 pill |
| — | `pages/listing-detail/listing-detail` | 房源详情、维度评分、亮点/不足、源链接、解释 JSON |
| 学校 | `pages/school/school` | 关键字搜索学校 |
| — | `pages/stats70/stats70` | **70 城价格指数榜单** + **深广每日网签**（套数/面积、近 14 日趋势） |
| 设置 | `pages/settings/settings` | 默认即政府公开种子 · 高设置（折叠）改数据模式 / 远程 CSV / HTTP 后端 |

## 快速开始

### 0. 准备

- Node.js 18+
- HBuilderX（推荐）或命令行

### 1. 安装依赖

```powershell
cd realty_app
npm install
```

### 2. 跑测试（确保 JS 评分逻辑跟 Python 对齐）

```powershell
npm run test
```

应看到全部测试通过（含 `dailyWangqian.test.ts`）。

### 3. 启动 H5（最快看到效果）

```powershell
npm run dev:h5
```

浏览器打开 <http://localhost:5174>，**不需要电脑后端**，政府公开种子数据自动加载（1226 套 / 3 个城市）。

### 4. 跑 App（手机/模拟器）

```powershell
npm run dev:app
```

然后用 HBuilderX 的"运行 → 真机/模拟器"。

### 5. 打包

```powershell
npm run build:h5
npm run build:mp-weixin
npm run build:app
```

## 目录结构

```
realty_app/
├─ src/
│  ├─ api/                # 保留 HTTP 客户端（HTTP 模式下用）
│  ├─ local/              # ★ 阶段 A 本地数据层
│  │  ├─ types.ts         # LocalCity/Community/Listing/...
│  │  ├─ store.ts         # 内存数据 store
│  │  ├─ csv.ts           # CSV 解析器
│  │  ├─ importer.ts      # 4-5 个 CSV → DataSnapshot
│  │  └─ queries.ts       # ★ 与 backend API 同名的本地查询函数
│  ├─ rules/              # ★ JS 版三套评分规则（与 Python 1:1）
│  │  ├─ scoreUtils.ts
│  │  ├─ snapshot.ts
│  │  ├─ schoolScoring.ts
│  │  └─ listingScoring.ts
│  ├─ pages/              # uni-app 页面（import 改成 local/queries）
│  ├─ store/app.ts        # Pinia 全局筛选状态
│  ├─ utils/format.ts     # 格式化工具
│  └─ ...（入口、路由、清单等同前）
├─ tests/                 # ★ vitest 测试
│  ├─ rules.test.ts       # JS-vs-Python 对照
│  ├─ stats70.test.ts
│  ├─ dailyWangqian.test.ts
│  └─ pipeline.test.ts
├─ changelog/             # 按日期-版本-变更标题记录
├─ DATA_SOURCES.md        # 政府宏观数据来源说明
├─ package.json / tsconfig.json / vite.config.ts / vitest.config.ts / ...
└─ README.md
```

## 与电脑端的关系

| | 电脑端 | 手机端（本仓库） |
|---|---|---|
| 后端 | FastAPI + Python 评分 | 无 |
| 客户端 | Vue 3 + ECharts 网页 | uni-app（App/小程序/H5） |
| 评分规则 | Python | **JS，1:1 翻译 + 单测对照** |
| 数据存储 | SQLite | 内存（demo / CSV / HTTP） |
| 离线可用 | ❌ | ✅（demo / CSV 模式） |

两边的 JS / Python 规则逻辑必须保持一致——通过 `tests/rules.test.ts` 中的手算预期值验证。任何一边改了算法，需要在另一边同步并更新预期值。

## 后续可做

- [ ] 接 SQLite 插件替换内存 store（数据量 > 1000 套房源时）
- [ ] 接 CSV 增量更新（只下载新增/变化的房源）
- [ ] 学校详情页（当前只做搜索）
- [ ] 多城市切换（当前 cityId 写死在 store 里）
- [ ] 把 Python 端 pytest 跑出的真值回填 `expected.json`，做更严格的 JS-vs-Python 对照

## 政府数据：70 城价格指数（已接入）

手机端内置一张"全国 70 城价格指数"卡片和榜单页，数据来自**国家统计局**。

- **数据源**：每月 15-17 日发布的「70 个大中城市商品住宅销售价格变动情况」
- **加载方式**：app 启动时从本地 `/static/stats_70.csv` 加载
- **更新方式**：在电脑上跑 `scripts/crawl_stats_70.py`

### 重新生成 CSV

```bash
# 选项 1：复用第三方完整历史（hugohe3/70cityprice）—— 推荐做历史回填
python scripts/crawl_stats_70.py convert --src /path/to/70cityprice.csv --out static/stats_70.csv

# 选项 2：从国家统计局下载当月增量（每月 15-17 日发布）
python scripts/crawl_stats_70.py crawl \
    --url "https://www.stats.gov.cn/sj/zxfb/202601/t20260115_xxxxxxx.html" \
    --out static/stats_70.csv
```

CSV 字段（窄表）：`date, city, fixed_base, new_idx, second_idx`（`fixed_base` ∈ {同比, 环比}）。

> 注：第三方 CSV 是反向工程、人工整理版本，覆盖到 2006 年；统计局官方源是 HTML 表格，需自爬（`crawl_stats_70.py crawl`）。

## 政府数据：深广每日网签（v0.2.0 新增）

住建局公布的**成交套数/面积**（宏观），与 70 城**价格指数**是不同维度。

- **数据源**：深圳 `fdc.zjj.sz.gov.cn`（新房+二手）；广州 `mrxjspfqyxx.ashx`（新房住宅签约）
- **加载方式**：`App.vue` 启动时内联 `static/daily_wangqian.csv`
- **更新方式**：

```bash
# 本地抓取并 merge 历史
python scripts/crawl_daily_wangqian.py fetch --merge
```

- **CI**：`.github/workflows/crawl-daily-wangqian.yml` 工作日 09:30（北京时间）自动 merge 并 commit

**局限**：接口只返回最近一个交易日；广州二手房暂无日更 API（仅月度图片公告）。

完整字段与 API 说明见 [DATA_SOURCES.md](./DATA_SOURCES.md)。

### 阶段 2：政府真数据接入（已实现 + 持续中）

手机端默认使用**政府公开种子数据**（见上表），由 `scripts/seed_real_data.py` 派生。

**进一步抓取单套成交** 的两个落地形态：
1. **`scripts/crawl_sz_newhouse.py fetch`** —— 直接对接 `opendata.sz.gov.cn` 政府开放数据平台。需要：
    - 注册一次：<https://opendata.sz.gov.cn/>
    - 用户中心 → 我的应用 → 创建 appToken
    - 设置环境变量：`$env:OPENDATA_SZ_TOKEN = "..."`（PowerShell）
    - 跑：`python scripts/crawl_sz_newhouse.py fetch`
2. **`scripts/crawl_sz_newhouse.py convert`** —— 如果你直接在网页下载政府 CSV，可转窄表格式入库。

**已知局限**：深圳住建局自 2019-04 起不再公布单套成交均价/总价，公开粒度只有"行政 / 日期 / 用途 / 套数 / 面积"。要把单套均价真值接进来，目前只能依赖：
- 链家/贝壳等第三方（合规风险）
- 公开楼盘"一房一价"清单（需要逐楼盘遍历）

## 已知限制

- H5/小程序模式下不能接 SQLite 插件，只能用内存；数据量受限于设备 RAM
- App 模式（Android/iOS）才能接 SQLite 插件
- demo 数据每次启动都重新生成，不持久化（要持久化可以加 `uni.setStorageSync`）

## 提交规范

提交代码前**必须**完成以下检查（规范来源与 [fund](https://github.com/xuefeng0324/fund) 仓库对齐，并按本仓库调整）：

| 项目 | 说明 |
|------|------|
| 代码审查 | 检查逻辑正确、改动范围最小，不夹带无关文件 |
| 补充注释 | 为非显而易见的业务/爬虫逻辑补充必要注释 |
| 测试 | `npm run test` 全部通过 |
| 更新版本号 | `package.json` 的 `version` 随功能版本递增（如 `0.2.0`） |
| 更新版本信息 | 本 README 顶部版本表**新增**一行（**不要修改**历史版本行） |
| 简要更新日志 | 本 README 底部「更新日志」添加简要说明 |
| 更新 changelog | `changelog/YYYY-MM-DD-v版本-变更标题.md` 写详细变更（见已有示例） |
| 数据来源变更 | 同步更新 `DATA_SOURCES.md` |
| 政府 CSV 变更 | 跑对应 `scripts/crawl_*.py`，一并提交 `static/*.csv` |
| AI 任务结束汇报 | AI agent 改动代码后，按仓库根 [AGENTS.md](../AGENTS.md) 的 5 段模板汇报（修改文件 / 内容总结 / 优缺点 / 下一步 / 验证状态） |
| CI 跑通 | push 到 main 或开 PR 后，`.github/workflows/realty-app-tests.yml` 自动跑 type-check + test + coverage；本机可用 `scripts/check.ps1` 预先验证 |

### Commit message 格式

```
<type>(<scope>): <简短中文说明>

<可选：多行 body，列出主要变更点>
```

| type | 用途 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(realty_app): 深广每日网签抓取与 App 接入` |
| `fix` | Bug 修复 | `fix(crawl): 0 行写入保护` |
| `docs` | 文档 | `docs(realty_app): v0.2.0 版本说明与 changelog` |
| `data` | 仅数据/CSV 更新 | `data(wangqian): 追加深广每日网签 2026-07-02` |
| `chore` | CI/工具/杂项 | `chore: 移动 GitHub Actions 到仓库根目录` |
| `perf` | 性能优化 | `perf(realty_app): 减少 stats70 重复解析` |

`scope` 常用：`realty_app`、`crawl`、`backend`、`frontend`；纯数据 commit 可省略 scope。

### changelog 文件命名

```
changelog/YYYY-MM-DD-vX.Y.Z-变更标题.md
```

示例：`changelog/2026-07-01-v0.2.0-深广每日网签抓取与App接入.md`

### 开发规范

| 项目 | 说明 |
|------|------|
| 爬虫请求 | 政府 API 加合理 `User-Agent` / `Referer`；分页或批量请求加间隔（如 200ms） |
| 爬虫保护 | 写入 CSV 前校验最小行数，避免空数据覆盖种子（见 `crawl_anjuke.py --min-rows`） |
| 数据分层 | 宏观（`stats_70.csv` / `daily_wangqian.csv`）与挂牌（`listings.csv`）分开维护 |
| JS 评分规则 | 改 Python 规则时同步改 `src/rules/` 并更新 `tests/rules.test.ts` |
| Git 推送 | 含 `.github/workflows/` 的 push 需 `gh` token 带 **`workflow`** scope；本机建议 `G:\Git\cmd\git.exe`（Git 2.23 与 Cursor 内置 git 的 `--trailer` 不兼容） |

### 推送前授权（一次性，长期有效）

```powershell
gh auth refresh -h github.com -s workflow
gh auth setup-git
```

## 更新日志

详细变更见 [changelog/](./changelog/) 目录。

### v0.2.0 (2026-07-01)

**深广每日网签抓取与 App 接入**

- 新增 `crawl_daily_wangqian.py` 与 `daily_wangqian.csv`
- Dashboard / stats70 展示政府网签；工作日 GitHub Actions 自动 merge

### v0.3.0 (2026-07-12)

**移除示例数据 + E2E smoke 验证**

- 删除 `src/local/demoData.ts`：所有数据统一走 `buildSeedSnapshot()` 政府公开种子（1226 套真房源）
- 设置页去掉"切到示例数据"按钮与兜底分支；`DataMode` 联合类型去掉 `"demo"`
- 端到端测试 `tests/pipeline.test.ts` 全部改用真数据；删除与种子快照重复的 describe 块
- 新增 `tests/e2e/smoke.mjs`：Playwright 自动化验证 dev server UI、console error、404 资源
- 新增 `tests/e2e/make-favicon.mjs`：生成最小 favicon 工具（已用 `<link rel="icon" href="data:," />` 取代）
- `index.html` 添加 `<link rel="icon" href="data:," />`，消除浏览器默认 favicon 404

### v0.3.0 优化批次 (2026-07-12)

**类型收敛 + 暗色主题一致性 + a11y 改进**

- 类型：`filterListings(body: any)` 在 `api/listings.ts` 和 `local/queries.ts` 改为 `ListingFilterRequest`；community.vue 调用点去除误传的 `weekEnd`、`cityId` 早返回避 `undefined`
- 暗色主题：把页面里散落的 `#0b1220` / `#0f172a` 硬编码统一为 `App.vue` palette 的 `#111827` card、`#1e293b` panel、`#1f2937` border（仅 `.thumb-bubble` tooltip 保留 `#0f172a`，设计上需更深）
- a11y：`App.vue` 加 `.tap-target` / `.focusable:focus` / `.sr-only` / `.card-active` 工具类；主要可点击 card 与行加 `role="button"` / `tabindex="0"` / `hover-class`
- 详见 [changelog/2026-07-12-v0.3.0-优化批次.md](./changelog/2026-07-12-v0.3.0-优化批次.md)

### v0.3.0 优化批次-2 (2026-07-12)

**类型工具收尾 + 工程脚本 + 可视化回归**

- 类型层：`api/http.ts` 把 `ApiError.data`、`buildUrl` params、`apiGet<T>` / `apiPost<T>` 默认泛型全部从 `any` 改为 `unknown`；新增 `src/utils/errorMessage.ts` 提供 `toErrorMessage(e: unknown)` 工具
- a11y 收尾：listing-detail / school / stats70 / wangqian / settings 五个页面的可点击 view 补 `role="button"` / `tabindex` / `hover-class`（gov-webview 已是 button）
- 工程脚本：`scripts/check.ps1` 一键跑 type-check + test + smoke；`scripts/commit.ps1` 参数化 git plumbing commit（绕开 Cursor 的 `--trailer` 注入 + Git 2.24 不支持）
- 测试覆盖：装 `@vitest/coverage-v8` + `vitest.config.ts` 加 coverage provider（exclude pages/store/main），新增 `npm run test:coverage`；当前 `src/rules/` 评分核心 95.86% 覆盖
- 视觉回归：`tests/e2e/visual-diff.mjs` 用 sharp 做像素 diff 对比 baseline，缺 sharp 时 fallback 字节 hash；baseline.png 入版本
- 详见 [changelog/2026-07-12-v0.3.0-类型工具脚本与可视化回归.md](./changelog/2026-07-12-v0.3.0-类型工具脚本与可视化回归.md)

### v0.3.0 优化批次-3 (2026-07-12)

**catch 迁移 + http/errorMessage 单测**

- 6 个页面 / 10 处 `catch (e: any) { e?.message || String(e) }` 统一迁到 `catch (e) { toErrorMessage(e) }`，catch 类型从 `any` 收紧到 `unknown`
- 新增 `tests/http.test.ts`（18 用例）覆盖 `http.ts` 全部 H5 分支：buildUrl 拼接/参数过滤/URL 编码、apiGet/apiPost 4xx/5xx/JSON 解析失败、set/getApiBaseUrl 持久化往返
- 新增 `tests/errorMessage.test.ts`（10 用例）覆盖 `errorMessage.ts`：`ApiError`、Error、uni-app `{errMsg}`、字符串、null、自定义 fallback
- `vitest.config.ts` 更新注释，明确 `src/api` 与 `src/utils` 因有单测已纳入覆盖统计；`src/pages` / `src/store` / `src/main.ts` 仍排除（UI/全局）
- 当前覆盖率：`src/api/http.ts` 66.01%（从 0% 起步）、`src/utils/errorMessage.ts` 85.71%
- 详见 [changelog/2026-07-12-v0.3.0-catch迁移与http单测.md](./changelog/2026-07-12-v0.3.0-catch迁移与http单测.md)

### v0.3.0 优化批次-4 (2026-07-12)

**CI 接入：GitHub Actions 跑 type-check + 单测 + coverage**

- 新增 `.github/workflows/realty-app-tests.yml`：ubuntu-latest + Node 20，触发器为 push/PR 到 main、工作日 09:00 北京时间（01:00 UTC）排程、手动 `workflow_dispatch`
- 步骤：`npm ci` → `npm run type-check` → `npm run test:coverage` → 上传 coverage 报告（14 天）与 E2E artifacts（7 天）
- 复用 `package-lock.json` 做依赖缓存（`actions/setup-node@v4` + `cache-dependency-path`）
- E2E smoke 暂不入 CI（Linux runner 安装 Playwright Chromium 慢且脆），后续单独做
- 本机验证仍走 `scripts/check.ps1`（含 E2E）
- 详见 [changelog/2026-07-12-v0.3.0-CI接入.md](./changelog/2026-07-12-v0.3.0-CI接入.md)

### v0.3.0 优化批次-5 (2026-07-12)

**CI 自检：actionlint 守 workflow 语法**

- `.github/workflows/realty-app-tests.yml` 加 `rhysd/actionlint@v1` 步骤
- 触发位置：`setup-node` 之后、`npm ci` 之前（fail fast，秒级 lint 通过后再装依赖）
- 默认 lint 所有 `.github/workflows/*.yml`，不仅 `realty-app-tests.yml`，连 `crawl-*` 也覆盖
- 详见 [changelog/2026-07-12-v0.3.0-actionlint.md](./changelog/2026-07-12-v0.3.0-actionlint.md)

### v0.3.0 优化批次-6 (2026-07-12)

**E2E CI 化：Playwright smoke 走 GitHub Actions**

- 新增 `.github/workflows/realty-app-e2e.yml`：独立 workflow，不跑每个 push，只在 PR 到 main、每日凌晨 02:00 北京时间排程、手动 `workflow_dispatch` 触发
- 步骤：`npm ci` → `npm run build:h5`（production 构建） → `npx playwright install --with-deps chromium` → 起 `serve` 静态服务器（端口 5173）→ 跑 `smoke.mjs` → 跑 `visual-diff.mjs`（软失败不阻塞）→ 上传 artifacts
- 视觉回归软失败：`visual-diff.mjs` 在 baseline 缺失或更新时会 fail，但用 `continue-on-error: true` 不阻塞 PR 合并，让维护者意识到需要本地更新 baseline
- 失败诊断：smoke 失败时自动打印 `smoke.json` 内容、dist 大小、serve 进程状态
- 详见 [changelog/2026-07-12-v0.3.0-E2E-CI.md](./changelog/2026-07-12-v0.3.0-E2E-CI.md)

### v0.3.1 (2026-07-12)

**CI 修复 + 构建健壮性**

- **修 CI 阻塞**：`.github/workflows/realty-app-tests.yml` 把 `uses: rhysd/actionlint@v1`（死引用：rhysd/actionlint 仓库不是 GitHub Action）改为官方推荐的 `download-actionlint.bash` 脚本拉二进制
- **CI 加速**：`crawl-daily-wangqian.yml` / `crawl-weekly.yml` 给 `setup-python` 加 `cache-dependency-path`，cache 命中时跳过 `pip install`
- **本机友好**：`scripts/check.ps1` 加 Node/npm 预检，缺环境时给 `winget install OpenJS.NodeJS.LTS` 指引而不是默默失败
- **构建完整性**：`tests/buildIntegrity.test.ts` 新增 14 个用例，覆盖 `index.html` favicon / `manifest.json` 字段 / `static/seed/*.csv` 与 README 一致性 / CI 必装文件存在性
- 详见 [changelog/2026-07-12-v0.3.1-CI修复与构建健壮性.md](./changelog/2026-07-12-v0.3.1-CI修复与构建健壮性.md)

### v0.4.0 (2026-07-12)

**接入链家在售真 listings（1200+→1286）**

- **数据源替换**：seed `listings.csv` 追加 60 条来自链家 `sz.lianjia.com/ershoufang/` 的真实挂牌数据（包含真实房价 / 户型 / 楼龄 / tags / 社区名）；原 1226 条 fake 数据保留（作为回归保障 + 让 UI 不显得"内容稀缺"）
- **抓取脚本**：新增 `scripts/crawl_lianjia_listings.py`，Python **纯标准库**（不需要 `requests`/`bs4`/`lxml`），自带 `--append` 去重 + `--dry` 覆盖率检视
- **UI 验证**：新增 `tests/e2e/smoke_listings.mjs`，Playwright 打开 listing-detail 页检查真房源 title/价格/户型是否渲染，并截 `listing_detail_*.png`
- **测试**：原 pipeline.test.ts 假设"latest weekEnd 有 ≥10 个 community"，新增 60 条 listings 后可能切换到新一周；改为扫描所有周找到首个有数据的周，向下兼容 fake 数据
- 详见 [changelog/2026-07-12-v0.4.0-链家在售真数据接入.md](./changelog/2026-07-12-v0.4.0-链家在售真数据接入.md)

### v0.4.1 (2026-07-12)

**接入高德 POI 真数据：小区经纬度 + 周边配套**

- **新增 2 套抓取脚本**：
  - `scripts/crawl_amap_geo.py` — 小区 geocode + reverse_geocode → `communities_geo.csv`（23 行，21 high + 2 medium confidence）
  - `scripts/crawl_amap_poi.py` — 周边 POI → `poi_seed.csv`（298 行 = 23 小区 × 5 类 × ~3 个最近）
- **数据**：5 类 POI = 地铁/小学/医院/商场/公园；每类取最近 3 个；按 distance 排序
- **新单测**：`tests/buildIntegrity.test.ts` 加 5 个用例，覆盖 `communities_geo.csv`/`poi_seed.csv` 文件存在 + geocode 覆盖率 + POI 孤儿检测
- **配额**：23 小区 × 4-5 次 = 79-115 次/天，远低于 5000-30000 配额
- 详见 [changelog/2026-07-12-v0.4.1-高德POI真数据接入.md](./changelog/2026-07-12-v0.4.1-高德POI真数据接入.md)

### v0.4.2 (2026-07-12)

**接链家 xiaoqu 真小区源 + 关联链家 listings**

- **新脚本**：`scripts/enrich_lianjia_xq.py`（抓链家 xiaoqu 列表页 → 30 个真小区带 district+bizcircle）+ `scripts/enrich_lianjia_listings.py`（给链家 listings 的 community_id=0 → 轮询关联）
- **数据**：深圳 seed 小区 6 → **39**（+33）；POI 115 → **657**（+542，~5.7×）；district coverage 4 → 9 区
- **数据源实测**：xq 列表页 HTTP 200 / 146 KB / 30 个 li；链家详情页 CAPTCHA 全拦截 → 改用 round-robin 关联（不是 1:1 真实映射，详见 changelog）
- **验证**：119/119 单测过；type-check clean；listing-detail (id=1227) + community-detail (id=24 中核集团宿舍) Playwright 截图渲染
- 详见 [changelog/2026-07-12-v0.4.2-链家xiaoqu真小区补足.md](./changelog/2026-07-12-v0.4.2-链家xiaoqu真小区补足.md)

### v0.4.3 (2026-07-12)

**把 POI 数据集成到 listing-detail + community UI**

- **数据层**：`types/importer/store/queries` 加 `LocalPoi/PoiItem/PoiCategory` 全套类型；`DataSnapshot.pois` 字段；`getCommunityPois({communityId})` 查询
- **UI**：`listing-detail.vue` + `community.vue` 各加"周边配套"卡片：5 类（地铁/学校/医院/商场/公园）每类最近 3 个 + 距离，icon + emoji
- **验证**：126/126 单测过（+2 buildIntegrity：5 类覆盖 + distance_m 合法）；type-check clean；listing 1227 + community 24 Playwright 渲染
- 详见 [changelog/2026-07-12-v0.4.3-高德POI集成到UI.md](./changelog/2026-07-12-v0.4.3-高德POI集成到UI.md)

### v0.5.0 (2026-07-12) — Option A：行政标准化 + 学校扩充

- **数据**
  - 新增 `static/seed/admin_districts.csv`：拉 `modood/Administrative-divisions-of-China` 过滤得 23 条官方区（广州 11 + 深圳 9 + 珠海 3）；人工补 `大鹏新区`
  - `static/seed/schools.csv` 14 → 58（深圳 32 / 广州 18 / 珠海 8，知名中小学）
  - `static/seed/school_indicators.csv` 14 → 58（一对一）
- **脚本**
  - `scripts/import_admin_divisions.py` — 拉 `areas.json` 过滤输出 csv（纯 stdlib）
  - `scripts/validate_districts.py` — 校验 `communities.district_name` 是否在 `admin_districts.csv` 内
  - `scripts/seed_schools.py` — 合并手填数据 + 生成 school_indicators
- **测试**
  - `tests/buildIntegrity.test.ts` 新增 describe `政府开放数据配套（v0.5.0 / Option A）` 共 5 条用例
  - `tests/e2e/smoke_admin.mjs`（新）— 浏览器拉 3 个 csv 校验字段 + 3 张页面截图
- **不做**
  - `opendata.sz.gov.cn` appkey 申请（≥3 工作日）
  - 国家级 CPI / GDP（`crawl_stats_70.py` 已覆盖）
  - 地铁规划、房价指数细化、宏观指标 → 推迟到 v0.6 / v0.7 / v0.8
- **验证**：131/131 单测过；type-check clean；smoke_admin / smoke_enrich / smoke_poi 全绿；dashboard + listings + 深圳主页 UI 未崩
- 详见 [changelog/2026-07-12-v0.5.0-行政标准化+学校扩充.md](./changelog/2026-07-12-v0.5.0-行政标准化+学校扩充.md)

### v0.6.0 (2026-07-12) — 医院清单 + UI 集成

- **数据**
  - 新增 `static/seed/hospitals.csv`：手填深广珠 **50 家**三甲+二甲（深圳 25 / 广州 19 / 珠海 6）
  - 新增 `static/seed/hospitals_geo.csv`：高德 POI 校验（high=4 / medium=24 / low=22）
  - `poi_seed.csv` hospital 类：113 → 143 行（半径 1500m → 3000m）
- **脚本**
  - `scripts/seed_hospitals.py` — 手填 50 条（深广珠三甲+二甲）
  - `scripts/crawl_amap_hospital.py` — 高德 text 搜索校验 + haversine 距离打分
  - `crawl_amap_poi.py` 调整：POI_RADIUS_M 字典，hospital=3000m，其他=1500m
- **代码**
  - `LocalHospital` / `getCommunityHospitals` / 5km + 同区兜底逻辑
  - `listing-detail.vue` + `community.vue` 新增 "周边医院" 卡片（5 类色码等级标签）
  - `settings.vue` csv-url 模式拉 hospitals.csv
- **测试**
  - `tests/buildIntegrity.test.ts` +9 用例（hospitals.csv / geo.csv / 三城覆盖 / 三甲 / 经纬度 / poi_seed 医院类）
  - `tests/e2e/smoke_hospital.mjs`（新）— 验证 listing 1227 + community 24 显示医院
- **不做**
  - `46319943/3AHospital` — 太旧（2020 最后更新）
  - `wjw.sz.gov.cn` appkey 申请 — 流程长
- **验证**：140/140 单测过（+9 buildIntegrity）；type-check clean；smoke_hospital / smoke_poi / smoke_enrich / smoke_admin 全绿
- 详见 [changelog/2026-07-12-v0.6.0-医院清单.md](./changelog/2026-07-12-v0.6.0-医院清单.md)

### v0.7.0 (2026-07-12) — 地铁规划 + UI 集成

- **数据**
  - 新增 `static/seed/metro_planning.csv`：**21 条**线路
  - 深圳五期 13 条（15/17/18/19/20二期/21/22/25/27/29/32/10东延/11北延）
  - 深圳四期 2 条（13 北延/6 支线二期，预计 2026 开通）
  - 广州三期调整 3 条（8 北延/8 东延/24 号线）+ 广州四期 1 条（16 号线一期）
  - 珠海规划 2 条（珠肇高铁/南珠城际）
- **脚本**
  - `scripts/seed_metro_planning.py` — 手填 21 条
- **代码**
  - `LocalMetroLine` / `getCommunityMetroPlanning`（按状态/速度/站数打分排序）
  - listing/community 新增"未来周边地铁"卡片（**仅当现有最近地铁 ≥ 1km 时显示**）
  - 状态色码：在建=橙 / 即将开通=绿 / 规划=灰
- **测试**
  - `tests/buildIntegrity.test.ts` +7 用例（地铁规划完整性）
  - `tests/e2e/smoke_metro.mjs`（新）— community 24 显示 15/11北延
- **不做**
  - 站点级经纬度（公开数据没规范）— 按区粗粒度匹配
  - 规划线路高德 POI 二次验证（建成才有）
- **验证**：147/147 单测过（+7 buildIntegrity）；type-check clean；smoke_metro / smoke_hospital / smoke_poi / smoke_enrich 全绿
- 详见 [changelog/2026-07-12-v0.7.0-地铁规划.md](./changelog/2026-07-12-v0.7.0-地铁规划.md)

### v0.8.0 (2026-07-12) — 板块级房价序列 + dashboard 卡片

- **数据**
  - 新增 `static/seed/district_trend.csv`：**269 行**
    - schema：`city_id, district_name, week_end, listing_count, avg_unit_price, median_unit_price, min_unit_price, max_unit_price`
    - 覆盖 15 个区 × 27 周 = 3 城 (广州 / 深圳 / 珠海)
    - 由 `scripts/compute_district_trend.py` 从 `listings.csv` (1286 条) 按 (城市/区/周日) 聚合
- **数据层**
  - `types.ts`：新增 `LocalDistrictTrend` 接口 + `DataSnapshot.districtTrends`
  - `importer.ts` / `seedSnapshot.ts`：解析并默认加载
  - `store.ts`：新增 `getDistrictTrendByDistrict` + `getDistrictsByCity`
  - `queries.ts`：新增 `DistrictTrendItem` + `getDistrictTrend` + `getCityDistrictOverview`
  - `dataRefresher.ts`：远程刷新时保留 `districtTrends`
  - `settings.vue`：csv-url 模式也拉 `district_trend.csv`
- **UI**
  - dashboard 新增「**区级近 8 周房价趋势**」卡片
  - 每个区一行：区名 + 最近 4 周均价 + 4 周环比变化率 (▲红涨/▼绿跌)
  - 8 个柱状条 (normalized 30-100%) 直观展示波动
- **测试**
  - `buildIntegrity.test.ts` +7 测试 (存在/行数/区数/周数/字段范围/city_id/区名匹配)
  - `smoke_district_trend.mjs` Playwright：广州(4 区) + 深圳(9 区) 截图
- **验证**：154/154 单测过 (+7 v0.8.0)；type-check clean；6/6 smoke 全绿
- 详见 [changelog/2026-07-12-v0.8.0-板块级房价序列.md](./changelog/2026-07-12-v0.8.0-板块级房价序列.md)

### v0.9.0 (2026-07-12) — 地图找房

- **新页面**：`pages/map-view/map-view.vue` + tabBar "地图"
- **配置**：`manifest.json` 的 `h5.sdkConfigs.maps.amap.key` 配高德 Web Services key
- **功能**
  - **热力图模式**：`circles` 按挂牌数着色（红=多 / 蓝=少），半径 200-1000m
  - **挂牌点模式**：每套挂牌一个 marker（限 200/城市）
  - 城市切换：深圳 / 广州 / 珠海（一键 zoom）
  - marker tap → 底部 info-card → 跳小区详情页
- **数据**：复用 `communities_geo.csv` (52 个小区有 lat/lng) + `listings.csv` (1286 套)
- **测试**
  - `buildIntegrity.test.ts` +7 测试
  - `smoke_map.mjs`：验证 52 小区 / 1286 挂牌 + 3 城市按钮 + 截图
- **验证**：161/161 单测过 (+7)；7/7 smoke 全绿
- 详见 [changelog/2026-07-12-v0.9.0-地图找房.md](./changelog/2026-07-12-v0.9.0-地图找房.md)

### v0.10.0 (2026-07-12) — 网签热度榜

- **数据**
  - 新增 `static/seed/wangqian_district_weekly.csv`：66 行
    - schema：`city, district, category, week_end, days, total_units, total_area_sqm, avg_daily_units, avg_daily_area_sqm`
    - 由 `scripts/build_wangqian_heatmap.py` 从 `daily_wangqian.csv` (264 条 district) 按 (城市/区/类别/周) 聚合
    - 覆盖 22 区 × 2 周 × 3 类别 (广州 + 深圳)
- **数据层**
  - `types.ts`：新增 `LocalWangqianDistrictWeekly` 接口 + `DataSnapshot.wangqianDistrictWeekly`
  - `importer.ts` / `seedSnapshot.ts`：解析并默认加载（含 category 归一化）
  - `store.ts`：新增 `getWangqianDistrictWeekly()` + `getWangqianTopDistricts()`
  - `queries.ts`：新增 `WangqianOverviewItem` + `getWangqianHeatmap()`
  - `dataRefresher.ts`：远程刷新保留 wangqianDistrictWeekly
  - `settings.vue`：csv-url 模式拉 `wangqian_district_weekly.csv`
- **UI**
  - dashboard 新增「**近 4 周二手网签热度榜**」卡片
  - 金银铜牌 (rank 1/2/3) + 柱状条 (按 totalUnits 归一化)
  - 每区显示套数 + 累计面积 (万㎡)
  - 智能 fallback：广州只显示新房榜（住建局不公示二手）
- **测试**
  - `buildIntegrity.test.ts` +8 测试（含 BOM-safe CSV 解析）
  - `smoke_wangqian_heatmap.mjs` Playwright：广州(10 区) + 深圳(10 区) 验证真实深圳区名
- **验证**：169/169 单测过 (+8)；8/8 smoke 全绿
- 详见 [changelog/2026-07-12-v0.10.0-网签热度榜.md](./changelog/2026-07-12-v0.10.0-网签热度榜.md)

### v0.11.0 (2026-07-12) — 学区溢价榜

- **数据**
  - `schools.csv` 新增 `district_name` 列（58 条手填）
  - 新增 `static/seed/school_premium_district.csv`（16 行）+ `school_premium_community.csv`（52 行）
  - 由 `scripts/compute_school_premium.py` 从 `listings.csv` + `schools.csv` + `school_indicators.csv` 聚合
- **数据层**
  - `src/local/types.ts`: `LocalSchoolPremiumDistrict` / `LocalSchoolPremiumCommunity`
  - `src/local/store.ts`: `getSchoolPremiumDistricts` / `getSchoolPremiumRank` / `getCommunitySchoolScore`
  - `src/local/queries.ts`: `getSchoolPremiumRank(cityId)` → `SchoolPremiumOverview`
- **UI**
  - `src/pages/dashboard/dashboard.vue`: 新增「学区溢价榜」卡片
    - 按 `premium_ratio` 降序展示 Top 区
    - 金/银/铜牌 + 学校评分 + 溢价% + 中位单价
- **洞察**（listing ≥ 10 过滤后）
  - 广州 Top 1: **天河区 +27.3%** (评分 86.0, 111 套)
  - 深圳 Top 1: **南山区 +23.2%** (评分 86.3, 177 套)
  - 珠海 Top 1: **香洲区 +14.2%** (评分 81.9, 153 套)
- **测试**
  - `tests/buildIntegrity.test.ts` 新增 10 个学区溢价测试
  - `tests/e2e/smoke_school_premium.mjs`: 广州/深圳 切换 + 截图
- **验证**：179/179 单测过 (+10)；9/9 smoke 全绿
- 详见 [changelog/2026-07-12-v0.11.0-学区溢价榜.md](./changelog/2026-07-12-v0.11.0-学区溢价榜.md)

### v0.12.0 (2026-07-12) — 成交价热力

- **UI**
  - `src/pages/map-view/map-view.vue`: map-view 第三种模式「成交价热力」
    - 圆点颜色按社区均价在所属城市的 min/max 区间内插值（绿=便宜 → 黄 → 红=贵）
    - 半径仍按挂牌数（200-1000m）
  - mode 由 `boolean` → `MapMode = "count" | "price" | "listings"`
  - 三模式轮换：count（挂牌数蓝→红）→ price（成交价绿→红）→ listings（挂牌点）
  - info-card 新增「价位」5 档标签：便宜/中低/中等/中高/昂贵（色码化）
  - legend 文案随 mode 切换
- **测试**
  - `tests/buildIntegrity.test.ts` 新增 5 个测试（map-view 存在、含 MapMode、含 priceColorRamp、5 档 CSS 类、geo CSV 行数）
  - `tests/e2e/smoke_price_heatmap.mjs`（新增）：验证模式切换 + 截图
- **验证**：184/184 单测过 (+5)；10/10 smoke 全绿
- 详见 [changelog/2026-07-12-v0.12.0-成交价热力.md](./changelog/2026-07-12-v0.12.0-成交价热力.md)

### v0.13.0 (2026-07-12) — POI overlay

- **数据**
  - `static/seed/poi_seed.csv` 现有 678 行 POI (5 类齐全)
- **数据层**
  - `src/local/store.ts`: `getPoisByCity(cityId)` — 关联 communities.csv cityId
  - `src/local/queries.ts`: `getCityPois({cityId, category?})` → `CityPoisResponse`
- **UI**
  - `src/pages/map-view/map-view.vue`: 4 模式轮换 `count → price → listings → poi`
  - POI 模式：5 类 toggle 按钮（带类别计数：🚇地铁 14 / 🏫学校 24 / 🏥医院 18 / 🛍商场 19 / 🌳公园 24）
  - `poiMarkers` computed: 每类最多 25 个 marker，按 category 着色（蓝/绿/红/橙/深绿）
  - POI info-card: 名称 + 类型 + 距离 + 所属小区 + 地址
- **测试**
  - `tests/buildIntegrity.test.ts` 新增 6 个 POI overlay 测试
  - `tests/e2e/smoke_poi_overlay.mjs`: 4 模式切换 + 5 toggle + 截图
- **验证**：193/193 单测过 (+6)；12/12 smoke 全绿
- 详见 [changelog/2026-07-12-v0.13.0-POI-overlay.md](./changelog/2026-07-12-v0.13.0-POI-overlay.md)

### v0.14.0 (2026-07-12) — 学区评分 Top 小区

- **数据层**
  - `src/local/store.ts`: `getSchoolPremiumCommunityRank({cityId, minListings, limit})`
    - 过滤 `school_count >= 1, avg_school_score > 0, listing_count >= minListings`
    - 排序：先 score 降序，并列按 median_unit_price 降序
  - `src/local/queries.ts`: `getSchoolPremiumCommunityRank` → `SchoolPremiumCommunityOverview`
- **UI**
  - `src/pages/dashboard/dashboard.vue`: 新增「学区评分 Top N 小区」卡
    - 金/银/铜牌 + 区名 + 学校评分 + 学校数 + 中位单价
    - 点击小区行 → 跳 community 详情
- **洞察**
  - 广州 Top 1: **珠江帝景苑** (天河区, 评分 86.0, 3 所学校)
  - 深圳 Top 1: **笋岗仓库综合楼** (罗湖区, 评分 90.3, 6 所学校)
- **测试**
  - `tests/buildIntegrity.test.ts` 新增 5 个测试
  - `tests/e2e/smoke_school_community.mjs`: 广州/深圳切换 + 截图
- **验证**：198/198 单测过 (+5)；13/13 smoke 全绿
- 详见 [changelog/2026-07-12-v0.14.0-学区评分小区榜.md](./changelog/2026-07-12-v0.14.0-学区评分小区榜.md)

### v0.15.0 - 地铁规划 overlay (2026-07-12)
- map-view 新增「地铁规划」模式 (count → price → listings → poi → metro)
- **数据**：新增 `static/seed/metro_planning_geo.csv` (21 行)，含每条线的 start/end 坐标
- **数据源**：`scripts/crawl_amap_metro.py` 用高德 `/v3/place/text` 拿 start_station / end_station 的 lat/lng
- **补充**：missing 坐标由 `scripts/enrich_metro_geo_manual.py` 基于公开地理信息手填
- **UI**：
  - 5 模式轮换 (新增 metro)
  - 每条线 2 个 marker (起/终点)，点击显示线路详情
  - polyline 颜色按 status：绿(即将开通) / 橙(在建) / 灰(规划)
  - info-card 显示：线路名 / status / 预计开通年 / 起讫站 / 站点数 / 长度
- **数据层**：
  - `LocalMetroLineGeo` 接口 + DataSnapshot.metroLineGeos
  - `getMetroLineGeos({cityId})` / `MetroLineGeoItem` / `MetroLinesGeoResponse`
  - 默认从 `metro_planning_geo.csv` 加载
- **测试**
  - `tests/buildIntegrity.test.ts` 新增 6 个测试
  - `tests/e2e/smoke_metro_overlay.mjs` (新增)：5 模式轮换 + 深圳/广州切换 + 截图
- **验证**：204/204 单测过 (+6)，type-check clean，12/12 smoke 全绿
- 详见 [changelog/2026-07-12-v0.15.0-地铁规划overlay.md](./changelog/2026-07-12-v0.15.0-地铁规划overlay.md)

### v0.16.0 - 实时天气 + 4 天预报 (2026-07-12)
- dashboard 新增「实时天气」卡：用高德 `/v3/weather/weatherInfo` 拿 3 城实况 + 4 天预报
- **数据源**：高德 weather API (extensions=base/all), 无需额外 key
- **数据**：`static/seed/weather.csv` (6 行 = 3 城 × 2 类型)
- **UI**：
  - 大字温度 + 天气 emoji (☀️/⛅/☁️/🌦️/⛈️/❄️/🌫️)
  - 湿度 / 风力 / AQI 三个 stat 卡片
  - AQI 估算按 level 0-3 着色 (绿/黄绿/橙/红)
  - 未来 4 天预报 grid (今天/周几 + 日期 + emoji + day/night 温度)
  - 切换城市自动更新
- **AQI 估算规则** (粗略, 仅演示):
  - 风力 >= 5 级 → 优
  - 湿度 >= 85% 且风力 <= 2 → 轻度污染 (闷热)
  - 温度 >= 35°C 且湿度 >= 60% → 轻度污染 (高温闷热)
  - 其它 → 良
  - 生产环境请接 AQICN 或国控站 API 拿真实 AQI
- **测试**
  - `tests/buildIntegrity.test.ts` 新增 7 个测试
  - **fix**: readCsv 升级为 RFC4180-lite (支持 quoted field + "" 转义)
  - `tests/e2e/smoke_weather.mjs` (新增)：深圳 → 卡片 → 切广州 → 卡片更新
- **验证**：211/211 单测过 (+7), type-check clean, 18/18 smoke 全绿
- 详见 [changelog/2026-07-12-v0.16.0-实时天气.md](./changelog/2026-07-12-v0.16.0-实时天气.md)

### v0.17.0 - Listing 学区溢价榜 (2026-07-12)

- **背景**：之前 v0.11.0 学区溢价是 *区* 级别。本次新增 *listing* 级别 — 直接告诉用户哪些房源是学区房 + 高溢价。
- **数据**：listings.csv (1286) + communities.csv (52, district_name) + schools.csv (58, district_name) + school_indicators.csv (58, latest_level_score_raw) → listing_school_premium.csv (1286 行)
  - 通过 (city, district) 关联：每个 listing → community → district → 同区学校 avg_score
  - 板块溢价率: (区中位单价 / 全市中位单价 - 1) * 100
  - 90% (1159/1286) listing 有 school_score > 0；100% 有 premium_ratio
- **数据层**：
  - `LocalListingSchoolPremium` 接口（types.ts）
  - `getListingSchoolPremia()` / `getListingSchoolPremiumByCity()` (store.ts)
  - `getTopListingsBySchoolPremium({ cityId, minScore, limit })` (queries.ts, 排序 score desc → premium desc)
  - importer 解析 `listing_school_premium.csv`
  - settings.vue 拉 csv
- **UI**：dashboard 新增 🏫 高学区评分房源 卡 (Top 10)，medal 按 score 分级 (≥90 金 / 85+ 银 / 80+ 铜)，区溢价 price-up/down 色码；点击跳 listing-detail
- **测试**：
  - 8 个新单测 (buildIntegrity)：csv 存在、行数 ≥ 1000、school_count+score 覆盖率 ≥ 80%、city_id 合法、types/store/queries/dashboard 接口
  - 1 个新 E2E: `smoke_listing_premium.mjs` 深圳+广州各截图
- **验证**：219/219 单测过 (+8), type-check clean, 20/20 smoke 全绿
- 详见 [changelog/2026-07-12-v0.17.0-listing学区溢价.md](./changelog/2026-07-12-v0.17.0-listing学区溢价.md)

### v0.18.0 - Marker 聚合 (2026-07-12)

- **背景**：listings 模式直接渲染每套挂牌一个 marker (最多 200/城市)。同小区多套挂牌完全重叠，且 DOM 节点过多导致渲染卡顿。本次引入**网格聚合**：同一网格内的 marker 合并为 1 个 cluster marker。
- **算法** (cluster.ts)：
  - `clusterCellDeg(zoom)` = 0.04 / 2^(zoom-11)，zoom 11 → 4km，zoom 14 → 500m，zoom 17 → 130m
  - `clusterMarkers(points, zoom)` 按 lat/lng/cell 桶分，单点保留原 id，**多点用负 id + count + 平均 lat/lng**
- **UI 集成** (map-view.vue)：
  - `listingMarkerInputs` (输入: 600 listing) + `listingClusterMarkers` (输出)
  - 单点: 16x16 默认蓝圆 + callout "小区名 + 总价" (BYCLICK)
  - cluster: 32x32 或 44x44 红色气泡 + callout "N 套" (ALWAYS)
  - legend 更新: 提示聚合行为
  - `onMarkerTap` 处理 cluster marker (负 id + count > 1) → zoom in +1 + mapCenter 移动 + showToast
  - 解决高德 H5 "Marker.iconPath is required" 警告 (inline SVG data URI)
- **测试**：
  - 7 个 cluster 单测 (cluster.test.ts)
  - 5 个 buildIntegrity 测试 (cluster.ts 存在/导出、map-view.vue 集成)
  - 1 个新 E2E: smoke_cluster.mjs (深圳 listings 模式 + 截图)
- **验证**：231/231 单测过 (+12), type-check clean, 19/19 smoke 全绿
- 详见 [changelog/2026-07-12-v0.18.0-marker聚合.md](./changelog/2026-07-12-v0.18.0-marker聚合.md)

### v0.19.0 - 周边商业配套密度 (2026-07-12)

- **背景**：之前 POI overlay 只覆盖 5 类 (地铁/学校/医院/商场/公园)。本次新增 3 类商业 POI (🍴餐饮/🏦银行/🏪便利店)，并基于此给每个小区算 **0-100 商业热度评分**。
- **数据**：
  - 高德 /v3/place/around: 49 小区 × 3 类 = 147 次 API 调用
  - `poi_commercial.csv` (416 行)
  - `community_commercial.csv` (52 行, 94% 有 score > 0)
- **评分模型**：
  - 餐饮(50) + 银行(30) + 便利店(20)，每类按数量阶梯打分
  - 距离权重: ≤300m ×1.0 / 800m ×0.7 / 1500m ×0.4 / 1500m+ ×0.1
- **数据层**：
  - `LocalCommunityCommercial` 接口 (types.ts)
  - `getCommunityCommercials/ByCity` (store.ts)
  - `getCommercialRanking({ cityId, limit, minScore })` (queries.ts)
  - importer 解析 `community_commercial.csv`
  - settings.vue 拉 csv
- **UI**：dashboard 新增 🛒 商业热度 Top 卡 (Top 10)，按 score desc 排序，medal + 商业分色码 (>=80 红 / 50-80 灰 / <50 绿)，点击跳 community 详情
- **测试**：
  - 10 个新单测 (buildIntegrity)：csv 存在/行数/3 类/coverage/score 范围/接口/dashboard
  - 1 个新 E2E: `smoke_commercial.mjs` (深圳+广州切换 + emoji 验证 + 截图)
- **验证**：241/241 单测过 (+10), type-check clean, 20/20 smoke 全绿
- 详见 [changelog/2026-07-12-v0.19.0-商业热度.md](./changelog/2026-07-12-v0.19.0-商业热度.md)

### v0.20.0 - 同区多小区对比 (2026-07-12)
- dashboard 「区/板块对比」卡 → 点任一区 → 下方展示「📊 {区} · {市} 小区对比」横柱图
- 数据源：listings.csv + communities.csv 按 community + 周聚合 (复用 snapshotForCommunityAtWeek)
- 新 query: `getCommunityCompareByDistrict({ cityId, weekEnd, districtName })`
- UI: 卡内列出该区所有 community (按均价降序)，每行小区名 + 横柱(长度=均价比例) + 元/㎡；点击行 → /pages/community/community?id={id}；「✕ 关闭」可收起
- 边际保护：listingCount<3 显示 ⚠️ 单价仅供参考
- 新增 E2E: `tests/e2e/smoke_district_compare.mjs` (验证卡出现/行数/价格/关闭)
- **验证**：246/246 单测过 (+5), type-check clean, 21/21 smoke 全绿
- 详见 [changelog/2026-07-12-v0.20.0-同区多小区对比.md](./changelog/2026-07-12-v0.20.0-同区多小区对比.md)

### v0.21.0 - 价格热力升级 (2026-07-12)
- map-view 切到「成交价热力」模式时颜色按 **5 档价格分位** 渲染 (绿→黄绿→黄→橙→红)
- 半径从「纯挂牌数」改为 **价格分位 × 挂牌数** 综合 (贵小区+多挂牌 → 最大圆)
- 新增「🎨 价格分位图例」卡片：5 档 swatch + 价格区间 + 城市均价 + 已覆盖社区数
- 新 computed: `priceBuckets`, `cityAvgPrice`, `pricedCommunityCount`
- `smoke_price_heatmap.mjs` 扩展图例验证 (5 行 + 5 swatch + 「城市均价」)
- **验证**：251/251 单测过 (+5), type-check clean, 21/21 smoke 全绿
- 详见 [changelog/2026-07-12-v0.21.0-价格热力升级.md](./changelog/2026-07-12-v0.21.0-价格热力升级.md)

### v0.22.0 - POI marker 聚合 (2026-07-12)
- 复用 `cluster.ts` (v0.18.0 算法) → POI marker 网格聚合
- **每类单独 cluster**（避免不同类 POI 混合），678 总 POI → zoom 11 显示 < 100 marker
- 单 POI: 圆形彩色图标 (emoji + 类别色背景)，click 弹 info-card
- 聚合 POI: 大号彩色气泡 + 数字 (e.g. `7`)，click 放大到下一 zoom 让 cluster 拆分
- 自适应 zoom：zoom 11 (城市级) 聚合多，zoom 16+ 几乎不聚合 (cell ≈ 250m)
- onMarkerTap 新增 POI cluster 处理 (`markerId <= -1000000` → zoom+1)
- `smoke_poi_overlay.mjs` 加聚合 legend 验证
- **验证**：256/256 单测过 (+5), type-check clean, 21/21 smoke 全绿
- 详见 [changelog/2026-07-12-v0.22.0-POI聚合.md](./changelog/2026-07-12-v0.22.0-POI聚合.md)

### v0.23.0 - 全品类区级网签热度榜 (2026-07-12)
- dashboard 新增「🔥 全品类区级网签热度榜」卡，3 tab 切换：**新房 / 二手 / 全部**
- 列字段：区名 + 累计套数 + 面积 + 套/天
- 显示 Top 10，总数 = totalDistricts
- 数据源：wangqian_district_weekly.csv (深圳 44 / 广州 22 行)
- 新 query: `getDistrictWangqianRank({ cityId, category, weeksBack, limit })`
- 新 E2E: `tests/e2e/smoke_district_wangqian_rank.mjs` (默认 tab + 切 3 tab + 行数)
- **验证**：261/261 单测过 (+5), type-check clean, 22/22 smoke 全绿
- 详见 [changelog/2026-07-12-v0.23.0-全品类区级网签热度榜.md](./changelog/2026-07-12-v0.23.0-全品类区级网签热度榜.md)

### v0.24.0 - 通勤时长榜 (2026-07-12)
- dashboard 新增「🚇 通勤时长榜 · {city} → {CBD}」卡
- 数据源：高德 `/v3/direction/transit/integrated` 公交路径规划 API (早 08:30)
- 目的地：城市核心 CBD (深圳福田CBD / 广州珠江新城)
- 新 query: `getCommuteRanking({ cityId, limit })` → fastest[] + cityAvgMinutes
- UI: rank medal + 小区名 + 区名 + 分钟 badge (绿<85%均值/灰/红>130%均值) + km 距离
- 行可点 → 小区详情
- `scripts/crawl_amap_commute.py` 38 次 API 调用 (深圳 30 + 广州 8)
- **验证**：269/269 单测过 (+8), type-check clean, 23/23 smoke 全绿
- 详见 [changelog/2026-07-12-v0.24.0-通勤时长.md](./changelog/2026-07-12-v0.24.0-通勤时长.md)

### v0.25.0 - 户型分布 (2026-07-13)

dashboard 新增「🏠 户型分布 · {城市}」卡，按 4 维度统计在售房源分布：

- **户型** (1室/2室/3室/4室/5室+)：基于 `listings.csv.bedrooms`
- **面积 (㎡)** (<50/50-80/80-110/110-150/150+)：基于 `area_sqm`
- **朝向** (南/东南/南北通透/西南/西/东/北...)：基于 `orientation` (合并 南北 → 南北通透)
- **装修** (精装/豪装/普装/简装/毛坯)：基于 `decorate_type`

每个 bucket 显示：bucket 名 + 条形比例 + 房源数 + 占比。3 城市合计 54 行（深圳 27 行 / 广州 13 行 / 珠海 14 行）。

数据流：`compute_layout_distribution.py` 聚合 `listings.csv` → `layout_distribution.csv` → importer → store → queries → dashboard UI。
BOM 修复：`tests/buildIntegrity.test.ts` 的 `readCsv` 增强支持去除 BOM。
详见 [changelog/2026-07-13-v0.25.0-户型分布.md](./changelog/2026-07-13-v0.25.0-户型分布.md)

### v0.26.0 - 学区评分小区榜增强 (2026-07-13)

dashboard 「学区评分 Top 小区」卡新增 3 组 chip 控件：

- **区**：该城市所有出现过的区名，多选 (点击切换)
- **最低评分**：不限 / 70+ / 75+ / 80+ / 85+
- **排序**：评分 (默认) / 均价 / 挂牌 / 校数

实现：
- `store.ts` 新增 `SchoolPremiumCommunitySort` 类型，`getSchoolPremiumCommunityRank` 支持 `minScore / districtFilter / sort`
- `queries.ts` 透传新参数
- `dashboard.vue` `spDistrictFilter / spMinScore / spSort` 三个 ref + `spDistrictOptions / spSortLabel` 等 computed
- 切城市时自动重置过滤；控件变化触发 watch 重载该卡

验证：287/287 单测过 (+7), type-check clean, 15/15 smoke 全绿
详见 [changelog/2026-07-13-v0.26.0-trend11-学区评分榜增强.md](./changelog/2026-07-13-v0.26.0-trend11-学区评分榜增强.md)

### v0.27.0 - map-8 marker 密度过滤 (2026-07-13)

map-view 在「挂牌点」模式下，根据缩放级别自动过滤低密度 marker：

- **zoom ≤ 10 (城市级)**：仅显示 listing_count ≥ 5 的社区点
- **zoom 11 (区级)**：仅显示 listing_count ≥ 2 的社区点
- **zoom ≥ 12 (小区级)**：不过滤，显示全部

避免城市级俯瞰时地图被 1-2 套挂牌的小社区淹没，重点突出活跃板块。
legend 文案显示当前 zoom 阈值，过滤逻辑不依赖 cluster。

验证：290/290 单测过 (+3), type-check clean, 16/16 smoke 全绿
详见 [changelog/2026-07-13-v0.27.0-map8-marker密度过滤.md](./changelog/2026-07-13-v0.27.0-map8-marker密度过滤.md)

### v0.28.0 - 房源标签云 (2026-07-13)

dashboard 新增「🏷️ 房源标签云 · {城市}」卡，5 档字号颜色梯度 (大=热门)，点击 tag 显示提示。

派生规则 (compute_listing_tags.py)：
- **户型** 一房/两房/三房/四房/大户型 (≥150㎡)
- **价格** 笋盘 (<城市中位 70%) / 高价 (>1.5×)
- **朝向** 朝南 / 南北通透
- **装修** 豪装/精装/简装/毛坯
- **学区** 名校区 (学区评分 ≥ 80)
- **地铁** 近地铁 (≤500m) / 地铁可达 (≤1500m)
- **楼龄** 楼龄新 (≥2015) / 老破小 (≤2000 且 <70㎡)
- **楼层** 高楼层 (≥20 层) / 带电梯
- **平台** VR房源 / 随时看房 (来自 listings.tags_json)

数据规模：listing_tags.csv 7517 行 (1286 listings × 平均 5.8 tag)。

验证：300/300 单测过 (+10, **总数突破 300**), type-check clean, 21/21 smoke 全绿
详见 [changelog/2026-07-13-v0.28.0-房源标签云.md](./changelog/2026-07-13-v0.28.0-房源标签云.md)

### v0.29.0 - 区房价指数 (2026-07-13)

dashboard 新增「📈 区房价指数 · {城市}」卡：
- 每个区显示：区名、最新周指数、WoW/YoY 变化
- 右侧 sparkline 柱状图 (12-30 周走势)
- 指数排序：按最新 index_value 降序
- 颜色编码：≥110 红 / <90 绿

实现：
- `compute_district_index.py` 从 `district_trend.csv` 计算
- `baseline = 各区最早 4+ listings 的周中位价` → 归一化为 100
- `index_value = current_median / baseline * 100`
- `mom_change` / `yoy_change` 计算
- `getDistrictIndex()` query + sparkPoints() helper

验证：309/309 单测过 (+9), type-check clean, 22/22 smoke 全绿
详见 [changelog/2026-07-13-v0.29.0-区房价指数.md](./changelog/2026-07-13-v0.29.0-区房价指数.md)

### v0.30.0 - 区涨幅榜 (2026-07-13)

dashboard 新增「🚀 区涨幅榜 (近 4 周) · {城市}」卡：
- 按最近 4 周累计中位价变化排序
- 显示：排名、区名、最新 WoW、4 周累计变化
- 颜色：>+0.5% 红 / <-0.5% 绿
- 金牌前 3

实现：`getDistrictChangeRank()` query 复用 `district_index.csv`，每区取最近一周和 4 周前的 medianUnitPrice 计算累计变化。

验证：314/314 单测过 (+5), type-check clean, 23/23 smoke 全绿
详见 [changelog/2026-07-13-v0.30.0-区涨幅榜.md](./changelog/2026-07-13-v0.30.0-区涨幅榜.md)

### v0.31.0 - 生活便利度 (2026-07-13)

dashboard 新增「🧭 生活便利度 Top 小区 · {城市}」卡：

- 城市均分 + 最高分 summary
- 每行展示小区名 / 区 / 5 维评分 (M/P/S/X/Y 缩写) / 总分 (0-100)
- 颜色分档：≥80 高 (绿) / 60-79 中 (蓝) / <60 低 (灰)

数据来源：`poi_seed.csv` → `compute_life_convenience.py` → `life_convenience.csv`

统计：
- 广州 avg=66.2 / max=85
- 深圳 avg=71.1 / max=90 (数据最全)
- 珠海 avg=59.4 / max=65

验证：322/322 单测过 (+8), type-check clean, smoke_life_convenience 3 城市全绿 (含城市切换差异性)
详见 [changelog/2026-07-13-v0.31.0-生活便利度.md](./changelog/2026-07-13-v0.31.0-生活便利度.md)

### v0.32.0 - 菜市场维度 (2026-07-13)

dashboard 「🧭 生活便利度 Top 小区」卡升级到 v2：

- 新增 **C=菜市场** 维度 (高德 `crawl_market_poi.py` 抓 49 小区 / 147 行)
- 打分从 100 → **110 满分**；新增 `score100` 归一化 (0-100)
- UI 6 维展示: M商场 / P公园 / S地铁 / X学校 / Y医院 / **C菜市场**

数据：
- 深圳 avg=89.4 / max=110 (京基100 满分 100/100)
- 广州 avg=85.6 / max=105 (北京路名宅 95.5/100)
- 珠海 avg=78.4 / max=85 (中信红树湾 77.3/100)

验证：323/323 单测过 (+1), type-check clean, smoke_life_convenience 3 城市全绿 (含 6 维 + score100 检查)
详见 [changelog/2026-07-13-v0.32.0-菜市场维度.md](./changelog/2026-07-13-v0.32.0-菜市场维度.md)

### v0.33.0 - 小区综合评分 (2026-07-13)

dashboard 新增「🏅 小区综合评分 Top 小区 · {城市}」卡：

- 综合分公式：`total = life*0.5 + school*0.3 + commute*0.2`
- 每行展示：金银铜牌 + 小区名 + 区 + 3 维细分 (生活/学区/通勤) + 总分
- 颜色分档：≥80 高 (绿) / 65-79 中 (蓝) / <65 低 (灰)

数据源：`life_convenience.csv` + `school_premium_community.csv` + `commute.csv` → `compute_community_score.py` → `community_score.csv` (52 行)

统计：
- 深圳 avg=68.7 / max=95.4 (京基100 🥇, 桃源居 🥈, 笋岗仓库 🥉)
- 广州 avg=79.4 / max=93.3 (北京路名宅 🥇)
- 珠海 avg=59.1 / max=63.2 (中信红树湾 🥇)

验证：331/331 单测过 (+8), type-check clean, smoke_community_score 3 城市全绿 (含 3 维细分 + 金牌)
详见 [changelog/2026-07-13-v0.33.0-小区综合评分.md](./changelog/2026-07-13-v0.33.0-小区综合评分.md)

### v0.34.0 - 综合评分权重自定义 (2026-07-13)

「🏅 小区综合评分」卡新增权重自定义：

- **4 预设 chip**: ⚖️均衡 (50/30/20) / 🎓学区 (20/60/20) / 🚇通勤 (20/20/60) / 🧭生活 (70/20/10)
- **3 slider**: 生活 (蓝) / 学区 (绿) / 通勤 (黄)，0-100 step 5
- 实时重算 + 重排 `rank_city`
- 总和 ≠ 100 自动归一化

互动示例 (深圳)：
- ⚖️ 均衡 → top1 京基100 (95)
- 🎓 学区 → top1 凤凰大厦66号大院 (92)
- 🚇 通勤 → top1 京基100 (97)
- 🧭 生活 → top1 凤凰大厦66号大院 (97)

验证：337/337 单测过 (+6), type-check clean, smoke_community_score_weight 全绿 (4 预设切换 + 排名变化)
详见 [changelog/2026-07-13-v0.34.0-权重自定义.md](./changelog/2026-07-13-v0.34.0-权重自定义.md)

### v0.35.0 - 地铁步行通勤 (2026-07-13)

「🚶 地铁步行通勤 Top」卡片新增 — 把每个小区到**最近地铁站**的步行时长直接展示出来：

- 颜色三档：
  - 🟢 ≤ 5 min (地铁上盖)
  - 🟠 ≤ 10 min (步行方便)
  - 🔴 > 10 min (需接驳)

数据源：poi_seed.csv (subway 类别) → 高德 `/v3/direction/walking` API。

**亮点**：
- quota 友好：49 小区 ~ 49 次 API；本数据 37 行 (AMAP_API 4 + ESTIMATED 30 + 5 个小区无 subway POI skip)
- quota 用尽时自动启发式 (直线 × 1.45 / 80m·min⁻¹)，每行立即写盘，支持续跑
- 行内展示：`{min}min / {m}m / 来源：高德|估算`

Top 5 (深圳)：
1. 振华路42号 — 0 min → 燕南(地铁站)
2. 京基100 — 4 min → 老街(地铁站)
3. 凤凰路66号大厦 — 4 min → 黄贝岭(地铁站)
4. 水围村 — 9 min → 民宝(地铁站)
5. 万科城 — 13 min → 贝尔路(地铁站)

验证：344/344 单测过 (+7), type-check clean, smoke_metro_walk 全绿（深/广双截图 ✓）
详见 [changelog/2026-07-13-v0.35.0-地铁步行通勤.md](./changelog/2026-07-13-v0.35.0-地铁步行通勤.md)

### v0.36.0 - 地铁规划受益 (2026-07-13)

「🚇 地铁规划受益 Top」卡片新增 — 展示每个小区到**未来 1-5 年即将开通的地铁站**的距离，按 `距离分 × status 权重` 综合打分排序：

- **距离分**：≤300m=100 / ≤500m=90 / ≤800m=75 / ≤1200m=60 / ≤2000m=40 / ≤3000m=20 / >3000m=0
- **status 权重**：即将开通×1.5 / 在建×1.2 / 规划×1.0 (≤2030) / ×0.7 (>2030)
- **必须同城** (过滤跨城误匹配)

数据：49 小区 × 21 规划线路，自动 join `metro_planning.csv` + `metro_planning_geo.csv`，纯本地计算（0 API）。

**Top 5 (深圳 / 在建)**：
1. 中海天钻 — 72 → 17号线一期「侨社」(1069m, 2028)
2. 星河智荟 — 72 → 21号线一期「坳背」(915m, 2028)
3. 诗宁别墅 — 72 → 18号线一期「盐田路」(1009m, 2028)
4. 聚福大厦 — 72 → 29号线一期「兴东」(1148m, 2028)
5. 科技楼 — 72 → 19号线一期「聚龙」(1164m, 2028)

**Top 1 (广州 / 在建)**：保利天悦 — 90 → 8号线东延「万胜围」(791m, 2027)

UI：每行 4 元数据 (受益分徽章 + 区/线/站描述 + status 颜色徽章 + 距离/年份)。3 档受益分 (绿 ≥75 / 橙 ≥40 / 红 0-39) + 3 色 status (在建橙 / 即将开通绿 / 规划灰)。

验证：351/351 单测过 (+7), type-check clean, smoke_metro_benefit 全绿（深/广双截图 ✓）
详见 [changelog/2026-07-13-v0.36.0-地铁规划受益.md](./changelog/2026-07-13-v0.36.0-地铁规划受益.md)

### v0.37.0 - 5 维小区指标 (2026-07-13)

把分散在 5 个 dashboard 卡片的指标"内聚"到 **listing 列表** + **小区详情** 2 个最常看的页面：

**Listing 列表迷你评分条**（每行底部，5 列）：
- 位置 (location_score) / 房屋 (house_quality) / 楼龄 (building_age) / 配套 (amenity) / 性价比 (price_value)
- 数据来自 listing 评分系统已有的 `explain_preview.dimension_scores`
- 3 色分档：🟢 ≥75 / 🟠 ≥50 / 🔴 <50

**Community 详情 5 格卡**（小区头部下方）：
- 🧭 生活 (life_convenience.score100)
- 🎓 学区 (school_premium_community.avg_school_score)
- 🚌 通勤 (commute.transitMinutes 反向换算)
- 🚶 步行地铁 (metro_walk.walkMinutes)
- 🚇 规划地铁 (metro_benefit.benefitScore)

**示例**：

| 小区 | 生活 | 学区 | 通勤 | 步行 | 规划 |
|---|---|---|---|---|---|
| 京基100 (深圳, id=7) | 81 | 100 | 100 | 90 | 0 |
| 保利天悦 (广州, id=15) | 0 | 0 | 84 | 99 | 90 |

新增 3 个 `getXxxByCommunity(cid)` store helper。

验证：356/356 单测过 (+5), type-check clean, smoke_community_metrics + smoke_listing_minidim 双 E2E 全绿（深 11 + listings 20 截图均 ✓）
详见 [changelog/2026-07-13-v0.37.0-5维小区指标.md](./changelog/2026-07-13-v0.37.0-5维小区指标.md)

## License

与主仓库一致（`LICENSE`）。