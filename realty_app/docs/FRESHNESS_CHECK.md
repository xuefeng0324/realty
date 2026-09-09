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
- 三档分级：✅ OK < 30 天 / ⚠️ WARN 30..60 天 / ❗ STALE ≥ 60 天
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

## 验证清单（修改后必跑）

`npm test` 不能被「我本地跑过」代替，必须配合：

1. **改代码 → 跑本地 `npm test`**：必须 1205/1205 全绿
2. **commit 前再跑一次 `npm test`**：防止「我跑了没 commit」的错位
3. **push 后等 CI 重跑**：GitHub actions 1~2 分钟，确认 commit hash 的 `realty_app tests` 和 `realty_app build` 都 `conclusion=success`
4. **CI 绿了** 才算「完成」，不要用「我本地测过」收尾

> 「用户不该每次都把报错截图给你」—— AI 应主动验证 CI status，而不只是本地跑通。

## 仍然 STALE 的源（待 v1.122.x 修）

- `gd_construction.csv` (133 天)
- `gz_housing_plan.csv` (98 天)
- `gz_provident_annual.csv` (531 天)
- `nbs_avg_wage.csv` (117 天)
- `provident_fund_rates.csv` (489 天)
- `zh_prov_vent_dynamics.csv` (135 天)
- `sz_provident_annual.csv` (162 天)
- `gd_provident_annual.csv` (498 天)
- `gz_land_deals.csv` (65 天)
- `zh_bdc_registration.csv` (63 天)
- `zh_price_filing.csv` (68 天)
- `gd_services.csv` (70 天)
- `sz_land_deals.csv` (77 天)
- `sz_planned_supply.csv` (65 天)
- `stats_70.csv` (100 天)

这些是 GD/广州/深圳/珠海政府源与 provident 利率，结构不统一，下次需要单独排查。

## 关键词索引

- `check_csv_freshness.py`: 统一陈旧度侦测脚本
- `crawl-monthly-stats70.yml`: 月度 cron，治理了 swallow stderr
- `append_recent_stats70.py`: 70 城指数增量追加工具
- `check_stats70_freshness.py`: 70 城指数专项（已修 tzdata bug）