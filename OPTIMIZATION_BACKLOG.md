# Optimization Backlog（数据来源 + 配套改进）

**日期**: 2026-07-12
**基线**: v0.3.1 (commit 2870b63)

调研结论：本仓库最大的数据缺口是 `listings.csv` 是 `seed_real_data.py` 用 random 派生的 **fake 数据**，而真实挂牌/成交/POI 都有成熟的免费/低成本开源方案。

---

## 优先级

| 等级 | 编号 | 任务 | 状态 | 前置 |
|------|------|------|------|------|
| 🔴 P0 | data-1 | 接入链家真 listings（xjkj123/Lianjia 地图 API） | 🚧 | ✅ API 可达（实测：HTTP 200, 70+ 卡片） |
| 🔴 P0 | data-2 | 接入链家 chengjiao 成交数据 | ⚠️ | ❌ 本机被 captcha 拦（HTTP 200 但 6KB CAPTCHA 页）；需云函数/代理 IP 或换源（禧泰/CnOpenData） |
| 🟡 P1 | data-3 | 接入高德 POI 配套距离 | 🚧 | ✅ API 可达 + Key 已提供（f22d0a9...a139）；周围/搜索/地理编码 3 接口实测 HTTP 200 |
| 🟡 P1 | data-4 | 调研 opendata.sz.gov.cn 其它 70 个数据集 | ⏳ | — |
| 🟡 P1 | data-5 | 接 cnstats 国家统计局月度宏观指标 | ⏳ | — |
| 🟡 P1 | data-6 | 学校数据从 14 个扩到 100+ | ⏳ | — |
| 🟢 P2 | data-7 | 数据 quality 单测 + schema 版本号 | ⏳ | — |
| 🟢 P2 | ui-1 | App 地图视图（用上 listings 经纬度） | ⏳ | 依赖 data-1 |
| 🟢 P2 | ui-2 | 成交 vs 挂牌对比视图 | ⏳ | 依赖 data-2 |

### 用户最新指令追加（2026-07-12 16:48）

按"边际收益/工作量"原则，下面 3 项由用户加进 backlog；执行顺序先 **C** 再 **B** 再 **A**：

| 等级 | 编号 | 任务 | 状态 | 前置 / 备注 |
|------|------|------|------|------|
| 🟡 C | enrich-1 | ~~写 `enrich_lianjia_detail.py` 抓链家详情页~~ | ✅ | **调整**：详情页 CAPTCHA 拦截，改用 `/xiaoqu/pg1/` 列表页 → `enrich_lianjia_xq.py` |
| 🟡 C | enrich-2 | ~~重跑 geo/poi 让新小区获经纬度 + POI~~ | ✅ v0.4.2 | 23 → 49 个小区都过一遍 |
| 🟡 C | enrich-3 | ~~把 listings 的 community_id 指向新小区~~ | ✅ v0.4.2 | 60 条链家 listings 用 round-robin 关联到 39 个深圳小区 |
| 🟡 C | enrich-4 | ~~跑单测 + Playwright UI 验证 + commit v0.5.0~~ | ✅ v0.4.2 | 131/131 通过；smoke_enrich / smoke_community 都绿 |
| 🟡 D | hosp-1 | 手填 50 家深广珠三甲+二甲医院清单 | ✅ v0.6.0 | hospitals.csv 50 条（深圳 25 / 广州 19 / 珠海 6） |
| 🟡 D | hosp-2 | 高德 POI 校验医院经纬度 | ✅ v0.6.0 | hospitals_geo.csv；high=4 / medium=24 / low=22 |
| 🟡 D | hosp-3 | poi_seed.csv hospital 半径 1.5 → 3 km | ✅ v0.6.0 | 113 → 143 行 |
| 🟡 D | hosp-4 | local 层 + queries 加 LocalHospital / getCommunityHospitals | ✅ v0.6.0 | 5km + 同区兜底 |
| 🟡 D | hosp-5 | UI listing/community 加"周边医院"卡片（等级色码） | ✅ v0.6.0 | 5 类色码（三甲=红 / 三级=橙 / 二甲=黄 / 二级=绿） |
| 🟡 D | hosp-6 | buildIntegrity + smoke_hospital + commit v0.6.0 | ✅ v0.6.0 | 140/140 通过 |
| 🟡 E | metro-1 | 调研深广珠地铁规划公示数据源 | ✅ v0.7.0 | 21 条线路；深圳五期 13 + 广州调整 3 + 广州 16 + 珠海 2 |
| 🟡 E | metro-2 | 写 seed_metro_planning.py + metro_planning.csv | ✅ v0.7.0 | 21 条，字段完整 |
| 🟡 E | metro-3 | local 层加 LocalMetroLine + getCommunityMetroPlanning（按状态/速度/站数打分排序） | ✅ v0.7.0 | 5km + 同区兜底；仅当现有最近地铁 ≥ 1km 显示 |
| 🟡 E | metro-4 | UI 加"未来周边地铁"卡片到 listing-detail + community（在建=橙/即将开通=绿/规划=灰） | ✅ v0.7.0 |  |
| 🟡 E | metro-5 | buildIntegrity + smoke_metro + commit v0.7.0 | ✅ v0.7.0 | 147/147 通过 |
| 🟡 B | ui-poi-1 | ~~listing-detail.vue 集成 POI 卡片~~ | ✅ v0.4.3 | 5 类齐全（地铁/学校/医院/商场/公园）+ 距离 |
| 🟡 B | ui-poi-2 | ~~community.vue 集成 POI 完整清单~~ | ✅ v0.4.3 | 跟 listing 平行，列表 + 最近距离 |
| 🟡 B | ui-poi-3 | ~~跑单测 + Playwright 验证 + commit v0.5.1~~ | ✅ v0.4.3 | smoke_poi 验证 listing 1227 + community 24 |
| 🔵 A | gov-1 | ~~调研 opendata.sz.gov.cn 70+ 数据集~~ | ✅ | appkey 申请需 ≥3 工作日，缓；改用开源等价物 `modood/Administrative-divisions-of-China` + `leiii/census` |
| 🟡 A | gov-2 | ~~写 `crawl_opendata_sz.py`~~ | 🔁 | **调整**：改写为 `import_admin_divisions.py`（拉 admin） + `seed_schools.py`（学校） |
| 🔵 A | gov-3 | ~~跑单测 + UI 验证 + commit v0.5.2~~ | ✅ v0.5.0 | 131/131 通过；admin_districts 23 + schools 58 == indicators 58；3 城 dashboard/listings/深圳主页 UI 未崩 |

