# 功能交付与验收标准流程（强制）

> 适用：`realty_app` 一切用户可见改动（功能、交互、主题、筛选、外链、OTA 等）。  
> 目的：禁止「只改代码、靠猜测说好了」；功能做完必须有**可执行的验收标准**，并按流程跑通。

参考：

- 本仓库 `AGENTS.md` 任务结束汇报模板
- `scripts/check.ps1` 一键门禁
- uni-app 官方能力文档（涉及平台能力时优先对照官网，而不是自创）

---

## 1. 何时必须走本流程

满足任一条件即必须：

1. 用户可感知的 UI / 交互变化  
2. 跨端能力（主题、外链、权限、原生壳、Tab/导航栏）  
3. 数据展示口径变化（筛选、计数、城市隔离、分页）  
4. 发版（`versionCode` +1）

纯注释 / 纯内部重构且用户不可见：可简化，但仍建议跑 type-check + unit。

---

## 2. 标准步骤（顺序固定）

### Step A — 对齐权威来源（禁止空手上车）

| 类型 | 必须先看 |
|------|----------|
| uni-app / App 原生壳 | [DarkMode 适配指南](https://uniapp.dcloud.net.cn/tutorial/darkmode.html) 等官网页 |
| 外链唤起 | 目标 App 公开 scheme / Intent 惯例 + 本仓 `openExternal` 单测 |
| 数据口径 | 现有 `queries` / CSV 字段 / README DATA 说明 |
| 交互参考 | 链家 / 贝壳 / 系统设置「显示与亮度」等**已验证产品**的行为，而不是臆造 |

产出：在 changelog 或专题 MD 里写清「对照了哪份文档 / 哪个产品行为」。

### Step B — 实现前写验收标准（先标准后代码）

每个功能在动手前写清（可写在专题 MD，发版时链到 changelog）：

1. **用户场景**：谁、在什么页、点什么  
2. **期望结果**：可见变化是什么（颜色、数字、列表条数、弹层选项…）  
3. **不期望结果**：明确写「不应出现…」  
4. **自动化门禁**：哪条 `vitest` / 哪条 `smoke_*.mjs`  
5. **手工门禁**：真机 / H5 的最短路径（≤ 8 步）

没有验收标准 → **不算完成**。

### Step C — 实现（克制自作主张）

- 优先用平台官方 API / 配置（如 `darkmode` + `theme.json`），再叠本应用偏好  
- 不顺便塞无关「优化」  
- 硬编码色值、写死 pageSize、静默吞错等，视为缺陷而不是风格

### Step D — 验证（不允许用猜测代替）

最低门禁（发版前）：

```powershell
powershell -File realty_app/scripts/check.ps1 -SkipSmoke
```

涉及视觉 / 主题 / 布局时，**额外**：

```powershell
# 需本机 H5 dev server 已起，默认见 check.ps1 / E2E_BASE_URL
npx playwright test   # 或仓库既有：node tests/e2e/smoke_theme_visual.mjs
node tests/e2e/smoke_theme_buttons.mjs
```

门禁结果必须写进 changelog「验证」节：

```text
- npm run type-check: ✅ / ❌
- npm test: ✅ N/N / ❌
- 专题自动化（如 theme smoke）: ✅ / ❌ / ⚠️ 未跑（原因）
- 真机手工: ✅ / ❌ / ⚠️ 未跑（原因）
```

`⚠️ 未跑` 必须写清阻塞原因（无真机、无 AMAP_KEY、dev server 未起），**不能**写成「应该没问题」。

### Step E — 文档与发版

1. `node scripts/bump-version.mjs patch|minor|major`  
2. README 版本表**新增一行**（不改历史行）  
3. `changelog/YYYY-MM-DD-vX.Y.Z-标题.md`：问题 / 对照来源 / 改动 / **验收标准** / 验证结果  
4. `commit.ps1 -MessageFile <abs> -Add ... -Push`  
5. 按 `AGENTS.md` 五段汇报

---

## 3. 验收标准书写模板（复制即用）

```markdown
## 验收标准：<功能名>

### 场景
- 入口：
- 前置：

### 期望
1. …
2. …

### 不期望
1. …

### 自动化
- [ ] `tests/….test.ts`：断言 …
- [ ] `tests/e2e/….mjs`：断言 …

### 手工（真机/H5）
1. …
2. …
通过准则：截图或日志可复核；失败则阻断发版。
```

---

## 4. 禁止事项

- 禁止用「我看代码逻辑应该对」代替跑测试  
- 禁止功能已合并但 changelog 无验收节  
- 禁止把「未跑 E2E」包装成优点  
- 禁止在未对照官网/竞品时，对跨端行为自创一套语义

---

## 5. 相关专题

| 专题 | 文档 |
|------|------|
| 浅色 / 深色 / 跟随系统 | [THEME_ACCEPTANCE.md](./THEME_ACCEPTANCE.md) |
| 总览长页信息流去分割缝 | [DASHBOARD_FEED_ACCEPTANCE.md](./DASHBOARD_FEED_ACCEPTANCE.md) |

---

最后更新：2026-07-26
