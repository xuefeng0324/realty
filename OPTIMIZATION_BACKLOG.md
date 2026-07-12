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