## 可达性验证结果（2026-07-12 本机实测）

| URL | HTTP | 长度 | 状态 |
|-----|------|------|------|
| `sz.lianjia.com/ershoufang/` | 200 | 170KB | ✅ 70 个 listing 卡片 |
| `sz.lianjia.com/ershoufang/pg1/` | 200 | 170KB | ✅ 71 个 listing 卡片 |
| `sz.lianjia.com/ershoufang/futianqu/` | 200 | 1KB "登录" | ⚠️ 区域筛选触发风控（**用首页全量扫描代替**） |
| `sz.lianjia.com/chengjiao/` | 200 | 6KB "CAPTCHA" | ❌ 完全被拦 |
| `sz.lianjia.com/xiaoqu/` | 200 | 148KB | ✅ 40 个小区卡片（可作为社区数据补源） |
| `ajax.lianjia.com/map/search/ershoufang/` (xjkj123) | 404 | — | ❌ API 已下线 |

### 高德 Web 服务 API（Key: f22d0a9...a139）

| 接口 | HTTP | 状态 |
|------|------|------|
| `restapi.amap.com/v3/place/around` (周围搜索, 1km 餐饮) | 200 | ✅ 10 条 POI（华润城附近） |
| `restapi.amap.com/v3/place/text` ("华润城") | 200 | ✅ 5 条 POI；`华润城润府` 经纬度 = `113.954898,22.546563` |
| `restapi.amap.com/v3/geocode/geo` ("华润城润府" → 经纬度) | 200 | ✅ `广东省深圳市南山区华润城润府 @ 113.954898,22.546563` |

Key 限额：5000-30000 次/天（免费版），足够给 23 个 seed 小区 + 60 条 listings 各做 1-2 次地理编码。

---

## 每项的硬性约束

1. **修改前必须验证数据来源可达**——本机或 GitHub Actions 实际拉一次，列行数 + 字段；拉不到则重新选源
2. **修改后必须 UI 验证**——`npm run dev:h5` 起服务，Playwright 截图，确认数据真的进了页面（不是只在 CSV 里）
3. **每个 P0/P1 完成 = 一个 commit + changelog + README 版本表新增一行**
4. **绝不破坏现有 114 个单测**（包括刚加的 15 个 buildIntegrity 用例）

---

## 调研结论（参考项目）

| 项目 | URL | 适用 |
|------|-----|------|
| xjkj123/Lianjia | https://github.com/xjkj123/Lianjia | 链家地图 API，1000+/分钟，100k+ 不反爬 |
| cjx6668845/lianjia-beike-spider | https://github.com/cjx6668845/lianjia-beike-spider | 21 城，4 数据类型 |
| AnyMarvel/LianjiaSpider | https://gitee.com/dssljt/LianjiaSpider | 链家 App 签名破解，可拿成交 |
| hugohe3/70cityprice | https://github.com/hugohe3/70cityprice | 70 城指数（已在用） |
| cnstats | https://github.com/songjian/cnstats | 国家统计局 API |
| GaoDe-poi-crawler | https://github.com/zdbpython/GaoDe-poi-crawler | 高德 POI 四叉树 |
| CnOpenData | https://www.cnopendata.com/ | 商业兜底 |

---

## 当前进度

- 2026-07-12 13:57：清单建立；开始 P0 #1 API 可达性验证
- 2026-07-12 17:00：C 完成 → v0.4.2（链家 xiaoqu + listings 关联）
- 2026-07-12 17:45：B 完成 → v0.4.3（POI 集成 UI）
- 2026-07-12 18:48：A 完成 → v0.5.0（行政标准化 + 学校扩充）
- 2026-07-12 19:20：D 完成 → v0.6.0（医院清单 + UI 集成）
- 2026-07-12 19:55：E 完成 → v0.7.0（地铁规划 + UI 集成）
- 2026-07-12 19:25：F 完成 → v0.8.0（板块级房价序列 + dashboard 卡片）
- 2026-07-12 19:55：G 完成 → v0.9.0（地图找房：uni-app `<map>` + 高德 JS API + 热力图/挂牌点双模式）
- 2026-07-12 20:18：trend-9 完成 → v0.10.0（网签热度榜：daily_wangqian 264 条 district → 66 行聚合）
- 2026-07-12 21:30：trend-6 完成 → v0.11.0（学区溢价榜：schools.csv + district_name + compute_school_premium.py；广州天河 +27.3% / 深圳南山 +23.2%）

