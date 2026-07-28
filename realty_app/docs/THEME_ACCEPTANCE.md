# 主题（浅色 / 深色 / 跟随系统）验收标准

> 对照：
> - [uni-app DarkMode 适配指南](https://uniapp.dcloud.net.cn/tutorial/darkmode.html)
> - [Material Design 3 · Color roles](https://m3.material.io/styles/color/roles)（Surface / On-surface）
> - [Apple HIG · Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)（浅色 = 浅分组底 + 深 label）
> - 微信 / 支付宝 / 贝壳 App：强制「浅色」= **白/浅灰底 + 深灰黑字**，不是「略提亮的夜景」
>
> 流程总则：[FEATURE_ACCEPTANCE.md](./FEATURE_ACCEPTANCE.md)

## 0. 一句话合格线（给产品/测试）

> 设置里点「浅色」后，**不看导航栏、只看内容区**，任何人都能在 1 秒内说出「这是浅色界面」；  
> 若需要盯着对比深色截图才能分辨 → **不合格，按缺陷重开**。

相对亮度硬门槛（与 `themeTokens.ts` / smoke 一致）：

| 指标 | 浅色 | 深色 |
|------|------|------|
| 页面背景 `--color-bg` | ≥ **0.85** | ≤ **0.12** |
| 正文 `--color-text` | ≤ **0.25**（够深） | ≥ **0.65**（够浅） |
| 卡片 `--color-surface` | ≥ **0.90**（近白） | — |

## 1. 背景与根因（为何会「跟没选差不多」）

| 问题 | 后果 |
|------|------|
| 未开 `manifest.darkmode` / 无 `theme.json` | 拿不到系统 theme，Tab/导航栏写死深色 |
| 「跟随系统」主要靠 `matchMedia` | Android App WebView 经常无效 |
| 未调用 `plus.nativeUI.setUIStyle` | App 听不到主题变化 |
| **只改 `data-realty-theme`，CSS 变量挂在 `page[...]` 选择器** | 部分 App WebView 不级联 → 页面仍用默认深色 token |
| **首页卡片硬编码 `#0c1426` / `#0c1a2e` 渐变** | 变量切了浅色，70城/网签卡仍是黑蓝块 → 「浅色坏了」 |
| 把 `--color-soft`（底色）当**文字色** | 浅色下近白字写在白底上，更像「坏了」而不是浅色 |
| 验收靠肉眼猜测 | 无亮度 / 对比度门禁 |

正确分层：

1. **原生壳**：`darkmode` + `theme.json` + `pages.json` `@变量`
2. **系统跟随**：`setUIStyle` + `uni.onThemeChange`
3. **页面内容**：**Vue 响应式属性绑定**（主路径）+ JS `style.setProperty`（H5 兜底）
4. **门禁**：token 亮度 unit + 绑定护栏 unit + H5 主题视觉 smoke + 真机三点路径

### 1.1 v1.121.139 根因修复：「只有导航栏变白、内容不变」

**根因**：App(app-plus) 页面 JS 跑在**逻辑层**，`theme.ts` 的 `paintDom` 通过
`document.querySelectorAll("page,…")` 写属性/内联变量，在逻辑层拿不到真正渲染页面的
WebView DOM → 只有 `paintChrome`（`uni.setNavigationBarColor` / `setTabBarStyle`，走
uni API）生效 → **导航栏/TabBar 变了、页面内容没变**，与用户反馈完全吻合。

**修复**：改由每个页面的**根节点响应式绑定**
`<view class="page" :data-realty-theme="realtyTheme" :class="'realty-theme-' + realtyTheme">`，
`realtyTheme` = `theme.ts` 导出的 `resolvedThemeRef`（`applyTheme` 中同步更新）。
Vue 的响应式跨逻辑层→渲染层可靠同步属性；`App.vue` 提供通用属性选择器
`[data-realty-theme="light"|"dark"] { --color-*: … }`，让浅/深变量从 `.page` 根**级联**
到全部子内容。H5 仍保留 `paintDom` 做双保险。

## 2. 验收标准

### 2.1 设置页三点切换

| # | 操作 | 期望 | 不期望 |
|---|------|------|--------|
| A1 | 「设置 → 外观」点「浅色」 | 内容区浅灰底；卡片近白；正文深色；选中按钮绿底白字；TabBar 浅底 | 大块仍黑底白字；或只导航栏变、内容区不变 |
| A2 | 点「深色」 | 回到深色体系 | 导航栏仍浅刺眼 |
| A3 | 「跟随系统」+ 系统浅色 | 同 A1 | 仍深色 |
| A4 | 「跟随系统」+ 系统深色 | 同 A2 | 仍浅色 |
| A5 | 杀进程重开 | 记住上次模式 | 丢偏好 |

### 2.2 原生壳

| # | 期望 |
|---|------|
| B1 | 浅色：导航栏浅底深字；TabBar 白底 |
| B2 | 深色：导航栏/TabBar 深底浅字 |
| B3 | 切 Tab 不串色残留 |

### 2.3 内容可读性

| # | 期望 |
|---|------|
| C1 | `dataset.realtyTheme` = 当前解析主题 |
| C2 | 根节点内联 `--color-bg` 已写入且通过亮度门禁 |
| C3 | 首页 70城 / 网签卡**不得**再硬编码 `#0c1426` 一类深色渐变终点 |
| C4 | 主按钮 / 标题对比度 ≥ 门禁（见 smoke） |

## 3. 自动化门禁

```powershell
npx vitest run tests/theme.test.ts tests/themeTokens.test.ts tests/themeBinding.test.ts tests/themeHardcodeGuard.test.ts
npm run type-check
npm test
node tests/e2e/smoke_theme_buttons.mjs
node tests/e2e/smoke_theme_visual.mjs
```

`themeBinding.test.ts` 护栏：全部页面根节点必须绑定 `:data-realty-theme="realtyTheme"`，
`App.vue` 必须有通用属性选择器，`theme.ts` 必须导出并更新 `resolvedThemeRef`——
任一缺失即 fail，防止新增页面漏绑定导致浅色回归。

失败则**阻断发版**。

## 4. 真机最短路径

1. 装含本改动的包（或 OTA 到对应 versionCode）
2. 设置 → 浅色：截总览 + 房源 + 设置（**必须能一眼看出浅色**）
3. 深色：同三页
4. 系统浅/深 +「跟随系统」各一遍

任一步「跟没选差不多」→ 缺陷，不发版。

## 5. 实现要点

- Token 单一来源：`src/utils/themeTokens.ts`
- 逻辑：`src/utils/theme.ts`（`setUIStyle` / `onThemeChange` / **内联 CSS 变量**）
- 样式：`App.vue` 同步选择器；页面禁止裸深色底硬编码
- 文字色禁止用 `--color-soft`（那是 soft **背景**）

## 6. 已知边界

- 第三方 WebView / 地图 SDK 配色可能不跟主题
- 系统弹窗不受 App CSS 控制
- `theme.json` `@` 随系统暗黑；强制浅/深仍靠本模块

---

最后更新：2026-07-26（浅色「一眼可辨」强化）
