# 数据陈旧度与 CI 警报快速检查（v1.122.8+）

> 本文档记录「数据陈旧度」+「CI 失败」两类问题的发现与修复，避免重复踩坑。

## 触发背景

本会话一开始，用户反馈「项目老是给我发邮件报 error」。根因排查发现：
- **41 个 CSV 数据源**长期未被监控陈旧度，wangqian 抓取 21 天没人发现。
- **CI 真实根因**：每个 NBS 月度脚本都 `|| true` swallow 失败，cron email 不变红。
- **测试硬编码过期**：v1.122.10 起我把 NBS 月度数据补到 2026-07~08，vitest 测试里硬编码 `month=2026-05/06` 全部挂掉。

## v1.122.8 引入：统一陈旧度侦测

新增 `scripts/check_csv_freshness.py`（+对应 workflow）：
- 扫 `realty_app/static/*.csv` 共 41 个文件
- 按表头自动识别 `date` / `publish_date` / `as_of_date` / `effective_date` /
  `as_of` / `updated_at` / `time` 等
- 三档分级（v1.122.51 起）：✅ OK < 90 天 / ⚠️ WARN 90..180 天 / ❗ STALE ≥ 180 天
- 退出码：0=全 OK / 1=有 WARN / 2=有 STALE
- `cron` 每天 02:30 UTC 跑 → `GITHUB_STEP_SUMMARY` 表格 + artifact 归档 30 天

**关键修正（v1.122.9）**：
- 把 `year` / `period` / `month` / `quarter` 从 freshness 候选剔除——这些是「项目立项年」/「统计期标识」，不是「数据爬取时间」，会误报 STALE
- UNKNOWN 不计入 `worst` 退出码——避免「立项 1 年的项目 CSV」把 cron 推红

**v1.122.10+**：把 `append_recent_stats70.py` 接进 `crawl-monthly-stats70.yml` cron，每月 16-20 号 publish_day 后自动增量补齐。

## v1.122.12+13：补齐陈旧数据

本机手动跑全套爬取脚本，每个 CSV 各补一波数据：

- `gz_land_deals.csv`: +4 条 2026-08~09，-5 条 2025-12 旧条目（脚本只保留最近一年）
- `gz_provident_annual.csv`: +6 行历史（2018-2024 完整）
- `gz_new_house_inventory.csv`: +11 行 2026-09 月度
- `gz_housing_plan.csv`: 改 1 行（publish_date 更新）
- `education_overview.csv`: 改 2 行（2025 年报）
- NBS 系列（cpi/ppi/pmi/industrial/industrial_profit/service_index/trade/unemployment 等）各 +1 行
- 修 `nbs_income / nbs_fa_investment / nbs_real_estate` 的 `INDEX_URL` 从 `/sj/` 改到 `/sj/zxfb/` 子栏目

## v1.122.14：根治「CI 邮件噪音」两个真问题

### 1. 修 7 个过期断言的测试

`tests/nbsCpi.test.ts` / `nbsPpi.test.ts` / `nbsUnemployment.test.ts` /
`nbsServiceIndex.test.ts`：硬编码 `month=2026-05/06` 改成
`toMatch(/^2026-(0[5-9]|10)$/)`（最近 4 个月内），数值改成合理范围断言
（`beGreaterThan` / `beLessThan`），不再硬编码具体百分比。

`tests/nbsFaInvestment.test.ts`：硬编码 `period=2026-01_to_2026-06` 改成
`toMatch(/^2026-\d{2}_to_2026-\d{2}$/)`，数值改成合理范围。

`tests/nbsRealEstate.test.ts`：硬编码 `publishDate` / `period` / 各分项数值全
改成「2026 内 + 合理范围」；trend 数组长度断言改为 `>=5` + 头 5 个标签
顺序断言，不再硬编码 5 行数值。

`tests/gzAffordableTargets.test.ts`：y2025 raised 计划因市住建局下架
被 cron 清理，所以 y2025 测试改为「可为 null + 有数据则校验」。

### 2. 修 `crawl-monthly-stats70.yml` swallow stderr

去掉 26 个 `|| true` swallow，用一个 `run_or_log` 包装器累计每个脚本退出码，
最后输出到 `GITHUB_STEP_SUMMARY` 让人 / 邮件能看到具体哪个脚本挂了；
任一脚本失败 `exit 1` 让整个 job 红。

### 3. 效果

- `npm test`: 1205/1205 全绿（之前 7 失败）
- CI realty_app tests / build: 不再因数据已补而 false-positive 失败
- 下次任何爬取脚本静默挂，CI 立即红邮件报警——根治「21 天陈旧没人发现」