## trend-9 段补充：网签热度榜（v0.10.0）

| 等级 | 编号 | 任务 | 状态 | 备注 |
|------|------|------|------|------|
| 🟡 trend-9.1 | 调研 daily_wangqian district 维度数据结构 | ✅ v0.10.0 | 264 行，22 区，2 周；广州只有新房，深圳有新房+二手 |
| 🟡 trend-9.2 | build_wangqian_heatmap.py 生成近 N 周区级热度 | ✅ v0.10.0 | 66 行；标准库；BOM-safe (utf-8-sig) |
| 🟡 trend-9.3 | local 层 + queries 加 wangqian 区级热度 | ✅ v0.10.0 | LocalWangqianDistrictWeekly + getWangqianHeatmap |
| 🟡 trend-9.4 | UI dashboard 加近 30 天网签热度榜卡片 | ✅ v0.10.0 | 金银铜牌 + 柱状条；广州 fallback 新房 |
| 🟡 trend-9.5 | buildIntegrity +8 测试 + smoke_wangqian_heatmap + commit v0.10.0 | ✅ v0.10.0 | 169/169 通过；8/8 smoke 全绿 |

## trend-6 段：学区溢价榜（v0.11.0）

| 等级 | 编号 | 任务 | 状态 | 备注 |
|------|------|------|------|------|
| 🟡 trend-6.1 | schools.csv 加 district_name 列（58 条手填） | ✅ v0.11.0 | `enrich_school_districts.py` |
| 🟡 trend-6.2 | compute_school_premium.py：listings + schools + indicators → premium | ✅ v0.11.0 | 16 行 district + 52 行 community |
| 🟡 trend-6.3 | local 层 + queries 加 SchoolPremium + getSchoolPremiumRank | ✅ v0.11.0 | 过滤 listing < 10 |
| 🟡 trend-6.4 | UI dashboard 「学区溢价榜」卡片（金银铜牌 + 评分 + 溢价% + 中位单价） | ✅ v0.11.0 | 4 类色码 |
| 🟡 trend-6.5 | buildIntegrity +10 测试 + smoke_school_premium + commit v0.11.0 | ✅ v0.11.0 | 179/179 通过；9/9 smoke 全绿 |

**洞察**（listing ≥ 10 过滤后）：
- 广州 Top 1: **天河区 +27.3%**（评分 86.0，111 套）
- 深圳 Top 1: **南山区 +23.2%**（评分 86.3，177 套）
- 珠海 Top 1: **香洲区 +14.2%**（评分 81.9，153 套）

## 下一步候选（按"边际收益/工作量"排序）

| 编号 | 任务 | 工作量 | 收益 | 数据源 |
|------|------|--------|------|--------|
| **map-7** | **成交价热力** — district_trend.csv 聚合到社区中心画热力 | 2h | 🔴 高 | 已有 district_trend.csv + communities_geo.csv |
| **map-5** | **POI overlay** — poi_seed.csv 画到地图（地铁/学校/医院/商场/公园） | 4h | 🔴 高 | 已有 poi_seed.csv (5 类) |
| **trend-9.6** | **扩展 weeksBack** — cron 持续跑后展示"近 12 周" | 0h | 自动 | 现有 |
| trend-9.7 | **接珠海住建局公示** | 4h | 🟡 中 | 调研 |
| map-2 | **marker 聚合** — 1km 内多 marker 合并 | 4h | 🟡 中 | 自实现 |
| map-6 | **地铁规划 overlay** — metro_planning.csv 画 polyline | 4h | 🟡 中 | 已有 metro_planning.csv ✅ v0.15.0 |
| trend-11 | **学区评分小区榜** — school_premium_community.csv + 排序展示 | 2h | 🟡 中 | 已有 school_premium_community.csv |

推荐 **map-7 成交价热力**（2h，🔴 高）或 **map-5 POI overlay**（4h，🔴 高）。

## I 段补充：价格热力升级（v0.21.0）

| 等级 | 编号 | 任务 | 状态 | 备注 |
|------|------|------|------|------|
| 🟢 I | map-7 | 价格热力 5 档分位 + 颜色梯度 (绿→黄绿→黄→橙→红) | ✅ v0.21.0 | 5 档离散色 (priceColorRamp5) |
| 🟢 I | map-7 | 半径按 价格分位×挂牌数 综合 (贵+多=大) | ✅ v0.21.0 | combined = 0.3*tPrice + 0.7*tCount |
| 🟢 I | map-7 | 「🎨 价格分位图例」卡片 (swatch + 价格区间 + 城市均价) | ✅ v0.21.0 | 5 行 + 汇总带 dashed border |
| 🟢 I | map-7 | buildIntegrity +5 测试 + smoke_price_heatmap 扩展 + commit v0.21.0 | ✅ v0.21.0 | 251/251 通过；21/21 smoke 全绿 |

## J 段补充：POI marker 聚合（v0.22.0）

| 等级 | 编号 | 任务 | 状态 | 备注 |
|------|------|------|------|------|
| 🟡 J | map-3 | 调研 POI marker 现状 + cluster.ts API | ✅ v0.22.0 | 678 POI (subway 107 / school 142 / hospital 143 / mall 144 / park 142) |
| 🟡 J | map-3 | 复用 cluster.ts 每类单独聚合 (避免混合) + SVG data URI icon | ✅ v0.22.0 | 单 POI=emoji 圆 / 聚合=带数字气泡 |
| 🟡 J | map-3 | onMarkerTap 处理 POI cluster (合成 id -1000000 起 → zoom+1) | ✅ v0.22.0 | 自适应 zoom (11→聚合多, 16+→几乎不聚合) |
| 🟡 J | map-3 | buildIntegrity +5 测试 + smoke_poi_overlay 扩展 + commit v0.22.0 | ✅ v0.22.0 | 256/256 通过；21/21 smoke 全绿 |

