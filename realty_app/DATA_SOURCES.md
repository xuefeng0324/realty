# Realty App — 政府宏观数据来源

本文档记录手机端 `realty_app` 使用的**政府公开宏观数据**来源、字段含义与更新方式。单套挂牌数据见 `src/local/importer.ts` 与 `scripts/crawl_anjuke.py`（安居客，CI 易被封）。

---

## 1. 国家统计局 70 城价格指数

| 属性 | 值 |
|------|-----|
| **脚本** | `scripts/crawl_stats_70.py` |
| **App CSV** | `static/stats_70.csv` |
| **加载模块** | `src/local/stats70.ts` |
| **维度** | 月度；同比 / 环比；新建 / 二手住宅价格指数 |
| **更新** | 手动跑脚本，或复用 hugohe3/70cityprice 第三方整理版 |

**窄表字段**：`date, city, fixed_base, new_idx, second_idx`

- `fixed_base`：`同比` 或 `环比`
- 指数基期 = 100，>100 上涨，<100 下跌

---

## 2. 深圳 / 广州每日网签（成交套数）

| 属性 | 值 |
|------|-----|
| **脚本** | `scripts/crawl_daily_wangqian.py` |
| **App CSV** | `static/daily_wangqian.csv` |
| **远端 meta** | `static/wangqian_meta.json`（`publish_wangqian_meta.py` 生成） |
| **App 刷新** | `src/local/wangqianDataRefresher.ts`；设置页「刷新网签」；启动时静默拉取 |
| **加载模块** | `src/local/dailyWangqian.ts` |
| **CI** | `.github/workflows/crawl-daily-wangqian.yml`（工作日 09:30 北京时间） |
| **维度** | 日更；全市 + 行政区；套数 + 面积（㎡） |

### 2.1 深圳 — 住建局 fdc 子站

| 类别 | Endpoint | 说明 |
|------|----------|------|
| 全市历史 | `POST …/getFjzsInfoData` `{startDate,endDate,dateType:""}` | 近 90 天可回溯；新房/二手套数+面积 |
| 新房分区（最新日） | `POST …/getYsfCjxxGsDataNew` | 商品房成交按区 |
| 二手分区（最新日） | `POST …/getEsfCjxxGsDataNew` | 二手房成交按区 |

- 趋势页：https://fdc.zjj.sz.gov.cn/public/marketInfo/housePriceTrendInfo.html
- 公示入口：http://zjj.sz.gov.cn/xxgk/ztzl/pubdata/
- 无需登录

### 2.1.1 暂不可用（需登录）

| 资源 | 说明 |
|------|------|
| `zjj.sz.gov.cn:8004` 房源库 | 预售/现售/二手房源明细，办事平台 |
| `fdc…/szfdccommon/#/publicInfo` | 预售许可等，`/szfdccommon/api/publicInfo/list` 返回 401 |

### 2.2 广州 — 商品房销售统计

| 类别 | Endpoint | 说明 |
|------|----------|------|
| 新房签约 | `GET https://zfcj.gz.gov.cn/ysqgk/Api/WebApi/mrxjspfqyxx.ashx` | 住宅 `zhuZaiTaoShu` / `zhuZaiArea`（按区） |

- 入口页面：<https://zfcj.gz.gov.cn/zfcj/tjxx/spfxstjxx>
- 同页面另有 `mrxjspfksxx`（可售）、`mrxjspfwsxx`（未售），本 App **未使用**
- 广州二手房月度统计为图片公告（存量房交易登记统计信息），**暂无日更 API**

### 2.3 CSV 字段

`date, city, category, district, units, area_sqm, granularity, source_url`

| 字段 | 说明 |
|------|------|
| `date` | `YYYY-MM-DD` 交易日 |
| `city` | `深圳` / `广州` |
| `category` | `新房` / `二手` |
| `district` | `全市` 或行政区名 |
| `units` | 成交套数 |
| `area_sqm` | 成交面积（平方米） |
| `granularity` | `city` 全市汇总 / `district` 分区 |
| `source_url` | 政府公示页链接 |

### 2.4 本地 / CI 更新

```bash
cd realty_app

# 抓取最新交易日（覆盖写）
python scripts/crawl_daily_wangqian.py fetch

# 与已有 CSV 去重合并（推荐每日定时）
python scripts/crawl_daily_wangqian.py fetch --merge

# 仅抓单城
python scripts/crawl_daily_wangqian.py fetch --city 深圳 --merge
```

---

## 3. 数据与 App 模块关系

```
stats_70.csv          → stats70.ts      → 70 城价格指数（月度）
daily_wangqian.csv    → dailyWangqian.ts → 深广网签（日更）
static/seed/listings.csv → seedSnapshot  → 单套挂牌（种子/远程刷新）
```

三类数据**相互独立**，在 `App.vue` 启动时分别注入内存 store。

---

## 4. 免责声明

政府数据以官网公布为准；脚本仅作技术聚合与学习用途，不构成投资建议。请遵守数据来源网站使用条款。