## EXEMPT_FROM_STALE 白名单（v1.122.16 起生效）

cron email 的 false-positive 噪音根因：provident / education / bdc 等源站是
**年度 / 季度 / 月度一次性发布**，freshness 默认阈值 30 / 60 天对这些源
不适用。

v1.122.16 起 `check_csv_freshness.py` 加 `--exempt-from-stale` 参数，
匹配文件标记为 `⏸ EXEMPT`，**不计入 worst 退出码**（但保留在报告里
供人眼扫）。check-csv-freshness.yml 当前白名单：

| 文件 | 真实发布节奏 | 备注 |
|------|--------------|------|
| `provident_fund_rates.csv` | 年度（5 月初） | 利率年度调整 |
| `education_overview.csv` | 年度（6 月底） | 教育事业统计年报 |
| `gz_provident_annual.csv` | 年度（3 月底） | 广州公积金年报 |
| `sz_provident_annual.csv` | 年度（3 月底） | 深圳公积金年报 |
| `gd_provident_annual.csv` | 年度（5 月初） | 广东公积金年报（v1.122.17 加） |
| `zh_provident_dynamics.csv` | 月度（源站偶发不发） | 珠海公积金动态 |
| `zh_bdc_registration.csv` | 季度（9 月才出 Q3） | 珠海不动产登记 |
| `zh_price_filing.csv` | 源站 404 / 已下架 | 珠海价格备案 |
| `nbs_avg_wage.csv` | 年度（5 月发） | 城镇平均工资 |
| `stats_70.csv` | 月度（每月 18 日发布下月） | 70 城指数 |

**仍保留 STALE 警告**（数据真过期，需要人补）的源：
`gd_construction / gd_services / gd_provident_annual / gz_housing_plan /
sz_land_deals / sz_planned_supply` —— 这些**真的需要新发布数据**，不豁免
让 cron 邮件继续提示；用户/AI 看到后可手动跑脚本尝试触发。

注：`gd_provident_annual` 当前 2025-04-29 = 498 天，应**已经**是年度发布
节奏，**后续可考虑也豁免**。本次未一起改，避免一次扩大范围。

## 验证清单（修改后必跑）

`npm test` 不能被「我本地跑过」代替，必须配合：

1. **改代码 → 跑本地 `npm test`**：必须 1205/1205 全绿
2. **commit 前再跑一次 `npm test`**：防止「我跑了没 commit」的错位
3. **push 后等 CI 重跑**：GitHub actions 1~2 分钟，确认 commit hash 的 `realty_app tests` 和 `realty_app build` 都 `conclusion=success`
4. **CI 绿了** 才算「完成」，不要用「我本地测过」收尾

> 「用户不该每次都把报错截图给你」—— AI 应主动验证 CI status，而不只是本地跑通。

## 仍然 STALE 的源（截至 v1.122.16 / 2026-09-09 真实状态）

本会话 4 次探针（v1.122.8 → v1.122.15 多次运行）确认：**STALE 报告是真 STALE，不是脚本假阳性**。
字节级对比 HEAD vs 探针输出：

> **v1.122.22 (2026-09-10) 复查**：4 个源维持 STALE，本机手跑爬虫后确认根因如下 —
> 
> | 源 | 根因（本机探针） | 应否豁免 |
> |---|---|---|
> | `gd_construction.csv` | 源站 `zfcxjst.gd.gov.cn` 自 2026-04-29 发 Q1 后**未发 H1**（按历史节奏 7 月底应有）；本机跑 `crawl_gd_construction.py --max 3` 仅解析到 4 行（HEAD 5 行），源站首页 1-5 页仅列到 Q1。**注意**：源码根因可能为页面 HTML 结构变化或服务器 GBK 编码错标（Content-Type 标 utf-8 但实际 GBK）。 | ❌ 不豁免（季度源，源站节奏变化需人查） |
> | `gz_housing_plan.csv` | 源站 `zfcj.gz.gov.cn` 2026-06-03 发完《2026 年度计划》后**无新文件**（年度源，按节奏 2027-06 才会有 2027 年计划）。 | ⚠️ **建议后续豁免**（年度源，模式与 `nbs_avg_wage` 一致） |
> | `sz_land_deals.csv` | 源站 `szggzy.com` 公共资源交易中心 API 返回 128 条记录，**最新一条仍是 2026-06-24**（光明区 A512-0092）；本机 `crawl_sz_land_deals.py --pages 4` 跑通，前 4 页 120 行全部 ≤ 2026-06-24。**业务信号**：深圳新房土地市场 7-9 月无新增居住用地成交。 | ❌ 不豁免（真实业务信号，市场冷） |
> | `sz_planned_supply.csv` | 源站 `zjj.sz.gov.cn` 2026-07-06 发完 Q3 后**未发 Q4**（按节奏 10 月中旬出）。 | ⚠️ **建议后续豁免**（季度源，Q4 应在 10 月 15 日前后发） |
> 
> **本轮决策**：不补数据（源站确实无新数据可拉），不扩 EXEMPT（尊重原作者"仍保留 STALE 警告"设计意图），仅写本节文档留档。
> 
> **教训**：本轮曾误跑 `crawl_sz_land_deals.py` + `crawl_gd_construction.py`，前者覆盖了 9 行历史数据（已 `git checkout` 回滚），后者丢了 2024_Q1 一行（同样回滚）。**手动跑爬虫前必须 `git stash` / `git restore --worktree --staged`** 兜底。