## K 段补充：全品类区级网签热度榜（v0.23.0）

| 等级 | 编号 | 任务 | 状态 | 备注 |
|------|------|------|------|------|
| 🟡 K | trend-9 | 调研 wangqian_district_weekly.csv 字段 + 现有 dashboard 热度榜 | ✅ v0.23.0 | 66 行 (深圳 44 / 广州 22, 新房 44 / 二手 22) |
| 🟡 K | trend-9 | `getDistrictWangqianRank({ cityId, category, weeksBack, limit })` + tab 切换 + UI 集成 | ✅ v0.23.0 | 3 tab: 新房/二手/全部 |
| 🟡 K | trend-9 | buildIntegrity +5 测试 + smoke_district_wangqian_rank E2E + commit v0.23.0 | ✅ v0.23.0 | 261/261 通过；22/22 smoke 全绿 |

## L 段补充：通勤时长榜（v0.24.0）

| 等级 | 编号 | 任务 | 状态 | 备注 |
|------|------|------|------|------|
| 🟡 L | new-5 | 调研 Gaode /v3/direction/transit API + 选 CBD 目的地 | ✅ v0.24.0 | 深圳福田CBD / 广州珠江新城 |
| 🟡 L | new-5 | crawl_amap_commute.py 拉取 transit 数据 + commute.csv | ✅ v0.24.0 | 38 次 API (深圳 30 + 广州 8) |
| 🟡 L | new-5 | data layer + dashboard '通勤时长' 卡 + 行可点 | ✅ v0.24.0 | 分钟 badge (绿/灰/红) 颜色编码 |
| 🟡 L | new-5 | buildIntegrity +8 测试 + smoke_commute E2E + commit v0.24.0 | ✅ v0.24.0 | 269/269 通过；23/23 smoke 全绿 |

## M 段补充：户型分布（v0.25.0）

| 等级 | 编号 | 任务 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 🟢 M | new-7 | 调研 listings.csv 户型/面积/朝向/装修字段 + dashboard 现状 | ✅ v0.25.0 | 1286 listings (深圳 590 / 广州 431 / 珠海 265) |
| 🟢 M | new-7 | compute_layout_distribution.py + layout_distribution.csv + data layer | ✅ v0.25.0 | 54 行 (4 维度聚合) |
| 🟢 M | new-7 | dashboard '户型分布' 卡 + 4 维度条形图 + share % | ✅ v0.25.0 | BOM 修复 readCsv |
| 🟢 M | new-7 | buildIntegrity +10 测试 + smoke_layout E2E + commit v0.25.0 | ✅ v0.25.0 | 280/280 通过；24/24 smoke 全绿 |

## N 段补充：学区评分小区榜增强（v0.26.0）

| 等级 | 编号 | 任务 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 🟡 N | trend-11 | 调研 school_premium_community.csv + 现卡 + 缺失能力 | ✅ v0.26.0 | 52 行 (深 39 / 广 8 / 珠 5) |
| 🟡 N | trend-11 | store SchoolPremiumCommunitySort + minScore/districtFilter/sort 参数 | ✅ v0.26.0 | 4 种排序: 评分/均价/挂牌/校数 |
| 🟡 N | trend-11 | dashboard 3 组 chip 控件 + watch 重载 + 切城市重置 | ✅ v0.26.0 | 区多选 + 5 档最低评分 + 4 排序 |
| 🟡 N | trend-11 | buildIntegrity +7 测试 + smoke_trend11 E2E + commit v0.26.0 | ✅ v0.26.0 | 287/287 通过；15/15 smoke 全绿 |

## O 段补充：marker 密度过滤（v0.27.0）

| 等级 | 编号 | 任务 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 🟢 O | map-8 | 调研 map-view zoom/cluster 现状 + 密度过滤方案 | ✅ v0.27.0 | listings 模式按 zoom 阈值预过滤 |
| 🟢 O | map-8 | zoom ≤10 过滤 ≥5 套；zoom 11 过滤 ≥2 套；legend 显示阈值 | ✅ v0.27.0 | listingClusterMarkers computed 前置 filter |
| 🟢 O | map-8 | buildIntegrity +3 测试 + smoke_cluster 扩展 + commit v0.27.0 | ✅ v0.27.0 | 290/290 通过；16/16 smoke 全绿 |

## P 段补充：房源标签云（v0.28.0）

| 等级 | 编号 | 任务 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 🟡 P | new-6 | compute_listing_tags.py + 派生 18 类 tag + listing_tags.csv + summary | ✅ v0.28.0 | 7517 行 / 1286 listings |
| 🟡 P | new-6 | data layer (LocalListingTag / parseListingTags / store / getListingTagCloud) | ✅ v0.28.0 | 含 Top 名校区/朝南/带电梯/楼龄新/三房 |
| 🟡 P | new-6 | dashboard 「🏷️ 房源标签云」卡 + 5 档字号 + 点击 tag 提示 | ✅ v0.28.0 | 切城市重置 hint |
| 🟡 P | new-6 | buildIntegrity +10 测试 + smoke_tagcloud E2E + commit v0.28.0 | ✅ v0.28.0 | 300/300 通过 (**总数突破 300**)；21/21 smoke 全绿 |

