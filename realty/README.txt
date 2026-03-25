Realty Analytics（房产数据可视化 + 优缺点评分）
===============================================

该目录包含：
- 后端：`backend/`（SQLAlchemy + FastAPI + ETL/评分脚本 + API）
- 前端：`frontend/`（Vue 3 + ECharts，调用后端 API 渲染 Dashboard / CommunityDetail）
- 规则与契约：`docs/`、`api/contracts/`（用于实现一致性）

------------------------------
快速开始（MVP + demo 数据）
------------------------------

1) 写入/重置 demo 数据（关键：会往 `G:\work\realty\realty.db` 塞最小样例并计算 derived 表）
```powershell
cd 'G:\work'
& 'G:\work\realty\backend\.venv\Scripts\python.exe' -m realty.backend.app.scripts.seed_demo --reset
```

2) 启动后端
```powershell
cd 'G:\work\realty'
& '.\backend\.venv\Scripts\python.exe' .\backend\run.py
```

健康检查：`http://localhost:8000/healthz`

3) 启动前端
```powershell
cd 'G:\work\realty\frontend'
npm install
npm run dev -- --port 5173
```

打开：`http://localhost:5173/`

4) （新增）导入真实 CSV 数据（链家/贝壳导出）
```powershell
cd 'G:\work'
& 'G:\work\realty\backend\.venv\Scripts\python.exe' -m realty.backend.app.scripts.import_listings_csv `
  --csv 'G:\path\to\your_listings.csv' `
  --cityCode sz `
  --cityName Shenzhen `
  --source lianjia_csv `
  --crawlDate 2026-03-23
```
说明：
- 脚本会自动按 `community_name` 建立/复用小区；
- 按 `source_listing_id` 做 upsert（有则更新，无则新增）；
- 导入后可执行 `run_mvp_jobs.py` 里的 `weekly_snapshot` + `listing_score` 生成图表与评分数据。

------------------------------
后端规则（已落成代码）
------------------------------
- `weekly_snapshot`：`backend/app/services/snapshot_service.py`
- `school_future_score_v1`：`backend/app/services/school_scoring.py`
- `listing_quality_score_v1`：`backend/app/services/listing_scoring.py`

------------------------------
当前实现的主要接口（供前端调用）
------------------------------
- `GET  /api/v1/cities`
- `GET  /api/v1/periods?type=weekly&cityId=...`
- `GET  /api/v1/stats/community-ranking`
- `GET  /api/v1/stats/district-compare`
- `GET  /api/v1/communities/{communityId}/price-trend`
- `GET  /api/v1/communities/{communityId}/quality-summary`
- `GET  /api/v1/communities/{communityId}/top-tags`
- `POST /api/v1/listings/filter`
- `GET  /api/v1/listings/{listingId}`（完整 explain_json）
- `GET  /api/v1/runtime`（当前 DB/规则版本/数据量）

------------------------------
当前开发进度（README 对齐）
------------------------------
- [x] 列表跳转到 listing 详情（Dashboard -> CommunityDetail）
- [x] 可解释详情卡片（维度分、标签证据、输入快照）
- [x] Dashboard 运行时元信息展示（DB/规则版本/数据量）
- [x] 真实数据导入脚本 `import_listings_csv.py`
- [x] Dashboard 数据来源筛选 + Top20 分页 + 每页条数 + 状态持久化
- [x] 社区详情页返回兜底与源链接按钮

------------------------------
下一步（按 README 往下走）
------------------------------
1) 调度可配置任务（已完成基础版）
```powershell
cd 'G:\work'
& 'G:\work\realty\backend\.venv\Scripts\python.exe' -m realty.backend.app.scripts.run_scheduler_loop `
  --cityId 1 `
  --weekEnd 2026-03-23 `
  --intervalMinutes 60 `
  --maxRuns 0
```
说明：脚本会按顺序循环执行 `school -> weekly_snapshot -> listing_score`。

2) 接第二数据源字段映射（已完成首批）
- 已将 `schoolArr/subwayInfo/tags` 映射为标准字段，提升 explain 质量

3) 增加质量保障（已完成首批）
- 已新增 `snapshot / school_score / listing_score` 逻辑单测与 API smoke

------------------------------
测试与 CI 入口
------------------------------
- 后端本地测试：
  - `cd G:\work`
  - `G:\work\realty\backend\.venv\Scripts\python.exe -m pytest -q realty/backend/tests`
- 后端文档速查：`backend/README.md`
- CI 工作流：`.github/workflows/backend-tests.yml`
