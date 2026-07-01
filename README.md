# Realty Analytics

房产数据可视化与房源质量评分：桌面端为 **FastAPI + Vue 3**，手机端为 **uni-app 纯本地 App**（`realty_app/`），支持政府宏观数据（70 城指数、深广每日网签）与本地房源评分。

## 仓库结构

```
realty/                 # 桌面端（Python 包 realty.*）
  backend/              # FastAPI、规则引擎、ETL 脚本
  frontend/             # Vite + Vue 3
realty_app/             # ★ 手机端 uni-app（纯本地，无后端依赖）
  scripts/              # 政府数据爬虫（stats_70、daily_wangqian 等）
  static/               # 打包进 App 的 CSV
  changelog/            # 版本变更记录
.github/workflows/      # CI（网签日更、安居客周更等）
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

GitHub Actions 工作流见 `.github/workflows/`（如 `crawl-daily-wangqian.yml`、`crawl-weekly.yml`）及 `realty\.github\workflows\`（桌面端 backend-tests、frontend-build）。

## 提交规范

本仓库含 **桌面端**（`realty/`）与 **手机端**（`realty_app/`）两套代码，规范与 [fund](https://github.com/xuefeng0324/fund) 仓库对齐。

### 通用（所有子项目）

| 项目 | 说明 |
|------|------|
| Commit 格式 | `<type>(<scope>): 中文说明`，type 见下表 |
| 不改历史版本 | README 版本表只**追加**新版本行 |
| changelog | 功能发版时在对应子目录 `changelog/` 新增详细记录 |
| 不提交垃圾 | 勿提交 `log.zip`、`logs/`、`runs.json`、探测脚本 `_probe_*.py` 等 |

| type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档 / README / changelog |
| `data` | 仅 CSV / 种子数据更新（如 `data(wangqian): …`） |
| `chore` | CI、目录调整、依赖 |
| `perf` | 性能 |

### 手机端 `realty_app/`

完整清单见 [`realty_app/README.md#提交规范`](realty_app/README.md#提交规范)，摘要：

- `npm run test` 通过
- 更新 `package.json` version、`realty_app/README.md` 版本表与更新日志
- 政府数据变更 → `DATA_SOURCES.md` + `scripts/crawl_*.py` + `static/*.csv`
- push 含 workflow 时需 `gh auth refresh -h github.com -s workflow`

### 桌面端 `realty/backend` + `realty/frontend`

| 项目 | 说明 |
|------|------|
| 测试 | `python -m pytest -q realty\backend\tests` |
| 前端构建 | 改 frontend 后 `npm run build` 确认无报错 |
| scope 示例 | `feat(backend): …` / `fix(frontend): …` |
| 评分规则 | Python 与 `realty_app/src/rules/` 保持同步 |

## 免责声明

本项目仅供学习与技术研究，展示的数据与评分不构成任何置业或投资建议。请遵守数据来源网站的使用条款与法律法规。

## 许可证

见仓库根目录 `LICENSE`。

## 手机端 App（realty_app）

- 说明与版本：`realty_app\README.md`
- 政府数据来源：`realty_app\DATA_SOURCES.md`
- 变更记录：`realty_app\changelog\`

```powershell
cd realty_app
npm install
npm run test
npm run dev:h5
```

## 更多文档

- 后端细节：`realty\backend\README.md`
- 前端说明：`realty\frontend\README.md`
- 进度与接口清单：`realty\README.txt`