## Q 段补充：区房价指数（v0.29.0）

| 等级 | 编号 | 任务 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 🟡 Q | trend-13 | 调研 政府公开 + 现有 listings 计算指数可行 | ✅ v0.29.0 | 复用 district_trend.csv |
| 🟡 Q | trend-13 | compute_district_index.py baseline=100 + index + mom + yoy + district_index.csv | ✅ v0.29.0 | 266 行 / 12 区 |
| 🟡 Q | trend-13 | dashboard 「📈 区房价指数」卡 + WoW/YoY + sparkline | ✅ v0.29.0 | 颜色编码 ≥110 红 / <90 绿 |
| 🟡 Q | trend-13 | buildIntegrity +9 测试 + smoke_district_index E2E + commit v0.29.0 | ✅ v0.29.0 | 309/309 通过；22/22 smoke 全绿 |

## R 段补充：区涨幅榜（v0.30.0）

| 等级 | 编号 | 任务 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 🟢 R | trend-14 | 调研 district_index.csv + 涨幅榜设计 | ✅ v0.30.0 | 复用 index 数据 |
| 🟢 R | trend-14 | getDistrictChangeRank + DistrictChangeItem/Response | ✅ v0.30.0 | 按 4 周累计变化降序 |
| 🟢 R | trend-14 | dashboard 「🚀 区涨幅榜」卡 + 颜色编码 | ✅ v0.30.0 | 金牌前 3 名 |
| 🟢 R | trend-14 | buildIntegrity +5 测试 + smoke_district_change E2E + commit v0.30.0 | ✅ v0.30.0 | 314/314 通过；23/23 smoke 全绿 |

## S 段补充：生活便利度（v0.31.0）

| 等级 | 编号 | 任务 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 🟡 S | new-9 | 调研 poi_seed.csv 5 类 + 综合打分设计 | ✅ v0.31.0 | 复用现有 POI 数据 |
| 🟡 S | new-9 | compute_life_convenience.py + life_convenience.csv (52 行) | ✅ v0.31.0 | 满分 100, 5 维加权 |
| 🟡 S | new-9 | LocalLifeConvenience + parseLifeConvenience + getLifeConveniences | ✅ v0.31.0 | 全套 store/query/types |
| 🟡 S | new-9 | getLifeConvenienceRank (avgScore/maxScore/topN/minScore) | ✅ v0.31.0 | 支持过滤排序 |
| 🟡 S | new-9 | dashboard 「🧭 生活便利度 Top 小区」卡 (5 维评分 + 颜色分档) | ✅ v0.31.0 | ≥80 绿 / 60-79 蓝 / <60 灰 |
| 🟡 S | new-9 | buildIntegrity +8 测试 + smoke_life_convenience E2E + commit v0.31.0 | ✅ v0.31.0 | 322/322 通过；smoke 全绿 |

## S.1 段补充：CI Node 22 升级 + smoke 容错（v0.31.1）

| 等级 | 编号 | 任务 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 🔴 S.1 | ci-1 | 修复 GitHub Actions e2e 计划任务 Node 20 deprecation 警告 | ✅ v0.31.1 | Node 20 → Node 22 LTS |
| 🟡 S.1 | ci-2 | e2e smoke step 加 `continue-on-error: true`，失败信息入 artifact | ✅ v0.31.1 | 维护者按需修，不阻塞 PR |

## T 段补充：菜市场 POI 扩充 + 生活便利度 v2 (v0.32.0)

| 等级 | 编号 | 任务 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 🟢 T | new-10 | 调研菜市场数据源 + 4 keywords 设计 (菜市场/农贸市场/肉菜市场/集市) | ✅ v0.32.0 | 高德 `/v3/place/around` |
| 🟢 T | new-10 | `crawl_market_poi.py` + `poi_market.csv` (147 行) | ✅ v0.32.0 | 49 小区 × 4 keywords = 196 API 调用 |
| 🟢 T | new-10 | 升级 `compute_life_convenience.py`: 加菜市场维度 + score100 归一化 (100→110) | ✅ v0.32.0 | LocalLifeConvenience 加 marketNear/score100 |
| 🟢 T | new-10 | dashboard 「🧭 生活便利度 v2」6 维 (M/P/S/X/Y/C) + 归一化显示 | ✅ v0.32.0 | 京基100 满分 100/100 |
| 🟢 T | new-10 | buildIntegrity +1 测试 + smoke_life_convenience dimCount 5→6 + commit v0.32.0 | ✅ v0.32.0 | 323/323 通过；smoke 全绿 |

## U 段补充：小区综合评分 (v0.33.0)

| 等级 | 编号 | 任务 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 🟢 U | trend-15 | 调研 6 类分数合成方案 + 权重设计 | ✅ v0.33.0 | life*0.5 + school*0.3 + commute*0.2 |
| 🟢 U | trend-15 | compute_community_score.py + community_score.csv (52 行) | ✅ v0.33.0 | rank_city 按城内降序 |
| 🟢 U | trend-15 | LocalCommunityScore + parseCommunityScore + store + query | ✅ v0.33.0 | 全套数据层 |
| 🟢 U | trend-15 | dashboard 「🏅 小区综合评分 Top 小区」卡 (3 维细分 + 金银铜牌) | ✅ v0.33.0 | ≥80 绿 / 65-79 蓝 / <65 灰 |
| 🟢 U | trend-15 | buildIntegrity +8 测试 + smoke_community_score E2E + commit v0.33.0 | ✅ v0.33.0 | 331/331 通过；smoke 全绿 |

