# 主题（浅色 / 深色 / 跟随系统）验收标准

> 对照：[uni-app DarkMode 适配指南](https://uniapp.dcloud.net.cn/tutorial/darkmode.html)  
> 流程总则：[FEATURE_ACCEPTANCE.md](./FEATURE_ACCEPTANCE.md)

## 1. 背景与根因（为何以前像「闹着玩」）

旧实现问题（已在 v1.121.42 起按官网纠正）：

| 问题 | 后果 |
|------|------|
| 未开 `manifest.darkmode` / 无 `theme.json` | 拿不到 `uni.getSystemInfoSync().theme`，Tab/导航栏写死深色 |
| 「跟随系统」主要靠 `matchMedia` | Android App WebView 经常无效 → 跟随系统名存实亡 |
| 未调用 `plus.nativeUI.setUIStyle` | 官网明确：App 上不开则听不到主题变化 |
| 大量页面硬编码 `#111827` / `#1e293b` 等 | CSS 变量切了浅色，控件仍是深色块 → 「浅色模式坏了」 |
| 验收靠肉眼猜测 | 无对比度 / 无主题属性断言，回归靠运气 |

正确分层（与官网 + 常见 App 一致）：

1. **原生壳**：`darkmode` + `theme.json` + `pages.json` 的 `@变量`（导航栏 / TabBar / 窗口背景）  
2. **系统跟随**：`plus.nativeUI.setUIStyle('auto'|'light'|'dark')` + `uni.onThemeChange`  
3. **页面内容**：`data-realty-theme` + CSS 变量（可强制浅/深，不单绑系统）  
4. **门禁**：unit + H5 主题视觉 smoke + 真机三点路径

## 2. 验收标准

### 2.1 设置页三点切换

| # | 操作 | 期望 | 不期望 |
|---|------|------|--------|
| A1 | 打开「设置 → 外观」点「浅色」 | 页面背景明显变亮；卡片近白；正文深色；TabBar 浅底深字 | 大块仍留黑底白字控件 |
| A2 | 点「深色」 | 背景回到深色体系；TabBar 深底 | 导航栏仍浅色刺眼 |
| A3 | 点「跟随系统」且系统为浅色 | 表现同 A1 | 无视系统仍深色 |
| A4 | 点「跟随系统」且系统为深色 | 表现同 A2 | 无视系统仍浅色 |
| A5 | 杀进程重开 | 仍为上次选择的模式 | 丢失偏好 |

### 2.2 原生壳

| # | 期望 |
|---|------|
| B1 | 浅色：导航栏浅底 + 深色标题字；TabBar 白底 |
| B2 | 深色：导航栏/TabBar 深底 + 浅色字 |
| B3 | 切换 Tab 后壳层颜色不「串色残留」 |

### 2.3 内容可读性（自动化已覆盖的部分）

| # | 期望 |
|---|------|
| C1 | `document.documentElement.dataset.realtyTheme` 等于当前解析主题 |
| C2 | 浅色页面背景相对亮度足够高；深色足够低（见 `smoke_theme_visual.mjs`） |
| C3 | 主按钮 / 标题对比度不低于门禁阈值 |

## 3. 自动化门禁

```powershell
# 单元（解析、存储、setUIStyle、onThemeChange、DOM 标记）
npx vitest run tests/theme.test.ts

# 全量
npm run type-check
npm test

# H5 主题视觉（需 dev server；默认 E2E_BASE_URL）
node tests/e2e/smoke_theme_buttons.mjs
node tests/e2e/smoke_theme_visual.mjs
```

通过准则：上述命令 exit code = 0。失败则**阻断发版**。

## 4. 真机手工最短路径（App 包）

1. 安装含本改动的包（或 OTA 到对应 versionCode）  
2. 设置 → 外观 → 浅色：截图总览 + 房源 + 设置  
3. 外观 → 深色：再截同样三页  
4. 手机系统改为浅色，App 选「跟随系统」：确认与步骤 2 一致  
5. 系统改深色，仍「跟随系统」：确认与步骤 3 一致  

记录：三组截图入库或贴到 issue；任一步失败开缺陷，不发版。

## 5. 实现要点（给后续改动）

- 配置：`src/theme.json`、`manifest.json` 的 `darkmode`/`themeLocation`、`pages.json` `@` 引用  
- 逻辑：`src/utils/theme.ts`（禁止删掉 `setUIStyle` / `onThemeChange` 只留 matchMedia）  
- 样式：新增颜色优先 `var(--color-*)`；禁止再引入裸 `#111827` 一类深色硬编码（unit/视觉门禁会打回）

## 6. 已知边界

- 第三方 WebView / 地图 SDK 自带配色可能不跟主题（需单独评估）  
- 系统弹窗（如 Runtime 提示）不受 App CSS 控制  
- `theme.json` 的 `@` 变量随**系统**暗黑能力切换；**强制浅/深**仍依赖本模块 `setUIStyle` + `setTabBarStyle` + CSS 变量

---

最后更新：2026-07-26（v1.121.42）
