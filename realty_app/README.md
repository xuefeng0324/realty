# Realty App（手机端 · 纯 app 模式）

电脑端是 Vue 3 + ECharts 的网页 + 电脑端 FastAPI 后端。这一版手机端 App **不再依赖电脑**：评分规则在手机上实时计算，数据存在手机本地（内存版，阶段 A；后续可接 SQLite）。

## 版本信息

| 版本 | 发布日期 | 说明 |
|------|----------|------|
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
│  │  ├─ demoData.ts      # 程序化生成 demo
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

提交代码前建议完成：

| 项目 | 说明 |
|------|------|
| 测试 | `npm run test` 通过 |
| 更新版本信息 | README 顶部版本表**新增**一行（不修改历史版本） |
| 更新 changelog | `changelog/YYYY-MM-DD-v版本-变更标题.md` |
| 数据来源变更 | 同步更新 `DATA_SOURCES.md` |
| 政府 CSV 变更 | 跑对应 `scripts/crawl_*.py`，一并提交 `static/*.csv` |

**Commit 格式**（与主仓库一致）：`feat(realty_app): …` / `fix(crawl): …` / `data(wangqian): …` / `docs(realty_app): …`

## 更新日志

详细变更见 [changelog/](./changelog/) 目录。

### v0.2.0 (2026-07-01)

**深广每日网签抓取与 App 接入**

- 新增 `crawl_daily_wangqian.py` 与 `daily_wangqian.csv`
- Dashboard / stats70 展示政府网签；工作日 GitHub Actions 自动 merge

## License

与主仓库一致（`LICENSE`）。