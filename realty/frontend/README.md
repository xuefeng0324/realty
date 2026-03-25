Realty Frontend (MVP)
======================

依赖
----
- Node.js（建议 18+）

启动
----
1. 启动后端（本机）：
   - `python realty/backend/run.py`
   - 确保能访问 `http://localhost:8000/healthz`

2. 安装前端依赖并启动：
```powershell
cd realty/frontend
npm install
npm run dev
```

配置
----
- 默认 API 地址：`http://localhost:8000`
- 如需修改，在前端目录创建 `.env`：
```bash
VITE_API_BASE_URL=http://localhost:8000
```

访问
----
- Dashboard：`http://localhost:5173/`
- 社区详情：点击排行行跳转到 `/community/:communityId`