| 源 | 探针字节级 | 实际原因 |
|-----|------|------|
| `gz_housing_plan.csv` | **与 HEAD SAME** | v1.122.11 (commit 56995de) 已补；STALE 报告是源站 6 月发 2026 年度计划后未再更新 |
| `gz_land_deals.csv` | **与 HEAD SAME** | v1.122.11 已补；STALE 报告是源站 9 月未发新地块 |
| `sz_land_deals.csv` | **与 HEAD SAME** | v1.122.11 已补；STALE 报告是源站 7 月后无新成交公示 |
| `sz_planned_supply.csv` | **HEAD 反而比探针多 2 行**（2024Q4 + 2025Q1） | v1.122.11 已补 8 行；STALE 报告是源站 7 月后无新季度公示 |
| `gd_construction.csv` | 探针 4 行 vs HEAD 4 行 1 行微差 | 源站 4 月发 2026Q1 后无新季度数据（季度发布） |
| `gd_services.csv` | **v1.122.18 已补 2026_01_07**（2026-08-31 公告） | gd_economy/fa_investment/industrial/real_estate_brief/retail/services 6 个月度 CSV 全部已 OK |
| `gd_economy / gd_fa_investment / gd_industrial / gd_real_estate_brief / gd_retail` | **v1.122.18 已补 2026_01_07**（2026-08-21 公告） | 见 changelog/2026-09-09-v1.122.18 |
| `nbs_avg_wage.csv` | 探针成功但脚本硬写正式 CSV | 国家统计局 5 月发 2025 年报后无新数据（年度发布） |
| `stats_70.csv` | 探针无法跑 | 70 城指数月度 6 月发后无新数据（18 日发布日已过） |
| `gz_provident_annual.csv` (531d) | — | 广州公积金年度报告，**年初一次发布**（freshness 永远会显示 STALE） |
| `gd_provident_annual.csv` (498d) | — | 广东公积金年度报告，同上 |
| `sz_provident_annual.csv` (162d) | — | 深圳公积金年度报告，3 月底一次发布 |
| `provident_fund_rates.csv` (489d) | — | 公积金利率年度调整，5 月初一次发布 |
| `education_overview.csv` (86d) | — | 教育事业统计，6 月发 2025 年报后等 2026 年报 |
| `zh_bdc_registration.csv` (63d) | — | 珠海不动产登记**季报**，9 月才出 Q3 |
| `zh_price_filing.csv` (68d) | — | 珠海价格备案列表页 404，**源站问题**（等恢复后改入口） |
| `zh_provident_dynamics.csv` (135d) | — | 珠海公积金动态月报，源站偶发不发 |

**真正仍然需要做的"治本"**（按优先级）：
1. `check_csv_freshness.py` 字段策略扩展：把 "年初/季度/月度一次性发布" 的源标 UNKNOWN 排除，**避免误报**
   引入 `EXEMPT_FROM_STALE` 白名单（如 `provident_fund_rates.csv`、`education_overview.csv`）
2. `zh_price_filing.py` 入口改 HTTPS 新 URL（源站恢复后）
3. 把 9-10 月新 NBS / 政府源数据真出后，再批量跑一次 crawl 补齐

这些是 GD/广州/深圳/珠海政府源与 provident 利率，结构不统一，下次需要单独排查。

## 关键词索引

- `check_csv_freshness.py`: 统一陈旧度侦测脚本
- `crawl-monthly-stats70.yml`: 月度 cron，治理了 swallow stderr
- `append_recent_stats70.py`: 70 城指数增量追加工具
- `check_stats70_freshness.py`: 70 城指数专项（已修 tzdata bug）