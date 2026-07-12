# Realty App（手机端 · 纯 app 模式）

电脑端是 Vue 3 + ECharts 的网页 + 电脑端 FastAPI 后端。这一版手机端 App **不再依赖电脑**：评分规则在手机上实时计算，数据存在手机本地（内存版，阶段 A；后续可接 SQLite）。

## 版本信息

| 版本 | 发布日期 | 说明 |
|------|----------|------|
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

## License

与主仓库一致（`LICENSE`）。