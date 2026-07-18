# Realty App — 数据来源与可信度分级

本文档记录手机端 `realty_app` 的宏观数据、挂牌数据、派生样本和完整快照更新方式。所有单套房源必须通过 `source_kind` 明确区分真实挂牌与派生样本。

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

| 类别 | Endpoint | 口径(scope) | 说明 |
|------|----------|------|------|
| 全市历史 | `POST …/getFjzsInfoData` `{startDate,endDate,dateType:""}` | 住宅 | 近 90 天可回溯；新房/二手套数+面积；走势页柱状图，Y 轴「商品住房成交量」 |
| 新房分区（最新日） | `POST …/getYsfCjxxGsDataNew` | 住宅 | 「商品住房成交套数」按区；**分区合计 = 走势新房（已实测 70=70）** |
| 二手分区（最新日） | `POST …/getEsfCjxxGsDataNew` | 全部 | 「二手房成交套数」按区（含非住宅）；**分区合计 = 全部二手 ≠ 走势住宅二手** |
| 新房月度分区 | `POST …/getYsfCjxxGsMonthDataNew` | 住宅 | 最近完整月「商品住房」按区累计（如 2026-06 全市 2413 套）；granularity=month/month_district |
| 二手月度分区 | `POST …/getEsfCjxxGsMonthDataNew` | 全部 | 最近完整月「二手房」按区累计（如 2026-06 全市 6214 套）；含全部 11 行政区 |

> 月度接口带全部 11 个行政区，是 App 里唯一能看到「全市各区」成交的来源
> （挂牌 listings 仅覆盖少数区）。

**两套口径为什么不同（已实测，非猜测）**

- 走势页 `getFjzsInfoData` 二手 = **住宅口径**（商品住房），如 2026-07-01 = **188 套**。
- 分区公示 `getEsfCjxxGsDataNew` 二手 = **全部口径**（含非住宅/商办），同日 = **239 套**。
- 差额 51 套即非住宅二手（套均约 69㎡，明显小于住宅套均 102㎡，与「小面积商办」一致）。
- 新房两套都是「商品住房（住宅）」，故一致（70=70）。

App 因此把二手拆成「住宅 / 全部」两列都展示，不再互相覆盖或隐藏。可用
`scripts/verify_sz_wangqian_apis.py` 复验两套接口。

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

`date, city, category, scope, district, units, area_sqm, granularity, source_url`

| 字段 | 说明 |
|------|------|
| `date` | `YYYY-MM-DD` 交易日 |
| `city` | `深圳` / `广州` |
| `category` | `新房` / `二手` |
| `scope` | `住宅`（走势页 getFjzsInfoData，可回溯 90 天）/ `全部`（分区公示，含非住宅二手，仅最新日） |
| `district` | `全市` 或行政区名 |
| `units` | 成交套数 |
| `area_sqm` | 成交面积（平方米） |
| `granularity` | `city` 全市汇总 / `district` 分区 |
| `source_url` | 政府公示页链接 |

> 旧 CSV 无 `scope` 列时，加载器按 `source_url`（含 `housePriceTrendInfo` → 住宅）与
> `category+granularity`（二手+district → 全部）自动推断，向后兼容。

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

## 3. 房源数据与可信度分级

`static/seed/listings.csv` 增加 `source_kind` 字段：

| 值 | 含义 | 当前数据 |
|---|---|---|
| `REAL` | 从公开挂牌页面解析到的真实挂牌记录 | 链家在售 60 条；每周安居客刷新成功后也使用此等级 |
| `DERIVED` | 用公开城市指数、市场参考价和固定随机种子生成的分析样本 | 内置包 1226 条；不代表真实逐套挂牌或成交 |
| `ESTIMATED` | 距离、通勤等启发式估算数据 | 主要用于 `metro_walk.csv` 等配套指标 |
| `UNKNOWN` | 历史或外部 CSV 未提供可信度等级 | UI 显示“来源未分级” |

派生样本由 `scripts/seed_real_data.py` 生成。其小区名和城市级参考口径来自公开资料，但面积、户型、楼层、装修及单套价格扰动是程序生成值，不能标记为“住建局逐套成交”。详情页会显示黄色“派生样本”提示。

### 3.1 完整快照更新

远程刷新不再只替换 `listings.csv`。流程如下：

1. `crawl_anjuke.py` 更新真实挂牌；
2. `rebuild_listing_derivatives.py` 重建所有受房源影响的趋势、标签、评分和画像 CSV；
3. `publish_csv.py` 为整个 `static/seed/*.csv` 生成 `snapshot_sha256`、schema 版本和逐文件行数；
4. App 下载并验证整套快照，全部成功后才一次性替换内存数据。

这样可以避免新 listings 混用旧的 `district_trend.csv`、`listing_tags.csv` 或 `community_score.csv`。

---

## 4. 数据与 App 模块关系

```
stats_70.csv          → stats70.ts      → 70 城价格指数（月度）
daily_wangqian.csv    → dailyWangqian.ts → 深广网签（日更）
static/seed/*.csv      → seedSnapshot / snapshotLoader → 完整业务快照
```

宏观数据与业务快照相互独立，在 `App.vue` 启动时分别注入内存 store。

---

## 5. 免责声明

政府数据以官网公布为准；真实挂牌以来源页面当时展示为准；`DERIVED` / `ESTIMATED` 数据仅用于产品演示和方法研究，不构成真实房源、成交记录或投资建议。请遵守数据来源网站使用条款。