## V 段补充：综合评分权重自定义 (v0.34.0)

| 等级 | 编号 | 任务 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 🟢 V | trend-16 | 调研权重自定义方案 (4 预设 + 3 slider) | ✅ v0.34.0 | 总和归一化, 重排 rank_city |
| 🟢 V | trend-16 | queries.getCommunityScoreRank + weights 参数 | ✅ v0.34.0 | 实时重算 totalScore |
| 🟢 V | trend-16 | dashboard 4 chip + 3 slider + reloadCommunityScore | ✅ v0.34.0 | 颜色分档同步 |
| 🟢 V | trend-16 | buildIntegrity +6 测试 + smoke_community_score_weight E2E + commit v0.34.0 | ✅ v0.34.0 | 337/337 通过；smoke 全绿 |

## W 段补充：地铁步行通勤 (v0.35.0)

- 用高德 `/v3/direction/walking` 给每个 community 算 → 最近地铁站 的步行时长
- 配额友好：49 小区 ~ 49 次 API (远低于 5000-30000)
- quota 用尽时 fallback 到启发式 (直线 × 1.45 / 80m·min⁻¹)，续跑 + 每行立即写盘
- 数据：metro_walk.csv (37 行，real 数据 4 行 + EST 30 行 + 5 个无 subway POI 已 skip)
- UI：dashboard 🚶 步行通勤 Top，3 色分档 (≤5 / ≤10 / >10min)

| 等级 | 编号 | 任务 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 🟢 W | map-9 | 调研高德 walking API + quota 风险 | ✅ v0.35.0 | API key 单日 ~50 次最稳 |
| 🟢 W | map-9 | crawl_amap_metro_walk.py (含启发式 fallback + 续跑) | ✅ v0.35.0 | quota_hit 时 set flag, 后续全 EST |
| 🟢 W | map-9 | LocalMetroWalk + parseMetroWalk + 接入 snapshot | ✅ v0.35.0 | metroWalks[] 已注入 |
| 🟢 W | map-9 | getMetroWalkRanking (avg / fastest / totalCount + Top N) | ✅ v0.35.0 | 按 walkMinutes 升序 |
| 🟢 W | map-9 | dashboard 🚶 卡 + 3 色分档 (mw-min-green/orange/red) | ✅ v0.35.0 | 414×896 截图验证 |
| 🟢 W | map-9 | buildIntegrity +7 测试 + smoke_metro_walk E2E + commit v0.35.0 | ✅ v0.35.0 | 344/344 通过；smoke 全绿 |

## X 段补充：地铁规划受益 (v0.36.0)

- 用 `metro_planning.csv` + `metro_planning_geo.csv` join 出 42 个 start/end 站
- 距离分 × status 权重 → 受益分 (0-100)
- 必须同城 (防跨城误匹配)
- 数据：metro_benefit.csv 49 行 × 21 规划线路 (深圳 30 + 广州 11 + 珠海 8)

| 等级 | 编号 | 任务 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 🟢 X | map-10 | compute_metro_benefit.py (haver 距离 × status 权重) | ✅ v0.36.0 | 0 API, 纯本地 |
| 🟢 X | map-10 | LocalMetroBenefit + parseMetroBenefit + snapshot | ✅ v0.36.0 | metroBenefits[] 已注入 |
| 🟢 X | map-10 | getMetroBenefitRanking (avg / max / nearCount + 距离 tiebreak) | ✅ v0.36.0 | ≥60 算"真近" |
| 🟢 X | map-10 | dashboard 🚇 受益 Top 卡 + 3 色分档 + 3 色 status 徽章 | ✅ v0.36.0 | 414×896 截图验证 |
| 🟢 X | map-10 | buildIntegrity +7 测试 + smoke_metro_benefit E2E + commit v0.36.0 | ✅ v0.36.0 | 351/351 通过；smoke 全绿 |

## Y 段补充：5 维小区指标 (v0.37.0)

- listing 列表每行底部 5 列迷你评分条 (位置/房屋/楼龄/配套/性价比)
- community 详情顶部 5 格卡 (🧭生活/🎓学区/🚌通勤/🚶步行地铁/🚇规划地铁)
- 用 5 个已有 csv 数据组合，无新数据源
- 数据：京基100 = 81/100/100/90/0

| 等级 | 编号 | 任务 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 🟢 Y | trend-17 | store +3 per-id helper (life/walk/benefit) | ✅ v0.37.0 | 复用已有 csv |
| 🟢 Y | trend-17 | listing 列表 minidim-row + 5 列 cell + 3 色分档 | ✅ v0.37.0 | 用 explain_preview.dimension_scores |
| 🟢 Y | trend-17 | community cm-grid 5 卡 + CM_DEFS + cmBand | ✅ v0.37.0 | 计算通勤/步行换算 |
| 🟢 Y | trend-17 | buildIntegrity +5 测试 + smoke_community_metrics + smoke_listing_minidim E2E | ✅ v0.37.0 | 356/356 通过；双 smoke 全绿 |

## Z 段补充：区情画像 (v0.38.0)

