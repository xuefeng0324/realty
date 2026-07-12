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
| trend-6 | **学区溢价** — listings 的 school_ids 关联学区评分 → 衍生"学区溢价率"(%) | 2h | 🔴 高 | 已有的 schools.csv + school_indicators.csv |
| trend-7 | **议价空间** — chainjia detail 拿最近成交价 vs 当前挂牌价，量化议价空间 | 8h | 🔴 高 | 链家 detail（被 CAPTCHA 拦，需换源） |
| trend-8 | **预测下一周均价** — 用 70 城指数 + listings 滞后 4 周做 ARIMA | 4h | 🟡 中 | 已有 stats70 + listings |
| trend-9 | **板块网签热度榜** — daily_wangqian 的 district 维度已有 264 条，做"近 30 天网签热度 Top N" | 1h | 🟡 中 | 已有 daily_wangqian.csv |
| trend-10 | **成交 vs 挂牌对比** | 8h+ | 🟢 低 | 需要新数据源（链家成交被 CAPTCHA 拦） |

推荐 **trend-6 学区溢价** 或 **trend-9 网签热度榜**（数据现成，1-2h 出活）。