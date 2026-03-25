Realty Backend (MVP)
=====================

用途
----
实现你前面定下的三套规则为可运行代码，并提供 API：
- `weekly_snapshot`：从 `listing_detail` 聚合生成 `price_snapshot_weekly`
- `school_future_score_v1`：从 `school_indicator_snapshot` 计算 `school_future_score`
- `listing_quality_score_v1`：从 `listing_detail` + `price_snapshot_weekly` + `school_future_score` 计算 `listing_quality_score`

技术栈
----
- FastAPI + SQLAlchemy
- PostgreSQL（建议）/ SQLite（本地 MVP 默认）

一、准备
1. 安装依赖
   - `cd realty/backend`
   - `pip install -r requirements.txt`
2. 初始化数据库
   - `python -m realty.backend.app.scripts.init_db`
   - 默认 SQLite：会生成 `realty.db`（在 repo 根目录 realty.db）
   - 若使用 PostgreSQL，设置环境变量 `DATABASE_URL`

二、运行后端
1. 启动
   - `python realty/backend/run.py`
2. 访问
   - `http://localhost:8000/healthz`

三、按规则顺序跑任务（强烈建议从这里开始）
1. 计算学校未来趋势分
   - `python -m realty.backend.app.scripts.run_mvp_jobs --job school --ruleVersionSchool school_future_score_v1`
2. 生成某个周的社区小区均价快照（weekly）
   - 例：weekEnd=2026-01-14，cityId=1
   - `python -m realty.backend.app.scripts.run_mvp_jobs --job weekly_snapshot --cityId 1 --weekEnd 2026-01-14`
3. 计算该周房源质量分（listing_quality_score）
   - `python -m realty.backend.app.scripts.run_mvp_jobs --job listing_score --cityId 1 --weekEnd 2026-01-14 --ruleVersionListing listing_quality_score_v1 --ruleVersionSchool school_future_score_v1`

四、调用 API（示例）
- Dashboard（全城）：
  - `GET /api/v1/stats/community-price-trend?cityId=1&startDate=2026-01-01&endDate=2026-01-31&periodType=weekly`
  - `GET /api/v1/stats/community-ranking?cityId=1&periodType=weekly&weekEnd=2026-01-14&metric=avg_unit_price&top=20&page=1&pageSize=10&source=lianjia_csv`
    - 说明：支持 `source`（如 `demo`/`lianjia_csv`）、分页 `page/pageSize`，返回 `total`
- CommunityDetail：
  - `GET /api/v1/communities/{communityId}/price-trend?periodType=weekly&startDate=2026-01-01&endDate=2026-01-31`
  - `GET /api/v1/communities/{communityId}/quality-summary?days=30&periodType=weekly&includeRadar=true`
  - `POST /api/v1/listings/filter`（带筛选条件）
  - 其他：
    - `GET /api/v1/listings/{listingId}?weekEnd=YYYY-MM-DD`（返回完整 `explain_json` 与各维度）
    - `GET /api/v1/runtime`（当前数据库文件/规则版本/数据量/服务日期）

五、数据准备提醒
MVP 默认不会替你爬取数据；你需要先把下面表写入数据：
- `t_city`
- `community_official`
- `school_standardized`
- `school_indicator_snapshot`
- `listing_detail`

六、开发者命令速查
----
建议在仓库根目录执行（`cd G:\work`）：

1. 一次性安装依赖
   - `G:\work\realty\backend\.venv\Scripts\python.exe -m pip install -r G:\work\realty\backend\requirements.txt`

2. 跑后端测试（规则 + API smoke）
   - `G:\work\realty\backend\.venv\Scripts\python.exe -m pytest -q realty/backend/tests`

3. 仅跑规则与快照相关单测
   - `G:\work\realty\backend\.venv\Scripts\python.exe -m pytest -q realty/backend/tests/test_scoring_and_snapshot.py`

4. 仅跑 API smoke
   - `G:\work\realty\backend\.venv\Scripts\python.exe -m pytest -q realty/backend/tests/test_api_smoke.py`
