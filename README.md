# Realty Analytics

房产数据可视化与房源质量评分（MVP）：后端为 **FastAPI + SQLAlchemy**，前端为 **Vue 3 + ECharts**，提供 Dashboard、社区详情与可解释的房源评分说明。

## 仓库结构

```
realty/                 # 应用根目录（Python 包 realty.* 所在位置）
  backend/              # FastAPI、规则引擎、ETL 脚本
  frontend/             # Vite + Vue 3
  docs/                 # 文档与约定
  api/                  # API 契约等
  data/                 # 示例数据与数据源相关说明
  README.txt            # 更细的进度与历史说明（可选读）
```

在命令行中，请把 **`G:\github\realty`**（本仓库根目录，即包含 `realty\` 子目录的那一层）作为工作目录；`python realty\backend\run.py` 会把该路径加入 `sys.path`，以便 `import realty.backend...` 正常工作。

默认 **SQLite** 数据库文件路径为：`realty\realty.db`（由 `realty\backend\app\core\config.py` 解析，与当前工作目录无关）。生产环境可改用 PostgreSQL，设置环境变量 `DATABASE_URL`。

## 环境要求

- Python 3.10+（与依赖兼容即可）
- Node.js 18+（前端）
- 可选：PostgreSQL（设置 `DATABASE_URL` 时）

## 快速开始

以下命令均在仓库根目录执行（示例：`cd G:\github\realty`）。

### 1. 后端依赖

```powershell
cd realty\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..\..
```

### 2. 初始化数据库

```powershell
python -m realty.backend.app.scripts.init_db
```

### 3. 写入演示数据（可选）

会写入/重置演示数据并计算衍生表（详见 `realty\README.txt`）。

```powershell
python -m realty.backend.app.scripts.seed_demo --reset
```

### 4. 启动后端

```powershell
python realty\backend\run.py
```

健康检查：<http://localhost:8000/healthz>

### 5. 启动前端

```powershell
cd realty\frontend
npm install
npm run dev
```

浏览器打开：<http://localhost:5173/>

前端默认请求后端：<http://localhost:8000>。如需修改，在 `realty\frontend` 下创建 `.env`：

```bash
VITE_API_BASE_URL=http://localhost:8000
```

## 常用脚本

### 从 CSV 导入房源（链家/贝壳等导出）

```powershell
python -m realty.backend.app.scripts.import_listings_csv `
  --csv "D:\path\to\your_listings.csv" `
  --cityCode sz `
  --cityName Shenzhen `
  --source lianjia_csv `
  --crawlDate 2026-03-23
```

导入后可按 `realty\backend\README.md` 中的说明执行 `run_mvp_jobs`（如 `weekly_snapshot`、`listing_score`）生成图表与评分数据。

### 定时循环任务（示例）

```powershell
python -m realty.backend.app.scripts.run_scheduler_loop `
  --cityId 1 `
  --weekEnd 2026-03-23 `
  --intervalMinutes 60 `
  --maxRuns 0
```

## 主要 HTTP API（节选）

完整列表见 `realty\README.txt` 与 `realty\backend\README.md`。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/cities` | 城市列表 |
| GET | `/api/v1/periods` | 周期信息 |
| GET | `/api/v1/stats/community-ranking` | 社区排行等 |
| GET | `/api/v1/stats/district-compare` | 区域对比 |
| GET | `/api/v1/communities/{id}/price-trend` | 社区价格趋势 |
| GET | `/api/v1/communities/{id}/quality-summary` | 质量摘要 |
| POST | `/api/v1/listings/filter` | 房源筛选 |
| GET | `/api/v1/listings/{listingId}` | 详情与 `explain_json` |
| GET | `/api/v1/runtime` | 数据库/规则版本/数据量等 |

## 测试与 CI

```powershell
python -m pytest -q realty\backend\tests
```

GitHub Actions 工作流见 `realty\.github\workflows\`（如 `backend-tests.yml`、`frontend-build.yml`）。

## 免责声明

本项目仅供学习与技术研究，展示的数据与评分不构成任何置业或投资建议。请遵守数据来源网站的使用条款与法律法规。

## 许可证

见仓库根目录 `LICENSE`。

## 更多文档

- 后端细节：`realty\backend\README.md`
- 前端说明：`realty\frontend\README.md`
- 进度与接口清单：`realty\README.txt`
