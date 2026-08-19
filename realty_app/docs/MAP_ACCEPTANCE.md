# 地图找房（挂牌均价等）验收标准

> 功能 ID：`F-MAP-01` / `F-MAP-03`  
> 对照：
> - [贝壳 App · 地图找房](https://bj.ke.com/)：浅色底图 + 半透明价格气泡 + 可读图例
> - [Google Maps Platform · Maps QA](https://developers.google.com/maps/documentation/javascript/examples)：底图可读、图层可切换、图例与数据一致
> - [Mapbox · Design guidelines](https://docs.mapbox.com/help/getting-started/)：热力半透明，不遮死底图
> - 本仓库 [HOUSING_PRICE_ACCEPTANCE.md](./HOUSING_PRICE_ACCEPTANCE.md)（挂牌 ≠ 成交）
>
> 用例写法参考大厂习惯：**Given / When / Then** + **UI / 功能 / 逻辑** 三类；每条可自动化或可手工复现。

## 0. 一句话合格线

> 点「挂牌均价」后：**底图道路/地名仍可辨认**；热力点为绿→红半透明圆；图例 5 档价格**不是** `0k-0k`；  
> 若整屏「黑乎乎 / 灰糊糊看不清地图」→ **不合格**。
>
> 另：**地图找房必须能找房**（对照贝壳/链家）：默认进找房图层 → 可筛总价/户型 → 点小区出房源底栏 → 点房源进详情。  
> 只有热力/图层、不能看盘 → **不合格**。

---

## 1. UI 显示（U）

| # | Given | When | Then | 不期望 |
|---|-------|------|------|--------|
| U1 | 进入地图 Tab | 底图加载前/中 | `.map-wrap` 为浅色占位（非纯黑） | 透出深色 page 成黑框 |
| U2 | 任意图层 | 底图 ready | 能辨认道路/水系/区域轮廓 | 整片纯黑或纯灰 |
| U3 | 点「挂牌均价」 | 热力渲染 | 圆为**半透明**彩点，底图仍透出 | 不透明灰/黑圆铺满 |
| U4 | 挂牌均价模式 | 看图例卡 | 5 行 swatch + 区间文案对比度可读 | 白字贴深底糊成一片（浅色主题下） |
| U5 | 浅色主题 | 打开地图 | 控件卡/图例卡浅底深字 | 控件仍夜景黑卡 |

---

## 2. 功能完整性（F）

| # | Given | When | Then |
|---|-------|------|------|
| F1 | 地图页 | 点 5 个 `data-map-mode` | 均切换成功，且仅 1 个 active |
| F2 | 挂牌均价 | 切换成功 | 出现「挂牌价格分位图例」；文案含「挂牌」不含「成交价」模式名 |
| F3 | 挂牌均价 | 有种子数据 | `#realty-map[data-overlay-count]` > 0 |
| F4 | 挂牌均价 | 切换深圳/广州/珠海 | 图例/均价随城更新，不串城 |
| F5 | 底图 error | 点「重新加载」 | `data-map-reload-key` +1，状态可恢复 |

---

## 3. 逻辑正确性（L）

| # | Given | When | Then |
|---|-------|------|------|
| L1 | 社区均价 2万–8万 | 图例 format | 显示如 `20k-xxk`，**禁止全表 `0k-0k`** |
| L2 | 52 小区仅 8 个有均价 | 挂牌均价热力 | **只画 8 个圆**，不为无价小区铺灰圆 |
| L3 | 价格归一化 | `normalizeRange(mid,min,max)` | 运算符优先级正确（先减后除） |
| L4 | 色阶 | `priceColorRamp5` | 输出 `#RRGGBBAA`，禁止 `rgb()`（App map 兼容） |
| L5 | 贵 vs 便宜 | 同城两点 | 更贵点色相更偏红（或不低于便宜点的红通道） |
| L6 | 语义 | 模式标签 | 「挂牌均价」≠「成交价」 |

---

## 4. 找房主路径（对照贝壳/链家 · F-MAP-04）

v1.122.0 地图为第三个一级 Tab；地图结果 Sheet 在 H5 使用普通视图，在 App/小程序不得被原生 map 层遮挡，必要控件使用 `cover-view` 或放在地图组件外部。

| # | Given | When | Then | 类型 |
|---|-------|------|------|------|
| F4-1 | 打开地图 Tab | 首屏 | 默认图层=`listings`（找房）；摘要显示套数 | F/U |
| F4-2 | 找房页 | 点总价/户型芯片 | `data-find-listing-count` 随筛选变少（收紧时） | L/F |
| F4-3 | 选中小区 | 打开底栏 | `[data-find-sheet]` 列出挂牌价/户型/面积；可点进详情 | F/U |
| F4-4 | 底栏一行 | 点击 | 进入 `listing-detail?id=` | F |
| F4-5 | 底栏 | 「本小区全部房源」 | 进入 `listing-filter?communityId=` | F |
| F4-6 | 找房图层 | 点单套 marker | 直接进详情（不是只弹小区卡） | F |
| F4-7 | 底栏行 | 看文案 | 含总价 + 单价或室卫/面积（`formatListingCardLine`） | U |
| F4-8 | 未知 markerId | 点击 | toast「无法识别」，不把 id 当 communityId | L |
| F4-9 | 均价摘要 | 读文案 | 「样本小区挂牌均价」，含「非成交价」 | U |

参考：贝壳「地图找房」= 筛 → 气泡 → 列表 → 详情；本产品不做经纪带看，只做到挂牌详情。

---

## 5. 自动化门禁

```powershell
npx vitest run tests/mapMath.test.ts tests/mapFind.test.ts
node tests/e2e/smoke_map_controls.mjs
node tests/e2e/smoke_price_heatmap.mjs
node tests/e2e/smoke_map_find.mjs
```

---

## 6. 真机最短路径

1. 地图 → 确认默认「找房」  
2. 筛「200-400万」+「3室」→ 套数下降  
3. 点小区气泡/地图 → 底栏出房源 → 点一条进详情  
4. 再验挂牌均价可读（见上节）  

---

## 7. 已知边界

- 高德 Key / 网络失败时底图可能空白，但应出「底图加载较慢」+ 重试，且图层数据仍可切  
- 第三方底图配色不完全跟 App 主题  
- H5 E2E 用 `__realtyMapFind` 钩子模拟点气泡（marker 非 DOM）

---

最后更新：2026-08-18（五栏入口与原生地图层 Sheet 验收）
