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

## 4. 自动化门禁

```powershell
npx vitest run tests/mapMath.test.ts
npx vitest run tests/buildIntegrity.test.ts -t "价格热力"
# H5（需 E2E_BASE_URL）
node tests/e2e/smoke_map_controls.mjs
node tests/e2e/smoke_price_heatmap.mjs
```

失败则阻断发版。

---

## 5. 真机最短路径

1. 地图 → 挂牌均价 → 截图（须能看清底图）  
2. 核对图例 5 档均非 `0k-0k`  
3. 浅色主题再截一张  
4. 广州/深圳各切一次看覆盖数变化  

---

## 6. 已知边界

- 高德 Key / 网络失败时底图可能空白，但应出「底图加载较慢」+ 重试，且图层数据仍可切  
- 第三方底图配色不完全跟 App 主题  

---

最后更新：2026-07-26（挂牌均价黑糊修复 + 用例补齐）