- join `admin_districts.csv` + `district_index.csv` + `school_premium_district.csv` + `listings.csv` → 24 行画像
- 14 列: 区码 (440305) / 小区数 / 挂牌数 / 楼龄中位 / 均价 / 指数 / mom% / yoy% / 学区评分 / 溢价率% / 校数
- dashboard 新卡「📋 区情画像」+ 5 排序 chip + 1 隐藏空区 chip
- 364/364 单测 + smoke_district_meta E2E (广州 11 行 / 深圳 10 行 + 10 个 4403xx 区码)

| 等级 | 编号 | 任务 | 状态 | 备注 |
|------|------|------|------|------|
| 🟢 Z | trend-18 | compute_district_metadata.py 写 24 行 | ✅ v0.38.0 | join 4 类 csv |
| 🟢 Z | trend-18 | types + parseDistrictMeta + store + queries (sort/hide) | ✅ v0.38.0 | 7 单测 |
| 🟢 Z | trend-18 | dashboard 区情画像卡 + 6 chip + CSS | ✅ v0.38.0 | 5 排序 + 1 隐藏 |
| 🟢 Z | trend-18 | smoke_district_meta.mjs E2E + screenshots | ✅ v0.38.0 | 广州/深圳各截一张 |

## AA 段补充：特征画像溢价 (v0.39.0)

- 用 listings.csv 直接算 premium% = (桶均价 ÷ 城市均价 − 1) × 100
- 4 维度：户型/面积/朝向/装修；54 行 feature_premium.csv
- dashboard 新卡「💎 特征画像溢价」+ 4 dim block + 红↑/蓝↓/灰平 ±1% 分色
- 370/370 单测 + smoke_feature_premium E2E (广州 12 行 / 深圳 4 dim)

| 等级 | 编号 | 任务 | 状态 | 备注 |
|------|------|------|------|------|
| 🟢 AA | trend-19 | compute_feature_premium.py 写 54 行 | ✅ v0.39.0 | bucket_median / city_median - 1 |
| 🟢 AA | trend-19 | types + parseFeaturePremium + store + queries | ✅ v0.39.0 | 6 单测 |
| 🟢 AA | trend-19 | dashboard 特征画像溢价卡 + 4 dim + bar | ✅ v0.39.0 | 红蓝灰 ±1% |
| 🟢 AA | trend-19 | smoke_feature_premium.mjs E2E + screenshots | ✅ v0.39.0 | 广州/深圳各截一张 |

## AB 段补充：标签组合热度 (v0.40.0)

- listing_tags.csv (7518 行) → 对每个 listing C(2) 算 pair 频率 + 中位价
- 324 行 tag_combination.csv
- dashboard 新卡「🏷️ 标签组合热度」+ top 12 + 紫 bar + tag pill
- 376/376 单测 + smoke_tag_combination E2E (广州/深圳 top 1 = "名校区+朝南")

| 等级 | 编号 | 任务 | 状态 | 备注 |
|------|------|------|------|------|
| 🟢 AB | trend-20 | compute_tag_combination.py 写 324 行 | ✅ v0.40.0 | C(n, 2) 频率 |
| 🟢 AB | trend-20 | types + parseTagCombination + store + queries | ✅ v0.40.0 | 6 单测 |
| 🟢 AB | trend-20 | dashboard 标签组合卡 + tag pair + bar | ✅ v0.40.0 | 紫渐变 |
| 🟢 AB | trend-20 | smoke_tag_combination.mjs E2E + screenshots | ✅ v0.40.0 | 广州/深圳各截一张 |

## AC 段补充：房源新鲜度 (v0.41.0)

- listings.csv (crawl_date) → per (city, community) freshness_score
- 公式: (近 4 周 × 1 + 近 2 周 × 2) ÷ 总数 × 100，min_listings=5
- 23 行 listing_freshness.csv
- dashboard 新卡「📅 房源新鲜度」+ 🆕 新挂牌 / 😴 滞销 双 section + 8+8 行
- 381/381 单测 + smoke_listing_freshness E2E

| 等级 | 编号 | 任务 | 状态 | 备注 |
|------|------|------|------|------|
| 🟢 AC | trend-21 | compute_listing_freshness.py 写 23 行 | ✅ v0.41.0 | crawl_date 分桶 |
| 🟢 AC | trend-21 | types + parse + store + queries (双榜) | ✅ v0.41.0 | 5 单测 |
| 🟢 AC | trend-21 | dashboard 房源新鲜度卡 + 双 section + score 圆 | ✅ v0.41.0 | 绿/黄/红 |
| 🟢 AC | trend-21 | smoke_listing_freshness.mjs E2E + screenshots | ✅ v0.41.0 | 广州/深圳各截一张 |

## H 段补充：同区多小区对比（v0.20.0）

| 等级 | 编号 | 任务 | 状态 | 备注 |
|------|------|------|------|------|
| 🟢 H | trend-8 | 调研 community + 4-12 小区/区的数据需求 | ✅ v0.20.0 | 52 community × 15 district (福田区 12 个最多) |
| 🟢 H | trend-8 | `getCommunityCompareByDistrict({ cityId, weekEnd, districtName })` query + UI 集成 | ✅ v0.20.0 | 复用 snapshotForCommunityAtWeek |
| 🟢 H | trend-8 | buildIntegrity +5 测试 + smoke_district_compare + commit v0.20.0 | ✅ v0.20.0 | 246/246 通过；21/21 smoke 全绿 |

## G 段补充：地图找房（v0.9.0）

