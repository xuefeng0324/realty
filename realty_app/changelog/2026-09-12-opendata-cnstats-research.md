# 2026-09-12 opendata.sz.gov.cn / cnstats 数据源调研

调研目的：确认 OPTIMIZATION_BACKLOG 里 data-4（opendata 70 数据集）+ data-5（cnstats 月度宏观）的可行性。

## opendata.sz.gov.cn（对应 data-4）

**结论：opendata 不是补 100+ 学校的可行源。**

- 学校类数据集审计（`audit_school_sources.py` + `school_source_audit.json`，2026-07-25 跑过）：
  - 4 个候选（盐田公办中小学 / 盐田办学情况 / 南山学校信息 / 龙岗民办中小学）全部 `eligible_for_import: false`
  - 原因：3 个 `stale_over_730_days`（2019-2021 发布，已超过 730 天未更新）；1 个 `title_abstract_mismatch`（标题说中小学、abstract 是托育机构）
- 房地产相关数据集（`crawl_sz_newhouse.py` 已枚举 6+ 个 id）：
  - 一手商品房成交信息（按日统计） 29200/01903510
  - 二手房成交信息（按日统计） 29200/01902783
  - 一手商品房按面积统计成交信息 29200/01903509
  - 一手商品房按用途统计成交信息 29200/01903511
  - 房地产开发项目销售情况 29200/03700915
  - 龙岗区-房地产开发项目销售情况 29200/01700922
  - **需 `OPENDATA_SZ_TOKEN` 环境变量**——必须注册账号、登录后用户中心创建 appToken；公开端点拿不到数据
- 热门数据集（首页 `hotdata` JSON 里）：
  - 建筑物数据（29200_00300237）、商事主体基本信息、经营异常名录、地面观测数据等
  - 大多跟房地产/学区无关

**建议**：opendata 当前不是优先源。要么花时间注册 appToken 跑通 `crawl_sz_newhouse.py`，要么换其它源。

## cnstats / 国家统计局（对应 data-5）

**结论：data-5 实际已被 15 个 crawl_nbs_*.py 覆盖，隐式完成。**

仓库已有 15 个 NBS 月度爬虫：

- nbs_energy / nbs_cpi / nbs_pmi / nbs_ppi / nbs_trade / nbs_retail / nbs_industrial / nbs_income / nbs_gdp / nbs_fa_investment / nbs_unemployment / nbs_industrial_profit / nbs_service_index / nbs_avg_wage / nbs_real_estate

cron `crawl-monthly-stats70.yml` 每月 16-20 日 02:00 UTC 跑这批。

GBK fix v1.122.37-40 已修完 stdout/stderr/stdin 三件套 UTF-8 包装；NBS 2026-08 新措辞「略降/略增」兼容 v1.122.41 已修完。data-5 不需要新工作。

## 后续

把这次调研结论同步到 `OPTIMIZATION_BACKLOG.md`：
- data-4：标记 `⚠️ 已调研` + 结论摘要
- data-5：标记 `✅ 已隐式完成`
- data-6：标记 `🟡 部分` + opendata 不可行