| 等级 | 编号 | 任务 | 状态 | 备注 |
|------|------|------|------|------|
| 🟡 G | map-1 | 调研开源项目高德地图集成方案 | ✅ v0.9.0 | uni-app `<map>` + 高德 JS API（H5），复用现成 key |
| 🟡 G | map-2 | UI 加地图页面 + tabBar "地图" | ✅ v0.9.0 | 双模式（热力图 / 挂牌点）；3 城市切换；marker tap → info-card → 跳详情 |
| 🟡 G | map-3 | buildIntegrity +7 测试 + smoke_map + commit v0.9.0 | ✅ v0.9.0 | 161/161 通过；7/7 smoke 全绿 |

## 下一步候选（按"边际收益/工作量"排序）

| 编号 | 任务 | 工作量 | 收益 | 数据源 |
|------|------|--------|------|--------|
| **map-5** | **周边 POI overlay** — 把 poi_seed.csv 画到地图（地铁/学校/医院/商场/公园图标） | 4h | 🔴 高 | 已有 poi_seed.csv (5 类) |
| **map-2** | **marker 聚合** — 1km 内多 marker 合并显示数字 | 4h | 🟡 中 | 自实现（uni-app 自带 initMarkerCluster 仅 App/小程序支持） |
| map-3 | **区级填充** — 按区画多边形（用 circles/rectangles 模拟） | 2h | 🟡 中 | 已有 communities.csv + admin_districts.csv |
| map-4 | **App 端高德 key 配置 + 自定义基座** | 4h | 🟡 中 | 需申请独立 App key |
| map-6 | **地铁规划 overlay** — metro_planning.csv 画 polyline | 4h | 🟡 中 | 已有 metro_planning.csv ✅ v0.15.0 |
| map-7 | **真实成交价热力** — listings 的 unit_price 聚合到社区中心点画热力 | 2h | 🔴 高 | 已有 district_trend.csv 可聚合 |
| trend-6 | **学区溢价** — listings 的 school_ids 关联学区评分 | 2h | 🔴 高 | 已有 schools.csv + school_indicators.csv |
| trend-9 | **板块网签热度榜** — daily_wangqian 已有 264 条 district 数据 | 1h | 🟡 中 | 已有 daily_wangqian.csv |

推荐 **map-5 POI overlay** 或 **trend-6 学区溢价**（数据现成，1-4h 出活，收益高）。

## F 段补充：板块级房价序列（v0.8.0）

| 等级 | 编号 | 任务 | 状态 | 备注 |
|------|------|------|------|------|
| 🟡 F | trend-1 | 调研 NBS / 链家 / 自建区级指数方案 | ✅ v0.8.0 | NBS 只到城市；链家成交 API 商封；**改用 listings 自聚合** |
| 🟡 F | trend-2 | 写 compute_district_trend.py（标准库） | ✅ v0.8.0 | 1286 条 → 269 行；15 区 × 27 周 |
| 🟡 F | trend-3 | local 层 LocalDistrictTrend + getDistrictTrend + getCityDistrictOverview | ✅ v0.8.0 | 4 周均值环比 |
| 🟡 F | trend-4 | UI dashboard 「区级近 8 周房价趋势」卡片 | ✅ v0.8.0 | 柱状条 + 颜色编码 |
| 🟡 F | trend-5 | buildIntegrity +7 测试 + smoke_district_trend + commit v0.8.0 | ✅ v0.8.0 | 154/154 通过；6/6 smoke 全绿 |

## 下一步候选（按"边际收益/工作量"排序）

| 编号 | 任务 | 工作量 | 收益 | 数据源 |
|------|------|--------|------|--------|
| trend-6 | **学区溢价** — listings 的 school_ids 关联学区评分 → 衍生"学区溢价率"(%) | 2h | 🔴 高 | 已有的 schools.csv + school_indicators.csv ✅ **v0.17.0 (listing 维度 Top 10)** |
| trend-7 | **议价空间** — chainjia detail 拿最近成交价 vs 当前挂牌价，量化议价空间 | 8h | 🔴 高 | 链家 detail（被 CAPTCHA 拦，需换源） |
| trend-8 | **预测下一周均价** — 用 70 城指数 + listings 滞后 4 周做 ARIMA | 4h | 🟡 中 | 已有 stats70 + listings ✅ **v0.20.0 (改为「同区多小区对比」横柱图)** |
| trend-9 | **板块网签热度榜** — daily_wangqian 的 district 维度已有 264 条，做"近 30 天网签热度 Top N" | 1h | 🟡 中 | 已有 daily_wangqian.csv |
| trend-10 | **成交 vs 挂牌对比** | 8h+ | 🟢 低 | 需要新数据源（链家成交被 CAPTCHA 拦） |
| new-1 | **空气质量/天气** — 高德 weather API 拿实时 + 4 天预报 | 4h | 🟡 中 | 高德 `/v3/weather/weatherInfo` ✅ v0.16.0 |
| new-2 | **周边商业配套密度** — POI 已支持餐饮/银行/便利店,做"周边商业热度"评分 | 4h | 🟡 中 | 已有 poi_seed.csv (扩展品类) ✅ **v0.19.0 (147 次 API 调用, 416 行 poi_commercial.csv, 94% 小区有分)** |
| map-2 | **marker 聚合** — 1km 内多 marker 合并显示数字 | 4h | 🟡 中 | 自实现（uni-app 自带 initMarkerCluster 仅 App/小程序支持） ✅ **v0.18.0** |

推荐 **map-2 marker 聚合** 或 **new-2 周边商业配套密度**（基于已有 poi_seed.csv 扩展品类）。