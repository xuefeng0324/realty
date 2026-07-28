<template>
  <view class="page" :data-dash-tab="activeTab" :data-realty-theme="realtyTheme" :class="[{ 'city-scoped': cityScoped }, 'realty-theme-' + realtyTheme]">
    <view class="container">
      <!-- v1.121.150 Batch 11：首页使用指南 banner（首次进入显示，用户可关闭） -->
      <view v-if="showGuide" class="home-guide-card" data-dash-guide>
        <view class="row-between">
          <view class="home-guide-title">🏠 首页使用指南</view>
          <button
            class="home-guide-close"
            size="mini"
            hover-class="tap-row--active"
            data-dash-guide-close
            @click.stop="dismissGuide"
          >✕</button>
        </view>
        <view class="home-guide-list">
          <view class="home-guide-row">
            <text class="home-guide-step">1</text>
            <view class="home-guide-content">
              <view class="home-guide-name">🏠 精简模式</view>
              <view class="muted" style="font-size: 22rpx">首页默认只显示 13 张精选卡，点工具栏「📊 完整模式」看全部 25 张。</view>
            </view>
          </view>
          <view class="home-guide-row">
            <text class="home-guide-step">2</text>
            <view class="home-guide-content">
              <view class="home-guide-name">✕ 单卡隐藏</view>
              <view class="muted" style="font-size: 22rpx">每张核心卡右上角的 ✕ 可一键隐藏；底部「⚙️ 首页卡片管理」恢复。</view>
            </view>
          </view>
          <view class="home-guide-row">
            <text class="home-guide-step">3</text>
            <view class="home-guide-content">
              <view class="home-guide-name">📊 进阶分析</view>
              <view class="muted" style="font-size: 22rpx">点频道「工具 / 供需」或下方「深度可视化 / 数据工具」进独立页，不在本页折叠长滚。</view>
            </view>
          </view>
          <view class="home-guide-row">
            <text class="home-guide-step">4</text>
            <view class="home-guide-content">
              <view class="home-guide-name">📐 深度可视化</view>
              <view class="muted" style="font-size: 22rpx">首页金刚区下方「📊 深度可视化分析」按钮 → 独立 sub-page 全屏深度卡。</view>
            </view>
          </view>
        </view>
      </view>

      <!-- F-ENTRY-01：定位 + 搜索 + 频道 + 金刚区（美团/淘宝式多入口） -->
      <view class="card home-entry-card" data-home-entry data-tab="all,overview,price,school,transit,map">
        <view class="home-loc-search">
          <button class="home-city-chip" hover-class="tap-row--active" data-home-city @click="pickCity">
            <text class="home-city-name">{{ currentCityLabel || "选城市" }}</text>
            <text class="home-city-caret">▾</text>
          </button>
          <view class="home-search" data-home-search>
            <input
              class="home-search-input"
              type="text"
              confirm-type="search"
              :placeholder="homeSearchPlaceholder"
              :value="homeSearchText"
              @input="onHomeSearchInput"
              @confirm="submitHomeSearch"
            />
            <button class="home-search-btn" size="mini" @click="submitHomeSearch">搜索</button>
          </view>
        </view>
        <view class="home-search-modes">
          <view
            v-for="m in HOME_SEARCH_MODES"
            :key="m.key"
            class="home-mode-chip"
            :class="{ 'home-mode-chip--on': homeSearchMode === m.key }"
            :data-home-mode="m.key"
            @click="homeSearchMode = m.key"
          >{{ m.label }}</view>
        </view>
        <scroll-view class="home-channel-scroll" scroll-x :show-scrollbar="false" data-home-channels>
          <view class="home-channel-row">
            <view
              v-for="c in HOME_CHANNELS"
              :key="c.key"
              class="home-channel-chip"
              :data-home-channel="c.key"
              @click="onHomeChannel(c)"
            >{{ c.label }}</view>
          </view>
        </scroll-view>
        <view class="home-kingkong" data-home-kingkong>
          <view
            v-for="k in HOME_KINGKONG"
            :key="k.key"
            class="home-king-tile"
            :data-home-king="k.key"
            @click="onHomeKingkong(k)"
          >
            <view class="home-king-icon" :class="'home-king-icon--' + k.tone">{{ k.icon }}</view>
            <text class="home-king-label">{{ k.label }}</text>
          </view>
        </view>
        <view class="home-entry-hint muted">
          房价看挂牌 / 网签量 / 70城指数；官方宏观≠城市成交均价。点频道或金刚区进入对应独立页（非本页长滚）。
        </view>
        <!-- v1.121.145 首页卡片个性化设置入口 -->
        <view class="home-personalize-row">
          <button
            class="home-personalize-btn"
            size="mini"
            hover-class="tap-row--active"
            data-dash-personalize
            @click="goDataTools"
          >⚙️ 首页卡片管理 ({{ hiddenCards.size }} 已隐藏)</button>
        </view>
        <!-- v1.121.149 Batch 10：深度可视化分析 sub-page 入口 -->
        <view class="home-personalize-row">
          <button
            class="home-personalize-btn"
            size="mini"
            hover-class="tap-row--active"
            data-dash-trend
            @click="goTrendAnalysis"
          >📊 深度可视化分析 (热图/矩阵/散点)</button>
        </view>
        <!-- v1.121.153 Batch 14：行政区 + 社区地图 sub-page 入口 -->
        <view class="home-personalize-row">
          <button
            class="home-personalize-btn"
            size="mini"
            hover-class="tap-row--active"
            data-dash-map
            @click="goMapAnalysis"
          >🗺️ 全屏行政区 + 社区地图</button>
        </view>
      </view>

      <!-- F-DASH-04：专业 Tab 置于入口下方（App/H5 均靠 .page[data-dash-tab] 过滤） -->
      <view id="dash-tabs" class="dash-tabs" data-dash-tabs>
        <view
          v-for="t in DASHBOARD_TABS"
          :key="t.key"
          :class="['dash-tab', { 'dash-tab--active': activeTab === t.key }]"
          @click="setDashTab(t.key)"
          :data-tab="t.key"
        >
          <text class="dash-tab-icon">{{ t.icon }}</text>
          <text class="dash-tab-label">{{ t.label }}</text>
        </view>
      </view>

      <!-- 高级工作台：默认折叠，避免霸占首屏 -->
      <view class="card filter-card" data-home-workbench>
        <view class="row-between" @click="filterWorkbenchExpanded = !filterWorkbenchExpanded">
          <view>
            <view class="dashboard-eyebrow">工作台</view>
            <view class="card-title" style="margin-bottom: 0">周期 · 来源 · 指标</view>
          </view>
          <view class="muted" style="font-size: 22rpx">
            {{ filterWorkbenchExpanded ? "收起 ▴" : "展开 ▾" }}
            · {{ currentCityLabel || "—" }} · {{ app.weekEnd || "—" }}
          </view>
        </view>
        <template v-if="filterWorkbenchExpanded">
        <view class="filter-card-head" style="margin-top: 12rpx">
          <view class="data-trust-badge">官方与公开数据</view>
        </view>
        <view class="row-gap">
          <button class="form-row tap-row" hover-class="tap-row--active" @click="pickCity">
            <text class="form-label">城市</text>
            <view class="picker-value">
              <text>{{ currentCityLabel || "请选择" }}</text>
              <text class="picker-caret">▾</text>
            </view>
          </button>
          <button class="form-row tap-row" hover-class="tap-row--active" @click="pickPeriod">
            <text class="form-label">周期结束日</text>
            <view class="picker-value">
              <text>{{ app.weekEnd || "请选择" }}</text>
              <text class="picker-caret">▾</text>
            </view>
          </button>
          <button class="form-row tap-row" hover-class="tap-row--active" @click="pickSource">
            <text class="form-label">数据来源</text>
            <view class="picker-value">
              <text>{{ app.source || "全部" }}</text>
              <text class="picker-caret">▾</text>
            </view>
          </button>
          <button class="form-row tap-row" hover-class="tap-row--active" @click="pickMetric">
            <text class="form-label">指标</text>
            <view class="picker-value">
              <text>{{ metricLabels[metricIndex] }}</text>
              <text class="picker-caret">▾</text>
            </view>
          </button>
        </view>
        <view class="row-gap filter-actions" style="margin-top: 16rpx">
          <button class="btn" size="mini" @click="reload">刷新</button>
          <button
            class="btn btn-ghost"
            size="mini"
            :class="{ 'btn-on': !cityScoped }"
            @click="toggleCityScoped"
          >
            {{ cityScoped ? "仅本市" : "含跨城" }}
          </button>
        </view>
        <text v-if="periodHint" class="muted period-hint">{{ periodHint }}</text>
        <text class="muted period-hint">
          默认仅展示本市卡片；点「含跨城」才显示对照块。周切换只刷新「本周速览 / 区对比 / 小区周榜」。
        </text>
        <text class="muted period-hint">
          数据构成：真实挂牌 {{ listingTrust.real }}（{{ listingTrust.realPct }}%）/
          派生样本 {{ listingTrust.derived }} / 其他 {{ listingTrust.other }}；派生样本不代表逐套成交。
          <text v-if="listingTrust.latestRealCrawlDate">
            真实挂牌最新 crawl_date {{ listingTrust.latestRealCrawlDate }}。
          </text>
          <text v-else>当前城市尚无带日期的真实挂牌。</text>
        </text>
        <text class="muted period-hint">{{ priceAxesHint }}</text>
        </template>
      </view>

      <!-- 今日要点：参考贝壳/链家「首页速览」收敛首屏信息密度 -->
      <view v-if="todayHighlights.length" class="card today-highlights-card">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">今日要点 · {{ hospitalCityName }}</view>
          <view class="muted" style="font-size: 22rpx">首屏速览</view>
        </view>
        <view class="today-grid">
          <view v-for="(h, i) in todayHighlights" :key="'th' + i" class="today-cell">
            <text class="today-label muted">{{ h.label }}</text>
            <text class="today-value" :class="h.toneClass">{{ h.value }}</text>
            <text v-if="h.sub" class="today-sub muted">{{ h.sub }}</text>
          </view>
        </view>
      </view>

      <!-- 全国 70 城指数（顶部第一张卡，入口也是 stats70 页） -->
      <view
        id="entry-stats70"
        class="card stats70-card tap-target"
        role="button"
        tabindex="0"
        hover-class="card-active"
        @click="goStats70"
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">全国 70 城价格指数</view>
          <view class="muted" style="font-size: 22rpx">{{ stats70MonthLabel }}</view>
        </view>

        <view v-if="!stats70Ready" class="empty" style="padding: 24rpx 0">
          70 城数据未加载。点击"刷新"或下拉重新加载。
        </view>
        <view v-else-if="!currentCityIndex" class="empty" style="padding: 24rpx 0">
          请先在上方选择城市
        </view>
        <view v-else>
          <view class="stats70-grid">
            <view class="stats70-cell">
              <text class="cell-label">新建 同比</text>
              <text class="cell-value" :class="trendClass(currentCityIndex.newYoY)">
                {{ formatIndex(currentCityIndex.newYoY) }}
              </text>
              <text class="cell-sub" v-if="currentCityIndex.newYoY != null">
                {{ deltaLabel(currentCityIndex.newYoY) }}
              </text>
            </view>
            <view class="stats70-cell">
              <text class="cell-label">新建 环比</text>
              <text class="cell-value" :class="trendClass(currentCityIndex.newMoM)">
                {{ formatIndex(currentCityIndex.newMoM) }}
              </text>
              <text class="cell-sub" v-if="currentCityIndex.newMoM != null">
                {{ deltaLabel(currentCityIndex.newMoM) }}
              </text>
            </view>
            <view class="stats70-cell">
              <text class="cell-label">二手 同比</text>
              <text class="cell-value" :class="trendClass(currentCityIndex.secondYoY)">
                {{ formatIndex(currentCityIndex.secondYoY) }}
              </text>
              <text class="cell-sub" v-if="currentCityIndex.secondYoY != null">
                {{ deltaLabel(currentCityIndex.secondYoY) }}
              </text>
            </view>
            <view class="stats70-cell">
              <text class="cell-label">二手 环比</text>
              <text class="cell-value" :class="trendClass(currentCityIndex.secondMoM)">
                {{ formatIndex(currentCityIndex.secondMoM) }}
              </text>
              <text class="cell-sub" v-if="currentCityIndex.secondMoM != null">
                {{ deltaLabel(currentCityIndex.secondMoM) }}
              </text>
            </view>
          </view>
          <view v-if="stats70RecentMonths.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
            可用月份（派生）· 最新 {{ stats70TrendLatestMonth || "—" }}
          </view>
          <view v-if="stats70RecentMonths.length" class="mp-year-row">
            <view v-for="m in stats70RecentMonths" :key="'s70m-' + m" class="mp-year-chip">
              <text class="mp-year-y">{{ m.replace(/\/1$/, "") }}</text>
            </view>
          </view>
          <view v-if="stats70LatestCities.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
            三城最新月二手同比
          </view>
          <view
            v-for="c in stats70LatestCities"
            :key="'s70c-' + c.city"
            class="rank-row"
          >
            <text class="rank-name">{{ c.city }}</text>
            <text class="rank-meta muted">{{ c.date.replace(/\/1$/, "") }}</text>
            <text :class="trendClass(c.secondYoY)">{{ formatIndex(c.secondYoY) }}</text>
          </view>
        </view>

        <view class="stats70-foot muted">点击进入全国 70 城榜单 ›</view>
      </view>

      <!-- v1.116.0 全国 70 城涨跌 Top + 当前城市排位 + 趋势方向 -->
      <view v-if="!isCardHidden('stats70-drift') && stats70Ready" class="card" data-card-key="stats70-drift">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">全国 70 城 · 涨跌 Top</view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="stats70-drift"
            @click.stop="toggleCardHidden('stats70-drift')"
          >✕</button>
          <view class="muted" style="font-size: 22rpx">{{ stats70MonthLabel }}</view>
        </view>

        <view class="trend-summary">
          <view
            v-for="row in stats70CityCounts"
            :key="row.fixedBase + row.indexType"
            class="trend-cell"
          >
            <text class="cell-label">
              {{ row.fixedBase }} · {{ row.indexType === "new_idx" ? "新建" : "二手" }}
            </text>
            <text class="cell-value" :class="row.upCount >= row.downCount ? 'trend-up' : 'trend-down'">
              涨 {{ row.upCount }} · 跌 {{ row.downCount }}
            </text>
            <text class="cell-sub muted">共 {{ row.total }} 城</text>
          </view>
        </view>

        <view class="rank-row" v-if="stats70CurrentCityRank">
          <text class="muted" style="font-size: 22rpx">当前城市排位</text>
          <text class="rank-val">
            {{ stats70CurrentCityRank.city }}
            · 全国 Top
            <text :class="stats70CurrentCityRank.rank <= 10 ? 'trend-up' : 'trend-down'">
              {{ stats70CurrentCityRank.topPct }}%
            </text>
            · 同比 {{ formatIndex(stats70CurrentCityRank.value) }}
          </text>
          <view
            class="gz-progress-track"
            style="margin-top: 8rpx"
            aria-hidden="true"
          >
            <view
              class="gz-progress-fill"
              :style="{ width: Math.min(100, Math.max(0, stats70CurrentCityRank.topPct)) + '%' }"
            />
          </view>
        </view>

        <view class="trend-row" v-if="stats70CurrentCityTrend">
          <text class="muted" style="font-size: 22rpx">近 3 月趋势</text>
          <text
            class="cell-value"
            :class="stats70CurrentCityTrend.direction === '上涨' ? 'trend-up' : stats70CurrentCityTrend.direction === '下跌' ? 'trend-down' : 'muted'"
          >
            {{ stats70CurrentCityTrend.direction }}
            <text class="muted" style="font-size: 22rpx" v-if="stats70CurrentCityTrend.direction !== '数据不足'">
              （{{ stats70CurrentCityTrend.avgChangePp > 0 ? '+' : '' }}{{ stats70CurrentCityTrend.avgChangePp }} pp）
            </text>
          </text>
        </view>

        <view class="top-section">
          <view class="top-line">
            <text class="muted" style="font-size: 22rpx">新建 同比 · 涨 Top 5</text>
          </view>
          <view
            v-for="row in stats70TopUpYoy"
            :key="row.city + 'yoy-up'"
            class="top-row"
          >
            <text class="top-rank">{{ row.city }}</text>
            <text class="top-val trend-up">{{ row.value.toFixed(1) }}</text>
          </view>
          <view class="top-line" style="margin-top: 8rpx">
            <text class="muted" style="font-size: 22rpx">新建 同比 · 跌 Top 5</text>
          </view>
          <view
            v-for="row in stats70TopDownYoy"
            :key="row.city + 'yoy-down'"
            class="top-row"
          >
            <text class="top-rank">{{ row.city }}</text>
            <text class="top-val trend-down">{{ row.value.toFixed(1) }}</text>
          </view>
        </view>

        <view v-if="stats70City12m.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          {{ stats70City12mName }} · 近 {{ stats70City12m.length }} 月指数（同比）
        </view>
        <view v-if="stats70City12m.length" class="s70-12m">
          <view v-for="p in stats70City12m" :key="p.date" class="s70-12m-row">
            <text class="s70-12m-date muted">{{ formatStats70Month(p.date) }}</text>
            <text class="s70-12m-val" :class="idxTone(p.newYoY)">新 {{ formatIndex(p.newYoY) }}</text>
            <text class="s70-12m-val" :class="idxTone(p.secondYoY)">二 {{ formatIndex(p.secondYoY) }}</text>
          </view>
        </view>
        <view v-if="stats70MonthSpread.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          全国离散度（当月 max−min）
        </view>
        <view v-if="stats70MonthSpread.length" class="s70-spread">
          <view v-for="s in stats70MonthSpread" :key="s.fixedBase + s.indexType" class="s70-spread-cell">
            <text class="s70-spread-l muted">
              {{ s.fixedBase }}·{{ s.indexType === "new_idx" ? "新建" : "二手" }}
            </text>
            <text class="s70-spread-v">{{ s.spread.toFixed(1) }}</text>
          </view>
        </view>
      </view>

      <!-- v1.117.0 LPR 与房贷利率信号卡 -->
      <view v-if="!isCardHidden('lpr-mortgage-signal') && lprLatest" class="card" data-card-key="lpr-mortgage-signal">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🏦 LPR 与房贷利率</view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="lpr-mortgage-signal"
            @click.stop="toggleCardHidden('lpr-mortgage-signal')"
          >✕</button>
          <view class="muted" style="font-size: 22rpx">{{ lprLatest.month }}</view>
        </view>

        <view class="trend-summary" style="margin-top: 12rpx">
          <view class="trend-cell">
            <text class="cell-label">1 年期 LPR</text>
            <text class="cell-value">{{ lprLatest.lpr1y.toFixed(2) }}%</text>
            <text class="cell-sub muted" v-if="lprDelta12m">
              12 月
              <text :class="rateDeltaClass(lprDelta12m.lpr1yDeltaBp)">
                {{ rateDeltaArrow(lprDelta12m.lpr1yDeltaBp) }}
                {{ Math.abs(lprDelta12m.lpr1yDeltaBp) }} bp
              </text>
            </text>
          </view>
          <view class="trend-cell">
            <text class="cell-label">5 年期以上 LPR</text>
            <text class="cell-value">{{ lprLatest.lpr5y.toFixed(2) }}%</text>
            <text class="cell-sub muted" v-if="lprDelta12m">
              12 月
              <text :class="rateDeltaClass(lprDelta12m.lpr5yDeltaBp)">
                {{ rateDeltaArrow(lprDelta12m.lpr5yDeltaBp) }}
                {{ Math.abs(lprDelta12m.lpr5yDeltaBp) }} bp
              </text>
            </text>
          </view>
          <view class="trend-cell">
            <text class="cell-label">首套房贷</text>
            <text class="cell-value">{{ lprLatest.mortgageFirst.toFixed(2) }}%</text>
            <text class="cell-sub muted" v-if="lprDelta12m">
              12 月
              <text :class="rateDeltaClass(lprDelta12m.mortgageFirstDeltaBp)">
                {{ rateDeltaArrow(lprDelta12m.mortgageFirstDeltaBp) }}
                {{ Math.abs(lprDelta12m.mortgageFirstDeltaBp) }} bp
              </text>
            </text>
          </view>
          <view class="trend-cell">
            <text class="cell-label">二套房贷</text>
            <text class="cell-value">{{ lprLatest.mortgageSecond.toFixed(2) }}%</text>
            <text class="cell-sub muted" v-if="lprDelta12m">
              12 月
              <text :class="rateDeltaClass(lprDelta12m.mortgageSecondDeltaBp)">
                {{ rateDeltaArrow(lprDelta12m.mortgageSecondDeltaBp) }}
                {{ Math.abs(lprDelta12m.mortgageSecondDeltaBp) }} bp
              </text>
            </text>
          </view>
        </view>

        <view class="rank-row" v-if="lprDownwardCumulative">
          <text class="muted" style="font-size: 22rpx">累计降息（自 {{ lprDownwardCumulative.startMonth }} 起）</text>
          <text class="rank-val">
            5 年期 LPR
            <text class="trend-down">
              ↓ {{ lprDownwardCumulative.lpr5yCumulativeBp }} bp
            </text>
            ·
            <text class="muted" style="font-size: 22rpx">首套房贷 ↓ {{ lprDownwardCumulative.mortgageFirstCumulativeBp }} bp</text>
          </text>
        </view>

        <view class="rank-row" v-if="lprLongestFlat">
          <text class="muted" style="font-size: 22rpx">最长"按兵不动"</text>
          <text class="rank-val">
            {{ lprLongestFlat.months }} 个月
            <text class="muted" style="font-size: 22rpx">
              （{{ lprLongestFlat.startMonth }} ~ {{ lprLongestFlat.endMonth }}）
            </text>
          </text>
        </view>

        <view v-if="lprSpreadCurrent" class="trend-summary" style="margin-top: 8rpx">
          <view class="trend-cell">
            <text class="cell-label">首套加点</text>
            <text class="cell-value">{{ formatBp(lprSpreadCurrent.firstSpreadBp) }}</text>
            <text class="cell-sub muted">vs 5Y LPR</text>
          </view>
          <view class="trend-cell">
            <text class="cell-label">二套加点</text>
            <text class="cell-value">{{ formatBp(lprSpreadCurrent.secondSpreadBp) }}</text>
            <text class="cell-sub muted">vs 5Y LPR</text>
          </view>
          <view class="trend-cell">
            <text class="cell-label">首二套利差</text>
            <text class="cell-value">{{ formatBp(lprSpreadCurrent.firstSecondDeltaBp) }}</text>
            <text class="cell-sub muted">二套 − 首套</text>
          </view>
        </view>

        <view v-if="lprYoY && lprYoY.lpr5yDeltaBp != null" class="trend-summary" style="margin-top: 8rpx">
          <view class="trend-cell">
            <text class="cell-label">5Y 同比</text>
            <text class="cell-value" :class="rateDeltaClass(lprYoY.lpr5yDeltaBp)">
              {{ formatBp(lprYoY.lpr5yDeltaBp) }}
            </text>
            <text class="cell-sub muted">vs {{ lprYoY.yearAgo?.month ?? "去年同月" }}</text>
          </view>
          <view class="trend-cell">
            <text class="cell-label">首套同比</text>
            <text
              class="cell-value"
              :class="rateDeltaClass(lprYoY.mortgageFirstDeltaBp ?? 0)"
            >
              {{ lprYoY.mortgageFirstDeltaBp != null ? formatBp(lprYoY.mortgageFirstDeltaBp) : "—" }}
            </text>
            <text class="cell-sub muted">加点后</text>
          </view>
          <view class="trend-cell">
            <text class="cell-label">1Y 同比</text>
            <text class="cell-value" :class="rateDeltaClass(lprYoY.lpr1yDeltaBp ?? 0)">
              {{ lprYoY.lpr1yDeltaBp != null ? formatBp(lprYoY.lpr1yDeltaBp) : "—" }}
            </text>
            <text class="cell-sub muted">短端</text>
          </view>
        </view>

        <view v-if="lprVsAllTimeAvg && lprLatest" class="trend-summary" style="margin-top: 8rpx">
          <view class="trend-cell">
            <text class="cell-label">5Y vs 全期均</text>
            <text
              class="cell-value"
              :class="rateDeltaClass(lprVsAllTimeAvg.lpr5yDeltaBp)"
            >
              {{ formatBp(lprVsAllTimeAvg.lpr5yDeltaBp) }}
            </text>
            <text class="cell-sub muted">均 {{ lprVsAllTimeAvg.lpr5yAvg.toFixed(2) }}%</text>
          </view>
          <view class="trend-cell">
            <text class="cell-label">首套 vs 全期均</text>
            <text
              class="cell-value"
              :class="rateDeltaClass(lprVsAllTimeAvg.mortgageFirstDeltaBp)"
            >
              {{ formatBp(lprVsAllTimeAvg.mortgageFirstDeltaBp) }}
            </text>
            <text class="cell-sub muted">{{ lprVsAllTimeAvg.monthCount }} 月样本</text>
          </view>
          <view class="trend-cell">
            <text class="cell-label">1Y vs 全期均</text>
            <text
              class="cell-value"
              :class="rateDeltaClass(lprVsAllTimeAvg.lpr1yDeltaBp)"
            >
              {{ formatBp(lprVsAllTimeAvg.lpr1yDeltaBp) }}
            </text>
            <text class="cell-sub muted">均 {{ lprVsAllTimeAvg.lpr1yAvg.toFixed(2) }}%</text>
          </view>
        </view>

        <view v-if="lprYearSeries.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          {{ lprYearLabel }} 年 LPR 序列（派生 getLprByYear）
        </view>
        <view
          v-for="row in lprYearSeries"
          :key="'lpry-' + row.month"
          class="top-row"
        >
          <text class="top-name">{{ row.month }}</text>
          <text class="top-val">5Y {{ row.lpr5y.toFixed(2) }}% · 首套 {{ row.mortgageFirst.toFixed(2) }}%</text>
        </view>

        <view v-if="lprRange12m.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          近 12 月 LPR（getLprRange）
        </view>
        <view
          v-for="row in lprRange12m"
          :key="'lprr-' + row.month"
          class="top-row"
        >
          <text class="top-name">{{ row.month }}</text>
          <text class="top-val">5Y {{ row.lpr5y.toFixed(2) }}%</text>
        </view>

        <view v-if="lprRecentCycles.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          近期调息节点（5Y LPR）
        </view>
        <view
          v-for="c in lprRecentCycles"
          :key="c.month"
          class="top-row"
        >
          <text class="top-rank">{{ c.month }}</text>
          <text class="top-val" :class="c.direction === 'down' ? 'trend-up' : 'trend-down'">
            {{ c.fromLpr5y.toFixed(2) }}% → {{ c.toLpr5y.toFixed(2) }}%
            （{{ c.direction === "down" ? "降" : "升" }} {{ Math.abs(c.changeBp) }} bp）
          </text>
        </view>

        <view class="top-section" v-if="lprYearSummaries.length > 0">
          <view class="top-line">
            <text class="muted" style="font-size: 22rpx">5 年期 LPR · 年度均值</text>
          </view>
          <view
            v-for="row in lprYearSummaries"
            :key="row.year"
            class="top-row"
          >
            <text class="top-rank">{{ row.year }} 年</text>
            <text class="top-val">{{ row.endLpr5y.toFixed(2) }}%</text>
          </view>
        </view>
      </view>
















      <!-- 政府每日网签（摘要；有日更则可进子页） -->
      <view
        class="card wangqian-card"
        :class="{ 'tap-target': !!currentWangqian }"
        :role="currentWangqian ? 'button' : undefined"
        :tabindex="currentWangqian ? 0 : undefined"
        :hover-class="currentWangqian ? 'card-active' : undefined"
        @click="onWangqianCardClick"
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">政府每日网签</view>
          <view class="muted" style="font-size: 22rpx">
            {{ wangqianDateLabel }}
            <text v-if="wangqianFreshLabel" class="wq-fresh" :class="wangqianFreshClass">{{ wangqianFreshLabel }}</text>
          </view>
        </view>

        <view v-if="!wangqianReady" class="empty" style="padding: 24rpx 0">
          网签数据未加载。
        </view>
        <view v-else-if="!currentWangqian" class="empty" style="padding: 24rpx 0">
          当前城市暂无网签日更（仅深圳/广州）
          <template v-if="zhBdcNew && zhBdcStock">；珠海见下方「不动产登记季报」</template>
        </view>
        <view v-else>
          <view class="stats70-grid">
            <view class="stats70-cell">
              <text class="cell-label">新房 · 住宅</text>
              <text class="cell-value wangqian-up">
                {{ formatWangqianUnits(currentWangqian.newUnits) }}
              </text>
              <text class="cell-sub muted">{{ formatWangqianArea(currentWangqian.newArea) }}</text>
            </view>
            <view class="stats70-cell">
              <text class="cell-label">二手 · 住宅</text>
              <text class="cell-value wangqian-res">
                {{ formatWangqianUnits(currentWangqian.secondResidentialUnits) }}
              </text>
              <text class="cell-sub muted">{{ formatWangqianArea(currentWangqian.secondResidentialArea) }}</text>
            </view>
            <view class="stats70-cell" v-if="currentWangqian.secondAllUnits != null">
              <text class="cell-label">二手 · 全部</text>
              <text class="cell-value wangqian-all">
                {{ formatWangqianUnits(currentWangqian.secondAllUnits) }}
              </text>
              <text class="cell-sub muted">{{ formatWangqianArea(currentWangqian.secondAllArea) }}</text>
            </view>
          </view>
        </view>

        <view v-if="currentWangqian" class="stats70-foot">点击查看 90 日趋势与分区 ›</view>
        <view
          v-else-if="zhBdcNew && zhBdcStock"
          class="stats70-foot"
          @click.stop="jumpHomeAnchor('entry-zh-bdc-registration')"
        >
          滚到珠海不动产登记季报 ›
        </view>
      </view>

      <!-- 珠海不动产登记季报（官方 PNG 合计抄录；≠日更网签） -->
      <view
        v-if="zhBdcNew && zhBdcStock"
        id="entry-zh-bdc-registration"
        class="card"
        data-tab="price"
        data-zh-bdc-registration
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">📋 珠海不动产登记季报</view>
          <view class="muted" style="font-size: 22rpx">{{ formatZhBdcPeriod(zhBdcNew) }}</view>
        </view>
        <view class="gz-inventory-grid">
          <view class="gz-inventory-kpi">
            <text class="cell-label">新增商品房 · 住宅</text>
            <text class="gz-inventory-value">{{ zhBdcNew.residentialUnits.toLocaleString() }} 套</text>
            <text class="cell-sub muted">{{ zhBdcNew.residentialAreaWanSqm.toFixed(2) }} 万㎡</text>
            <text
              v-if="zhBdcNewQoQ"
              class="cell-sub"
              :class="invDeltaClass(zhBdcNewQoQ.unitsDelta)"
            >
              较上季 {{ formatInvDelta(zhBdcNewQoQ.unitsDelta) }}
            </text>
          </view>
          <view class="gz-inventory-kpi">
            <text class="cell-label">存量房转移 · 住宅</text>
            <text class="gz-inventory-value">{{ zhBdcStock.residentialUnits.toLocaleString() }} 套</text>
            <text class="cell-sub muted">{{ zhBdcStock.residentialAreaWanSqm.toFixed(2) }} 万㎡</text>
            <text
              v-if="zhBdcStockQoQ"
              class="cell-sub"
              :class="invDeltaClass(zhBdcStockQoQ.unitsDelta)"
            >
              较上季 {{ formatInvDelta(zhBdcStockQoQ.unitsDelta) }}
            </text>
          </view>
          <view class="gz-inventory-kpi">
            <text class="cell-label">新增 · 非住（商办其他）</text>
            <text class="gz-inventory-value">
              {{
                (
                  zhBdcNew.commercialUnits +
                  zhBdcNew.officeUnits +
                  zhBdcNew.otherUnits
                ).toLocaleString()
              }}
              套
            </text>
            <text class="cell-sub muted">
              商 {{ zhBdcNew.commercialUnits }} / 办 {{ zhBdcNew.officeUnits }} / 其他
              {{ zhBdcNew.otherUnits }}
            </text>
          </view>
        </view>
        <view class="muted" style="margin-top: 10rpx; font-size: 21rpx">
          {{ zhBdcNew.sourceOrg }} · {{ zhBdcNew.publishDate }} 公示（官方表为 PNG，人工抄录合计行）。
          登记量 ≠ 日更网签、≠ 挂牌均价、≠ 70 城指数。
          <text
            v-if="zhBdcNew.sourceUrl"
            class="linkish"
            @click.stop="openZhBdcSource"
          >
            查看官方公示 ›
          </text>
        </view>
        <view
          v-if="!zhBdcStockDistricts.length && !zhBdcNewDistricts.length"
          class="muted"
          style="margin-top: 8rpx; font-size: 21rpx"
        >
          本期分区表未抄录（仅全市合计）。
        </view>
        <view v-if="zhBdcStockDistricts.length" class="muted" style="margin-top: 10rpx; font-size: 22rpx">
          本期分区住宅（存量转移 Top）
        </view>
        <view
          v-for="d in zhBdcStockDistricts.slice(0, 5)"
          :key="'zh-bdc-st-' + d.district"
          class="gz-inventory-row"
          style="margin-top: 4rpx"
        >
          <text class="muted">{{ d.district }}</text>
          <text>{{ d.residentialUnits.toLocaleString() }} 套 · {{ d.residentialAreaWanSqm.toFixed(2) }} 万㎡</text>
        </view>
        <view v-if="zhBdcNewDistricts.length" class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          本期分区住宅（新增登记）
        </view>
        <view
          v-for="d in zhBdcNewDistricts.slice(0, 5)"
          :key="'zh-bdc-new-' + d.district"
          class="gz-inventory-row"
          style="margin-top: 4rpx"
        >
          <text class="muted">{{ d.district }}</text>
          <text>{{ d.residentialUnits.toLocaleString() }} 套 · {{ d.residentialAreaWanSqm.toFixed(2) }} 万㎡</text>
        </view>
      </view>

      <!-- 珠海商品房价格备案（住建局 HTML 表；备案价 ≠ 挂牌/成交/70城） -->
      <view
        v-if="zhPriceFiling"
        id="entry-zh-price-filing"
        class="card"
        data-tab="price"
        data-zh-price-filing
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">📑 珠海商品房价格备案</view>
          <view class="muted" style="font-size: 22rpx">
            近 {{ zhPriceFiling.filingCount }} 条 · {{ zhPriceFiling.latestPublishDate || "—" }}
          </view>
        </view>
        <view class="gz-inventory-grid">
          <view class="gz-inventory-kpi">
            <text class="cell-label">公示条数</text>
            <text class="gz-inventory-value">{{ zhPriceFiling.filingCount.toLocaleString() }}</text>
            <text v-if="zhPriceFiling.earliestPublishDate" class="cell-sub muted">
              {{ zhPriceFiling.earliestPublishDate }} 起
            </text>
          </view>
          <view class="gz-inventory-kpi">
            <text class="cell-label">合计套数</text>
            <text class="gz-inventory-value">{{ zhPriceFiling.totalUnits.toLocaleString() }} 套</text>
          </view>
          <view class="gz-inventory-kpi">
            <text class="cell-label">建筑面积均价中位</text>
            <text class="gz-inventory-value">
              <template v-if="zhPriceFiling.medianAvgPriceBuilding">
                {{ Math.round(zhPriceFiling.medianAvgPriceBuilding).toLocaleString() }}
              </template>
              <template v-else>—</template>
            </text>
            <text class="cell-sub muted">元/㎡ · 备案</text>
            <text
              v-if="zhPriceFiling.weightedAvgPriceBuilding"
              class="cell-sub muted"
            >
              套数加权 {{ Math.round(zhPriceFiling.weightedAvgPriceBuilding).toLocaleString() }}
            </text>
          </view>
        </view>
        <view
          v-if="zhPriceFiling.districtStats.length"
          class="muted"
          style="margin-top: 10rpx; font-size: 22rpx"
        >
          分区（地址推断）
        </view>
        <view
          v-for="d in zhPriceFiling.districtStats.slice(0, 5)"
          :key="'zh-pf-d-' + d.district"
          class="gz-inventory-row"
          style="margin-top: 4rpx"
        >
          <text class="muted">{{ d.district }}</text>
          <text>
            {{ d.filingCount }} 条 · {{ d.units.toLocaleString() }} 套
            <template v-if="d.medianAvgPriceBuilding">
              · 中位 {{ Math.round(d.medianAvgPriceBuilding).toLocaleString() }}
            </template>
          </text>
        </view>
        <view class="muted" style="margin-top: 10rpx; font-size: 22rpx">最近公示</view>
        <view
          v-for="f in zhPriceFiling.recent.slice(0, 5)"
          :key="'zh-pf-' + f.postId"
          class="gz-inventory-row"
          style="margin-top: 6rpx"
        >
          <text class="muted">{{ f.district }} · {{ f.projectName || "项目" }}</text>
          <text>
            {{ f.units }} 套 ·
            {{ f.avgPriceBuilding ? Math.round(f.avgPriceBuilding).toLocaleString() : "—" }} 元/㎡
          </text>
        </view>
        <view class="muted" style="margin-top: 10rpx; font-size: 21rpx">
          来源：珠海市住建局「商品房价格备案公示」HTML 表摘要。
          备案价 ≠ 挂牌价、≠ 成交价、≠ 日更网签、≠ 70 城指数。
          <text class="linkish" @click.stop="openZhPriceFilingSource">查看专栏 ›</text>
        </view>
      </view>

      <!-- v1.121.138：「数据工具」独立页入口（14 张派生卡已迁出 dashboard；从此页查看） -->
      <view class="card data-tools-entry-card" data-data-tools-entry>
        <view class="row-between" @click="goDataTools">
          <view>
            <view class="dashboard-eyebrow">设置入口</view>
            <view class="card-title" style="margin-bottom: 0">数据工具 · 全部派生数据</view>
          </view>
          <view class="muted" style="font-size: 22rpx">›</view>
        </view>
        <view class="muted" style="font-size: 20rpx; margin-top: 8rpx">
          派生排行 · 学校维度 · 教育事业 · 行政区划 · 通勤 · 户型分布 等 14 张卡，单独页查看。
        </view>
      </view>

      <!-- 官方宏观对照：全国 / 广东分组；≠城市挂牌·网签均价 -->
      <view v-if="nbsMacro" id="entry-macro" class="card macro-card" data-tab="price" data-nbs-macro>
        <view class="macro-kicker">全国 · 官方累计</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">房地产开发与销售</view>
          <view class="muted" style="font-size: 22rpx">{{ nbsMacro.publishDate }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <MacroKpiCell
            label="开发投资"
            :value="formatMacro100m(nbsMacro.investmentCny100m)"
            :sub="`同比 ${formatMacroPct(nbsMacro.investmentYoyPct)}`"
            :subTrendClass="macroTrendClass(nbsMacro.investmentYoyPct) === 'stats70-up' ? 'up' : macroTrendClass(nbsMacro.investmentYoyPct) === 'stats70-down' ? 'down' : 'flat'"
          />
          <MacroKpiCell
            label="新房销售额"
            :value="formatMacro100m(nbsMacro.salesAmountCny100m)"
            :sub="`同比 ${formatMacroPct(nbsMacro.salesAmountYoyPct)}`"
            :subTrendClass="macroTrendClass(nbsMacro.salesAmountYoyPct) === 'stats70-up' ? 'up' : macroTrendClass(nbsMacro.salesAmountYoyPct) === 'stats70-down' ? 'down' : 'flat'"
          />
          <MacroKpiCell
            label="新房销售面积"
            :value="formatMacroArea(nbsMacro.salesArea10kSqm)"
            :sub="`同比 ${formatMacroPct(nbsMacro.salesAreaYoyPct)}`"
            :subTrendClass="macroTrendClass(nbsMacro.salesAreaYoyPct) === 'stats70-up' ? 'up' : macroTrendClass(nbsMacro.salesAreaYoyPct) === 'stats70-down' ? 'down' : 'flat'"
          />
          <MacroKpiCell
            label="商品房待售"
            :value="formatMacroArea(nbsMacro.inventoryArea10kSqm)"
            :sub="`同比 ${formatMacroPct(nbsMacro.inventoryAreaYoyPct)}`"
            :subTrendClass="macroTrendClass(nbsMacro.inventoryAreaYoyPct) === 'stats70-up' ? 'up' : macroTrendClass(nbsMacro.inventoryAreaYoyPct) === 'stats70-down' ? 'down' : 'flat'"
          />
        </view>
        <view v-if="!isOverviewCompact" class="stats70-grid" style="margin-top: 12rpx" data-nbs-pipeline>
          <MacroKpiCell label="房屋施工" :value="formatMacroArea(nbsMacro.constructionArea10kSqm)" :sub="`同比 ${formatMacroPct(nbsMacro.constructionAreaYoyPct)}`" :subTrendClass="macroTrendBand(nbsMacro.constructionAreaYoyPct)" />
          <MacroKpiCell label="新开工" :value="formatMacroArea(nbsMacro.newStartsArea10kSqm)" :sub="`同比 ${formatMacroPct(nbsMacro.newStartsAreaYoyPct)}`" :subTrendClass="macroTrendBand(nbsMacro.newStartsAreaYoyPct)" />
          <MacroKpiCell label="竣工" :value="formatMacroArea(nbsMacro.completedArea10kSqm)" :sub="`同比 ${formatMacroPct(nbsMacro.completedAreaYoyPct)}`" :subTrendClass="macroTrendBand(nbsMacro.completedAreaYoyPct)" />
          <MacroKpiCell label="到位资金" :value="formatMacro100m(nbsMacro.fundsCny100m)" :sub="`同比 ${formatMacroPct(nbsMacro.fundsYoyPct)}`" :subTrendClass="macroTrendBand(nbsMacro.fundsYoyPct)" />
        </view>
        <view v-if="!isOverviewCompact" class="stats70-grid" style="margin-top: 12rpx" data-nbs-res-pipeline>
          <MacroKpiCell label="住宅施工" :value="formatMacroArea(nbsMacro.residentialConstructionArea10kSqm)" :sub="`同比 ${formatMacroPct(nbsMacro.residentialConstructionAreaYoyPct)}`" :subTrendClass="macroTrendBand(nbsMacro.residentialConstructionAreaYoyPct)" />
          <MacroKpiCell label="住宅新开工" :value="formatMacroArea(nbsMacro.residentialNewStartsArea10kSqm)" :sub="`同比 ${formatMacroPct(nbsMacro.residentialNewStartsAreaYoyPct)}`" :subTrendClass="macroTrendBand(nbsMacro.residentialNewStartsAreaYoyPct)" />
          <MacroKpiCell label="住宅竣工" :value="formatMacroArea(nbsMacro.residentialCompletedArea10kSqm)" :sub="`同比 ${formatMacroPct(nbsMacro.residentialCompletedAreaYoyPct)}`" :subTrendClass="macroTrendBand(nbsMacro.residentialCompletedAreaYoyPct)" />
          <MacroKpiCell label="住宅施工占比" :value="(nbsResidentialConstructionSharePct != null ? nbsResidentialConstructionSharePct + '%' : '—')" sub-muted="占全部房屋施工" />
        </view>
        <view v-if="!isOverviewCompact" class="stats70-grid" style="margin-top: 12rpx" data-nbs-residential>
          <MacroKpiCell label="住宅销售面积" :value="formatMacroArea(nbsMacro.residentialSalesArea10kSqm)" :sub="`同比 ${formatMacroPct(nbsMacro.residentialSalesAreaYoyPct)}`" :subTrendClass="macroTrendBand(nbsMacro.residentialSalesAreaYoyPct)" />
          <MacroKpiCell label="住宅销售额" :value="formatMacro100m(nbsMacro.residentialSalesAmountCny100m)" :sub="`同比 ${formatMacroPct(nbsMacro.residentialSalesAmountYoyPct)}`" :subTrendClass="macroTrendBand(nbsMacro.residentialSalesAmountYoyPct)" />
          <MacroKpiCell label="住宅待售" :value="formatMacroArea(nbsMacro.residentialInventoryArea10kSqm)" :sub="`同比 ${formatMacroPct(nbsMacro.residentialInventoryAreaYoyPct)}`" :subTrendClass="macroTrendBand(nbsMacro.residentialInventoryAreaYoyPct)" />
          <MacroKpiCell label="住宅投资" :value="formatMacro100m(nbsMacro.residentialInvestmentCny100m)" :sub="`同比 ${formatMacroPct(nbsMacro.residentialInvestmentYoyPct)}`" :subTrendClass="macroTrendBand(nbsMacro.residentialInvestmentYoyPct)" />
        </view>
        <view v-if="!isOverviewCompact" class="stats70-grid" style="margin-top: 12rpx" data-nbs-funds>
          <MacroKpiCell label="国内贷款" :value="formatMacro100m(nbsMacro.domesticLoanFundsCny100m)" :sub="`同比 ${formatMacroPct(nbsMacro.domesticLoanFundsYoyPct)}`" :subTrendClass="macroTrendBand(nbsMacro.domesticLoanFundsYoyPct)" />
          <MacroKpiCell label="定金及预收款" :value="formatMacro100m(nbsMacro.depositFundsCny100m)" :sub="`同比 ${formatMacroPct(nbsMacro.depositFundsYoyPct)}`" :subTrendClass="macroTrendBand(nbsMacro.depositFundsYoyPct)" />
          <MacroKpiCell label="个人按揭贷款" :value="formatMacro100m(nbsMacro.mortgageFundsCny100m)" :sub="`同比 ${formatMacroPct(nbsMacro.mortgageFundsYoyPct)}`" :subTrendClass="macroTrendBand(nbsMacro.mortgageFundsYoyPct)" />
          <MacroKpiCell label="自筹资金" :value="formatMacro100m(nbsMacro.selfRaisedFundsCny100m)" :sub="`同比 ${formatMacroPct(nbsMacro.selfRaisedFundsYoyPct)}`" :subTrendClass="macroTrendBand(nbsMacro.selfRaisedFundsYoyPct)" />
        </view>
        <view v-if="nbsImpliedUnitPrice != null" class="rank-row macro-derived" style="margin-top: 12rpx">
          <text class="muted" style="font-size: 22rpx">派生合同均价</text>
          <text class="rank-val">
            {{ nbsImpliedUnitPrice.toLocaleString() }} 元/㎡
            <template v-if="nbsImpliedResidentialUnitPrice != null">
              · 住宅 {{ nbsImpliedResidentialUnitPrice.toLocaleString() }} 元/㎡
            </template>
            <template v-if="nbsImpliedInventoryMonths != null">
              · 粗算可售 {{ nbsImpliedInventoryMonths }} 月
            </template>
          </text>
        </view>
        <view class="macro-note">
          {{ nbsMacro.period.replace("_to_", "–") }} 累计 · 国家统计局 · 非城市均价 / 非70城
        </view>
        <button
          v-if="!isOverviewCompact && nbsHasSeriesDetail"
          class="gz-inventory-toggle"
          size="mini"
          data-nbs-series-toggle
          :aria-expanded="nbsSeriesExpanded"
          @click="nbsSeriesExpanded = !nbsSeriesExpanded"
        >
          {{ nbsSeriesExpanded ? "收起多期" : "多期序列" }}
        </button>
        <template v-if="nbsSeriesExpanded">
          <view v-if="nbsUnitPriceTrend.length > 1" class="macro-series" data-nbs-series-detail>
            均价
            <text v-for="(p, i) in nbsUnitPriceTrend" :key="'up-' + p.period">
              {{ p.shortLabel }} {{ p.unitPriceYuanPerSqm.toLocaleString() }}<text v-if="i < nbsUnitPriceTrend.length - 1"> · </text>
            </text>
          </view>
          <view v-if="nbsInventoryMonthsTrend.length > 1" class="macro-series" data-nbs-series-detail>
            可售月
            <text v-for="(p, i) in nbsInventoryMonthsTrend" :key="'im-' + p.period">
              {{ p.shortLabel }} {{ p.inventoryMonths }}<text v-if="i < nbsInventoryMonthsTrend.length - 1"> · </text>
            </text>
          </view>
          <view v-if="nbsYoyTrend.length > 1" class="macro-series" data-nbs-series-detail>
            销售额同比
            <text v-for="(p, i) in nbsYoyTrend" :key="'sa-' + p.period">
              {{ p.shortLabel }} {{ formatMacroPct(p.salesAmountYoyPct) }}<text v-if="i < nbsYoyTrend.length - 1"> · </text>
            </text>
          </view>
          <view v-if="nbsYoyTrend.length > 1" class="macro-series" data-nbs-series-detail>
            资金同比
            <text v-for="(p, i) in nbsYoyTrend" :key="'fund-' + p.period">
              {{ p.shortLabel }} {{ formatMacroPct(p.fundsYoyPct) }}<text v-if="i < nbsYoyTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>

      <view
        v-if="gzInventory"
        :id="supplyEntryOwner === 'gz' ? 'entry-supply' : undefined"
        class="card gz-inventory-card"
        data-tab="archived"
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🏗️ 广州新房库存</view>
          <view class="muted" style="font-size: 22rpx">{{ gzInventoryFresh.label }}</view>
        </view>
        <view class="gz-inventory-grid">
          <view class="gz-inventory-kpi">
            <text class="cell-label">可售住宅</text>
            <text class="gz-inventory-value">{{ formatInventoryUnits(gzInventory.availableUnits) }}</text>
            <text v-if="gzInventoryDelta" class="cell-sub" :class="invDeltaClass(gzInventoryDelta.availableDelta)">
              较上日 {{ formatInvDelta(gzInventoryDelta.availableDelta) }}
            </text>
          </view>
          <view class="gz-inventory-kpi">
            <text class="cell-label">未售住宅</text>
            <text class="gz-inventory-value">{{ formatInventoryUnits(gzInventory.unsoldUnits) }}</text>
            <text v-if="gzInventoryDelta" class="cell-sub" :class="invDeltaClass(gzInventoryDelta.unsoldDelta)">
              较上日 {{ formatInvDelta(gzInventoryDelta.unsoldDelta) }}
            </text>
          </view>
          <view class="gz-inventory-kpi">
            <text class="cell-label">当日签约</text>
            <text class="gz-inventory-value gz-inventory-value--signed">{{ gzInventory.signedUnits }} 套</text>
            <text v-if="gzInventoryDelta" class="cell-sub" :class="invDeltaClass(gzInventoryDelta.signedDelta)">
              较上日 {{ formatInvDelta(gzInventoryDelta.signedDelta) }}
            </text>
          </view>
        </view>
        <view v-if="gzInventory.districts[0]" class="overview-card-summary">
          可售量最高：{{ gzInventory.districts[0].district }}
          {{ gzInventory.districts[0].availableUnits.toLocaleString() }} 套
          <template v-if="gzInventoryTopSharePct != null">
            · 占全市 {{ gzInventoryTopSharePct }}%
          </template>
          <text v-if="gzInventoryDelta" class="muted"> · 对比 {{ gzInventoryDelta.prevDate }}</text>
        </view>
        <view
          v-if="gzInventoryTopSharePct != null"
          class="gz-progress-track"
          style="margin-top: 8rpx"
          aria-hidden="true"
        >
          <view class="gz-progress-fill" :style="{ width: Math.min(100, gzInventoryTopSharePct) + '%' }" />
        </view>
        <template v-if="gzInventoryExpanded">
          <view
            v-for="row in gzInventory.districts"
            :key="row.district"
            class="gz-inventory-row"
            data-gz-inventory-detail
          >
            <text class="gz-inventory-district">
              {{ row.district }}
              <text class="muted" v-if="districtAvailableSharePct(row, gzInventory.availableUnits) != null">
                · {{ districtAvailableSharePct(row, gzInventory.availableUnits) }}%
              </text>
            </text>
            <text>可售 {{ row.availableUnits.toLocaleString() }}</text>
            <text class="muted">未售 {{ row.unsoldUnits.toLocaleString() }}</text>
            <text class="muted">签约 {{ row.signedUnits }}</text>
          </view>
        </template>
        <button class="gz-inventory-toggle" size="mini" :aria-expanded="gzInventoryExpanded" @click="gzInventoryExpanded = !gzInventoryExpanded">
          {{ gzInventoryExpanded ? "收起分区" : "查看 11 区" }}
        </button>
        <view class="muted" style="margin-top: 10rpx; font-size: 21rpx">
          数据源：广州市住建局商品房销售统计。可售与未售为不同官方口径，不以单日签约直接推算去化周期。
        </view>
      </view>

      <view
        v-if="szPlannedSupply"
        :id="supplyEntryOwner === 'sz' ? 'entry-supply' : undefined"
        class="card"
        data-tab="archived"
        data-sz-planned-supply
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🏗️ 深圳计划入市</view>
          <view class="muted" style="font-size: 22rpx">{{ formatSzSupplyPeriod(szPlannedSupply) }}</view>
        </view>
        <view class="gz-inventory-grid">
          <view class="gz-inventory-kpi">
            <text class="cell-label">计划供应</text>
            <text class="gz-inventory-value">{{ szPlannedSupply.totalUnits.toLocaleString() }} 套</text>
            <text v-if="szSupplyQoQ" class="cell-sub" :class="invDeltaClass(szSupplyQoQ.unitsDelta)">
              较上季 {{ formatInvDelta(szSupplyQoQ.unitsDelta) }}
            </text>
          </view>
          <view class="gz-inventory-kpi">
            <text class="cell-label">供应面积</text>
            <text class="gz-inventory-value">{{ formatSupplyArea(szPlannedSupply.totalAreaSqm) }}</text>
            <text class="cell-sub muted">项目 {{ szPlannedSupply.projectCount }} 个</text>
          </view>
          <view class="gz-inventory-kpi">
            <text class="cell-label">其中住宅</text>
            <text class="gz-inventory-value">{{ szPlannedSupply.residentialUnits.toLocaleString() }} 套</text>
            <view v-if="szSupplyResidentialPct != null" class="gz-progress-track" aria-hidden="true">
              <view class="gz-progress-fill" :style="{ width: Math.min(100, szSupplyResidentialPct) + '%' }" />
            </view>
            <text class="cell-sub muted">
              {{ formatSupplyArea(szPlannedSupply.residentialAreaSqm) }}
              <template v-if="szSupplyResidentialPct != null"> · 占供应 {{ szSupplyResidentialPct }}%</template>
            </text>
          </view>
        </view>
        <view class="muted" style="margin-top: 10rpx; font-size: 21rpx">
          {{ szPlannedSupply.sourceOrg }} · 截至 {{ szPlannedSupply.asOfDate }} · {{ szPlannedSupply.publishDate }} 公示。
          口径为「计划入市」供应，非成交、非可售库存。
        </view>
      </view>

      <view
        v-if="gzHousingPlan && !isOverviewCompact"
        :id="supplyEntryOwner === 'gz-plan' ? 'entry-supply' : undefined"
        class="card"
        data-tab="archived"
        data-gz-housing-plan
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">📋 广州住房发展计划</view>
          <view class="muted" style="font-size: 22rpx">{{ gzHousingPlan.year }} 年</view>
        </view>
        <view class="gz-inventory-grid">
          <view class="gz-inventory-kpi">
            <text class="cell-label">计划批准预售</text>
            <text class="gz-inventory-value">{{ formatWan(gzHousingPlan.approvedPresaleAreaWanSqm, " 万㎡") }}</text>
            <text v-if="gzHousingPlanYoY" class="cell-sub" :class="invDeltaClass(gzHousingPlanYoY.areaDeltaWan)">
              较上年 {{ gzHousingPlanYoY.areaDeltaWan > 0 ? "+" : "" }}{{ gzHousingPlanYoY.areaDeltaWan.toFixed(1) }} 万㎡
            </text>
          </view>
          <view class="gz-inventory-kpi">
            <text class="cell-label">商品住宅用地</text>
            <text class="gz-inventory-value">{{ formatWan(gzHousingPlan.residentialLandHa, " 公顷") }}</text>
            <text v-if="gzHousingPlanYoY" class="cell-sub" :class="invDeltaClass(gzHousingPlanYoY.landDeltaHa)">
              较上年 {{ gzHousingPlanYoY.landDeltaHa > 0 ? "+" : "" }}{{ gzHousingPlanYoY.landDeltaHa.toFixed(1) }} 公顷
            </text>
          </view>
          <view class="gz-inventory-kpi">
            <text class="cell-label">保障性住房</text>
            <text class="gz-inventory-value">{{ formatWan(gzHousingPlan.affordableUnitsWan, " 万套") }}</text>
            <text class="cell-sub muted">筹建计划</text>
          </view>
        </view>
        <view class="muted" style="margin-top: 10rpx; font-size: 21rpx">
          {{ gzHousingPlan.sourceOrg }} · {{ gzHousingPlan.publishDate || (gzHousingPlan.year + " 年") }} 印发。
          年度计划指标，非成交量、非可售库存、非成交均价。
        </view>
      </view>

      <view v-if="(gzAffordableRaised || gzAffordableCompleted) && !isOverviewCompact" class="card" data-tab="archived" data-gz-affordable-projects>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🏗️ 广州保障房项目清单</view>
          <view class="muted" style="font-size: 22rpx">
            {{ (gzAffordableRaised || gzAffordableCompleted)?.year }} 年
          </view>
        </view>
        <view class="gz-inventory-grid">
          <view v-if="gzAffordableRaised" class="gz-inventory-kpi">
            <text class="cell-label">
              {{ gzAffordableRaised.year }} 已筹建 ·
              {{ gzAffordableRaised.category.replace("保障性住房", "保障房") }}
            </text>
            <text class="gz-inventory-value">{{ gzAffordableRaised.totalUnits.toLocaleString() }} 套</text>
            <text class="cell-sub muted">
              {{ gzAffordableRaised.projectCount }} 个项目 · 截至 {{ gzAffordableRaised.asOfMonth }} 月底
            </text>
          </view>
          <view v-if="gzAffordableCompleted" class="gz-inventory-kpi">
            <text class="cell-label">
              {{ gzAffordableCompleted.year }} 已竣工 ·
              {{ gzAffordableCompleted.category.replace("保障性住房", "保障房") }}
            </text>
            <text class="gz-inventory-value">{{ gzAffordableCompleted.totalUnits.toLocaleString() }} 套</text>
            <text class="cell-sub muted">
              {{ gzAffordableCompleted.projectCount }} 个项目 · 截至 {{ gzAffordableCompleted.asOfMonth }} 月底
            </text>
          </view>
          <view v-if="gzAffordableTargetRaised && gzAffordableTargetRaised.targetUnits > 0" class="gz-inventory-kpi">
            <text class="cell-label">
              {{ gzAffordableTargetRaised.year }} 筹集目标 ·
              {{ gzAffordableTargetRaised.category.replace("保障性住房", "保障房") }}
            </text>
            <text class="gz-inventory-value">{{ gzAffordableTargetPct }}%</text>
            <view class="gz-progress-track" aria-hidden="true">
              <view class="gz-progress-fill" :style="{ width: Math.min(100, gzAffordableTargetPct) + '%' }" />
            </view>
            <text class="cell-sub muted">
              {{ gzAffordableTargetRaised.actualUnits.toLocaleString() }} /
              {{ gzAffordableTargetRaised.targetUnits.toLocaleString() }} 套
              <template v-if="gzAffordableTargetRaised.asOfMonth > 0">
                · 截至 {{ gzAffordableTargetRaised.asOfMonth }} 月底
              </template>
              <template v-else> · 年度计划</template>
            </text>
          </view>
          <view
            v-else-if="gzAffordableTargetCompleted && gzAffordableTargetCompleted.targetUnits > 0"
            class="gz-inventory-kpi"
          >
            <text class="cell-label">
              {{ gzAffordableTargetCompleted.year }} 竣工目标 ·
              {{ gzAffordableTargetCompleted.category.replace("保障性住房", "保障房") }}
            </text>
            <text class="gz-inventory-value">{{ gzAffordableTargetCompletedPct }}%</text>
            <text class="cell-sub muted">
              {{ gzAffordableTargetCompleted.actualUnits.toLocaleString() }} /
              {{ gzAffordableTargetCompleted.targetUnits.toLocaleString() }} 套 · 截至
              {{ gzAffordableTargetCompleted.asOfMonth }} 月底
            </text>
          </view>
          <view v-else-if="!gzAffordableCompleted && gzAffordableRaised" class="gz-inventory-kpi">
            <text class="cell-label">口径</text>
            <text class="gz-inventory-value" style="font-size: 26rpx">清单汇总</text>
            <text class="cell-sub muted">非销售、非网签</text>
          </view>
        </view>
        <view
          v-if="gzAffordableTargetCompleted && gzAffordableTargetCompleted.targetUnits > 0 && gzAffordableTargetRaised && gzAffordableTargetRaised.targetUnits > 0"
          class="muted"
          style="margin-top: 8rpx; font-size: 21rpx"
        >
          {{ gzAffordableTargetCompleted.year }} 竣工目标进度 {{ gzAffordableTargetCompletedPct }}%（{{
            gzAffordableTargetCompleted.actualUnits.toLocaleString()
          }}
          / {{ gzAffordableTargetCompleted.targetUnits.toLocaleString() }} 套，截至
          {{ gzAffordableTargetCompleted.asOfMonth }} 月底任务量完成表）。
        </view>
        <view
          v-if="gzAffordableShantyNote"
          class="muted"
          style="margin-top: 8rpx; font-size: 21rpx"
          data-gz-affordable-shanty-note
        >
          另：同年棚改已竣工 {{ gzAffordableShantyNote.totalUnits.toLocaleString() }} 套（{{
            gzAffordableShantyNote.projectCount
          }}
          个项目，截至 {{ gzAffordableShantyNote.asOfMonth }} 月底）；与上方配售型/保障房清单不同口径，不并排作竣工 KPI。
        </view>
        <view class="muted" style="margin-top: 10rpx; font-size: 21rpx">
          来源：广州市住建局保障性住房项目公开 XLS；已筹建/已竣工为项目清单合计；目标进度优先「任务量完成」，缺省回退「筹集建设计划」合计并对齐同年清单实际。均非商品房成交、非房价均价。
        </view>
      </view>

      <view
        v-if="gzLandSummary && !isOverviewCompact"
        :id="landEntryOwner === 'gz' ? 'entry-land' : undefined"
        class="card"
        data-tab="archived"
        data-gz-land-deals
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🗺️ 广州居住用地成交</view>
          <view class="muted" style="font-size: 22rpx">近 {{ gzLandSummary.count }} 宗 · {{ gzLandSummary.latestDate }}</view>
        </view>
        <view class="gz-inventory-grid">
          <view class="gz-inventory-kpi">
            <text class="cell-label">成交面积</text>
            <text class="gz-inventory-value">{{ formatLandArea(gzLandSummary.totalAreaSqm) }}</text>
          </view>
          <view class="gz-inventory-kpi">
            <text class="cell-label">成交总价</text>
            <text class="gz-inventory-value">{{ formatLandPrice(gzLandSummary.totalPriceWan) }}</text>
          </view>
          <view class="gz-inventory-kpi">
            <text class="cell-label">样本均价</text>
            <text class="gz-inventory-value" style="font-size: 28rpx">
              {{
                gzLandSummary.avgSurfaceUnitPriceYuan != null
                  ? Math.round(gzLandSummary.avgSurfaceUnitPriceYuan).toLocaleString() + " 元/㎡地"
                  : "—"
              }}
            </text>
            <text class="cell-sub muted">最新 {{ gzLandLatest[0]?.district || "—" }} · {{ (gzLandLatest[0]?.dealDate || gzLandLatest[0]?.publishDate || "").slice(0, 10) }}</text>
          </view>
        </view>
        <view v-for="d in gzLandLatest" :key="d.sourceUrl" class="gz-inventory-row" style="margin-top: 8rpx">
          <text class="gz-inventory-district">
            {{ d.district || "广州" }}
            <text class="muted" v-if="d.dealDate || d.publishDate"> · {{ (d.dealDate || d.publishDate).slice(0, 10) }}</text>
          </text>
          <text>{{ formatLandPrice(d.priceWan) }}</text>
          <text class="muted">{{ formatLandArea(d.areaSqm) }}</text>
          <text class="muted">
            {{ landSurfaceUnitPriceYuan(d) != null ? Math.round(landSurfaceUnitPriceYuan(d)!).toLocaleString() + " 元/㎡地" : "" }}
          </text>
        </view>
        <view v-if="gzLandByMonth.length" style="margin-top: 12rpx">
          <view class="muted" style="font-size: 22rpx; margin-bottom: 6rpx">分月汇总（样本加权均价）</view>
          <view v-for="m in gzLandByMonth" :key="m.month" class="gz-inventory-row">
            <text class="gz-inventory-district">{{ m.month }}</text>
            <text>{{ m.count }} 宗 · {{ formatLandPrice(m.totalPriceWan) }}</text>
            <text class="muted">{{ formatLandArea(m.totalAreaSqm) }}</text>
            <text class="muted">
              {{
                m.avgSurfaceUnitPriceYuan != null
                  ? Math.round(m.avgSurfaceUnitPriceYuan).toLocaleString() + " 元/㎡地"
                  : "—"
              }}
            </text>
          </view>
        </view>
        <view class="muted" style="margin-top: 10rpx; font-size: 21rpx">
          来源：广州市规划和自然资源局成交公示；仅统计居住/R2 等住宅用途。成交价为土地出让价款，不是房价均价；地表单价未除容积率。分月为样本库内公示，非全市全量。
        </view>
      </view>

      <view
        v-if="szLandSummary"
        :id="landEntryOwner === 'sz' ? 'entry-land' : undefined"
        class="card"
        data-tab="archived"
        data-sz-land-deals
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🗺️ 深圳居住用地（已成交）</view>
          <view class="muted" style="font-size: 22rpx">近 {{ szLandSummary.count }} 宗 · {{ szLandSummary.latestDate }}</view>
        </view>
        <view class="gz-inventory-grid">
          <view class="gz-inventory-kpi">
            <text class="cell-label">成交面积</text>
            <text class="gz-inventory-value">{{ formatLandArea(szLandSummary.totalAreaSqm) }}</text>
          </view>
          <view class="gz-inventory-kpi">
            <text class="cell-label">起始价合计</text>
            <text class="gz-inventory-value">{{ formatLandPrice(szLandSummary.totalStartPriceWan) }}</text>
          </view>
          <view class="gz-inventory-kpi">
            <text class="cell-label">样本起始均价</text>
            <text class="gz-inventory-value" style="font-size: 28rpx">
              {{
                szLandSummary.avgStartSurfaceUnitPriceYuan != null
                  ? Math.round(szLandSummary.avgStartSurfaceUnitPriceYuan).toLocaleString() + " 元/㎡地"
                  : "—"
              }}
            </text>
            <text class="cell-sub muted">最新 {{ szLandLatest[0]?.district || "—" }} · {{ (szLandLatest[0]?.publishDate || "").slice(0, 10) }}</text>
          </view>
        </view>
        <view v-for="d in szLandLatest" :key="d.landNo || d.sourceUrl" class="gz-inventory-row" style="margin-top: 8rpx">
          <text class="gz-inventory-district">
            {{ d.district || "深圳" }}
            <text class="muted" v-if="d.publishDate"> · {{ d.publishDate.slice(0, 10) }}</text>
          </text>
          <text>{{ formatLandPrice(d.startPriceWan) }}</text>
          <text class="muted">{{ formatLandArea(d.areaSqm) }}</text>
          <text class="muted">
            {{
              landStartSurfaceUnitPriceYuan(d) != null
                ? Math.round(landStartSurfaceUnitPriceYuan(d)!).toLocaleString() + " 元/㎡地"
                : ""
            }}
          </text>
        </view>
        <view v-if="szLandByMonth.length" style="margin-top: 12rpx">
          <view class="muted" style="font-size: 22rpx; margin-bottom: 6rpx">分月汇总（样本起始均价）</view>
          <view v-for="m in szLandByMonth" :key="m.month" class="gz-inventory-row">
            <text class="gz-inventory-district">{{ m.month }}</text>
            <text>{{ m.count }} 宗 · {{ formatLandPrice(m.totalStartPriceWan) }}</text>
            <text class="muted">{{ formatLandArea(m.totalAreaSqm) }}</text>
            <text class="muted">
              {{
                m.avgStartSurfaceUnitPriceYuan != null
                  ? Math.round(m.avgStartSurfaceUnitPriceYuan).toLocaleString() + " 元/㎡地"
                  : "—"
              }}
            </text>
          </view>
        </view>
        <view class="muted" style="margin-top: 10rpx; font-size: 21rpx">
          来源：深圳公共资源交易中心土地矿业主页列表 API；用途含「居住」。金额为公开列表「起始价」（万元），不是成交总价、不是房价均价；地表单价未除容积率。
        </view>
      </view>

      <view v-if="(szAffordableRaised || szAffordableCompleted) && !isOverviewCompact" class="card" data-tab="archived" data-sz-affordable-projects>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🏗️ 深圳保障房项目表</view>
          <view class="muted" style="font-size: 22rpx">
            {{ (szAffordableRaised || szAffordableCompleted)?.year }} 年
          </view>
        </view>
        <view class="gz-inventory-grid">
          <view v-if="szAffordableRaised" class="gz-inventory-kpi">
            <text class="cell-label">建设筹集 · {{ szAffordableRaised.category }}</text>
            <text class="gz-inventory-value">{{ szAffordableRaised.totalUnits.toLocaleString() }} 套</text>
            <text class="cell-sub muted">
              {{ szAffordableRaised.projectCount }} 个项目
              <text v-if="szAffordableRaised.raiseUnits > 0">
                · 建设 {{ szAffordableRaised.buildUnits.toLocaleString() }} / 筹集 {{ szAffordableRaised.raiseUnits.toLocaleString() }}
              </text>
            </text>
          </view>
          <view v-if="szAffordableCompleted" class="gz-inventory-kpi">
            <text class="cell-label">基本建成 · {{ szAffordableCompleted.category }}</text>
            <text class="gz-inventory-value">{{ szAffordableCompleted.totalUnits.toLocaleString() }} 套</text>
            <text class="cell-sub muted">{{ szAffordableCompleted.projectCount }} 个项目</text>
          </view>
        </view>
        <view class="muted" style="margin-top: 10rpx; font-size: 21rpx">
          来源：深圳市住建局项目建设信息 PDF/XLSX；套数为项目表合计，不是商品房成交量、不是房价均价。
        </view>
      </view>

      <view
        v-if="zhAffordable && !isOverviewCompact"
        :id="supplyEntryOwner === 'zh' ? 'entry-supply' : undefined"
        class="card"
        data-tab="archived"
        data-zh-affordable-progress
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🏗️ 珠海安居工程进展</view>
          <view class="muted" style="font-size: 22rpx">
            {{ zhAffordable.year }}-{{ String(zhAffordable.month).padStart(2, "0") }}
          </view>
        </view>
        <view class="gz-inventory-grid">
          <view class="gz-inventory-kpi">
            <text class="cell-label">新开工</text>
            <text class="gz-inventory-value">{{ zhAffordable.startedUnits.toLocaleString() }} 套</text>
            <text
              v-if="zhAffordableMoM"
              class="cell-sub"
              :class="invDeltaClass(zhAffordableMoM.startedDelta)"
            >
              较上月 {{ zhAffordableMoM.startedDelta > 0 ? "+" : "" }}{{ zhAffordableMoM.startedDelta.toLocaleString() }}
            </text>
          </view>
          <view class="gz-inventory-kpi">
            <text class="cell-label">基本建成</text>
            <text class="gz-inventory-value">{{ zhAffordable.basicallyCompletedUnits.toLocaleString() }} 套</text>
          </view>
          <view class="gz-inventory-kpi">
            <text class="cell-label">竣工</text>
            <text class="gz-inventory-value">{{ zhAffordable.completedUnits.toLocaleString() }} 套</text>
            <text
              v-if="zhAffordableMoM"
              class="cell-sub"
              :class="invDeltaClass(zhAffordableMoM.completedDelta)"
            >
              较上月 {{ zhAffordableMoM.completedDelta > 0 ? "+" : "" }}{{ zhAffordableMoM.completedDelta.toLocaleString() }}
            </text>
          </view>
        </view>
        <view class="gz-inventory-row" style="margin-top: 8rpx">
          <text class="muted">年内计划投资</text>
          <text>{{ Math.round(zhAffordable.planInvestWan).toLocaleString() }} 万元</text>
          <text class="muted">租赁补贴</text>
          <text>{{ zhAffordable.rentalSubsidyHouseholds.toLocaleString() }} 户</text>
        </view>
        <view class="gz-inventory-row" style="margin-top: 6rpx">
          <text class="muted">其中保租房</text>
          <text>开 {{ zhAffordable.protectedRentalStartedUnits.toLocaleString() }} / 竣 {{ zhAffordable.protectedRentalCompletedUnits.toLocaleString() }}</text>
          <text class="muted">配售型</text>
          <text>开 {{ zhAffordable.saleTypeStartedUnits.toLocaleString() }} / 竣 {{ zhAffordable.saleTypeCompletedUnits.toLocaleString() }}</text>
        </view>
        <view class="gz-inventory-row" style="margin-top: 4rpx">
          <text class="muted">公租房</text>
          <text>开 {{ zhAffordable.publicRentalStartedUnits.toLocaleString() }} / 竣 {{ zhAffordable.publicRentalCompletedUnits.toLocaleString() }}</text>
          <text class="muted"></text>
          <text class="muted" style="font-size: 20rpx">分业态为报表大类行</text>
        </view>
        <view class="muted" style="margin-top: 10rpx; font-size: 21rpx">
          来源：珠海市住建局「保障性安居工程建设进展情况快报表」XLS；指标为当年 1 月至报告期末累计，非商品房成交量、非房价均价。环比仅同年相邻月展示。合计行可能含租赁补贴户数，分业态以大类行为准。
        </view>
      </view>

      <view v-if="runtime" class="card muted">
        <text>DB: {{ runtime.database_file || runtime.database_url }}</text>
        <text> · 规则: {{ runtime.rule_version_listing }}</text>
        <text> · 数据量: 城市 {{ runtime.data_counts.cities }} / 小区 {{ runtime.data_counts.communities }} / 房源 {{ runtime.data_counts.listings }}</text>
      </view>

      <view v-if="coverage" class="card" data-tab="overview">
        <view class="card-title">数据覆盖</view>
        <view class="muted">
          来源：{{ coverage.source_used || "全部" }} ·
          覆盖率 {{ coverage.covered_districts }} / {{ coverage.total_districts }}
          （{{ (coverage.coverage_ratio * 100).toFixed(1) }}%）
        </view>
        <view v-if="coverage.empty_districts.length" class="muted" style="margin-top: 8rpx">
          空区（{{ coverage.empty_districts.length }}）：{{ coverage.empty_districts.slice(0, 6).join("、") }}{{ coverage.empty_districts.length > 6 ? "..." : "" }}
        </view>
      </view>

      <view v-if="errorMsg" class="error">{{ errorMsg }}</view>

      <!-- v0.49.0 topnav-1: 周期切换 sticky 顶栏 -->
      <view v-if="app.weekEnd && periods.length > 1" class="topnav-period">
        <view class="topnav-p-week">
          📅 第 <text class="topnav-p-num">{{ currentPeriodIdx + 1 }}</text>
          / {{ periods.length }} 周 · {{ app.weekEnd }}
        </view>
        <view class="topnav-p-btns">
          <button
            class="topnav-p-btn tap-row"
            :class="{ 'topnav-p-btn--disabled': currentPeriodIdx <= 0 }"
            hover-class="tap-row--active"
            :disabled="currentPeriodIdx <= 0"
            @click="stepPeriod(-1)"
          >‹ 上一周</button>
          <button
            class="topnav-p-btn tap-row"
            :class="{ 'topnav-p-btn--disabled': currentPeriodIdx >= periods.length - 1 }"
            hover-class="tap-row--active"
            :disabled="currentPeriodIdx >= periods.length - 1"
            @click="stepPeriod(1)"
          >下一周 ›</button>
        </view>
      </view>

      <!-- 本周速览：切换周时这里数字必须变，避免用户以为控件坏了 -->
      <view
        v-if="app.weekEnd"
        id="week-bound-strip"
        class="card week-bound-strip"
        data-tab="all,overview,price"
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">本周速览 · {{ currentCityLabel }}</view>
          <view class="muted" style="font-size: 22rpx">{{ app.weekEnd }}</view>
        </view>
        <view class="week-bound-grid">
          <view class="week-bound-kpi">
            <text class="cell-label">上榜小区</text>
            <text class="week-bound-value">{{ rankingTotal }}</text>
          </view>
          <view class="week-bound-kpi">
            <text class="cell-label">有数据的区</text>
            <text class="week-bound-value">{{ districtItems.length }}</text>
          </view>
          <view class="week-bound-kpi">
            <text class="cell-label">周榜 Top1</text>
            <text class="week-bound-value week-bound-value--sm">
              {{ ranking[0]?.community_name || "—" }}
            </text>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 20rpx">
          按 crawl_date 落在本周窗口的挂牌聚合；宏观 / 网签日更 / 地铁规划等快照不随周切换。
        </view>
      </view>

      <!-- v0.55.0 hero-1: 顶部大盘轮播 + 快捷入口图标网格 -->
      <view class="hero-section" v-if="heroSlides.length > 0">
        <view class="hero-carousel">
          <swiper
            class="hero-scroll"
            :current="heroIdx"
            circular
            autoplay
            :interval="5000"
            :duration="350"
            @change="onHeroChange"
          >
            <swiper-item
              v-for="(s, i) in heroSlides"
              :key="'hero_' + i"
            >
              <view :class="['hero-slide', 'hero-slide--' + s.tone]" @click="heroClick(i)">
                <view class="hero-slide-row">
                  <view class="hero-slide-icon">{{ s.icon }}</view>
                  <view class="hero-slide-mid">
                    <view class="hero-slide-label">{{ s.label }}</view>
                    <view class="hero-slide-val">{{ s.value }}<text v-if="s.unit" class="hero-slide-unit">{{ s.unit }}</text></view>
                    <view class="hero-slide-sub muted">{{ s.sub }}</view>
                  </view>
                </view>
              </view>
            </swiper-item>
          </swiper>
          <view class="hero-dots">
            <view
              v-for="(_, i) in heroSlides"
              :key="'dot_' + i"
              :class="['hero-dot', { 'hero-dot--active': heroIdx === i }]"
              @click="heroIdx = i"
            ></view>
          </view>
        </view>
        <!-- 金刚区已上移至首页入口，此处仅保留大盘轮播 -->
      </view>

      <!-- 概览工具条：只保留精简/完整模式；禁止「快捷跳转滚锚点 + 全部展开收起」折叠套路 -->
      <view v-if="activeTab === 'overview'" class="overview-toolbar" data-overview-toolbar>
        <button
          class="overview-mode-toggle"
          size="mini"
          hover-class="tap-row--active"
          data-dash-mode-toggle
          @click.stop="toggleFeaturedMode"
        >{{ featuredMode ? "📊 完整模式" : "🏠 精简模式" }}</button>
      </view>

      <!-- v1.121.138：原中间段折叠块内的 7 张派生卡已真删；区/板块对比核心卡移出折叠块、直接渲染 -->
      <!-- 区/板块对比 -->
      <view
        v-if="!isCardHidden('region-compare')"
        id="overview-region"
        class="card overview-card"
        :class="{ 'overview-card--collapsed': isOverviewGroupCollapsed('region') }"
        data-tab="overview,price"
        data-card-key="region-compare"
        @click="onOverviewCardClick('region')"
      >
        <view class="row-between">
          <view class="card-title">区/板块对比</view>
          <view class="row">
            <view class="muted">{{ app.metric === "listing_count" ? "挂牌数" : "均价(元/㎡)" }}</view>
            <button
              class="card-hide-btn"
              hover-class="tap-row--active"
              data-dash-card-hide="region-compare"
              @click.stop="toggleCardHidden('region-compare')"
            >✕</button>
          </view>
        </view>
        <view v-if="isOverviewGroupCollapsed('region')" data-overview-summary class="overview-card-summary muted">
          {{ overviewRegionSummary }}
        </view>
        <template v-else>
        <view v-if="districtItems.length === 0" class="empty">暂无数据</view>
        <view v-else>
          <view
            v-for="(it, idx) in districtItems"
            :key="idx"
            class="bar-row"
            @click="onPickDistrict(it.district_name)"
          >
            <view class="bar-name">{{ it.district_name }}</view>
            <view class="bar-track">
              <view
                class="bar-fill"
                :style="{ width: districtPct(it) + '%' }"
              ></view>
            </view>
            <view class="bar-value">{{ formatBarValue(it) }}</view>
          </view>
        </view>
        <view
          v-if="coverage && coverage.total_districts > districtItems.length"
          class="muted district-note"
          @click="goWangqian"
        >
          仅显示有挂牌房源的区（{{ districtItems.length }} / 全市 {{ coverage.total_districts }} 区）。
          挂牌来自安居客周度抓取，覆盖有限；全市各区成交见「政府每日网签」›
        </view>
        </template>
      </view>

      <!-- v0.8.0 区级近 8 周价格趋势 -->
      <view v-if="!isCardHidden('district-8w-trend') && (trendItems.length > 0)" class="card" data-card-key="district-8w-trend" data-tab="price">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">区级近 8 周房价趋势</view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="district-8w-trend"
            @click.stop="toggleCardHidden('district-8w-trend')"
          >✕</button>
          <view class="muted" style="font-size: 22rpx">按近 4 周均价 vs 前 4 周均价</view>
        </view>
        <view v-for="it in trendItems" :key="it.district_name" class="trend-row">
          <view class="trend-row-head">
            <text class="trend-name">{{ it.district_name }}</text>
            <view class="trend-meta">
              <text class="muted" style="font-size: 22rpx">
                最近 4 周 {{ it.recent_4w_listing_count }} 套 · 均价 {{ formatTrendPrice(it.latest_avg_unit_price) }}
              </text>
            </view>
            <text class="trend-change" :class="trendDeltaClass(it.recent_change_ratio)">
              {{ trendArrow(it.recent_change_ratio) }} {{ trendPct(it.recent_change_ratio) }}
            </text>
          </view>
          <view class="trend-bars">
            <view
              v-for="p in it.points"
              :key="p.week_end"
              class="trend-bar-col"
              :title="`${p.week_end} 均价 ${Math.round(p.avg_unit_price).toLocaleString()} 元/㎡ (${p.listing_count} 套)`"
            >
              <view
                class="trend-bar-fill"
                :style="{ height: trendBarPct(it, p) + '%' }"
              ></view>
            </view>
          </view>
          <view class="trend-axis">
            <text class="muted" style="font-size: 20rpx">
              {{ it.points[0]?.week_end }} → {{ it.points[it.points.length - 1]?.week_end }}
            </text>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：本地 listings.csv 按 (城市/区/周) 聚合均价（中位数 = 排除极端值后更稳健）。
          样本量较小的区波动较大，仅供参考。
        </view>
      </view>

      <!-- v0.10.0 近 4 周网签热度榜 -->
      <view v-if="!isCardHidden('wangqian-rank-4w') && (wangqianOverview && wangqianOverview.items.length > 0)" class="card" data-card-key="wangqian-rank-4w" data-tab="price">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">
            近 4 周二手网签热度榜 · {{ wangqianOverview.cityName }}
          </view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="wangqian-rank-4w"
            @click.stop="toggleCardHidden('wangqian-rank-4w')"
          >✕</button>
          <view class="muted" style="font-size: 22rpx">
            累计 {{ wangqianOverview.totalUnits }} 套
          </view>
        </view>
        <view v-for="it in wangqianOverview.items" :key="it.district" class="wq-row">
          <text class="wq-rank" :class="rankClass(it.rank)">{{ it.rank }}</text>
          <text class="wq-name">{{ it.district }}</text>
          <view class="wq-track">
            <view
              class="wq-fill"
              :style="{ width: wangqianPct(it) + '%' }"
            ></view>
          </view>
          <text class="wq-units">
            {{ it.totalUnits }} 套
            <text class="muted" style="font-size: 20rpx">({{ formatWqArea(it.totalAreaSqm) }})</text>
          </text>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：深圳市/广州市住建局公示的每日网签，按周聚合；只看二手住宅。
          网签活跃度反映板块热度，与挂牌价互补（挂牌 = 卖家意愿，网签 = 真实成交）。
        </view>
        <view v-if="wangqianWeeklyDistrictTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          派生区周累计 Top（二手）
        </view>
        <view
          v-for="(it, idx) in wangqianWeeklyDistrictTop"
          :key="'wqd-' + it.district + it.category"
          class="wq-row"
        >
          <text class="wq-rank" :class="rankClass(idx + 1)">{{ idx + 1 }}</text>
          <text class="wq-name">{{ it.district }}</text>
          <text class="wq-units">
            累计 {{ it.totalUnits }} 套
            <text class="muted" style="font-size: 20rpx">
              · 日均 {{ it.avgDailyUnits.toFixed(1) }}
              <text v-if="it.latestUnits != null"> · 近周 {{ it.latestUnits }}</text>
            </text>
          </text>
        </view>
      </view>

      <!-- v0.23.0 trend-9: 全品类区级网签热度榜 (新房/二手/全部 tab 切换) -->
      <view
        v-if="!isCardHidden('district-wangqian-3cat') && (districtWangqianRank && districtWangqianRank.items.length > 0)" data-card-key="district-wangqian-3cat"
        id="overview-wangqian"
        class="card overview-card"
        :class="{ 'overview-card--collapsed': isOverviewGroupCollapsed('wangqian') }"
        data-tab="price"
        @click="onOverviewCardClick('wangqian')"
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">
            🔥 全品类区级网签热度榜 · {{ districtWangqianRank.cityName }}
          </view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="district-wangqian-3cat"
            @click.stop="toggleCardHidden('district-wangqian-3cat')"
          >✕</button>
          <view class="muted" style="font-size: 22rpx">
            累计 {{ districtWangqianRank.totalUnits }} 套 · {{ districtWangqianRank.totalDistricts }} 区
          </view>
        </view>
        <view v-if="isOverviewGroupCollapsed('wangqian')" data-overview-summary class="overview-card-summary muted">
          {{ overviewWangqianSummary }}
        </view>
        <template v-else>
        <!-- tab 切换: 新房 / 二手 / 全部 -->
        <view class="wq-cat-tabs">
          <view
            v-for="cat in (['新房', '二手', '全部'] as const)"
            :key="cat"
            :class="['wq-cat-tab', wqRankCat === cat ? 'wq-cat-tab-on' : 'wq-cat-tab-off']"
            @click="setWqRankCat(cat)"
          >
            {{ cat }}
          </view>
        </view>
        <view
          v-for="it in districtWangqianRank.items.slice(0, 10)"
          :key="it.district"
          class="wq-row"
        >
          <text class="wq-rank" :class="rankClass(it.rank)">{{ it.rank }}</text>
          <text class="wq-name">{{ it.district }}</text>
          <view class="wq-track">
            <view
              class="wq-fill"
              :style="{ width: wqRankPct(it) + '%' }"
            ></view>
          </view>
          <text class="wq-units">
            {{ it.totalUnits }} 套
            <text class="muted" style="font-size: 20rpx">
              ({{ formatWqArea(it.totalAreaSqm) }} · {{ Math.round(it.avgDailyUnits * 10) / 10 }}套/天)
            </text>
          </text>
        </view>
        <view v-if="districtWangqianRank.items.length > 10" class="muted" style="margin-top: 4rpx; font-size: 22rpx">
          共 {{ districtWangqianRank.totalDistricts }} 个区有网签数据，显示 Top 10
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：{{ districtWangqianRank.weeksBack }} 周内 {{ districtWangqianRank.cityName }} 住建局网签，按区聚合。
          「全部」= 新房+二手合并；切 tab 实时刷新。
        </view>
        </template>
      </view>

      <!-- 网签周环比 + 异常突增（wangqianTrendRanking 派生，随 cityId） -->
      <view v-if="wangqianTrendWeeklyReady" class="card" data-tab="price">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">
            📈 网签周环比 · {{ wangqianTrendCityName }}
          </view>
        </view>
        <view v-if="!wangqianTrendHasCityData" class="empty" style="padding: 24rpx 0">
          <text class="muted">当前城市暂无区级周网签数据（深圳、广州有住建局周度口径）</text>
        </view>
        <template v-else>
          <view class="wq-trend-section-title muted">周环比涨跌 Top</view>
          <view v-if="wangqianTrendWowUp.length" class="wq-trend-block">
            <view class="wq-trend-sub muted">涨幅 Top 3</view>
            <view
              v-for="(it, idx) in wangqianTrendWowUp"
              :key="'wow-up-' + it.district + it.category"
              class="wq-trend-row"
            >
              <text class="wq-trend-idx">{{ idx + 1 }}</text>
              <text class="wq-trend-name">{{ it.district }}</text>
              <text class="wq-trend-cat">{{ it.category }}</text>
              <text class="wq-trend-pct wq-trend-up">{{ formatWowPct(it.changePct) }}</text>
              <text class="wq-trend-units muted">{{ it.prevUnits }}→{{ it.latestUnits }} 套</text>
            </view>
          </view>
          <view v-if="wangqianTrendWowDown.length" class="wq-trend-block">
            <view class="wq-trend-sub muted">跌幅 Top 3</view>
            <view
              v-for="(it, idx) in wangqianTrendWowDown"
              :key="'wow-down-' + it.district + it.category"
              class="wq-trend-row"
            >
              <text class="wq-trend-idx">{{ idx + 1 }}</text>
              <text class="wq-trend-name">{{ it.district }}</text>
              <text class="wq-trend-cat">{{ it.category }}</text>
              <text class="wq-trend-pct wq-trend-down">{{ formatWowPct(it.changePct) }}</text>
              <text class="wq-trend-units muted">{{ it.prevUnits }}→{{ it.latestUnits }} 套</text>
            </view>
          </view>
          <view v-if="wangqianTrendSpikes.length" class="wq-trend-block">
            <view class="wq-trend-sub muted">异常突增（较近 4 周均 ≥1.5 倍）</view>
            <view
              v-for="it in wangqianTrendSpikes"
              :key="'spike-' + it.district + it.category"
              class="wq-trend-row wq-trend-row--spike"
            >
              <text class="wq-trend-name">{{ it.district }}</text>
              <text class="wq-trend-cat">{{ it.category }}</text>
              <text class="wq-trend-mult">{{ formatWqSpikeMultiplier(it.multiplier) }}</text>
              <text class="wq-trend-units muted">{{ Math.round(it.recentAvg) }}→{{ it.latestUnits }} 套</text>
            </view>
          </view>
          <view v-if="wangqianTrendVolatility.length" class="wq-trend-block">
            <view class="wq-trend-sub muted">波动 Top（变异系数 CV）</view>
            <view
              v-for="(it, idx) in wangqianTrendVolatility"
              :key="'vol-' + it.district + it.category"
              class="wq-trend-row"
            >
              <text class="wq-trend-idx">{{ idx + 1 }}</text>
              <text class="wq-trend-name">{{ it.district }}</text>
              <text class="wq-trend-cat">{{ it.category }}</text>
              <text class="wq-trend-pct">CV {{ it.cv.toFixed(2) }}</text>
              <text class="wq-trend-units muted">均 {{ Math.round(it.mean) }} · σ {{ Math.round(it.stdDev) }}</text>
            </view>
          </view>
          <view v-if="wangqianCategoryTrend.length" class="wq-trend-block">
            <view class="wq-trend-sub muted">全市品类近 4 周变化</view>
            <view
              v-for="it in wangqianCategoryTrend"
              :key="'wct-' + it.category"
              class="wq-trend-row"
            >
              <text class="wq-trend-name">{{ it.category }}</text>
              <text
                class="wq-trend-pct"
                :class="it.changePct >= 0 ? 'wq-trend-up' : 'wq-trend-down'"
              >
                {{ formatWowPct(it.changePct) }}
              </text>
              <text class="wq-trend-units muted">
                {{ Math.round(it.recentAvg) }}→{{ it.latestUnits }} 套
              </text>
            </view>
          </view>
          <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
            周环比 = 最近完整周 vs 上一周网签套数；突增 = 最新周较前 4 周均值倍数；CV = 标准差÷均值。数据源：wangqian_district_weekly.csv。
          </view>
        </template>
      </view>

      <!-- v0.24.0 new-5: 通勤时长榜 (community → 城市 CBD 公交通勤) -->
      <view
        v-if="!isCardHidden('commute-rank') && (commuteRanking && commuteRanking.fastest.length > 0)" data-card-key="commute-rank"
        id="overview-transit"
        class="card overview-card"
        :class="{ 'overview-card--collapsed': isOverviewGroupCollapsed('transit') }"
        data-tab="overview,transit"
        @click="onOverviewCardClick('transit')"
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">
            🚇 通勤时长榜 · {{ commuteRanking.cityName }} → {{ commuteRanking.cbdName }}
          </view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="commute-rank"
            @click.stop="toggleCardHidden('commute-rank')"
          >✕</button>
          <view class="muted" style="font-size: 22rpx">
            城市均 {{ commuteRanking.cityAvgMinutes ?? "—" }} 分钟
            · {{ commuteRanking.totalCommunities }} 小区
          </view>
        </view>
        <view v-if="isOverviewGroupCollapsed('transit')" data-overview-summary class="overview-card-summary muted">
          {{ overviewTransitSummary }}
        </view>
        <template v-else>
        <view
          v-for="(it, idx) in commuteRanking.fastest"
          :key="it.communityId"
          class="wq-row tap-target"
          role="button"
          tabindex="0"
          hover-class="row-active"
          @click="goCommunity(it.communityId)"
        >
          <text class="wq-rank" :class="rankClass(idx + 1)">{{ idx + 1 }}</text>
          <text class="wq-name">{{ it.communityName }}</text>
          <text class="wq-area">
            <text class="muted" style="font-size: 20rpx">{{ it.districtName }}</text>
          </text>
          <text class="wq-units">
            <text :class="['commute-badge', commuteMinutesClass(it.transitMinutes, commuteRanking.cityAvgMinutes)]">
              {{ Math.round(it.transitMinutes) }} 分钟
            </text>
            <text class="muted" style="font-size: 20rpx; margin-left: 4rpx">
              ({{ (it.transitDistanceM / 1000).toFixed(1) }}km)
            </text>
          </text>
        </view>
        <view v-if="commuteSplit" class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          市内快慢分裂：最快 {{ Math.round(commuteSplit.fastestMinutes) }} 分 · 最慢
          {{ Math.round(commuteSplit.slowestMinutes) }} 分 · 约 {{ commuteSplit.ratio.toFixed(1) }}×
        </view>
        <view v-if="commuteSpeedTop.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          等效通勤速度 Top（距离 ÷ 时长）
        </view>
        <view
          v-for="(it, idx) in commuteSpeedTop"
          :key="'csp-' + it.communityId"
          class="wq-row tap-target"
          role="button"
          tabindex="0"
          hover-class="row-active"
          @click="goCommunity(it.communityId)"
        >
          <text class="wq-rank" :class="rankClass(idx + 1)">{{ idx + 1 }}</text>
          <text class="wq-name">{{ it.communityName }}</text>
          <text class="wq-units">
            {{ it.speedKmh.toFixed(1) }} km/h
            <text class="muted" style="font-size: 20rpx; margin-left: 4rpx">
              · {{ Math.round(it.transitMinutes) }} 分
            </text>
          </text>
        </view>
        <view v-if="commuteFastestTop.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          通勤时长最短 Top（派生）
        </view>
        <view
          v-for="(it, idx) in commuteFastestTop"
          :key="'cft-' + it.communityId"
          class="wq-row tap-target"
          role="button"
          tabindex="0"
          hover-class="row-active"
          @click="goCommunity(it.communityId)"
        >
          <text class="wq-rank" :class="rankClass(idx + 1)">{{ idx + 1 }}</text>
          <text class="wq-name">{{ communityDisplayName(it.communityId) }}</text>
          <text class="wq-units">
            {{ it.transitMinutes != null ? Math.round(it.transitMinutes) + " 分" : "—" }}
            <text v-if="it.transitDistanceM != null" class="muted" style="font-size: 20rpx; margin-left: 4rpx">
              · {{ (it.transitDistanceM / 1000).toFixed(1) }}km
            </text>
          </text>
        </view>
        <view data-cross-city v-if="commuteCitySummaries.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          跨城通勤均分对照
        </view>
        <view
          v-for="c in commuteCitySummaries"
          :key="'ccs-' + c.cityId"
          class="wq-row"
        >
          <text class="wq-name">{{ c.cityName }}</text>
          <text class="wq-units">
            均 {{ c.avgMinutes != null ? Math.round(c.avgMinutes) + " 分" : "—" }}
            <text v-if="c.avgSpeedKmh != null" class="muted" style="font-size: 20rpx; margin-left: 4rpx">
              · {{ c.avgSpeedKmh.toFixed(1) }} km/h · {{ c.communityCount }} 小区
            </text>
          </text>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：高德 /v3/direction/transit/integrated (公交通勤方案 1, 早 08:30)。
          深圳 → 福田CBD (30 小区, 38 次 API)；广州 → 珠江新城 (8 小区, 10 次 API)。
          行可点 → 小区详情。
        </view>
        </template>
      </view>

      <!-- v0.25.0 户型/面积/朝向/装修分布 -->
      <view v-if="layoutDistribution && layoutDistribution.totalListings > 0" class="card" data-tab="price">
        <view class="row-between">
          <view class="card-title">🏠 户型分布 · {{ layoutDistribution.cityName }}</view>
          <view class="muted">共 {{ layoutDistribution.totalListings }} 套</view>
        </view>

        <view v-for="dim in layoutDims" :key="dim.key" style="margin-top: 12rpx">
          <view class="ld-dim-title">{{ dim.label }}</view>
          <view v-if="layoutDistribution.dimensions[dim.key].length === 0" class="muted" style="font-size: 22rpx; padding: 6rpx 0">
            无数据
          </view>
          <view
            v-for="b in layoutDistribution.dimensions[dim.key]"
            :key="dim.key + '-' + b.bucket"
            class="ld-row"
          >
            <text class="ld-bucket">{{ b.bucket }}</text>
            <view class="ld-bar-wrap">
              <view class="ld-bar" :style="{ width: Math.round(b.share * 100) + '%' }"></view>
            </view>
            <text class="ld-count">{{ b.count }} 套</text>
            <text class="ld-pct">{{ formatShare(b.share) }}</text>
          </view>
        </view>

        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：listings.csv 按 (city, dimension, bucket) 聚合。
          户型 / 面积 / 朝向 / 装修 各维度占比，条形比例代表 share。
        </view>
        <view data-cross-city v-if="distributionCitySummaries.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          跨城分布源聚合（加权中位价）
        </view>
        <view
          v-for="(d, idx) in distributionCitySummaries"
          :key="'dcs-' + d.cityId"
          class="ld-row"
        >
          <text class="ld-bucket">{{ idx + 1 }}. {{ d.cityName }}</text>
          <text class="ld-count">{{ d.totalListings }} 套</text>
          <text class="ld-pct">
            {{
              d.weightedMedianPrice != null
                ? Math.round(d.weightedMedianPrice / 1000) + "k"
                : "—"
            }}
          </text>
        </view>
      </view>

      <!-- v0.28.0 new-6 房源 tags 标签云 -->
      <view v-if="!isCardHidden('listing-tag-cloud') && (tagCloud && tagCloud.tags.length > 0)" class="card" data-card-key="listing-tag-cloud" data-tab="school">
        <view class="row-between">
          <view class="card-title">🏷️ 房源标签云 · {{ tagCloud.cityName }}</view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="listing-tag-cloud"
            @click.stop="toggleCardHidden('listing-tag-cloud')"
          >✕</button>
          <view class="muted">{{ tagCloud.tags.length }} 个标签 / {{ tagCloud.totalTags }} 次命中</view>
        </view>
        <view class="tag-cloud">
          <text
            v-for="t in tagCloud.tags"
            :key="t.tag"
            :class="['tag-chip', 'tag-size-' + tagSizeClass(t.count, tagCloudMaxCount)]"
            @click="onPickTag(t.tag)"
          >
            {{ t.tag }} · {{ t.count }}
          </text>
        </view>
        <view v-if="tagCloudFilteredHint" class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          {{ tagCloudFilteredHint }}
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：listings.csv 派生 tags (scripts/compute_listing_tags.py)。
          字号 = 命中数映射 (大=热门)；点击 tag 高亮 (此版本仅显示提示)。
        </view>
      </view>

      <!-- v0.29.0 trend-13 区房价指数 -->
      <view v-if="!isCardHidden('district-index') && (districtIndex && districtIndex.items.length > 0)" class="card" data-card-key="district-index" data-tab="price">
        <view class="row-between">
          <view class="card-title">📈 区房价指数 · {{ districtIndex.cityName }}</view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="district-index"
            @click.stop="toggleCardHidden('district-index')"
          >✕</button>
          <view class="muted">基准 100 = 各区最早周中位价</view>
        </view>
        <view
          v-for="it in districtIndex.items.slice(0, 6)"
          :key="it.districtName"
          class="di-row"
          @click="toggleDistrictIndexExpand(it.districtName)"
        >
          <view class="di-mid">
            <view class="di-name">{{ it.districtName }}</view>
            <view class="muted">
              {{ it.latestListingCount }} 套 · ¥{{ formatNum(it.latestMedianPrice) }}/㎡ · {{ it.totalWeeks }} 周
            </view>
          </view>
          <view class="di-right">
            <text :class="['di-index', diIndexClass(it.indexValue)]">{{ it.indexValue.toFixed(1) }}</text>
            <view class="muted" style="font-size: 20rpx">
              <text v-if="it.momChange != null" :class="diChangeClass(it.momChange)">
                {{ it.momChange > 0 ? "+" : "" }}{{ it.momChange.toFixed(1) }}% WoW
              </text>
              <text v-else class="muted">— WoW</text>
              <text v-if="it.yoyChange != null" :class="diChangeClass(it.yoyChange)" style="margin-left: 8rpx">
                {{ it.yoyChange > 0 ? "+" : "" }}{{ it.yoyChange.toFixed(1) }}% YoY
              </text>
            </view>
          </view>
          <view class="di-spark-wrap">
            <view
              v-for="(pt, i) in sparkPoints(it.weeklySeries)"
              :key="i"
              class="di-spark-bar"
              :style="{ height: pt + '%' }"
            ></view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：district_trend.csv (scripts/compute_district_trend.py) → 归一化为 index (scripts/compute_district_index.py)。
          指数 = 各区 baseline 中位价 × 100；WoW / YoY = 周 / 同比变化。
        </view>
      </view>

      <!-- v0.30.0 trend-14 区涨幅榜 (4 周累计) -->
      <view v-if="!isCardHidden('district-4w-change') && (districtChange && districtChange.items.length > 0)" class="card" data-card-key="district-4w-change" data-tab="price">
        <view class="row-between">
          <view class="card-title">🚀 区涨幅榜 (近 4 周) · {{ districtChange.cityName }}</view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="district-4w-change"
            @click.stop="toggleCardHidden('district-4w-change')"
          >✕</button>
          <view class="muted">Top {{ districtChange.items.length }}</view>
        </view>
        <view v-if="districtChange.items.length === 0" class="empty">暂无数据</view>
        <view
          v-for="it in districtChange.items"
          :key="it.districtName"
          class="dc-row"
        >
          <view class="dc-rank">
            <text :class="['sp-medal-mini', spMedalClass(it.rank)]">{{ it.rank }}</text>
          </view>
          <view class="dc-mid">
            <view class="dc-name">{{ it.districtName }}</view>
            <view class="muted">最新 WoW
              <text v-if="it.latestMom != null" :class="diChangeClass(it.latestMom)">
                {{ it.latestMom > 0 ? "+" : "" }}{{ it.latestMom.toFixed(1) }}%
              </text>
              <text v-else class="muted">—</text>
            </view>
          </view>
          <view class="dc-right">
            <text v-if="it.recentChange4w != null" :class="['dc-4w', diChangeClass(it.recentChange4w)]">
              {{ it.recentChange4w > 0 ? "+" : "" }}{{ it.recentChange4w.toFixed(1) }}%
            </text>
            <text v-else class="muted">—</text>
            <view class="muted" style="font-size: 20rpx">4 周累计</view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：district_index.csv (compute_district_index.py) → 4 周累计变化 (last / 4w_ago - 1)。
          按涨幅降序；金色前 3 名；区可点击 (此版本仅展示)。
        </view>
      </view>

      <!-- v0.33.0 trend-15 小区综合评分榜 (生活+学区+通勤 加权) -->
      <view
        v-if="!isCardHidden('community-score-rank') && (communityScore && communityScore.items.length > 0)" data-card-key="community-score-rank"
        id="overview-community"
        class="card overview-card"
        :class="{ 'overview-card--collapsed': isOverviewGroupCollapsed('community') }"
        data-tab="overview,price"
        @click="onOverviewCardClick('community')"
      >
        <view class="row-between">
          <view class="card-title">🏅 小区综合评分 Top 小区 · {{ communityScore.cityName }}</view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="community-score-rank"
            @click.stop="toggleCardHidden('community-score-rank')"
          >✕</button>
          <view class="muted">Top {{ communityScore.items.length }}</view>
        </view>
        <view v-if="isOverviewGroupCollapsed('community')" data-overview-summary class="overview-card-summary muted">
          {{ overviewCommunitySummary }}
        </view>
        <template v-else>
        <view v-if="communityScore.items.length === 0" class="empty">暂无数据</view>
        <view class="cs-summary muted">
          城市均分 {{ communityScore.avgScore }} · 最高 {{ communityScore.maxScore }}
        </view>
        <!-- v0.34.0 trend-16 权重自定义 -->
        <view class="cs-weights">
          <view class="cs-presets">
            <text
              v-for="p in csPresets"
              :key="p.key"
              :class="['cs-preset-chip', csPresetActive(p) ? 'cs-preset-on' : '']"
              @click="applyCsPreset(p)"
            >{{ p.label }}</text>
          </view>
          <view class="cs-sliders">
            <view class="cs-slider-row">
              <text class="cs-slider-label">生活</text>
              <slider
                :value="csWeights.life"
                min="0"
                max="100"
                step="5"
                activeColor="#38bdf8"
                backgroundColor="#334155"
                block-size="20"
                @change="onCsWeightChange('life', $event)"
                class="cs-slider"
              />
              <text class="cs-slider-val">{{ csWeights.life }}%</text>
            </view>
            <view class="cs-slider-row">
              <text class="cs-slider-label">学区</text>
              <slider
                :value="csWeights.school"
                min="0"
                max="100"
                step="5"
                activeColor="#22c55e"
                backgroundColor="#334155"
                block-size="20"
                @change="onCsWeightChange('school', $event)"
                class="cs-slider"
              />
              <text class="cs-slider-val">{{ csWeights.school }}%</text>
            </view>
            <view class="cs-slider-row">
              <text class="cs-slider-label">通勤</text>
              <slider
                :value="csWeights.commute"
                min="0"
                max="100"
                step="5"
                activeColor="#fbbf24"
                backgroundColor="#334155"
                block-size="20"
                @change="onCsWeightChange('commute', $event)"
                class="cs-slider"
              />
              <text class="cs-slider-val">{{ csWeights.commute }}%</text>
            </view>
            <view class="muted" style="font-size: 20rpx; margin-top: 4rpx">
              当前权重：生活 {{ csWeights.life }}% · 学区 {{ csWeights.school }}% · 通勤 {{ csWeights.commute }}%
              <text v-if="csWeightSum !== 100" style="color: #fbbf24">
                (自动归一化，原值总和 {{ csWeightSum }})
              </text>
            </view>
          </view>
        </view>
        <view
          v-for="it in communityScore.items"
          :key="it.communityId"
          class="cs-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="cs-rank">
            <text :class="['cs-medal', csMedalClass(it.rankCity)]">{{ csMedalText(it.rankCity) }}</text>
          </view>
          <view class="cs-mid">
            <view class="cs-name">{{ it.communityName }}</view>
            <view class="cs-dist muted">{{ it.districtName }}</view>
          </view>
          <view class="cs-scores">
            <view class="cs-dim">
              <text class="cs-dim-label">生活</text>
              <text class="cs-dim-val">{{ it.lifeScore.toFixed(0) }}</text>
            </view>
            <view class="cs-dim">
              <text class="cs-dim-label">学区</text>
              <text class="cs-dim-val">{{ it.schoolScore.toFixed(0) }}</text>
            </view>
            <view class="cs-dim">
              <text class="cs-dim-label">通勤</text>
              <text class="cs-dim-val">
                <text v-if="it.commuteMinutes != null">{{ it.commuteScore.toFixed(0) }}</text>
                <text v-else>—</text>
              </text>
            </view>
          </view>
          <view class="cs-right">
            <text :class="['cs-total', csTotalClass(it.totalScore)]">{{ it.totalScore.toFixed(0) }}</text>
            <view class="muted" style="font-size: 20rpx">/ 100</view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：life_convenience.csv (50%) + school_premium_community.csv (30%) + commute.csv (20%) → community_score.csv。
          综合分 0-100，按总分降序；金色前 3 名。
        </view>
        <view v-if="communityScorePareto.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          高分 + 通勤快（总分≥80）
        </view>
        <view
          v-for="(it, idx) in communityScorePareto"
          :key="'csp-' + it.communityId"
          class="cs-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="cs-rank">
            <text class="cs-medal">{{ idx + 1 }}</text>
          </view>
          <view class="cs-mid">
            <view class="cs-name">{{ it.communityName }}</view>
            <view class="cs-dist muted">{{ it.districtName }} · 总分 {{ it.totalScore.toFixed(0) }}</view>
          </view>
          <view class="cs-right">
            <text class="cs-total">
              {{ it.commuteMinutes != null ? Math.round(it.commuteMinutes) + " 分" : "—" }}
            </text>
          </view>
        </view>
        <view v-if="communityScoreCommuteFast.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          综合分库 · 通勤最短（不限总分）
        </view>
        <view
          v-for="(it, idx) in communityScoreCommuteFast"
          :key="'cscf-' + it.communityId"
          class="cs-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="cs-rank">
            <text class="cs-medal">{{ idx + 1 }}</text>
          </view>
          <view class="cs-mid">
            <view class="cs-name">{{ it.communityName }}</view>
            <view class="cs-dist muted">{{ it.districtName }} · 总分 {{ it.totalScore.toFixed(0) }}</view>
          </view>
          <view class="cs-right">
            <text class="cs-total">
              {{ it.commuteMinutes != null ? Math.round(it.commuteMinutes) + " 分" : "—" }}
            </text>
          </view>
        </view>
        <view v-if="communityScoreLifeTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          生活维 Top（派生）
        </view>
        <view
          v-for="(it, idx) in communityScoreLifeTop"
          :key="'csl-' + it.communityId"
          class="cs-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="cs-rank">
            <text class="cs-medal">{{ idx + 1 }}</text>
          </view>
          <view class="cs-mid">
            <view class="cs-name">{{ it.communityName }}</view>
            <view class="cs-dist muted">{{ it.districtName }} · 总分 {{ it.totalScore.toFixed(0) }}</view>
          </view>
          <view class="cs-right">
            <text class="cs-total">{{ it.lifeScore.toFixed(0) }}</text>
          </view>
        </view>
        <view v-if="communityScoreSchoolTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          学区维 Top（派生）
        </view>
        <view
          v-for="(it, idx) in communityScoreSchoolTop"
          :key="'css-' + it.communityId"
          class="cs-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="cs-rank">
            <text class="cs-medal">{{ idx + 1 }}</text>
          </view>
          <view class="cs-mid">
            <view class="cs-name">{{ it.communityName }}</view>
            <view class="cs-dist muted">{{ it.districtName }} · 总分 {{ it.totalScore.toFixed(0) }}</view>
          </view>
          <view class="cs-right">
            <text class="cs-total">{{ it.schoolScore.toFixed(0) }}</text>
          </view>
        </view>
        <view v-if="communityScoreTotalTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          派生总分 Top（固定权重 seed）
        </view>
        <view
          v-for="(it, idx) in communityScoreTotalTop"
          :key="'cstt-' + it.communityId"
          class="cs-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="cs-rank">
            <text class="cs-medal">{{ idx + 1 }}</text>
          </view>
          <view class="cs-mid">
            <view class="cs-name">{{ it.communityName }}</view>
            <view class="cs-dist muted">{{ it.districtName }}</view>
          </view>
          <view class="cs-right">
            <text class="cs-total">{{ it.totalScore.toFixed(0) }}</text>
          </view>
        </view>
        <view data-cross-city v-if="communityScoreCitySummaries.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          跨城综合均分对照
        </view>
        <view
          v-for="c in communityScoreCitySummaries"
          :key="'cscs-' + c.cityId"
          class="cs-row"
        >
          <view class="cs-mid">
            <view class="cs-name">{{ cityNameForId(c.cityId) }}</view>
            <view class="cs-dist muted">
              {{ c.communityCount }} 小区 · 生活 {{ c.avgLifeScore.toFixed(0) }} · 学区 {{ c.avgSchoolScore.toFixed(0) }}
            </view>
          </view>
          <view class="cs-right">
            <text class="cs-total">{{ c.avgTotalScore.toFixed(0) }}</text>
          </view>
        </view>
        </template>
      </view>

      <!-- v0.41.0 trend-21 房源新鲜度 (新挂牌多 + 滞销) -->
      <view v-if="!isCardHidden('listing-freshness') && (listingFreshness && listingFreshness.totalCount > 0)" class="card" data-card-key="listing-freshness" data-tab="price">
        <view class="row-between">
          <view class="card-title">📅 房源新鲜度 · {{ listingFreshness.cityName }}</view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="listing-freshness"
            @click.stop="toggleCardHidden('listing-freshness')"
          >✕</button>
          <view class="muted">活跃 top {{ listingFreshness.mostFresh.length }} · 滞销 top {{ listingFreshness.mostStale.length }}</view>
        </view>

        <view class="lf-section-title">🆕 新挂牌最多 (近 2 周)</view>
        <view
          v-for="it in listingFreshness.mostFresh"
          :key="'fresh_' + it.communityId"
          class="lf-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="lf-left">
            <view class="lf-name">{{ it.communityName }}</view>
            <view class="muted" style="font-size: 22rpx">{{ it.districtName }} · 总 {{ it.totalListings }} 套 · 中位 {{ it.medianAgeDays ?? '?' }} 天</view>
          </view>
          <view class="lf-mid">
            <view class="lf-line">
              <text class="lf-k">近 2 周</text>
              <text :class="['lf-v', lfFreshClass(it.new2wCount * 5)]">{{ it.new2wCount }}</text>
            </view>
            <view class="lf-line">
              <text class="lf-k">近 4 周</text>
              <text class="lf-v">{{ it.recent4wCount }}</text>
            </view>
            <view class="lf-line">
              <text class="lf-k">滞销</text>
              <text class="lf-v muted">{{ it.staleCount }}</text>
            </view>
          </view>
          <view :class="['lf-score', lfFreshClass(it.freshnessScore)]">
            {{ it.freshnessScore.toFixed(0) }}
          </view>
        </view>

        <view class="lf-section-title">😴 滞销最久 (中位在挂天数)</view>
        <view
          v-for="it in listingFreshness.mostStale"
          :key="'stale_' + it.communityId"
          class="lf-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="lf-left">
            <view class="lf-name">{{ it.communityName }}</view>
            <view class="muted" style="font-size: 22rpx">{{ it.districtName }} · 总 {{ it.totalListings }} 套</view>
          </view>
          <view class="lf-mid">
            <view class="lf-line">
              <text class="lf-k">中位</text>
              <text class="lf-v">{{ it.medianAgeDays ?? '—' }} 天</text>
            </view>
            <view class="lf-line">
              <text class="lf-k">滞销</text>
              <text class="lf-v">{{ it.staleCount }}</text>
            </view>
            <view class="lf-line">
              <text class="lf-k">活跃度</text>
              <text :class="['lf-v', lfFreshClass(it.freshnessScore)]">{{ it.freshnessScore.toFixed(0) }}</text>
            </view>
          </view>
        </view>

        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：listings.csv (crawl_date) → scripts/compute_listing_freshness.py。<br>
          公式：freshness = (近 4 周 × 1 + 近 2 周 × 2) ÷ 总数 × 100，min_listings=5。
        </view>
        <view v-if="freshnessCitySummary" class="lf-section-title">
          本市聚合：均鲜 {{ freshnessCitySummary.avgFreshness.toFixed(0) }}
          · 近4周占比 {{ (freshnessCitySummary.recent4wRate * 100).toFixed(0) }}%
          · 积压占比 {{ (freshnessCitySummary.staleRate * 100).toFixed(0) }}%
        </view>
        <view data-cross-city v-if="freshnessCrossCityTop.length" class="lf-section-title">
          跨城最新鲜 Top
        </view>
        <view
          v-for="(it, idx) in freshnessCrossCityTop"
          :key="'fx-' + it.communityId"
          class="lf-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="lf-left">
            <view class="lf-name">{{ it.communityName }}</view>
            <view class="muted" style="font-size: 22rpx">
              {{ it.cityName }} · {{ it.districtName }} · {{ it.totalListings }} 套
            </view>
          </view>
          <view :class="['lf-score', lfFreshClass(it.freshnessScore)]">
            {{ it.freshnessScore.toFixed(0) }}
          </view>
        </view>
        <view data-cross-city v-if="freshnessStaleCrossCity.length" class="lf-section-title">
          跨城最积压 Top
        </view>
        <view
          v-for="(it, idx) in freshnessStaleCrossCity"
          :key="'fs-' + it.communityId"
          class="lf-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="lf-left">
            <view class="lf-name">{{ it.communityName }}</view>
            <view class="muted" style="font-size: 22rpx">
              {{ it.cityName }} · {{ it.districtName }}
              · 中位 {{ it.medianAgeDays ?? "—" }} 天
            </view>
          </view>
          <view :class="['lf-score', lfFreshClass(it.freshnessScore)]">
            {{ it.freshnessScore.toFixed(0) }}
          </view>
        </view>
      </view>

      <view v-if="!isCardHidden('district-map') && (districtMap && districtMap.districts.length > 0)" class="card" data-card-key="district-map" data-tab="map">
        <view class="row-between">
          <view class="card-title">🗺️ 行政区域图 · {{ districtMap.cityName }}</view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="district-map"
            @click.stop="toggleCardHidden('district-map')"
          >✕</button>
          <view class="muted">{{ districtMap.districts.length }} 区 · {{ districtMap.markers.length }} 社区</view>
        </view>
        <!-- v0.52.0 map-12: 地图模式切换 (marker / count / price / school / metro) -->
        <view class="map-mode-tabs">
          <view
            v-for="m in MAP_MODES"
            :key="m.key"
            :class="['map-mode-tab', { 'map-mode-tab--active': mapMode === m.key }]"
            @click="mapMode = m.key"
          >
            <text class="map-mode-icon">{{ m.icon }}</text>
            <text class="map-mode-label">{{ m.label }}</text>
          </view>
        </view>
        <view v-if="mapMode !== 'marker'" class="map-legend">
          <text class="map-legend-title">{{ mapModeTitle }}:</text>
          <view class="map-legend-bar" :style="{ background: mapModeGradient }"></view>
          <text class="map-legend-min">{{ mapModeMin }}</text>
          <text class="map-legend-max">{{ mapModeMax }}</text>
        </view>
        <view class="map-wrap">
          <svg
            :viewBox="`0 0 ${MAP_W} ${MAP_H}`"
            class="map-svg"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <!-- 行政区多边形 (fill-rule:evenodd 自动处理洞) -->
            <g class="map-districts">
              <path
                v-for="d in districtMap.districts"
                :key="'d_' + d.districtCode"
                :d="districtAllPath(d.polygons, districtMap.bbox.minLng, districtMap.bbox.maxLng, districtMap.bbox.minLat, districtMap.bbox.maxLat)"
                :class="['map-district-p', { 'map-district-p--mode': mapMode !== 'marker' }]"
                :data-name="d.districtName"
                :fill="districtFill(d.districtName)"
                fill-rule="evenodd"
              />
              <!-- 区名 label (center) -->
              <text
                v-for="d in districtMap.districts"
                :key="'lbl_' + d.districtCode"
                :x="mapX(d.centerLng, districtMap.bbox.minLng, districtMap.bbox.maxLng)"
                :y="mapY(d.centerLat, districtMap.bbox.minLat, districtMap.bbox.maxLat)"
                text-anchor="middle"
                dominant-baseline="middle"
                class="map-district-lbl"
              >{{ d.districtName }}</text>
            </g>
            <!-- 社区 marker (圆点 + 名字) — v0.52.0 map-12 仅 marker 模式显示 -->
            <g v-if="mapMode === 'marker' && districtMap.markers.length <= 30">
              <g
                v-for="m in districtMap.markers"
                :key="'m_' + m.communityId"
                class="map-marker-g tap-row"
                @click="goCommunity(m.communityId)"
              >
                <circle
                  :cx="mapX(m.lng, districtMap.bbox.minLng, districtMap.bbox.maxLng)"
                  :cy="mapY(m.lat, districtMap.bbox.minLat, districtMap.bbox.maxLat)"
                  r="5"
                  class="map-marker"
                />
                <text
                  :x="mapX(m.lng, districtMap.bbox.minLng, districtMap.bbox.maxLng) + 7"
                  :y="mapY(m.lat, districtMap.bbox.minLat, districtMap.bbox.maxLat) + 3"
                  class="map-marker-lbl"
                >{{ m.communityName }}</text>
              </g>
            </g>
            <g v-else-if="mapMode === 'marker'">
              <circle
                v-for="m in districtMap.markers"
                :key="'mb_' + m.communityId"
                :cx="mapX(m.lng, districtMap.bbox.minLng, districtMap.bbox.maxLng)"
                :cy="mapY(m.lat, districtMap.bbox.minLat, districtMap.bbox.maxLat)"
                r="3"
                class="map-marker-bare tap-row"
                :data-community-id="m.communityId"
                :data-name="m.communityName"
                @click="goCommunity(m.communityId)"
              ><title>{{ m.communityName }}</title></circle>
            </g>
            <!-- 非 marker 模式: 显示该区聚合值 -->
            <g v-else>
              <text
                v-for="d in districtMap.districts"
                :key="'v_' + d.districtCode"
                :x="mapX(d.centerLng, districtMap.bbox.minLng, districtMap.bbox.maxLng)"
                :y="mapY(d.centerLat, districtMap.bbox.minLat, districtMap.bbox.maxLat) + 18"
                text-anchor="middle"
                dominant-baseline="middle"
                class="map-district-val"
              >{{ districtStatLabel(d.districtName) }}</text>
            </g>
          </svg>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：高德 /v3/config/district (行政区边界) + communities_geo.csv (社区经纬度)<br>
          v0.46.0 区名 = 直辖市区 + 行政区; 社区 marker = 圆点 + 名字 (≤30 社区时显示, 超过则简化为点)
        </view>
      </view>

      <!-- v0.47.0 school-4 学区指标加权细分 -->
      <view
        v-if="!isCardHidden('school-dim-weighted') && (schoolDims && schoolDims.total > 0)" data-card-key="school-dim-weighted"
        id="overview-school"
        class="card overview-card"
        :class="{ 'overview-card--collapsed': isOverviewGroupCollapsed('school') }"
        data-tab="school"
        @click="onOverviewCardClick('school')"
      >
        <view class="row-between">
          <view class="card-title">🏫 学区 5 维评分 · {{ schoolDims.cityName }}</view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="school-dim-weighted"
            @click.stop="toggleCardHidden('school-dim-weighted')"
          >✕</button>
          <view class="muted">{{ schoolDims.total }} 校</view>
        </view>
        <view v-if="isOverviewGroupCollapsed('school')" data-overview-summary class="overview-card-summary muted">
          {{ overviewSchoolSummary }}
        </view>
        <template v-else>
        <view class="muted" style="font-size: 22rpx; margin-bottom: 8rpx">
          综合 = 评级(40%) + 集团实力(20%) + 区域均衡(15%) + 趋势(10%) + 是否集团(5%)
        </view>

        <!-- 综合 Top 5 (横向 grid) -->
        <view class="sd-block">
          <view class="sd-block-title">🏆 综合 Top 5</view>
          <view class="sd-ovr">
            <view v-for="(row, i) in schoolDims.topOverall.slice(0, 5)" :key="'so_' + row.schoolId" class="sd-ovr-row">
              <view class="sd-rank">{{ i + 1 }}</view>
              <view class="sd-info">
                <view class="sd-name">{{ row.schoolName }}</view>
                <view class="sd-meta muted">{{ row.districtName }} · {{ row.schoolType }}</view>
              </view>
              <view class="sd-score-wrap">
                <view class="sd-score-bar">
                  <view class="sd-score-fill" :style="{ width: row.compositeScore + '%', background: schoolDimsColor(row.compositeScore) }"></view>
                </view>
                <view class="sd-score-num">{{ row.compositeScore.toFixed(0) }}</view>
              </view>
            </view>
          </view>
        </view>

        <!-- 各维度最强 (2x2 grid) -->
        <view class="sd-block">
          <view class="sd-block-title">📊 各维度最强 Top 3</view>
          <view class="sd-grid">
            <view class="sd-cell">
              <view class="sd-cell-h">📈 评级 levelScore</view>
              <view v-for="(r, i) in schoolDims.topByLevel.slice(0, 3)" :key="'lvl_' + r.schoolId" class="sd-row">
                <text class="sd-rank-sm">{{ i + 1 }}</text>
                <text class="sd-name-sm">{{ r.schoolName.slice(0, 14) }}</text>
                <text class="sd-val">{{ r.levelScore.toFixed(1) }}</text>
              </view>
            </view>
            <view class="sd-cell">
              <view class="sd-cell-h">🏢 集团校实力</view>
              <view v-for="(r, i) in schoolDims.topByGroup.slice(0, 3)" :key="'grp_' + r.schoolId" class="sd-row">
                <text class="sd-rank-sm">{{ i + 1 }}</text>
                <text class="sd-name-sm">{{ r.schoolName.slice(0, 14) }}</text>
                <text class="sd-val">{{ r.groupStrength.toFixed(1) }}</text>
              </view>
              <view v-if="schoolDims.topByGroup.length === 0" class="muted" style="font-size: 22rpx">该城市暂无集团校</view>
            </view>
            <view class="sd-cell">
              <view class="sd-cell-h">⚖️ 区域均衡</view>
              <view v-for="(r, i) in schoolDims.topByDistrict.slice(0, 3)" :key="'dst_' + r.schoolId" class="sd-row">
                <text class="sd-rank-sm">{{ i + 1 }}</text>
                <text class="sd-name-sm">{{ r.schoolName.slice(0, 14) }}</text>
                <text class="sd-val">{{ r.districtBalance.toFixed(1) }}</text>
              </view>
            </view>
            <view class="sd-cell">
              <view class="sd-cell-h">🚀 涨幅 (trend)</view>
              <view v-for="(r, i) in schoolDims.topByTrend.slice(0, 3)" :key="'trd_' + r.schoolId" class="sd-row">
                <text class="sd-rank-sm">{{ i + 1 }}</text>
                <text class="sd-name-sm">{{ r.schoolName.slice(0, 14) }}</text>
                <text :class="['sd-val', r.trendDelta > 0 ? 'sd-pos' : r.trendDelta < 0 ? 'sd-neg' : '']">
                  {{ r.trendDelta > 0 ? '+' : '' }}{{ r.trendDelta.toFixed(2) }}
                </text>
              </view>
            </view>
          </view>
        </view>

        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：school_indicators.csv (5 原始指标列) → 城市内百分位排名 → 综合分 0-100
        </view>
        <view data-cross-city v-if="schoolCompositeCrossCity.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          跨城综合分冠军校
        </view>
        <view
          v-for="c in schoolCompositeCrossCity"
          :key="'scc-' + c.cityId"
          class="sd-ovr-row"
        >
          <text class="sd-name-sm">{{ c.cityName }}</text>
          <text class="sd-name-sm">{{ c.topSchool?.schoolName?.slice(0, 16) ?? "—" }}</text>
          <text class="sd-val">{{ c.topSchool?.score?.toFixed(1) ?? "—" }}</text>
        </view>
        </template>
      </view>

      <!-- v0.53.0 macro-1 LPR + 房贷利率 -->
      <view
        v-if="!isCardHidden('macro-lpr-card') && (lpr && lpr.total > 0)" data-card-key="macro-lpr-card"
        id="overview-lpr"
        class="card overview-card"
        :class="{ 'overview-card--collapsed': isOverviewGroupCollapsed('lpr') }"
        data-tab="price"
        @click="onOverviewCardClick('lpr')"
      >
        <view class="row-between">
          <view class="card-title">💰 LPR + 房贷利率 · 全国</view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="macro-lpr-card"
            @click.stop="toggleCardHidden('macro-lpr-card')"
          >✕</button>
          <view class="muted">{{ lpr.total }} 月历史 · 最新 {{ lpr.latest?.month }}</view>
        </view>
        <view v-if="isOverviewGroupCollapsed('lpr')" data-overview-summary class="overview-card-summary muted">
          {{ overviewLprSummary }}
        </view>
        <template v-else>

        <!-- 当前利率 KPI -->
        <view class="lpr-kpi">
          <view class="lpr-kpi-cell">
            <view class="lpr-kpi-label">1Y LPR</view>
            <view class="lpr-kpi-val">{{ lpr.latest?.lpr1y.toFixed(2) }}<text class="lpr-kpi-unit">%</text></view>
          </view>
          <view class="lpr-kpi-cell lpr-kpi-cell--5y">
            <view class="lpr-kpi-label">5Y+ LPR</view>
            <view class="lpr-kpi-val">{{ lpr.latest?.lpr5y.toFixed(2) }}<text class="lpr-kpi-unit">%</text></view>
          </view>
          <view class="lpr-kpi-cell">
            <view class="lpr-kpi-label">首套房贷</view>
            <view class="lpr-kpi-val lpr-kpi-val--down">{{ lpr.latest?.mortgageFirst.toFixed(2) }}<text class="lpr-kpi-unit">%</text></view>
          </view>
          <view class="lpr-kpi-cell">
            <view class="lpr-kpi-label">二套房贷</view>
            <view class="lpr-kpi-val">{{ lpr.latest?.mortgageSecond.toFixed(2) }}<text class="lpr-kpi-unit">%</text></view>
          </view>
        </view>

        <!-- 累计下调 -->
        <view class="lpr-drop-row">
          <view class="lpr-drop-cell">
            <text class="lpr-drop-label">自 2019-08 累计下调</text>
            <text class="lpr-drop-val lpr-drop-val--down">5Y: -{{ lpr.cumDrop5y }} pp</text>
            <text class="lpr-drop-val lpr-drop-val--down">1Y: -{{ lpr.cumDrop1y }} pp</text>
          </view>
          <view class="lpr-drop-cell">
            <text class="lpr-drop-label">近 12 月</text>
            <text class="lpr-drop-val" :class="lpr.yoyDrop5y < 0 ? 'lpr-drop-val--down' : 'lpr-drop-val--up'">5Y: {{ lpr.yoyDrop5y > 0 ? '+' : '' }}{{ lpr.yoyDrop5y }} pp</text>
            <text class="lpr-drop-val" :class="lpr.yoyDrop1y < 0 ? 'lpr-drop-val--down' : 'lpr-drop-val--up'">1Y: {{ lpr.yoyDrop1y > 0 ? '+' : '' }}{{ lpr.yoyDrop1y }} pp</text>
          </view>
        </view>

        <!-- 5Y LPR sparkline (SVG) -->
        <view class="lpr-chart-title">📉 5Y+ LPR 走势 (近 36 月)</view>
        <view class="lpr-chart-wrap">
          <svg :viewBox="`0 0 ${LPR_W} ${LPR_H}`" class="lpr-chart" preserveAspectRatio="none">
            <path
              v-if="lprSpark5y.path"
              :d="lprSpark5y.path"
              fill="none"
              stroke="#ef4444"
              stroke-width="2"
              stroke-linejoin="round"
            />
            <circle
              v-if="lprSpark5y.last"
              :cx="lprSpark5y.last.x"
              :cy="lprSpark5y.last.y"
              r="3"
              fill="#ef4444"
            >
              <title>{{ lpr.latest?.month }} 5Y LPR = {{ lpr.latest?.lpr5y }}%</title>
            </circle>
            <!-- Y 轴 labels -->
            <text v-for="(lbl, i) in lprSpark5y.yLabels" :key="'y_' + i" :x="4" :y="lbl.y + 4" class="lpr-chart-ylbl">{{ lbl.text }}</text>
            <!-- X 轴 labels (首/末/月数) -->
            <text :x="4" :y="LPR_H - 4" class="lpr-chart-xlbl">{{ lpr.series[Math.max(0, lpr.series.length - 36)].month }}</text>
            <text :x="LPR_W - 4" :y="LPR_H - 4" text-anchor="end" class="lpr-chart-xlbl">{{ lpr.latest?.month }}</text>
          </svg>
        </view>

        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：央行 PBOC 公开公告 (lpr_history.csv · 83 月 · {{ lpr.series[0].month }} → {{ lpr.latest?.month }})。
          首套房贷 = 5Y LPR + 加点 (-30bp), 二套 = 5Y LPR + 35bp (一线城市普遍加点)。
          房贷利率直接影响月供：100w 贷 30 年等额本息，每 25bp 约影响月供 ¥150。
        </view>

        <view v-if="providentRate" class="pf-card" data-provident-fund-rate>
          <view class="row-between">
            <view class="lpr-chart-title" style="margin: 0">🏦 住房公积金贷款</view>
            <view class="muted" style="font-size: 21rpx">{{ providentRate.effectiveDate }} 起</view>
          </view>
          <view class="pf-rate-grid">
            <view class="pf-rate-cell"><text>首套 ≤5年</text><text class="pf-rate-value">{{ providentRate.first5yOrLess }}%</text></view>
            <view class="pf-rate-cell"><text>首套 ＞5年</text><text class="pf-rate-value">{{ providentRate.firstOver5y }}%</text></view>
            <view class="pf-rate-cell"><text>二套 ≤5年</text><text class="pf-rate-value">不低于 {{ providentRate.second5yOrLess }}%</text></view>
            <view class="pf-rate-cell"><text>二套 ＞5年</text><text class="pf-rate-value">不低于 {{ providentRate.secondOver5y }}%</text></view>
          </view>
          <button
            v-if="gdProvidentAnnual"
            class="gz-inventory-toggle"
            size="mini"
            style="margin-top: 12rpx"
            data-gd-provident-toggle
            :aria-expanded="gdProvidentExpanded"
            @click="gdProvidentExpanded = !gdProvidentExpanded"
          >
            {{ gdProvidentExpanded ? "收起广东全省年报" : "展开广东全省年报" }}
          </button>
          <template v-if="gdProvidentAnnual && gdProvidentExpanded">
            <view class="gz-inventory-grid" style="margin-top: 12rpx" data-gd-provident-annual>
              <view class="gz-inventory-kpi">
                <text class="cell-label">广东 {{ gdProvidentAnnual.year }} 缴存额</text>
                <text class="gz-inventory-value">{{ gdProvidentAnnual.depositAmountYi.toLocaleString() }} 亿</text>
                <text class="cell-sub muted">
                  实缴 {{ gdProvidentAnnual.paidPersonsWan.toLocaleString() }} 万人
                  <template v-if="gdProvidentExtractPct != null">
                    · 提取/缴存 {{ gdProvidentExtractPct }}%
                  </template>
                </text>
              </view>
              <view class="gz-inventory-kpi">
                <text class="cell-label">全省发放贷款</text>
                <text class="gz-inventory-value">{{ gdProvidentAnnual.loanIssuedWan }} 万笔</text>
                <text class="cell-sub muted">{{ gdProvidentAnnual.loanIssuedYi.toLocaleString() }} 亿元</text>
              </view>
              <view class="gz-inventory-kpi">
                <text class="cell-label">全省缴存余额</text>
                <text class="gz-inventory-value">{{ gdProvidentAnnual.depositBalanceYi.toLocaleString() }} 亿</text>
                <text class="cell-sub muted">
                  贷款余额 {{ gdProvidentAnnual.loanBalanceYi.toLocaleString() }} 亿
                  <template v-if="gdProvidentLoanBalancePct != null">
                    · 个贷/缴存 {{ gdProvidentLoanBalancePct }}%
                  </template>
                </text>
              </view>
            </view>
            <view class="muted" style="margin-top: 8rpx; font-size: 21rpx">
              省年报：{{ gdProvidentAnnual.sourceOrg }} · {{ gdProvidentAnnual.publishDate || gdProvidentAnnual.year }}；全省口径，非城市挂牌/网签均价。官方 HTML 无稳定分市表，分市细节仍以各市年报/动态为准。
            </view>
          </template>
          <view v-if="szProvidentAnnual" class="gz-inventory-grid" style="margin-top: 12rpx" data-sz-provident-annual>
            <view class="gz-inventory-kpi">
              <text class="cell-label">{{ szProvidentAnnual.year }} 发放贷款</text>
              <text class="gz-inventory-value">{{ szProvidentAnnual.loanIssuedWan }} 万笔</text>
              <text class="cell-sub muted">{{ szProvidentAnnual.loanIssuedYi.toLocaleString() }} 亿元</text>
            </view>
            <view class="gz-inventory-kpi">
              <text class="cell-label">支持购建房</text>
              <text class="gz-inventory-value">{{ szProvidentAnnual.supportPurchaseWanSqm.toLocaleString() }} 万㎡</text>
              <text class="cell-sub muted">贷款余额 {{ szProvidentAnnual.loanBalanceYi.toLocaleString() }} 亿</text>
            </view>
            <view class="gz-inventory-kpi">
              <text class="cell-label">缴存余额</text>
              <text class="gz-inventory-value">{{ szProvidentAnnual.depositBalanceYi.toLocaleString() }} 亿</text>
              <text class="cell-sub muted">
                实缴 {{ szProvidentAnnual.paidPersonsWan.toLocaleString() }} 万人
                <template v-if="szProvidentExtractPct != null">
                  · 提取/缴存 {{ szProvidentExtractPct }}%
                </template>
              </text>
            </view>
          </view>
          <view v-if="szProvidentAnnual" class="muted" style="margin-top: 8rpx; font-size: 21rpx">
            深圳年报：{{ szProvidentAnnual.sourceOrg }} · {{ szProvidentAnnual.publishDate || szProvidentAnnual.year }}；
            <template v-if="szProvidentLoanBalancePct != null">
              个贷余额/缴存余额 {{ szProvidentLoanBalancePct }}%；
            </template>
            <template v-if="szProvidentAnnual.publicRentalSupplementYi > 0">
              公租房建设补充资金计提 {{ szProvidentAnnual.publicRentalSupplementYi }} 亿元；
            </template>
            非成交均价、非挂牌价。
          </view>
          <view
            v-if="szProvidentYearDelta"
            class="muted"
            style="margin-top: 8rpx; font-size: 21rpx"
            data-sz-provident-yoy
          >
            对照上年年报（{{ szProvidentYearDelta.prior.year }}）：缴存
            {{ szProvidentYearDelta.prior.depositAmountYi.toLocaleString() }} 亿 → 今年
            <text :class="macroTrendClass(szProvidentYearDelta.depositDeltaYi)">
              {{ formatInvDelta(szProvidentYearDelta.depositDeltaYi) }} 亿
            </text>
            ；发放贷款 {{ szProvidentYearDelta.prior.loanIssuedYi.toLocaleString() }} 亿 →
            <text :class="macroTrendClass(szProvidentYearDelta.loanDeltaYi)">
              {{ formatInvDelta(szProvidentYearDelta.loanDeltaYi) }} 亿
            </text>
            ；购建房 {{ szProvidentYearDelta.prior.supportPurchaseWanSqm.toLocaleString() }} 万㎡ →
            <text :class="macroTrendClass(szProvidentYearDelta.supportDeltaWanSqm)">
              {{ formatInvDelta(szProvidentYearDelta.supportDeltaWanSqm) }} 万㎡
            </text>
            。
          </view>
          <view v-if="gzProvidentAnnual" class="gz-inventory-grid" style="margin-top: 12rpx" data-gz-provident-annual>
            <view class="gz-inventory-kpi">
              <text class="cell-label">{{ gzProvidentAnnual.year }} 发放贷款</text>
              <text class="gz-inventory-value">{{ gzProvidentAnnual.loanIssuedWan }} 万笔</text>
              <text class="cell-sub muted">{{ gzProvidentAnnual.loanIssuedYi.toLocaleString() }} 亿元</text>
            </view>
            <view class="gz-inventory-kpi">
              <text class="cell-label">支持购建房</text>
              <text class="gz-inventory-value">{{ gzProvidentAnnual.supportPurchaseWanSqm.toLocaleString() }} 万㎡</text>
              <text class="cell-sub muted">贷款余额 {{ gzProvidentAnnual.loanBalanceYi.toLocaleString() }} 亿</text>
            </view>
            <view class="gz-inventory-kpi">
              <text class="cell-label">缴存余额</text>
              <text class="gz-inventory-value">{{ gzProvidentAnnual.depositBalanceYi.toLocaleString() }} 亿</text>
              <text class="cell-sub muted">
                实缴 {{ gzProvidentAnnual.paidPersonsWan.toLocaleString() }} 万人
                <template v-if="gzProvidentExtractPct != null">
                  · 提取/缴存 {{ gzProvidentExtractPct }}%
                </template>
              </text>
            </view>
          </view>
          <view v-if="gzProvidentAnnual" class="muted" style="margin-top: 8rpx; font-size: 21rpx">
            广州年报：{{ gzProvidentAnnual.sourceOrg }} · {{ gzProvidentAnnual.publishDate || gzProvidentAnnual.year }}；
            <template v-if="gzProvidentLoanBalancePct != null">
              个贷余额/缴存余额 {{ gzProvidentLoanBalancePct }}%；
            </template>
            <template v-if="gzProvidentAnnual.publicRentalSupplementYi > 0">
              公租房建设补充资金计提 {{ gzProvidentAnnual.publicRentalSupplementYi }} 亿元；
            </template>
            非成交均价、非挂牌价。
          </view>
          <view v-if="zhProvidentDynamics" class="gz-inventory-grid" style="margin-top: 12rpx" data-zh-provident-dynamics>
            <view class="gz-inventory-kpi">
              <text class="cell-label">{{ zhProvidentPeriodLabel }} 缴存额</text>
              <text class="gz-inventory-value">{{ zhProvidentDynamics.depositAmountYi.toLocaleString() }} 亿</text>
              <text class="cell-sub" :class="macroTrendClass(zhProvidentDynamics.depositYoyPct)">
                同比 {{ formatMacroPct(zhProvidentDynamics.depositYoyPct) }}
              </text>
            </view>
            <view class="gz-inventory-kpi">
              <text class="cell-label">发放贷款</text>
              <text class="gz-inventory-value">{{ zhProvidentDynamics.loanIssuedYi.toLocaleString() }} 亿</text>
              <text class="cell-sub" :class="macroTrendClass(zhProvidentDynamics.loanIssuedYoyPct)">
                同比 {{ formatMacroPct(zhProvidentDynamics.loanIssuedYoyPct) }}
                · 个贷率 {{ zhProvidentDynamics.loanRatioPct }}%
              </text>
            </view>
            <view class="gz-inventory-kpi">
              <text class="cell-label">缴存余额</text>
              <text class="gz-inventory-value">{{ zhProvidentDynamics.depositBalanceYi.toLocaleString() }} 亿</text>
              <text class="cell-sub muted">
                实缴 {{ zhProvidentDynamics.paidPersons.toLocaleString() }} 人
                <template v-if="zhProvidentDynamics.extractRatePct > 0">
                  · 提取率 {{ zhProvidentDynamics.extractRatePct }}%
                </template>
              </text>
            </view>
          </view>
          <view v-if="zhProvidentDynamics" class="muted" style="margin-top: 8rpx; font-size: 21rpx">
            珠海动态：{{ zhProvidentDynamics.sourceOrg }} · 截至 {{ zhProvidentDynamics.asOfDate }}；
            贷款余额 {{ zhProvidentDynamics.loanBalanceYi.toLocaleString() }} 亿元。
            <template v-if="zhProvidentFullYear">
              另有 {{ zhProvidentFullYear.year }} 全年动态：缴存 {{ zhProvidentFullYear.depositAmountYi.toLocaleString() }} 亿 /
              发放贷款 {{ zhProvidentFullYear.loanIssuedYi.toLocaleString() }} 亿。
            </template>
            非成交均价、非挂牌价；完整年报正文若未公开则以本动态为准。
          </view>
          <view
            v-if="zhProvidentSamePeriodDelta"
            class="muted"
            style="margin-top: 8rpx; font-size: 21rpx"
            data-zh-provident-same-period
          >
            同月末对照（{{ formatZhProvidentPeriod(zhProvidentSamePeriodDelta.prior) }}）：缴存
            {{ zhProvidentSamePeriodDelta.prior.depositAmountYi.toLocaleString() }} 亿 → 今年
            <text :class="macroTrendClass(zhProvidentSamePeriodDelta.depositDeltaYi)">
              {{ formatInvDelta(zhProvidentSamePeriodDelta.depositDeltaYi) }} 亿
            </text>
            ；贷款 {{ zhProvidentSamePeriodDelta.prior.loanIssuedYi.toLocaleString() }} 亿 → 今年
            <text :class="macroTrendClass(zhProvidentSamePeriodDelta.loanDeltaYi)">
              {{ formatInvDelta(zhProvidentSamePeriodDelta.loanDeltaYi) }} 亿
            </text>
            ；个贷率 {{ zhProvidentSamePeriodDelta.prior.loanRatioPct }}% →
            <text :class="macroTrendClass(zhProvidentSamePeriodDelta.loanRatioDeltaPct)">
              {{ formatMacroPct(zhProvidentSamePeriodDelta.loanRatioDeltaPct) }}
            </text>
            。
          </view>
          <view class="pf-saving">
            贷款 100 万、30 年、等额本息：公积金首套月供约 {{ pfMonthly100w().toLocaleString() }} 元；
            比当前商业首套参考少约 {{ pfSavingVsCommercial100w().toLocaleString() }} 元/月。
          </view>
          <view class="combo-loan" data-combo-loan>
            <view class="combo-title">组合贷月供试算</view>
            <view class="combo-input-grid">
              <label class="combo-field">
                <text>公积金贷款（万元）</text>
                <input
                  class="combo-input"
                  type="number"
                  data-combo-input="fund"
                  :value="String(comboFundWan)"
                  @input="onComboFundInput"
                  @blur="onComboFundBlur"
                />
              </label>
              <label class="combo-field">
                <text>商业贷款（万元）</text>
                <input
                  class="combo-input"
                  type="number"
                  data-combo-input="commercial"
                  :value="String(comboCommercialWan)"
                  @input="onComboCommercialInput"
                  @blur="onComboCommercialBlur"
                />
              </label>
            </view>
            <view class="combo-years">
              <button
                v-for="y in COMBO_YEAR_OPTIONS"
                :key="y"
                class="combo-year-btn"
                :class="{ 'combo-year-btn--active': comboYears === y }"
                size="mini"
                :data-combo-years="y"
                @click.stop="comboYears = y"
              >{{ y }} 年</button>
              <button class="combo-reset" size="mini" @click.stop="resetCombo">重置</button>
            </view>
            <view class="combo-result" aria-live="polite">
              <view>
                <text>组合贷月供</text>
                <text class="combo-result-main" data-combo-monthly>{{ comboMonthly.toLocaleString() }} 元</text>
              </view>
              <view>
                <text>相比全部商贷</text>
                <text class="combo-result-saving">少 {{ comboSavingMonthly.toLocaleString() }} 元/月</text>
              </view>
              <view>
                <text>预计总利息</text>
                <text>{{ comboTotalInterestWan }} 万元</text>
              </view>
            </view>
          </view>
          <view class="muted" style="font-size: 20rpx; margin-top: 8rpx">
            仅比较利率，不考虑当地贷款额度、组合贷、公积金缴存资格和银行实际加点。
          </view>
        </view>
        </template>
      </view>

      <!-- v1.121.12 医疗资源榜（hospitalRanking 已派生，此前未接 UI） -->
      <view v-if="!isCardHidden('hospital-rank') && (hospitalCitySummary)" class="card" data-card-key="hospital-rank" data-tab="school">
        <view class="row-between">
          <view class="card-title">🏥 医疗资源 · {{ hospitalCityName }}</view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="hospital-rank"
            @click.stop="toggleCardHidden('hospital-rank')"
          >✕</button>
          <view class="muted">{{ hospitalCitySummary.hospitalCount }} 家</view>
        </view>
        <view class="hosp-summary">
          <view class="hosp-kpi">
            <text class="hosp-kpi-val">{{ hospitalCitySummary.sanJiaCount }}</text>
            <text class="hosp-kpi-label muted">三甲</text>
          </view>
          <view class="hosp-kpi">
            <text class="hosp-kpi-val">{{ (hospitalCitySummary.sanJiaShare * 100).toFixed(0) }}%</text>
            <text class="hosp-kpi-label muted">三甲占比</text>
          </view>
          <view class="hosp-kpi">
            <text class="hosp-kpi-val">{{ hospitalCitySummary.keyFlagCount }}</text>
            <text class="hosp-kpi-label muted">重点</text>
          </view>
        </view>
        <view v-if="hospitalDistrictTop.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          分区医院数 Top
        </view>
        <view
          v-for="d in hospitalDistrictTop"
          :key="d.districtName"
          class="hosp-dist-row"
        >
          <text class="hosp-dist-rank muted">{{ d.rankInCity }}</text>
          <text class="hosp-dist-name">{{ d.districtName }}</text>
          <text class="hosp-dist-count">{{ d.hospitalCount }} 家</text>
          <text v-if="d.sanJiaCount" class="hosp-dist-sj muted">三甲 {{ d.sanJiaCount }}</text>
        </view>
        <view v-if="hospitalFocusDistrictList.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          「{{ hospitalDistrictCrossName }}」医院名录
        </view>
        <view
          v-for="(h, idx) in hospitalFocusDistrictList"
          :key="'hfd-' + h.hospitalId"
          class="hosp-top-row"
        >
          <text class="hosp-top-rank muted">{{ idx + 1 }}</text>
          <view class="hosp-top-mid">
            <text class="hosp-top-name">{{ h.displayName || h.officialName }}</text>
            <text class="hosp-top-meta muted">{{ h.hospitalType || "医院" }}</text>
          </view>
          <text class="hosp-top-level" :class="'hosp-lv--' + (h.hospitalLevel || '其他')">
            {{ h.hospitalLevel || "其他" }}
          </text>
        </view>
        <view v-if="hospitalTopList.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          等级优先 Top {{ hospitalTopList.length }}
        </view>
        <view
          v-for="(h, idx) in hospitalTopList"
          :key="h.hospitalId"
          class="hosp-top-row"
        >
          <text class="hosp-top-rank muted">{{ idx + 1 }}</text>
          <view class="hosp-top-mid">
            <text class="hosp-top-name">{{ h.displayName || h.officialName }}</text>
            <text class="hosp-top-meta muted">
              {{ h.districtName || "—" }} · {{ h.hospitalType || "医院" }}
              <text v-if="h.keyFlag"> · 重点</text>
            </text>
          </view>
          <text class="hosp-top-level" :class="'hosp-lv--' + (h.hospitalLevel || '其他')">
            {{ h.hospitalLevel || "其他" }}
          </text>
        </view>
        <view v-if="hospitalKeyList.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          重点医院名录
        </view>
        <view
          v-for="(h, idx) in hospitalKeyList"
          :key="'hk-' + h.hospitalId"
          class="hosp-top-row"
        >
          <text class="hosp-top-rank muted">{{ idx + 1 }}</text>
          <view class="hosp-top-mid">
            <text class="hosp-top-name">{{ h.displayName || h.officialName }}</text>
            <text class="hosp-top-meta muted">{{ h.districtName || "—" }}</text>
          </view>
          <text class="hosp-top-level" :class="'hosp-lv--' + (h.hospitalLevel || '其他')">
            {{ h.hospitalLevel || "其他" }}
          </text>
        </view>
        <view v-if="hospitalTcmList.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          中医医院
        </view>
        <view
          v-for="(h, idx) in hospitalTcmList"
          :key="'htcm-' + h.hospitalId"
          class="hosp-top-row"
        >
          <text class="hosp-top-rank muted">{{ idx + 1 }}</text>
          <view class="hosp-top-mid">
            <text class="hosp-top-name">{{ h.displayName || h.officialName }}</text>
            <text class="hosp-top-meta muted">{{ h.districtName || "—" }}</text>
          </view>
          <text class="hosp-top-level" :class="'hosp-lv--' + (h.hospitalLevel || '其他')">
            {{ h.hospitalLevel || "其他" }}
          </text>
        </view>
        <view v-if="hospitalMaternityList.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          妇幼保健院
        </view>
        <view
          v-for="(h, idx) in hospitalMaternityList"
          :key="'hmat-' + h.hospitalId"
          class="hosp-top-row"
        >
          <text class="hosp-top-rank muted">{{ idx + 1 }}</text>
          <view class="hosp-top-mid">
            <text class="hosp-top-name">{{ h.displayName || h.officialName }}</text>
            <text class="hosp-top-meta muted">{{ h.districtName || "—" }}</text>
          </view>
          <text class="hosp-top-level" :class="'hosp-lv--' + (h.hospitalLevel || '其他')">
            {{ h.hospitalLevel || "其他" }}
          </text>
        </view>
        <view v-if="hospitalSpecialtyList.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          专科医院
        </view>
        <view
          v-for="(h, idx) in hospitalSpecialtyList"
          :key="'hsp-' + h.hospitalId"
          class="hosp-top-row"
        >
          <text class="hosp-top-rank muted">{{ idx + 1 }}</text>
          <view class="hosp-top-mid">
            <text class="hosp-top-name">{{ h.displayName || h.officialName }}</text>
            <text class="hosp-top-meta muted">{{ h.districtName || "—" }}</text>
          </view>
          <text class="hosp-top-level" :class="'hosp-lv--' + (h.hospitalLevel || '其他')">
            {{ h.hospitalLevel || "其他" }}
          </text>
        </view>
        <view v-if="hospitalDistrictCross.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          同名区医院对照 · {{ hospitalDistrictCrossName }}
        </view>
        <view
          v-for="d in hospitalDistrictCross"
          :key="'hdx-' + d.cityId + d.districtName"
          class="hosp-dist-row"
        >
          <text class="hosp-dist-name">{{ cityNameForId(d.cityId) }} · {{ d.districtName }}</text>
          <text class="hosp-dist-count">{{ d.hospitalCount }} 家</text>
          <text v-if="d.sanJiaCount" class="hosp-dist-sj muted">三甲 {{ d.sanJiaCount }}</text>
        </view>
        <view v-if="hospitalGeoSummary" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          坐标覆盖（hospitals_geo）
        </view>
        <view v-if="hospitalGeoSummary" class="hosp-summary">
          <view class="hosp-kpi">
            <text class="hosp-kpi-val">{{ hospitalGeoSummary.geoCount }}</text>
            <text class="hosp-kpi-label muted">有坐标</text>
          </view>
          <view class="hosp-kpi">
            <text class="hosp-kpi-val">{{ ((hospitalGeoConfRatio?.ratio ?? 0) * 100).toFixed(0) }}%</text>
            <text class="hosp-kpi-label muted">高置信</text>
          </view>
          <view class="hosp-kpi">
            <text class="hosp-kpi-val">{{ hospitalGeoSummary.confidence.medium + hospitalGeoSummary.confidence.low }}</text>
            <text class="hosp-kpi-label muted">中/低置信</text>
          </view>
        </view>
        <view v-if="hospitalGeoCoverage" class="muted" style="margin-top: 4rpx; font-size: 22rpx">
          全国坐标覆盖
          {{ hospitalGeoCoverage.withCoords }}/{{ hospitalGeoCoverage.total }}
          （{{ (hospitalGeoCoverage.coverageRatio * 100).toFixed(0) }}%）
          <text v-if="hospitalGeoDupCount > 0">
            · 重复 amapPoi {{ hospitalGeoDupCount }} 组
          </text>
        </view>
        <view v-if="hospitalGeoConfNational.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          全国医院坐标置信分布
        </view>
        <view
          v-for="c in hospitalGeoConfNational"
          :key="'hgcn-' + c.level"
          class="hosp-dist-row"
        >
          <text class="hosp-dist-name">{{ c.level }}</text>
          <text class="hosp-dist-count">{{ c.count }} 家 · {{ c.cityCount }} 城</text>
        </view>
        <view v-if="hospitalGeoDistricts.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          地址分区 Top
        </view>
        <view
          v-for="d in hospitalGeoDistricts"
          :key="'geo-' + d.districtName"
          class="hosp-dist-row"
        >
          <text class="hosp-dist-name">{{ d.districtName }}</text>
          <text class="hosp-dist-count">{{ d.count }} 家</text>
        </view>
        <view v-if="hospitalGeoNearest.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          市内最近医院对
        </view>
        <view
          v-for="(p, idx) in hospitalGeoNearest"
          :key="'np-' + p.hospitalIdA + '-' + p.hospitalIdB"
          class="hosp-geo-pair"
        >
          <text class="hosp-geo-rank muted">{{ idx + 1 }}</text>
          <text class="hosp-geo-names">
            {{ hospitalDisplayName(p.hospitalIdA) }} · {{ hospitalDisplayName(p.hospitalIdB) }}
          </text>
          <text class="hosp-geo-km">{{ p.distanceKm.toFixed(2) }} km</text>
        </view>
        <view data-cross-city v-if="hospitalGeoCrossCity.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          跨城最近医院对
        </view>
        <view
          v-for="(p, idx) in hospitalGeoCrossCity"
          :key="'hxc-' + p.hospitalIdA + '-' + p.hospitalIdB"
          class="hosp-geo-pair"
        >
          <text class="hosp-geo-rank muted">{{ idx + 1 }}</text>
          <text class="hosp-geo-names">
            {{ cityNameForId(p.cityIdA) }} {{ hospitalDisplayName(p.hospitalIdA) }}
            ·
            {{ cityNameForId(p.cityIdB) }} {{ hospitalDisplayName(p.hospitalIdB) }}
          </text>
          <text class="hosp-geo-km">{{ p.distanceKm.toFixed(1) }} km</text>
        </view>
        <view v-if="hospitalCbdRadius" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          CBD {{ hospitalCbdRadius.radiusKm }}km 内医院
          {{ hospitalCbdRadius.withinCount }} 家
          <text v-if="hospitalCbdName">（{{ hospitalCbdName }}）</text>
        </view>
        <view
          v-for="(hid, idx) in (hospitalCbdRadius?.hospitalIds ?? []).slice(0, 3)"
          :key="'cbd-h-' + hid"
          class="hosp-geo-pair"
        >
          <text class="hosp-geo-rank muted">{{ idx + 1 }}</text>
          <text class="hosp-geo-names">{{ hospitalDisplayName(hid) }}</text>
        </view>
        <view v-if="hospitalGeoLowConf.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          低置信坐标（待复核）
        </view>
        <view
          v-for="(g, idx) in hospitalGeoLowConf"
          :key="'hgl-' + g.hospitalId"
          class="hosp-geo-pair"
        >
          <text class="hosp-geo-rank muted">{{ idx + 1 }}</text>
          <text class="hosp-geo-names">{{ hospitalDisplayName(g.hospitalId) }}</text>
          <text class="hosp-geo-km muted">{{ g.confidence }}</text>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          名录：hospitals.csv。坐标：hospitals_geo.csv（高德文本检索）。置信度反映 POI 匹配质量。
        </view>
      </view>

      <!-- v1.121.15 周边商业 POI（poiCommercialRanking，此前未接仪表盘） -->
      <view v-if="commercialReady" class="card" data-tab="transit">
        <view class="row-between">
          <view class="card-title">🏪 周边商业 · {{ hospitalCityName }}</view>
          <view class="muted">{{ commercialCommunityCount }} 小区</view>
        </view>
        <view class="pc-summary">
          <view class="pc-kpi">
            <text class="pc-kpi-val">{{ commercialCatCount.restaurant }}</text>
            <text class="pc-kpi-label muted">餐饮</text>
          </view>
          <view class="pc-kpi">
            <text class="pc-kpi-val">{{ commercialCatCount.bank }}</text>
            <text class="pc-kpi-label muted">银行</text>
          </view>
          <view class="pc-kpi">
            <text class="pc-kpi-val">{{ commercialCatCount.convenience }}</text>
            <text class="pc-kpi-label muted">便利店</text>
          </view>
          <view class="pc-kpi">
            <text class="pc-kpi-val">{{ Math.round(commercialAvgDist) }}</text>
            <text class="pc-kpi-label muted">均距 m</text>
          </view>
        </view>
        <view data-cross-city v-if="poiCommercialCitySummaries.length" class="muted" style="margin: 4rpx 0 4rpx; font-size: 22rpx">
          跨城 POI 密度对照
        </view>
        <view
          v-for="c in poiCommercialCitySummaries"
          :key="'pcs-' + c.cityId"
          class="pc-row"
        >
          <text class="pc-rank muted">{{ cityNameForId(c.cityId) }}</text>
          <view class="pc-mid">
            <text class="pc-name">{{ c.totalPois }} POI · {{ c.communityCount }} 小区</text>
            <text class="pc-meta muted">
              餐{{ c.categoryDistribution.restaurant }} / 银{{ c.categoryDistribution.bank }} / 便{{ c.categoryDistribution.convenience }}
              · 均 {{ Math.round(c.avgTopDistanceM) }} m
            </text>
          </view>
        </view>
        <view v-if="commercialNearestAcrossSample.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          样例小区最近生活 POI · {{ commercialNearestAcrossName }}
        </view>
        <view
          v-for="(p, idx) in commercialNearestAcrossSample"
          :key="'cna-' + p.communityId + p.poiCategory + idx"
          class="pc-row"
        >
          <text class="pc-rank muted">{{ idx + 1 }}</text>
          <view class="pc-mid">
            <text class="pc-name">{{ categoryLabel(p.poiCategory) }} · {{ p.poiName }}</text>
            <text class="pc-meta muted">{{ p.poiType || "—" }}</text>
          </view>
          <text class="pc-dist">{{ Math.round(p.distanceM) }} m</text>
        </view>
        <view v-if="commercialCategoryTopSample.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          样例小区三类最近各 1 · {{ commercialNearestAcrossName }}
        </view>
        <view
          v-for="p in commercialCategoryTopSample"
          :key="'cct-' + p.poiCategory"
          class="pc-row"
        >
          <text class="pc-rank muted">{{ categoryLabel(p.poiCategory) }}</text>
          <view class="pc-mid">
            <text class="pc-name">{{ p.poiName }}</text>
            <text class="pc-meta muted">{{ p.address || "—" }}</text>
          </view>
          <text class="pc-dist">{{ Math.round(p.distanceM) }} m</text>
        </view>
        <view v-if="commercialBankCoverage" class="muted" style="margin: 4rpx 0 8rpx; font-size: 22rpx">
          银行覆盖小区
          {{ commercialBankCoverage.bankCoveredCommunities }}/{{ commercialBankCoverage.totalCommunities }}
          （{{ (commercialBankCoverage.coverageRatio * 100).toFixed(0) }}%）
        </view>
        <view v-if="commercialCategoryStats.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          全国品类均距（派生）
        </view>
        <view
          v-for="c in commercialCategoryStats"
          :key="'pcc-' + c.category"
          class="pc-row"
        >
          <text class="pc-rank muted">{{ categoryLabel(c.category) }}</text>
          <view class="pc-mid">
            <text class="pc-name">{{ c.poiCount }} POI · {{ c.communityCount }} 小区</text>
            <text class="pc-meta muted">
              均 {{ Math.round(c.avgTopDistanceM) }} m · 最近 {{ Math.round(c.minTopDistanceM) }} m
            </text>
          </view>
        </view>
        <view class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">步行便利 Top（≤500m 加权）</view>
        <view
          v-for="(w, idx) in commercialWalkTop"
          :key="'walk-' + w.communityId"
          class="pc-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(w.communityId)"
        >
          <text class="pc-rank muted">{{ idx + 1 }}</text>
          <view class="pc-mid">
            <text class="pc-name">{{ communityDisplayName(w.communityId) }}</text>
            <text class="pc-meta muted">≤100m {{ w.nearCount100 }} · ≤200m {{ w.nearCount200 }} · ≤500m {{ w.nearCount500 }}</text>
          </view>
          <text class="pc-score">{{ w.walkScore }}</text>
        </view>
        <view v-if="commercialRestaurantNear.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          最近餐饮 Top
        </view>
        <view
          v-for="(b, idx) in commercialRestaurantNear"
          :key="'rest-' + b.communityId"
          class="pc-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(b.communityId)"
        >
          <text class="pc-rank muted">{{ idx + 1 }}</text>
          <view class="pc-mid">
            <text class="pc-name">{{ communityDisplayName(b.communityId) }}</text>
            <text class="pc-meta muted">{{ b.poiName }}</text>
          </view>
          <text class="pc-dist">{{ Math.round(b.distanceM) }} m</text>
        </view>
        <view class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">最近银行 Top</view>
        <view
          v-for="(b, idx) in commercialBankNear"
          :key="'bank-' + b.communityId"
          class="pc-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(b.communityId)"
        >
          <text class="pc-rank muted">{{ idx + 1 }}</text>
          <view class="pc-mid">
            <text class="pc-name">{{ communityDisplayName(b.communityId) }}</text>
            <text class="pc-meta muted">{{ b.poiName }}</text>
          </view>
          <text class="pc-dist">{{ Math.round(b.distanceM) }} m</text>
        </view>
        <view data-cross-city v-if="commercialBankNearestCross.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          跨城最近银行小区（派生）
        </view>
        <view
          v-for="(b, idx) in commercialBankNearestCross"
          :key="'bnx-' + b.communityId"
          class="pc-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(b.communityId)"
        >
          <text class="pc-rank muted">{{ idx + 1 }}</text>
          <view class="pc-mid">
            <text class="pc-name">{{ cityNameForId(b.cityId) }} · {{ communityDisplayName(b.communityId) }}</text>
            <text class="pc-meta muted">{{ b.poiName }}</text>
          </view>
          <text class="pc-dist">{{ Math.round(b.distanceM) }} m</text>
        </view>
        <view v-if="commercialConvenienceNear.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          最近便利店 Top
        </view>
        <view
          v-for="(b, idx) in commercialConvenienceNear"
          :key="'conv-' + b.communityId"
          class="pc-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(b.communityId)"
        >
          <text class="pc-rank muted">{{ idx + 1 }}</text>
          <view class="pc-mid">
            <text class="pc-name">{{ communityDisplayName(b.communityId) }}</text>
            <text class="pc-meta muted">{{ b.poiName }}</text>
          </view>
          <text class="pc-dist">{{ Math.round(b.distanceM) }} m</text>
        </view>
        <view v-if="commercialSevenElevenNear.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          最近 7-ELEVEn Top
        </view>
        <view
          v-for="(b, idx) in commercialSevenElevenNear"
          :key="'711-' + b.communityId"
          class="pc-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(b.communityId)"
        >
          <text class="pc-rank muted">{{ idx + 1 }}</text>
          <view class="pc-mid">
            <text class="pc-name">{{ communityDisplayName(b.communityId) }}</text>
            <text class="pc-meta muted">{{ b.poiName }}</text>
          </view>
          <text class="pc-dist">{{ Math.round(b.distanceM) }} m</text>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：poi_commercial.csv（餐饮 / 银行 / 便利店，每小区每类 Top3）。
        </view>
      </view>

      <!-- v1.121.15 菜市场/超市可达（poiMarketRanking） -->
      <view v-if="marketNearTop.length" class="card" data-tab="transit">
        <view class="row-between">
          <view class="card-title">🥬 菜市场可达 · {{ hospitalCityName }}</view>
          <view class="muted">最近 Top {{ marketNearTop.length }}</view>
        </view>
        <view
          v-for="(m, idx) in marketNearTop"
          :key="'mkt-' + m.communityId"
          class="pc-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(m.communityId)"
        >
          <text class="pc-rank muted">{{ idx + 1 }}</text>
          <view class="pc-mid">
            <text class="pc-name">{{ communityDisplayName(m.communityId) }}</text>
            <text class="pc-meta muted">{{ m.nearestName || "—" }}</text>
          </view>
          <text class="pc-dist">{{ Math.round(m.nearestDistanceM ?? 0) }} m</text>
        </view>
        <view class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">最远（覆盖偏弱）</view>
        <view
          v-for="(m, idx) in marketFarTop"
          :key="'mktf-' + m.communityId"
          class="pc-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(m.communityId)"
        >
          <text class="pc-rank muted">{{ idx + 1 }}</text>
          <view class="pc-mid">
            <text class="pc-name">{{ communityDisplayName(m.communityId) }}</text>
            <text class="pc-meta muted">{{ m.nearestName || "—" }}</text>
          </view>
          <text class="pc-dist">{{ Math.round(m.nearestDistanceM ?? 0) }} m</text>
        </view>
        <view v-if="marketDeriveNear.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          派生层最近榜（本市）
        </view>
        <view
          v-for="(m, idx) in marketDeriveNear"
          :key="'mkdn-' + m.communityId"
          class="pc-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(m.communityId)"
        >
          <text class="pc-rank muted">{{ idx + 1 }}</text>
          <view class="pc-mid">
            <text class="pc-name">{{ communityDisplayName(m.communityId) }}</text>
            <text class="pc-meta muted">{{ m.nearestName || "—" }}</text>
          </view>
          <text class="pc-dist">{{ Math.round(m.nearestDistanceM ?? 0) }} m</text>
        </view>
        <view v-if="marketNearestDetail" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          最近小区详情 · {{ communityDisplayName(marketNearestDetail.communityId) }}
        </view>
        <view v-if="marketNearestDetail" class="pc-row">
          <view class="pc-mid">
            <text class="pc-name">{{ marketNearestDetail.poiName }}</text>
            <text class="pc-meta muted">
              {{ marketNearestDetail.poiTypeCategory }} · {{ marketNearestDetail.address || "—" }}
            </text>
          </view>
          <text class="pc-dist">{{ Math.round(marketNearestDetail.distanceM) }} m</text>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：poi_market.csv（每小区最近 3 个菜市场/超市）。
        </view>
        <view v-if="marketCategoryStats.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          全国品类结构
        </view>
        <view
          v-for="c in marketCategoryStats"
          :key="'mkc-' + c.category"
          class="pc-row"
        >
          <view class="pc-mid">
            <text class="pc-name">{{ c.category }}</text>
            <text class="pc-meta muted">均距 {{ Math.round(c.avgDistanceM) }} m</text>
          </view>
          <text class="pc-dist">{{ c.count }}</text>
        </view>
      </view>

      <!-- v0.32.0 new-10 生活便利度榜 v2 (6 维: mall/park/subway/school/hospital/market) -->
      <view v-if="!isCardHidden('life-convenience') && (lifeConvenience && lifeConvenience.items.length > 0)" class="card" data-card-key="life-convenience" data-tab="transit">
        <view class="row-between">
          <view class="card-title">🧭 生活便利度 Top 小区 · {{ lifeConvenience.cityName }}</view>
          <view class="muted">Top {{ lifeConvenience.items.length }}</view>
        </view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="life-convenience"
            @click.stop="toggleCardHidden('life-convenience')"
          >✕</button>
        <view v-if="lifeConvenience.items.length === 0" class="empty">暂无数据</view>
        <view class="lc-summary muted">
          城市均分 {{ lifeConvenience.avgScore }} / 110 · 最高 {{ lifeConvenience.maxScore }} / 110
        </view>
        <view v-if="lifeCitySummary" class="muted" style="margin: 4rpx 0 8rpx; font-size: 22rpx">
          派生均分 {{ lifeCitySummary.avgScore100.toFixed(0) }}
          · 地铁近 {{ lifeCitySummary.avgSubwayNear.toFixed(1) }}
          · 菜场近 {{ lifeCitySummary.avgMarketNear.toFixed(1) }}
          <text v-if="lifeCitySummary.top"> · Top {{ lifeCitySummary.top.communityName }}</text>
        </view>
        <view data-cross-city v-if="lifeCitySummariesCross.length" class="muted" style="margin: 4rpx 0 4rpx; font-size: 22rpx">
          跨城便利均分
        </view>
        <view
          v-for="c in lifeCitySummariesCross"
          :key="'lccs-' + c.cityId"
          class="lc-row"
        >
          <view class="lc-mid">
            <view class="lc-name">{{ cityNameForId(c.cityId) }}</view>
            <view class="lc-dist muted">{{ c.communityCount }} 小区</view>
          </view>
          <view class="lc-right">
            <text class="lc-score">{{ c.avgScore100.toFixed(0) }}</text>
          </view>
        </view>
        <view
          v-for="it in lifeConvenience.items"
          :key="it.communityId"
          class="lc-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="lc-mid">
            <view class="lc-name">{{ it.communityName }}</view>
            <view class="lc-dist muted">{{ it.districtName }}</view>
          </view>
          <view class="lc-scores">
            <view class="lc-dim">
              <text class="lc-dim-label">M</text>
              <text class="lc-dim-val">{{ it.mallNear }}</text>
            </view>
            <view class="lc-dim">
              <text class="lc-dim-label">P</text>
              <text class="lc-dim-val">{{ it.parkNear }}</text>
            </view>
            <view class="lc-dim">
              <text class="lc-dim-label">S</text>
              <text class="lc-dim-val">{{ it.subwayNear }}</text>
            </view>
            <view class="lc-dim">
              <text class="lc-dim-label">X</text>
              <text class="lc-dim-val">{{ it.schoolNear }}</text>
            </view>
            <view class="lc-dim">
              <text class="lc-dim-label">Y</text>
              <text class="lc-dim-val">{{ it.hospitalNear }}</text>
            </view>
            <view class="lc-dim">
              <text class="lc-dim-label">C</text>
              <text class="lc-dim-val">{{ it.marketNear }}</text>
            </view>
          </view>
          <view class="lc-right">
            <text :class="['lc-score', lifeScoreClass(it.score100)]">{{ it.score100 }}</text>
            <view class="muted" style="font-size: 20rpx">/ 100</view>
          </view>
        </view>
        <view v-if="lifeConvenienceParetoSubway.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          高分 + 地铁近（帕累托）
        </view>
        <view
          v-for="(it, idx) in lifeConvenienceParetoSubway"
          :key="'lcp-' + it.communityId"
          class="lc-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="lc-mid">
            <view class="lc-name">{{ it.communityName }}</view>
            <view class="lc-dist muted">{{ it.districtName }} · 地铁维 {{ it.dimValue }}</view>
          </view>
          <view class="lc-right">
            <text :class="['lc-score', lifeScoreClass(it.score100)]">{{ it.score100 }}</text>
          </view>
        </view>
        <view v-if="lifeConvenienceImbalance.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          单维偏强 · 综合偏低
        </view>
        <view
          v-for="it in lifeConvenienceImbalance"
          :key="'lci-' + it.communityId"
          class="lc-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="lc-mid">
            <view class="lc-name">{{ it.communityName }}</view>
            <view class="lc-dist muted">
              {{ it.districtName }} · 强维 {{ it.strongestDim }}={{ it.strongestValue }}
            </view>
          </view>
          <view class="lc-right">
            <text :class="['lc-score', lifeScoreClass(it.score100)]">{{ it.score100 }}</text>
          </view>
        </view>
        <view v-if="lifeMarketNearTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          菜市场维度近数 Top（本市）
        </view>
        <view
          v-for="(it, idx) in lifeMarketNearTop"
          :key="'lcm-' + it.communityId"
          class="lc-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="lc-mid">
            <view class="lc-name">{{ it.communityName }}</view>
            <view class="lc-dist muted">{{ it.districtName }} · 市场维 {{ it.value }}</view>
          </view>
          <view class="lc-right">
            <text class="lc-score">{{ it.value }}</text>
          </view>
        </view>
        <view v-if="lifeDistrictTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          分区便利均分 Top（派生）
        </view>
        <view
          v-for="d in lifeDistrictTop"
          :key="'lcd-' + d.districtName"
          class="lc-row"
        >
          <view class="lc-mid">
            <view class="lc-name">{{ d.districtName }}</view>
            <view class="lc-dist muted">#{{ d.rankOverall }} · {{ d.communityCount }} 小区</view>
          </view>
          <view class="lc-right">
            <text class="lc-score">{{ d.avgScore100.toFixed(0) }}</text>
          </view>
        </view>
        <view v-if="lifeScoreTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          派生层 score100 Top
        </view>
        <view
          v-for="(it, idx) in lifeScoreTop"
          :key="'lst-' + it.communityId"
          class="lc-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="lc-mid">
            <view class="lc-name">{{ it.communityName }}</view>
            <view class="lc-dist muted">{{ it.districtName }} · #{{ idx + 1 }}</view>
          </view>
          <view class="lc-right">
            <text :class="['lc-score', lifeScoreClass(it.score100)]">{{ it.score100 }}</text>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：poi_seed.csv + poi_market.csv (高德新拉) → life_convenience.csv。
          评分维度 M=商场 P=公园 S=地铁 X=学校 Y=医院 C=菜市场。
          满分 110 (≈ score100 / 100)，按综合分降序。
        </view>
      </view>

      <!-- v0.11.0 学区溢价榜 -->
      <view v-if="schoolPremiumOverview && schoolPremiumOverview.items.length > 0" class="card" data-tab="school">
        <view class="row-between">
          <view class="card-title">学区溢价榜 · {{ schoolPremiumOverview.cityName }}</view>
          <view class="muted">Top {{ schoolPremiumOverview.items.length }}</view>
        </view>
        <view v-for="it in schoolPremiumOverview.items" :key="it.districtName" class="sp-row">
          <view class="sp-rank">
            <text :class="['sp-medal', medalClass(it.rank)]">{{ medalText(it.rank) }}</text>
          </view>
          <view class="sp-mid">
            <view class="sp-district">{{ it.districtName }}</view>
            <view class="sp-meta">
              <text>评分 {{ it.avgSchoolScore.toFixed(1) }}</text>
              <text class="muted"> · {{ it.schoolCount }} 所名校</text>
              <text class="muted"> · {{ it.listingCount }} 套</text>
            </view>
          </view>
          <view class="sp-right">
            <view :class="['sp-premium', premiumClass(it.premiumRatio)]">
              {{ formatPremium(it.premiumRatio) }}
            </view>
            <view class="muted" style="font-size: 20rpx">¥{{ formatNum(it.medianUnitPrice) }}/㎡</view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：学校评分由 latest_level_score_raw 加权；溢价 = (该区中位单价 / 全市中位单价 - 1)。
          已过滤 listings &lt; 10 套的小样本区。名校聚集区通常呈现正溢价。
        </view>
        <view v-if="schoolPremiumDistrictTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          派生层分区溢价 Top
        </view>
        <view
          v-for="(it, idx) in schoolPremiumDistrictTop"
          :key="'spd-' + it.districtName"
          class="sp-row"
        >
          <view class="sp-rank">
            <text class="sp-medal">{{ idx + 1 }}</text>
          </view>
          <view class="sp-mid">
            <view class="sp-district">{{ it.districtName }}</view>
            <view class="sp-meta">
              <text>评分 {{ it.avgSchoolScore.toFixed(1) }}</text>
              <text class="muted"> · {{ it.schoolCount }} 所 · {{ it.listingCount }} 套</text>
            </view>
          </view>
          <view class="sp-right">
            <view :class="['sp-premium', premiumClass(it.premiumRatio)]">
              {{ formatPremium(it.premiumRatio) }}
            </view>
          </view>
        </view>
        <view data-cross-city v-if="schoolPremiumDistrictCross.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          同名区跨城对照 · {{ schoolPremiumDistrictCrossName }}
        </view>
        <view
          v-for="it in schoolPremiumDistrictCross"
          :key="'spx-' + it.cityId + it.districtName"
          class="sp-row"
        >
          <view class="sp-mid">
            <view class="sp-district">{{ cityNameForId(it.cityId) }} · {{ it.districtName }}</view>
            <view class="sp-meta muted">评分 {{ it.avgSchoolScore.toFixed(1) }} · {{ it.schoolCount }} 所</view>
          </view>
          <view class="sp-right">
            <view :class="['sp-premium', premiumClass(it.premiumRatio)]">
              {{ formatPremium(it.premiumRatio) }}
            </view>
          </view>
        </view>
        <view data-cross-city v-if="schoolPremiumDistrictCitySummaries.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          跨城学区分区溢价汇总
        </view>
        <view
          v-for="c in schoolPremiumDistrictCitySummaries"
          :key="'spdcs-' + c.cityId"
          class="sp-row"
        >
          <view class="sp-mid">
            <view class="sp-district">{{ cityNameForId(c.cityId) }}</view>
            <view class="sp-meta muted">
              {{ c.districtCount }} 区 · 均分 {{ c.avgSchoolScore.toFixed(1) }}
              <text v-if="c.topDistrict"> · Top {{ c.topDistrict.districtName }}</text>
            </view>
          </view>
          <view class="sp-right">
            <view v-if="c.weightedPremiumRatio != null" :class="['sp-premium', premiumClass(c.weightedPremiumRatio)]">
              {{ formatPremium(c.weightedPremiumRatio) }}
            </view>
            <view v-else class="muted">—</view>
          </view>
        </view>
      </view>

      <!-- 小区排行（随周切换） -->
      <view id="week-ranking-card" class="card" data-tab="all,overview,price">
        <view class="row-between">
          <view class="card-title">小区周榜 Top {{ ranking.length }} · {{ app.weekEnd }}</view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="school-top-community"
            @click.stop="toggleCardHidden('school-top-community')"
          >✕</button>
          <view class="muted" v-if="rankingTotal">共 {{ rankingTotal }} 条</view>
        </view>

        <view v-if="ranking.length === 0" class="empty">暂无数据</view>
        <view
          v-for="item in ranking"
          :key="item.community_id"
          class="community-row tap-target"
          role="button"
          tabindex="0"
          hover-class="row-active"
          @click="goCommunity(item.community_id)"
        >
          <view class="community-rank">#{{ item.rank }}</view>
          <view class="community-main">
            <view class="community-name">{{ item.community_name }}</view>
            <view class="muted">
              均价 {{ formatUnitPrice(item.avg_unit_price) }} · 挂牌 {{ item.listing_count }}
            </view>
          </view>
          <view class="muted" style="font-size: 22rpx">置信 {{ coverageText(item.coverage_score) }}</view>
        </view>
      </view>

      <!-- v0.14.0 + v0.26.0 学区评分 Top 小区 (增强) -->
      <view v-if="!isCardHidden('school-top-community') && (schoolPremiumCommunityItems.length > 0)" class="card" data-card-key="school-top-community">
        <view class="row-between">
          <view class="card-title">学区评分 Top 小区 · {{ schoolPremiumCommunityItems.length }}</view>
          <view class="muted">{{ spSortLabel }}</view>
        </view>

        <!-- v0.26.0 trend-11 过滤 + 排序 -->
        <view class="spc-controls">
          <view class="spc-row">
            <text class="spc-label">区</text>
            <view class="spc-chips">
              <text
                v-for="d in spDistrictOptions"
                :key="d"
                :class="['spc-chip', spDistrictFilter.includes(d) ? 'spc-chip-on' : '']"
                @click="toggleSpDistrict(d)"
              >
                {{ d }}
              </text>
            </view>
          </view>
          <view class="spc-row">
            <text class="spc-label">最低评分</text>
            <view class="spc-chips">
              <text
                v-for="opt in spMinScoreOptions"
                :key="opt"
                :class="['spc-chip', spMinScore === opt ? 'spc-chip-on' : '']"
                @click="spMinScore = opt"
              >
                {{ opt === 0 ? '不限' : opt + '+' }}
              </text>
            </view>
          </view>
          <view class="spc-row">
            <text class="spc-label">排序</text>
            <view class="spc-chips">
              <text
                v-for="opt in spSortOptions"
                :key="opt.value"
                :class="['spc-chip', spSort === opt.value ? 'spc-chip-on' : '']"
                @click="spSort = opt.value"
              >
                {{ opt.label }}
              </text>
            </view>
          </view>
        </view>

        <view v-if="schoolPremiumCommunityItems.length === 0" class="empty">暂无数据</view>
        <view
          v-for="item in schoolPremiumCommunityItems"
          :key="item.communityId"
          class="community-row tap-target"
          role="button"
          tabindex="0"
          hover-class="row-active"
          @click="goCommunity(item.communityId)"
        >
          <view class="community-rank">
            <text :class="['sp-medal-mini', spMedalClass(item.rank)]">{{ item.rank }}</text>
          </view>
          <view class="community-main">
            <view class="community-name">{{ item.communityName }}</view>
            <view class="muted">
              {{ item.districtName }} · 评分 {{ item.avgSchoolScore.toFixed(1) }} · {{ item.schoolCount }} 所学校 · {{ item.listingCount }} 套
            </view>
          </view>
          <view class="community-sp-price">
            <text v-if="item.medianUnitPrice > 0" class="sp-up">¥{{ formatNum(item.medianUnitPrice) }}</text>
            <text v-else class="muted">—</text>
            <view class="muted" style="font-size: 20rpx">中位/㎡</view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：schools.csv (district_name) + school_indicators.csv (latest_level_score_raw)。
          支持按区过滤、最低评分筛选、4 种排序 (评分/均价/挂牌/校数)。
        </view>
        <view v-if="schoolPremiumCommunityDeriveTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          派生层学区评分 Top
        </view>
        <view
          v-for="(it, idx) in schoolPremiumCommunityDeriveTop"
          :key="'spcdt-' + it.communityId"
          class="community-row tap-target"
          hover-class="row-active"
          @click="goCommunity(it.communityId)"
        >
          <view class="community-rank">
            <text class="sp-medal-mini">{{ idx + 1 }}</text>
          </view>
          <view class="community-main">
            <view class="community-name">{{ it.communityName }}</view>
            <view class="muted">
              {{ it.districtName }} · 评分 {{ it.avgSchoolScore.toFixed(1) }} · {{ it.schoolCount }} 所
            </view>
          </view>
        </view>
        <view v-if="schoolPremiumCommunityByFocusDistrict.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          「{{ schoolPremiumFocusDistrictName }}」区内小区学区分
        </view>
        <view
          v-for="(it, idx) in schoolPremiumCommunityByFocusDistrict"
          :key="'spfd-' + it.communityId"
          class="community-row tap-target"
          hover-class="row-active"
          @click="goCommunity(it.communityId)"
        >
          <view class="community-rank">
            <text class="sp-medal-mini">{{ idx + 1 }}</text>
          </view>
          <view class="community-main">
            <view class="community-name">{{ it.communityName }}</view>
            <view class="muted">评分 {{ it.avgSchoolScore.toFixed(1) }} · {{ it.schoolCount }} 所 · {{ it.listingCount }} 套</view>
          </view>
        </view>
        <view data-cross-city v-if="schoolPremiumCommunityCitySummaries.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          跨城学区小区均分
        </view>
        <view
          v-for="c in schoolPremiumCommunityCitySummaries"
          :key="'spccs-' + c.cityId"
          class="community-row"
        >
          <view class="community-main">
            <view class="community-name">{{ cityNameForId(c.cityId) }}</view>
            <view class="muted">
              {{ c.communityCount }} 小区 · {{ c.totalListings }} 套
              <text v-if="c.topCommunity"> · Top {{ c.topCommunity.communityName }}</text>
            </view>
          </view>
          <view class="community-sp-price">
            <text class="sp-up">{{ c.avgSchoolScore.toFixed(1) }}</text>
          </view>
        </view>
        <view v-if="schoolPremiumTier" class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          学区挂牌三层一致性：
          小区合计 {{ schoolPremiumTier.communityListings }} ·
          分区合计 {{ schoolPremiumTier.districtListings }}
          <text :class="schoolPremiumTier.consistent ? 'trend-up' : 'trend-down'">
            {{ schoolPremiumTier.consistent ? " · 一致" : " · 不一致" }}
          </text>
        </view>
      </view>

      <!-- 天气快照 + 4 天预报 -->
      <view v-if="weatherResp && (weatherResp.live || weatherResp.forecast.length > 0)" class="card">
        <view class="row-between">
          <view class="card-title">🌤️ {{ weatherResp.cityName }} 天气快照</view>
          <view class="muted">
            {{ weatherResp.live?.report_time || "—" }} {{ weatherFreshLabel }}
          </view>
        </view>
        <view v-if="weatherResp.live" class="weather-live">
          <view class="weather-main">
            <text class="weather-icon">{{ weatherEmoji(weatherResp.live.weather) }}</text>
            <view class="weather-info">
              <text class="weather-temp">{{ weatherResp.live.temperature }}°C</text>
              <text class="weather-cond">{{ weatherResp.live.weather }}</text>
            </view>
          </view>
          <view class="weather-stats">
            <view class="weather-stat">
              <text class="weather-stat-label">💧 湿度</text>
              <text class="weather-stat-value">{{ weatherResp.live.humidity }}%</text>
            </view>
            <view class="weather-stat">
              <text class="weather-stat-label">💨 风力</text>
              <text class="weather-stat-value">{{ weatherResp.live.windpower }}级 {{ weatherResp.live.winddirection }}</text>
            </view>
            <view class="weather-stat">
              <text class="weather-stat-label">🌬 扩散条件</text>
              <text :class="['weather-stat-value', 'aqi-chip', aqiChipClass]">
                {{ weatherResp.aqi_estimate?.label ?? "—" }}
              </text>
            </view>
          </view>
        </view>
        <view v-if="weatherResp.forecast.length > 0" class="weather-forecast">
          <view class="forecast-title">未来 4 天预报</view>
          <view class="forecast-grid">
            <view
              v-for="(d, idx) in weatherResp.forecast"
              :key="d.date"
              class="forecast-day"
            >
              <text class="forecast-week">{{ idx === 0 ? "今天" : d.week }}</text>
              <text class="forecast-date">{{ d.date.slice(5) }}</text>
              <text class="forecast-icon">{{ weatherEmoji(d.dayweather) }}</text>
              <view class="forecast-temp">
                <text class="forecast-high">{{ d.daytemp }}°</text>
                <text class="forecast-low">/ {{ d.nighttemp }}°</text>
              </view>
              <text class="forecast-cond">{{ d.dayweather }}</text>
            </view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：高德地图 /v3/weather/weatherInfo (实况 + 4 天预报)。
          “扩散条件”按湿度、风力和温度粗略估算，不是空气质量指数。
        </view>
      </view>

      <!-- v0.17.0 listing 学区溢价榜（Top 高评分房源） -->
      <view v-if="!isCardHidden('listing-school-premium') && (listingPremiumOverview && listingPremiumOverview.items.length > 0)" class="card" data-card-key="listing-school-premium" data-tab="price">
        <view class="row-between">
          <view class="card-title">🏫 高学区评分房源 · {{ listingPremiumOverview.cityName }}</view>
          <view class="muted">Top {{ listingPremiumOverview.items.length }} / 共 {{ listingPremiumOverview.total }}</view>
        </view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="listing-school-premium"
            @click.stop="toggleCardHidden('listing-school-premium')"
          >✕</button>
        <view v-if="lspCitySummary" class="lsp-summary">
          <view class="lsp-kpi">
            <text class="lsp-kpi-val">{{ lspCitySummary.avgPremiumPct.toFixed(1) }}%</text>
            <text class="lsp-kpi-label muted">均溢价</text>
          </view>
          <view class="lsp-kpi">
            <text class="lsp-kpi-val">{{ (lspCitySummary.highPremiumShare * 100).toFixed(0) }}%</text>
            <text class="lsp-kpi-label muted">>10%</text>
          </view>
          <view class="lsp-kpi">
            <text class="lsp-kpi-val">{{ lspCitySummary.premiumListingCount }}</text>
            <text class="lsp-kpi-label muted">正溢价套</text>
          </view>
        </view>
        <view v-if="lspDist.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">溢价分布</view>
        <view v-if="lspDist.length" class="lsp-dist-row">
          <view v-for="b in lspDist" :key="b.bucket" class="lsp-bucket">
            <text class="lsp-bucket-n">{{ b.count }}</text>
            <text class="lsp-bucket-l muted">{{ b.bucket }}%</text>
            <text class="lsp-bucket-s muted">{{ (b.share * 100).toFixed(0) }}%</text>
          </view>
        </view>
        <view v-if="lspDistrictTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          分区挂牌溢价 Top
        </view>
        <view
          v-for="(d, idx) in lspDistrictTop"
          :key="'lspd-' + d.districtName"
          class="lsp-dist-item"
        >
          <text class="lsp-rank muted">{{ idx + 1 }}</text>
          <text class="lsp-dname">{{ d.districtName }}</text>
          <text class="lsp-meta muted">{{ d.listingCount }} 套 · {{ d.communityCount }} 小区</text>
          <text class="lsp-pct">{{ d.avgPremiumPct >= 0 ? "+" : "" }}{{ d.avgPremiumPct.toFixed(1) }}%</text>
        </view>
        <view v-if="lspCommunityTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          小区挂牌溢价 Top（派生）
        </view>
        <view
          v-for="(c, idx) in lspCommunityTop"
          :key="'lspc-' + c.communityId"
          class="lsp-dist-item tap-target"
          hover-class="row-active"
          @click="goCommunity(c.communityId)"
        >
          <text class="lsp-rank muted">{{ idx + 1 }}</text>
          <text class="lsp-dname">{{ communityDisplayName(c.communityId) }}</text>
          <text class="lsp-meta muted">{{ c.districtName }} · {{ c.listingCount }} 套</text>
          <text class="lsp-pct">{{ c.avgPremiumPct >= 0 ? "+" : "" }}{{ c.avgPremiumPct.toFixed(1) }}%</text>
        </view>
        <view v-if="lspCommunityByVolume.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          学区挂牌量 Top 小区（派生聚合）
        </view>
        <view
          v-for="(c, idx) in lspCommunityByVolume"
          :key="'lspv-' + c.communityId"
          class="lsp-dist-item tap-target"
          hover-class="row-active"
          @click="goCommunity(c.communityId)"
        >
          <text class="lsp-rank muted">{{ idx + 1 }}</text>
          <text class="lsp-dname">{{ communityDisplayName(c.communityId) }}</text>
          <text class="lsp-meta muted">{{ c.districtName }} · 均溢价 {{ c.avgPremiumPct.toFixed(1) }}%</text>
          <text class="lsp-pct">{{ c.listingCount }} 套</text>
        </view>
        <view
          v-for="item in listingPremiumOverview.items"
          :key="item.listingId"
          class="community-row tap-target"
          role="button"
          tabindex="0"
          hover-class="row-active"
          @click="goListing(item.listingId)"
        >
          <view class="community-rank">
            <text class="sp-medal-mini" :class="lpScoreClass(item.avgSchoolScore)">
              {{ item.avgSchoolScore.toFixed(0) }}
            </text>
          </view>
          <view class="community-main">
            <view class="community-name">{{ item.title || "—" }}</view>
            <view class="muted">
              {{ item.communityName || "—" }} · {{ item.areaSqm ? item.areaSqm.toFixed(0) + "㎡" : "—" }} ·
              {{ item.schoolCount }} 所学校
            </view>
          </view>
          <view class="community-sp-price">
            <text :class="['sp-up', item.premiumRatioEst >= 0 ? 'price-up' : 'price-down']">
              {{ item.premiumRatioEst >= 0 ? "+" : "" }}{{ item.premiumRatioEst.toFixed(1) }}%
            </text>
            <view class="muted" style="font-size: 20rpx">区溢价</view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          分布/分区派生：listingSchoolPremiumRanking。房源列表同前（listings + schools + school_indicators）。
        </view>
      </view>

      <!-- v0.19.0 商业热度榜 (小区维度) -->
      <view v-if="!isCardHidden('commercial-heat') && (commercialResp && commercialResp.items.length > 0)" class="card" data-card-key="commercial-heat" data-tab="transit">
        <view class="row-between">
          <view class="card-title">🛒 商业热度 Top {{ commercialResp.items.length }} · {{ commercialResp.cityName }}</view>
          <view class="muted">共 {{ commercialResp.total }} 个小区上榜</view>
        </view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="commercial-heat"
            @click.stop="toggleCardHidden('commercial-heat')"
          >✕</button>
        <view v-if="commercialDistrictTop.length" class="muted" style="margin: 0 0 4rpx; font-size: 22rpx">
          分区均分 Top
        </view>
        <view
          v-for="d in commercialDistrictTop"
          :key="'cd-' + d.districtName"
          class="cd-row"
        >
          <text class="cd-rank muted">{{ d.rankOverall }}</text>
          <text class="cd-name">{{ d.districtName }}</text>
          <text class="cd-meta muted">{{ d.communityCount }} 小区</text>
          <text class="cd-score">{{ d.avgCommercialScore.toFixed(0) }}</text>
        </view>
        <view
          v-for="item in commercialResp.items"
          :key="item.communityId"
          class="community-row tap-target"
          role="button"
          tabindex="0"
          hover-class="row-active"
          @click="goCommunity(item.communityId)"
        >
          <view class="community-rank">
            <text class="sp-medal-mini" :class="spMedalClass(item.rank)">
              {{ item.rank }}
            </text>
          </view>
          <view class="community-main">
            <view class="community-name">{{ item.communityName }}</view>
            <view class="muted">
              {{ item.districtName }} ·
              🍴{{ item.restaurantCount }} 🏦{{ item.bankCount }} 🏪{{ item.convenienceCount }}
            </view>
          </view>
          <view class="community-sp-price">
            <text :class="['sp-up', commercialScoreClass(item.commercialScore)]">
              {{ item.commercialScore.toFixed(0) }}
            </text>
            <view class="muted" style="font-size: 20rpx">商业分</view>
          </view>
        </view>
        <view v-if="commercialDensityCity.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          餐饮密度×距离分桶（≥2.5 家 / ≤200m）
        </view>
        <view v-if="commercialDensityCity.length" class="dens-grid">
          <view v-for="b in commercialDensityCity" :key="b.bucket" class="dens-cell">
            <text class="dens-n">{{ b.count }}</text>
            <text class="dens-l muted">{{ b.bucket }}</text>
            <text v-if="b.communities[0]" class="dens-ex muted">
              例：{{ b.communities[0].communityName }}
            </text>
          </view>
        </view>
        <view v-if="commercialNearestRestaurant.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          最近饭店小区 Top（派生）
        </view>
        <view
          v-for="(it, idx) in commercialNearestRestaurant"
          :key="'cnr-' + it.communityId"
          class="community-row tap-target"
          hover-class="row-active"
          @click="goCommunity(it.communityId)"
        >
          <view class="community-rank">
            <text class="sp-medal-mini">{{ idx + 1 }}</text>
          </view>
          <view class="community-main">
            <view class="community-name">{{ it.communityName }}</view>
            <view class="muted">{{ it.districtName }} · 最近饭店 {{ Math.round(it.nearestRestaurantM ?? 0) }} m</view>
          </view>
          <view class="community-sp-price">
            <text :class="['sp-up', commercialScoreClass(it.commercialScore)]">
              {{ it.commercialScore.toFixed(0) }}
            </text>
          </view>
        </view>
        <view v-if="commercialScoreTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          派生层商业分 Top
        </view>
        <view
          v-for="(it, idx) in commercialScoreTop"
          :key="'cst-' + it.communityId"
          class="community-row tap-target"
          hover-class="row-active"
          @click="goCommunity(it.communityId)"
        >
          <view class="community-rank">
            <text class="sp-medal-mini">{{ idx + 1 }}</text>
          </view>
          <view class="community-main">
            <view class="community-name">{{ it.communityName }}</view>
            <view class="muted">
              {{ it.districtName }} · 餐{{ it.restaurantCount }} / 银{{ it.bankCount }} / 便{{ it.convenienceCount }}
            </view>
          </view>
          <view class="community-sp-price">
            <text :class="['sp-up', commercialScoreClass(it.commercialScore)]">
              {{ it.commercialScore.toFixed(0) }}
            </text>
          </view>
        </view>
        <view data-cross-city v-if="commercialCitySummary.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          跨城商业均分对照
        </view>
        <view
          v-for="c in commercialCitySummary"
          :key="'ccs-' + c.cityId"
          class="community-row"
        >
          <view class="community-main">
            <view class="community-name">{{ cityNameForId(c.cityId) }}</view>
            <view class="muted">{{ c.communityCount }} 小区 · 均近餐 {{ Math.round(c.avgNearestRestaurantM ?? 0) }} m</view>
          </view>
          <view class="community-sp-price">
            <text :class="['sp-up', commercialScoreClass(c.avgCommercialScore)]">
              {{ c.avgCommercialScore.toFixed(0) }}
            </text>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          分区均分 / 密度分桶：communityCommercialRanking。「高密度远」可能是门口空、远处扎堆。
        </view>
      </view>

      <!-- v0.20.0 trend-8: 同区多小区对比 (点区/板块对比 区名后展示) -->
      <view v-if="!isCardHidden('multi-community-compare') && (districtCompareResp && districtCompareResp.items.length > 0)" class="card" data-card-key="multi-community-compare" data-tab="school">
        <view class="row-between">
          <view class="card-title">📊 {{ districtCompareResp.districtName }} · {{ districtCompareResp.cityName }} 小区对比</view>
          <view class="muted tap-target" @click="closeDistrictCompare">✕ 关闭</view>
        </view>
          <button
            class="card-hide-btn"
            hover-class="tap-row--active"
            data-dash-card-hide="multi-community-compare"
            @click.stop="toggleCardHidden('multi-community-compare')"
          >✕</button>
        <view class="muted" style="font-size: 22rpx; margin-bottom: 8rpx">
          均价柱状图 ({{ districtCompareResp.weekEnd }} 周快照 · 共 {{ districtCompareResp.total }} 个小区)
        </view>
        <view
          v-for="it in districtCompareResp.items"
          :key="it.communityId"
          class="bar-row tap-target"
          role="button"
          tabindex="0"
          hover-class="row-active"
          @click="goCommunity(it.communityId)"
        >
          <view class="bar-name">{{ it.communityName }}</view>
          <view class="bar-track">
            <view
              class="bar-fill"
              :style="{ width: districtBarPct(it, districtMaxPrice()) + '%' }"
            ></view>
          </view>
          <view class="bar-value">
            {{ it.avgUnitPrice ? formatNum(it.avgUnitPrice) + " 元/㎡" : "—" }}
          </view>
        </view>
        <view
          v-if="districtCompareResp.items[0] && districtCompareResp.items[0].listingCount < 3"
          class="muted"
          style="margin-top: 8rpx; font-size: 22rpx"
        >
          ⚠️ 部分小区挂牌数少于 3 套，单价仅供参考
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：listings.csv (按社区+周聚合均价 + 挂牌数)。点击柱条 → 小区详情。
        </view>
      </view>

      <!-- 进阶分析：入口进独立页，禁止本页折叠展开 -->
      <view v-if="activeTab === 'overview'" class="card advanced-section" data-dash-advanced-section>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">📊 进阶分析</view>
          <view class="muted">{{ advancedCardCount }} 张 · 独立页</view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          深度可视化 / 数据工具已迁出总览。点下方进页查看，不在本页折叠长滚。
        </view>
        <view class="advanced-actions">
          <button
            class="advanced-expand-btn"
            size="mini"
            hover-class="tap-row--active"
            data-dash-advanced-trend
            @click.stop="goTrendAnalysis"
          >深度可视化分析</button>
          <button
            class="advanced-expand-btn"
            size="mini"
            hover-class="tap-row--active"
            data-dash-advanced-tools
            @click.stop="goDataTools"
          >数据工具</button>
        </view>
      </view>

    <!-- 内置 popup：城市/周期/来源/指标选择 -->
    <view v-if="sheet.open" class="sheet-mask" @click="closeSheet">
      <view class="sheet" @click.stop>
        <view class="sheet-title">{{ sheet.title }}</view>
        <scroll-view scroll-y class="sheet-list">
          <view
            v-for="(label, idx) in sheet.items"
            :key="idx"
            class="sheet-item tap-target"
            :class="{ 'sheet-item--active': idx === sheet.currentIndex }"
            role="button"
            tabindex="0"
            hover-class="row-active"
            @click="sheetPick(idx)"
          >
            <text>{{ label }}</text>
            <text v-if="idx === sheet.currentIndex" class="sheet-check">✓</text>
          </view>
        </scroll-view>
        <view class="sheet-cancel" @click="closeSheet">取消</view>
      </view>
    </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { resolvedThemeRef as realtyTheme } from "../../utils/theme";
import { DASHBOARD_GUIDE_KEY, shouldShowDashboardGuide } from "../../utils/dashboardGuide";
import MacroKpiCell from "../../components/MacroKpiCell.vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import { useAppStore } from "../../store/app";
import { toErrorMessage } from "../../utils/errorMessage";
import { getCities, getCoverage, getPeriods, getRuntimeMeta, getSources } from "../../local/queries";
import { getCommunityRanking, getDistrictCompare, getCityDistrictOverview, getWangqianHeatmap, getSchoolPremiumRank, getSchoolPremiumCommunityRank, getWeather, getTopListingsBySchoolPremium, getCommercialRanking, getCommunityCompareByDistrict, getDistrictWangqianRank, getCommuteRanking, getLayoutDistribution, getListingTagCloud, getDistrictIndex, getDistrictChangeRank, getLifeConvenienceRank, getCommunityScoreRank, getMetroWalkRanking, getMetroBenefitRanking,
  getListingFreshnessRanking,
  getDistrictMap,
  getSchoolDimensions,
  getLprOverview,
  type SchoolDimResponse,
  type LprResponse,
  type DistrictTrendItem, type WangqianOverviewItem, type SchoolPremiumOverview, type SchoolPremiumCommunityItem, type WeatherResponse, type ListingSchoolPremiumOverview, type CommercialRankingResponse, type DistrictCommunityCompareResponse, type DistrictWangqianRankResponse, type CommuteRankingResponse, type LayoutDistributionResponse, type TagCloudResponse, type DistrictIndexResponse, type DistrictChangeResponse, type LifeConvenienceResponse, type CommunityScoreResponse, type MetroWalkResponse, type MetroBenefitResponse, type DistrictMetaResponse, type FeaturePremiumResponse, type TagCombinationResponse, type ListingFreshnessResponse, type DistrictMapResponse } from "../../local/queries";
import {
  getLatestIndexForCity,
  getLatestMonth,
  type LatestIndexForCity
} from "../../local/stats70";
import {
  getStats70TopByTypeByMonth,
  getStats70CurrentCityNationalRank,
  getStats70CityTrendDirection,
  getStats70CrossCityByCityCount,
  getStats70CityOver12MonthChange,
  getStats70CrossCityByMonthSpread,
  getStats70LatestMonth as getStats70LatestMonthTrend,
  getStats70MonthOptions,
  getStats70LatestByCity,
  type City12MonthPoint,
  type MonthSpreadEntry,
  type CityLatestIndex
} from "../../local/stats70TrendAnalysis";
import {
  getLprLatest,
  getLprDelta,
  summarizeLprByYear,
  getLprLongestFlatStreak,
  getLprDownwardCumulative,
  summarizeLprSpread,
  detectLprCutCycles,
  summarizeLprCurrentVsYearAgo,
  getLprMonthlyAverage,
  getLprByYear,
  getLprRange,
  type LprSpreadSnapshot,
  type LprCycle
} from "../../local/lprHistoryAnalysis";
import {
  getLatestCityDaily,
  type CityDailySnapshot
} from "../../local/dailyWangqian";
import { hasStats70, hasDailyWangqian, getWangqianDistrictWeekly } from "../../local/store";
import {
  getWangqianWeeklyWoWChange,
  getWangqianWeeklyRecentSpikes,
  getWangqianWeeklyVolatility,
  getWangqianWeeklyByCityCategoryTrend,
  summarizeWangqianWeeklyByDistrict,
  type DistrictWoWChange,
  type DistrictSpike,
  type DistrictVolatility,
  type CityCategoryTrend,
  type DistrictWeeklySummary
} from "../../local/wangqianTrendRanking";
import {
  listingMedianUnitPriceLabel,
  priceAxesDisclaimer
} from "../../local/priceSemantics";
import { summarizeListingTrust } from "../../local/listingTrustSummary";
import { assessStats70Freshness } from "../../local/stats70Freshness";
import * as store from "../../local/store";
import {
  summarizeHospitalByCity,
  summarizeHospitalByCityDistrict,
  getHospitalTopByLevelByCity,
  getHospitalKeyFlagByCity,
  getHospitalByCityByType,
  getHospitalCrossCityByDistrict,
  getHospitalByCityByDistrict,
  type CityHospitalSummary,
  type CityDistrictHospitalSummary,
  type CrossCityHospitalEntry
} from "../../local/hospitalRanking";
import {
  summarizeHospitalGeoByCity,
  getHospitalGeoByCityHighConfidenceRatio,
  getHospitalGeoByCityNearestPair,
  getHospitalGeoByCityAddressDistrict,
  getHospitalGeoCoverageStats,
  detectHospitalGeoDuplicateAmapPoi,
  getHospitalGeoByCityWithinRadius,
  getHospitalGeoCrossCityByCityPairDistance,
  getHospitalGeoByCityByConfidence,
  summarizeHospitalGeoByConfidence,
  type CityHospitalGeoSummary,
  type HospitalGeoHighConfidenceRatio,
  type HospitalGeoNearestPair,
  type HospitalGeoDistrictSummary,
  type HospitalGeoCoverageStats,
  type HospitalGeoWithinRadius,
  type CrossCityHospitalDistance,
  type HospitalGeoConfidenceSummary
} from "../../local/hospitalGeoAnalysis";
import {
  getPoiCommercialByCommunityWalkScore,
  getPoiCommercialCrossCommunityByCategoryDistance,
  getPoiCommercialByCityBankCoverage,
  getPoiCommercialByCityConvenienceLeaderboard,
  getPoiCommercialByCityRestaurantNearestByCommunity,
  getPoiCommercialByPoiTypeLeaderboard,
  summarizePoiCommercialByCategory,
  summarizePoiCommercialByCity,
  getPoiCommercialByCommunityNearestAcross,
  getPoiCommercialByCommunityTopByCategory,
  getPoiCommercialByCityBankNearestByCommunity,
  type WalkScore,
  type CommunityBankNearest,
  type CityBankCoverage,
  type PoiTypeLeaderboardEntry,
  type CategoryPoiCommercialSummary,
  type CityPoiCommercialSummary,
  type CommunityCategoryTop
} from "../../local/poiCommercialRanking";
import {
  summarizePoiMarketByCommunity,
  getPoiMarketByCategoryRanking,
  getPoiMarketNearestByCommunity,
  getPoiMarketDistanceLeaderboard,
  type CommunityPoiMarketSummary,
  type MarketCategoryStat,
  type NearestMarketEntry
} from "../../local/poiMarketRanking";
import {
  getDistributionCrossCityLeaderboard,
  getDistributionShareLeaderboard,
  getDistributionTopByMedianPrice,
  getDistributionByCityDimension,
  summarizeDistributionByCity,
  type CrossCityBucketEntry,
  type CrossCityShareEntry,
  type DistributionRow,
  type CityDistributionSummary
} from "../../local/distributionRanking";
import {
  getLifeConveniencePareto,
  getLifeConvenienceDimensionBalance,
  getLifeConvenienceByDimensionCoverage,
  getLifeConvenienceByCityDistrict,
  getLifeConvenienceTopByScore,
  summarizeLifeConvenienceByCity,
  type ParetoEntry,
  type DimensionImbalance,
  type DimensionCoverageEntry,
  type DistrictLifeConvenienceSummary,
  type CityLifeConvenienceSummary
} from "../../local/lifeConvenienceRanking";
import {
  getCommunityScatterByCityTotalPriceExtremes,
  getCommunityScatterPareto,
  getCommunityScatterByAreaCohort,
  getCommunityScatterByQuadrant,
  getCommunityScatterCrossCityByQuadrant,
  summarizeCommunityScatterByCity,
  summarizeCommunityScatterByCityQuadrant,
  summarizeCommunityScatterByCityAreaCohort,
  type TotalPriceExtreme,
  type ParetoEntry as ScatterParetoEntry,
  type CrossCityQuadrantEntry,
  type CityCommunityScatterSummary,
  type QuadrantSummary,
  type AreaCohortSummary
} from "../../local/communityScatterRanking";
import {
  getCommuteByCityFastestSlowestCompare,
  getCommuteSpeedLeaderboard,
  getCommuteFastestTopN,
  summarizeCommuteByCity,
  type FastestSlowestCompare,
  type CityCommuteSummary
} from "../../local/commuteRanking";
import {
  getFreshestCommunityTopN,
  getStalestCommunityTopN,
  summarizeListingFreshnessByCity,
  type FreshnessRankingEntry,
  type CityFreshnessSummary
} from "../../local/listingFreshnessRanking";
import {
  getCommunityScorePareto,
  getCommunityScoreByCommuteFastest,
  getCommunityScoreByDimensionTopN,
  getCommunityScoreByTotalTopN,
  summarizeCommunityScoreByCity,
  type CommunityScoreCitySummary
} from "../../local/communityScoreRanking";
import {
  summarizeListingTagsByCity,
  getCityTagSignature,
  getTagPenetrationCompare,
  type CityTagSummary,
  type TagSignatureEntry,
  type TagPenetration
} from "../../local/listingTagsComparison";
import {
  summarizeAdminDistrictByCity,
  summarizeAdminDistrictBySuffixType,
  summarizeAdminDistrictBySuffix,
  getAdminDistrictByCityOrderedByCode,
  detectAdminDistrictCodeGaps,
  classifyAdminDistrictSuffix,
  getAdminDistrictByCityCrossReference,
  getAdminDistrictByNameLike,
  getAdminDistrictCrossCityByNameLike,
  type CityAdminDistrictSummary,
  type CitySuffixTypeCount,
  type AdminDistrictCodeGap,
  type AdminDistrictSuffixType,
  type AdminMetroCrossRef,
  type SuffixUsage
} from "../../local/adminDistrictRanking";
import {
  summarizeListingSchoolPremiumByCity,
  getListingSchoolPremiumDistribution,
  getListingSchoolPremiumByCityDistrict,
  getListingSchoolPremiumByCommunityLeaderboard,
  aggregateListingSchoolPremiumByCommunity,
  type CitySchoolPremiumSummary,
  type PremiumBucket,
  type DistrictPremiumSummary,
  type CommunityPremiumAggregate
} from "../../local/listingSchoolPremiumRanking";
import {
  getCityByCompositeRank,
  type CityTopComposite
} from "../../local/schoolDimensionRanking";
import {
  getSchoolPremiumThreeTierConsistency,
  getSchoolPremiumDistrictByCityTop,
  getSchoolPremiumDistrictCrossCityByDistrict,
  getSchoolPremiumCommunityTopByScore,
  summarizeSchoolPremiumCommunityByCity,
  summarizeSchoolPremiumDistrictByCity,
  getSchoolPremiumCommunityByDistrict,
  type ThreeTierConsistency,
  type CrossCityDistrictEntry,
  type CitySchoolPremiumCommunitySummary,
  type CitySchoolPremiumDistrictSummary
} from "../../local/schoolPremiumRanking";
import {
  getCommunityCommercialByCityDistrict,
  getCommunityCommercialDensityVsDistance,
  getCommunityCommercialByNearest,
  getCommunityCommercialByScoreTopN,
  summarizeCommunityCommercialByCity,
  type DistrictCommercialSummary,
  type DensityDistanceBucket,
  type CityCommercialSummary
} from "../../local/communityCommercialRanking";
import {
  getListingKeywordsByCity,
  getListingKeywordsCrossCity,
  type ListingKeywordRow
} from "../../local/listingKeyword";
import {
  getOrientationFloorBestWorstByCity,
  getOrientationFloorByOrientationLeaderboard,
  getOrientationFloorCrossCityByPair,
  getOrientationFloorByCityOrientation,
  getOrientationFloorByCityFloorBucket,
  summarizeOrientationFloorByCity,
  type CityOrientationFloorTopEntry,
  type CrossCityOrientationFloorEntry,
  type CityOrientationFloorSummary
} from "../../local/orientationFloorRanking";
import type { LocalHospital, LocalAdminDistrict, LocalLayoutDistribution, LocalFeaturePremium, LocalOrientationFloor, LocalTagCombination, LocalCommunityScore, LocalSchoolPremiumDistrict, LocalSchoolPremiumCommunity, LocalMetroLine, LocalCommunityScatter, LocalCommunityCommercial, LocalCommute, LocalLprRow, LocalLifeConvenience, LocalHospitalGeo, LocalPoiCommercial, LocalMetroLineGeo } from "../../local/types";
import { refreshFromRemote } from "../../local/dataRefresher";
import { refreshWangqianFromRemote } from "../../local/wangqianDataRefresher";
import type {
  CityItem,
  CommunityRankingItem,
  CoverageResponse,
  DistrictCompareItem,
  RuntimeMetaResponse,
  SourceStatItem
} from "../../api/contracts";
import { coverageText, formatMacro100m, formatMacroArea, formatMacroPct, formatMacroYuan, formatUnitPrice, macroTrendBand, macroTrendClass, showToast, daysAgoFromToday } from "../../utils/format";
import { SNAPSHOT_UPDATED_EVENT } from "../../config";
import {
  getLatestNbsRealEstate,
  getNbsImpliedContractUnitPrice,
  getNbsImpliedResidentialUnitPrice,
  getNbsImpliedInventoryMonths,
  getNbsImpliedInventoryMonthsTrend,
  getNbsImpliedUnitPriceTrend,
  getNbsResidentialConstructionSharePct,
  getNbsYoyTrend
} from "../../local/nbsRealEstate";
import { getGzInventoryOverview, getGzInventoryDayDelta, topDistrictAvailableSharePct, districtAvailableSharePct } from "../../local/gzNewHouseInventory";
import {
  getLatestSzPlannedSupply,
  getSzSupplyQoQDelta,
  formatSzSupplyPeriod,
  residentialSharePct,
  type SzPlannedSupplyRow
} from "../../local/szPlannedSupply";
import {
  getLatestGzHousingPlan,
  getGzHousingPlanYoY,
  type GzHousingPlanRow
} from "../../local/gzHousingPlan";
import {
  getLatestGzAffordableRaised,
  getLatestGzAffordableCompleted,
  getLatestGzAffordableShantytownCompleted,
  type GzAffordableProjectsRow
} from "../../local/gzAffordableProjects";
import {
  getLatestGzAffordableTargetRaised,
  getLatestGzAffordableTargetCompleted,
  resolveTargetWithProjectsActual,
  progressPct,
  type GzAffordableTargetRow
} from "../../local/gzAffordableTargets";
import {
  getLatestGzLandDeals,
  summarizeGzLandDeals,
  summarizeGzLandDealsByMonth,
  landSurfaceUnitPriceYuan,
  type GzLandDeal
} from "../../local/gzLandDeals";
import {
  getLatestSzLandDeals,
  summarizeSzLandDeals,
  summarizeSzLandDealsByMonth,
  landStartSurfaceUnitPriceYuan,
  type SzLandDeal
} from "../../local/szLandDeals";
import {
  getLatestSzAffordableRaised,
  getLatestSzAffordableCompleted,
  type SzAffordableProjectsRow
} from "../../local/szAffordableProjects";
import {
  getLatestZhAffordableProgress,
  getZhAffordableProgressMoM,
  type ZhAffordableProgressRow
} from "../../local/zhAffordableProgress";
import {
  formatZhBdcPeriod,
  getLatestZhBdcByKind,
  getZhBdcDistrictsFor,
  getZhBdcResidentialQoQ,
  type ZhBdcRegistrationRow
} from "../../local/zhBdcRegistration";
import {
  getZhPriceFilingSummary,
  type ZhPriceFilingSummary
} from "../../local/zhPriceFiling";
import { assessGzInventoryFreshness } from "../../local/gzInventoryFreshness";
import {
  HOME_CHANNELS,
  HOME_KINGKONG,
  HOME_SEARCH_MODES,
  homeLandEntryOwner,
  homeSupplyEntryOwner,
  resolveHomeScrollAnchor,
  resolveHomeSearch,
  setPendingSchoolQuery,
  setPendingListingQuery,
  type HomeChannel,
  type HomeKingkongItem,
  type HomeScrollAvailability,
  type HomeSearchMode
} from "../../local/homeEntry";
import {
  dashTabSwitchFeedback,
  type DashTabKey
} from "../../local/dashTabs";
import { getLatestProvidentFundRate, monthlyPayment } from "../../local/providentFund";
import {
  getLatestSzProvidentAnnual,
  getSzProvidentYearDelta,
  extractToDepositPct,
  loanToDepositBalancePct,
  type SzProvidentAnnualRow
} from "../../local/szProvidentAnnual";
import {
  getLatestGzProvidentAnnual,
  gzExtractToDepositPct,
  gzLoanToDepositBalancePct,
  type GzProvidentAnnualRow
} from "../../local/gzProvidentAnnual";
import {
  getLatestGdProvidentAnnual,
  gdExtractToDepositPct,
  gdLoanToDepositBalancePct,
  type GdProvidentAnnualRow
} from "../../local/gdProvidentAnnual";
import {
  getLatestZhProvidentDynamics,
  getLatestZhProvidentFullYear,
  formatZhProvidentPeriod,
  getZhProvidentSamePeriodDelta,
  type ZhProvidentDynamicsRow
} from "../../local/zhProvidentDynamics";
const app = useAppStore();

// v1.121.145 Batch 6: 首页卡片个性化（设置入口 → 数据工具页"首页卡片管理"）
const hiddenCards = ref<Set<string>>(new Set());
const HIDDEN_CARDS_KEY = "realty_dashboard_hidden_cards";
function loadHiddenCards() {
  try {
    const raw = uni.getStorageSync(HIDDEN_CARDS_KEY);
    if (typeof raw === "string" && raw.length > 0) {
      const arr = JSON.parse(raw) as string[];
      hiddenCards.value = new Set(arr);
    }
  } catch (e) {
    console.warn("loadHiddenCards failed:", e);
  }
}
function saveHiddenCards() {
  try {
    uni.setStorageSync(HIDDEN_CARDS_KEY, JSON.stringify([...hiddenCards.value]));
  } catch (e) {
    console.warn("saveHiddenCards failed:", e);
  }
}
function isCardHidden(key: string): boolean {
  return hiddenCards.value.has(key);
}
function toggleCardHidden(key: string) {
  const s = new Set(hiddenCards.value);
  if (s.has(key)) s.delete(key);
  else s.add(key);
  hiddenCards.value = s;
  saveHiddenCards();
}

// v1.121.147 Batch 8: 精简/完整模式 + 进阶分析区块
const FEATURED_MODE_KEY = "realty_dashboard_featured_mode";
const ADVANCED_EXPANDED_KEY = "realty_dashboard_advanced_expanded";
const featuredMode = ref<boolean>(true);  // 默认精简模式
const advancedExpanded = ref<boolean>(false);  // 默认折叠
const ADVANCED_CARDS: { key: string; label: string; hint: string; hot?: boolean }[] = [
  { key: "bedroom-area-heatmap", label: "户型×面积 热图", hint: "bedroomAreaDistribution 联合分布" },
  { key: "orientation-floor-matrix", label: "朝向×楼层 溢价", hint: "orientationFloorMatrix 朝向×楼层溢价" },
  { key: "decorate-age-matrix", label: "装修×楼龄 溢价", hint: "decorateAgeMatrix 装修×楼龄溢价" },
  { key: "community-scatter", label: "总价×单价 散点", hint: "communityScatter 双轴散点可视化" },
  { key: "district-map", label: "行政区+社区 地图", hint: "districtMap 地图聚合 marker/count/price/school/metro 模式", hot: true },
  { key: "school-dim-weighted", label: "学区指标加权", hint: "schoolDimensions 加权细分明细", hot: true },
  { key: "macro-lpr-card", label: "LPR+房贷利率", hint: "LPR 1y/5y + 房贷利率快照", hot: true },
  { key: "hospital-rank", label: "医疗资源榜", hint: "hospitalRanking 周边医院" },
  { key: "commercial-heat", label: "商业热度榜", hint: "commercialRanking 小区维度", hot: true },
  { key: "school-top-community", label: "学区评分 Top 小区", hint: "schoolPremiumCommunityItems Top 评分小区", hot: true },
  { key: "listing-school-premium", label: "Listing 学区溢价", hint: "listingPremiumOverview 房源学区溢价" },
  { key: "stats70-drift", label: "70 城涨跌 Top", hint: "stats70 城市 12 月同比趋势" },
  { key: "lpr-mortgage-signal", label: "LPR 与房贷利率信号", hint: "lprOverview 信号卡" },
  { key: "district-wangqian-3cat", label: "区级网签 (新房/二手/全部)", hint: "districtWangqianRank 三品类 tab", hot: true }
];
const advancedCardCount = computed(() => ADVANCED_CARDS.length);
function toggleFeaturedMode() {
  featuredMode.value = !featuredMode.value;
  try {
    uni.setStorageSync(FEATURED_MODE_KEY, JSON.stringify(featuredMode.value));
  } catch (e) {
    console.warn("saveFeaturedMode failed:", e);
  }
}
function expandAdvancedCards() {
  advancedExpanded.value = true;
  try {
    uni.setStorageSync(ADVANCED_EXPANDED_KEY, JSON.stringify(true));
  } catch (e) {
    console.warn("saveAdvancedExpanded failed:", e);
  }
}
function loadUiState() {
  try {
    const raw = uni.getStorageSync(FEATURED_MODE_KEY);
    if (typeof raw === "string" && raw.length > 0) {
      featuredMode.value = JSON.parse(raw) as boolean;
    }
    const raw2 = uni.getStorageSync(ADVANCED_EXPANDED_KEY);
    if (typeof raw2 === "string" && raw2.length > 0) {
      advancedExpanded.value = JSON.parse(raw2) as boolean;
    }
  } catch (e) {
    console.warn("loadUiState failed:", e);
  }
}

// v1.121.150 Batch 11: 首页使用指南 banner
// 首帧必须同步读 storage：默认 true 会先画出浅色渐变卡，启动后上半截必闪白
const showGuide = ref<boolean>(shouldShowDashboardGuide());
function dismissGuide() {
  showGuide.value = false;
  try {
    uni.setStorageSync(DASHBOARD_GUIDE_KEY, JSON.stringify(true));
  } catch (e) {
    console.warn("saveGuideDismissed failed:", e);
  }
}

const cities = ref<CityItem[]>([]);
const periods = ref<string[]>([]);
const sourceOptions = ref<SourceStatItem[]>([]);
const runtime = ref<RuntimeMetaResponse | null>(null);
const coverage = ref<CoverageResponse | null>(null);

const ranking = ref<CommunityRankingItem[]>([]);
const rankingTotal = ref<number>(0);
const districtItems = ref<DistrictCompareItem[]>([]);
const trendItems = ref<DistrictTrendItem[]>([]);
const wangqianOverview = ref<WangqianOverviewItem | null>(null);
// v0.23.0 trend-9: 全品类区级网签热度榜 (tab 切换)
const districtWangqianRank = ref<DistrictWangqianRankResponse | null>(null);
const wqRankCat = ref<"新房" | "二手" | "全部">("全部");
// v0.24.0 new-5: 通勤时长榜
const commuteRanking = ref<CommuteRankingResponse | null>(null);
const commuteSplit = computed<FastestSlowestCompare | null>(() =>
  getCommuteByCityFastestSlowestCompare().find((x) => x.cityId === app.cityId) ?? null
);
const commuteSpeedTop = computed(() =>
  getCommuteSpeedLeaderboard(app.cityId, 5).map((x) => ({
    ...x,
    communityName: store.getCommunityById(x.communityId)?.communityName ?? `#${x.communityId}`
  }))
);
const commuteFastestTop = computed<LocalCommute[]>(() =>
  getCommuteFastestTopN(app.cityId, 5)
);
const commuteCitySummaries = computed<CityCommuteSummary[]>(() =>
  summarizeCommuteByCity()
);
const layoutDistribution = ref<LayoutDistributionResponse | null>(null);
const tagCloud = ref<TagCloudResponse | null>(null);
const tagCloudFilteredHint = ref<string>("");
const districtIndex = ref<DistrictIndexResponse | null>(null);
const districtChange = ref<DistrictChangeResponse | null>(null);
const lifeConvenience = ref<LifeConvenienceResponse | null>(null);
const communityScore = ref<CommunityScoreResponse | null>(null);

// v1.121.12 医疗资源（同步派生，跟 cityId）
const hospitalCitySummary = computed<CityHospitalSummary | null>(() => {
  const all = summarizeHospitalByCity();
  return all.find((x) => x.cityId === app.cityId) ?? null;
});
const hospitalCityName = computed(() => cityNameForId(app.cityId));
const hospitalDistrictTop = computed<CityDistrictHospitalSummary[]>(() =>
  summarizeHospitalByCityDistrict(app.cityId).slice(0, 6)
);
const hospitalTopList = computed<LocalHospital[]>(() =>
  getHospitalTopByLevelByCity(app.cityId, 5)
);
const hospitalKeyList = computed<LocalHospital[]>(() =>
  getHospitalKeyFlagByCity(app.cityId).slice(0, 5)
);
const hospitalTcmList = computed<LocalHospital[]>(() =>
  getHospitalByCityByType(app.cityId, "中医医院").slice(0, 5)
);
const hospitalMaternityList = computed<LocalHospital[]>(() =>
  getHospitalByCityByType(app.cityId, "妇幼保健院").slice(0, 5)
);
const hospitalSpecialtyList = computed<LocalHospital[]>(() =>
  getHospitalByCityByType(app.cityId, "专科医院").slice(0, 5)
);
const hospitalDistrictCrossName = computed(
  () => hospitalDistrictTop.value[0]?.districtName ?? ""
);
const hospitalDistrictCross = computed<CrossCityHospitalEntry[]>(() => {
  const name = hospitalDistrictCrossName.value;
  if (!name) return [];
  return getHospitalCrossCityByDistrict(name);
});
const hospitalFocusDistrictList = computed<LocalHospital[]>(() => {
  const name = hospitalDistrictCrossName.value;
  if (!name) return [];
  return getHospitalByCityByDistrict(app.cityId, name).slice(0, 5);
});

// v1.121.15 医院坐标覆盖
const hospitalGeoSummary = computed<CityHospitalGeoSummary | null>(() => {
  return summarizeHospitalGeoByCity().find((x) => x.cityId === app.cityId) ?? null;
});
const hospitalGeoConfRatio = computed<HospitalGeoHighConfidenceRatio | null>(() => {
  return getHospitalGeoByCityHighConfidenceRatio().find((x) => x.cityId === app.cityId) ?? null;
});
const hospitalGeoCoverage = computed<HospitalGeoCoverageStats>(() => getHospitalGeoCoverageStats());
const hospitalGeoDupCount = computed(
  () => detectHospitalGeoDuplicateAmapPoi().length
);
const hospitalGeoNearest = computed<HospitalGeoNearestPair[]>(() =>
  getHospitalGeoByCityNearestPair(app.cityId, 3)
);
const hospitalGeoCrossCity = computed<CrossCityHospitalDistance[]>(() =>
  crossCityRows(getHospitalGeoCrossCityByCityPairDistance(5))
);
const hospitalCbdRef = computed(() => {
  const rows = store.getCommutesByCity(app.cityId);
  const hit = rows.find((x) => x.cbdLat != null && x.cbdLng != null);
  if (!hit) return null;
  return { lat: hit.cbdLat, lng: hit.cbdLng, name: hit.cbdName };
});
const hospitalCbdName = computed(() => hospitalCbdRef.value?.name ?? null);
const hospitalCbdRadius = computed<HospitalGeoWithinRadius | null>(() => {
  const ref = hospitalCbdRef.value;
  if (!ref) return null;
  return getHospitalGeoByCityWithinRadius(app.cityId, ref.lat, ref.lng, 3);
});
const hospitalGeoDistricts = computed<HospitalGeoDistrictSummary[]>(() =>
  getHospitalGeoByCityAddressDistrict(app.cityId).slice(0, 5)
);
const hospitalGeoLowConf = computed<LocalHospitalGeo[]>(() =>
  getHospitalGeoByCityByConfidence(app.cityId, "low").slice(0, 5)
);
const hospitalGeoConfNational = computed<HospitalGeoConfidenceSummary[]>(() =>
  summarizeHospitalGeoByConfidence()
);

function hospitalDisplayName(hospitalId: number): string {
  const h = store.getHospitalById(hospitalId);
  return h?.displayName || h?.officialName || `#${hospitalId}`;
}

function communityDisplayName(communityId: number): string {
  return store.getCommunityById(communityId)?.communityName ?? `小区#${communityId}`;
}

function communityIdsInCity(cityId: number): Set<number> {
  return new Set(
    store.getCommunitiesByCity(cityId).map((c) => c.communityId)
  );
}

// v1.121.15 周边商业
const commercialCityPois = computed(() =>
  store.getPoiCommercials().filter((x) => store.getCommunityById(x.communityId)?.cityId === app.cityId)
);
const commercialReady = computed(() => commercialCityPois.value.length > 0);
const commercialCommunityCount = computed(() => communityIdsInCity(app.cityId).size);
const commercialCatCount = computed(() => {
  const c = { restaurant: 0, bank: 0, convenience: 0 };
  for (const x of commercialCityPois.value) {
    if (x.poiCategory in c) c[x.poiCategory as keyof typeof c]++;
  }
  return c;
});
const commercialAvgDist = computed(() => {
  const arr = commercialCityPois.value;
  if (arr.length === 0) return 0;
  return arr.reduce((s, x) => s + x.distanceM, 0) / arr.length;
});
const commercialWalkTop = computed<WalkScore[]>(() => {
  const ids = communityIdsInCity(app.cityId);
  return [...ids]
    .map((id) => getPoiCommercialByCommunityWalkScore(id))
    .sort((a, b) => b.walkScore - a.walkScore)
    .slice(0, 5);
});
const commercialBankNear = computed<CommunityBankNearest[]>(() =>
  getPoiCommercialCrossCommunityByCategoryDistance("bank", 80)
    .filter((x) => store.getCommunityById(x.communityId)?.cityId === app.cityId)
    .slice(0, 5)
);
const commercialBankNearestCross = computed<CommunityBankNearest[]>(() =>
  crossCityRows(getPoiCommercialByCityBankNearestByCommunity(8))
);
const commercialRestaurantNear = computed<CommunityBankNearest[]>(() =>
  getPoiCommercialByCityRestaurantNearestByCommunity(80)
    .filter((x) => store.getCommunityById(x.communityId)?.cityId === app.cityId)
    .slice(0, 5)
);
const commercialConvenienceNear = computed<CommunityBankNearest[]>(() =>
  getPoiCommercialByCityConvenienceLeaderboard(80)
    .filter((x) => store.getCommunityById(x.communityId)?.cityId === app.cityId)
    .slice(0, 5)
);
const commercialSevenElevenNear = computed<PoiTypeLeaderboardEntry[]>(() =>
  getPoiCommercialByPoiTypeLeaderboard("7-ELEVEn", 40)
    .filter((x) => x.cityId === app.cityId)
    .slice(0, 5)
);
const commercialBankCoverage = computed<CityBankCoverage | null>(() =>
  getPoiCommercialByCityBankCoverage().find((x) => x.cityId === app.cityId) ?? null
);
const poiCommercialCitySummaries = computed<CityPoiCommercialSummary[]>(() =>
  summarizePoiCommercialByCity()
);
const commercialNearestAcrossSample = computed<LocalPoiCommercial[]>(() => {
  const id = commercialWalkTop.value[0]?.communityId;
  if (id == null) return [];
  return getPoiCommercialByCommunityNearestAcross(id, 5);
});
const commercialNearestAcrossName = computed(() => {
  const id = commercialWalkTop.value[0]?.communityId;
  return id != null ? communityDisplayName(id) : "";
});
const commercialCategoryTopSample = computed<CommunityCategoryTop[]>(() => {
  const id = commercialWalkTop.value[0]?.communityId;
  if (id == null) return [];
  return getPoiCommercialByCommunityTopByCategory(id);
});
const commercialCategoryStats = computed<CategoryPoiCommercialSummary[]>(() =>
  summarizePoiCommercialByCategory()
);
function categoryLabel(cat: string): string {
  if (cat === "restaurant") return "餐饮";
  if (cat === "bank") return "银行";
  if (cat === "convenience") return "便利";
  return cat;
}

// v1.121.15 菜市场可达
const marketSummariesInCity = computed<CommunityPoiMarketSummary[]>(() =>
  summarizePoiMarketByCommunity().filter(
    (s) => store.getCommunityById(s.communityId)?.cityId === app.cityId && s.nearestDistanceM != null
  )
);
const marketNearTop = computed(() =>
  [...marketSummariesInCity.value]
    .sort((a, b) => (a.nearestDistanceM ?? 0) - (b.nearestDistanceM ?? 0))
    .slice(0, 5)
);
const marketFarTop = computed(() =>
  [...marketSummariesInCity.value]
    .sort((a, b) => (b.nearestDistanceM ?? 0) - (a.nearestDistanceM ?? 0))
    .slice(0, 3)
);
const marketDeriveNear = computed<CommunityPoiMarketSummary[]>(() => {
  const ids = communityIdsInCity(app.cityId);
  return getPoiMarketDistanceLeaderboard(40).nearest
    .filter((s) => ids.has(s.communityId))
    .slice(0, 5);
});
const marketNearestDetail = computed<NearestMarketEntry | null>(() => {
  const top = marketNearTop.value[0];
  if (!top) return null;
  return getPoiMarketNearestByCommunity(top.communityId);
});
const marketCategoryStats = computed<MarketCategoryStat[]>(() =>
  getPoiMarketByCategoryRanking().slice(0, 5)
);

// v1.121.16 派生卡（教育事业概览）已迁出至 data-tools.vue；computed 删除

// v1.121.16 listing 学区溢价分布 / 分区
const lspCitySummary = computed<CitySchoolPremiumSummary | null>(() => {
  return summarizeListingSchoolPremiumByCity().find((x) => x.cityId === app.cityId) ?? null;
});
const lspDist = computed<PremiumBucket[]>(() =>
  getListingSchoolPremiumDistribution(app.cityId)
);
const lspDistrictTop = computed<DistrictPremiumSummary[]>(() =>
  getListingSchoolPremiumByCityDistrict(app.cityId).slice(0, 5)
);
const lspCommunityTop = computed<CommunityPremiumAggregate[]>(() =>
  getListingSchoolPremiumByCommunityLeaderboard(app.cityId, 5)
);
const lspCommunityByVolume = computed<CommunityPremiumAggregate[]>(() =>
  [...aggregateListingSchoolPremiumByCommunity(app.cityId)]
    .sort((a, b) => b.listingCount - a.listingCount)
    .slice(0, 5)
);


const listingKeywordsCity = computed<ListingKeywordRow[]>(() =>
  getListingKeywordsByCity(app.cityId).slice(0, 6)
);

// v0.35.0 map-9: 地铁步行通勤
const metroWalk = ref<MetroWalkResponse | null>(null);
// v0.36.0 map-10: 地铁规划受益
const metroBenefit = ref<MetroBenefitResponse | null>(null);
// v0.41.0 trend-21: 房源新鲜度
const listingFreshness = ref<ListingFreshnessResponse | null>(null);
const freshnessCitySummary = computed<CityFreshnessSummary | null>(() =>
  summarizeListingFreshnessByCity(app.cityId)[0] ?? null
);
const freshnessCrossCityTop = computed<FreshnessRankingEntry[]>(() =>
  crossCityRows(getFreshestCommunityTopN(undefined, 5))
);
const freshnessStaleCrossCity = computed<FreshnessRankingEntry[]>(() =>
  crossCityRows(getStalestCommunityTopN(undefined, 5))
);
const communityScorePareto = computed<LocalCommunityScore[]>(() =>
  getCommunityScorePareto(app.cityId, 80, 5)
);
const communityScoreCommuteFast = computed<LocalCommunityScore[]>(() =>
  getCommunityScoreByCommuteFastest(app.cityId, 5)
);
const communityScoreLifeTop = computed<LocalCommunityScore[]>(() =>
  getCommunityScoreByDimensionTopN("life", app.cityId, 5)
);
const communityScoreSchoolTop = computed<LocalCommunityScore[]>(() =>
  getCommunityScoreByDimensionTopN("school", app.cityId, 5)
);
const communityScoreTotalTop = computed<LocalCommunityScore[]>(() =>
  getCommunityScoreByTotalTopN(app.cityId, 5)
);
const communityScoreCitySummaries = computed<CommunityScoreCitySummary[]>(() =>
  summarizeCommunityScoreByCity()
);
const lifeConvenienceParetoSubway = computed<ParetoEntry[]>(() => {
  const ids = new Set(
    store.getCommunitiesByCity(app.cityId).map((c) => c.communityId)
  );
  return getLifeConveniencePareto("subwayNear", 80, 8).filter((x) =>
    ids.has(x.communityId)
  ).slice(0, 3);
});
const lifeConvenienceImbalance = computed<DimensionImbalance[]>(() => {
  const ids = new Set(
    store.getCommunitiesByCity(app.cityId).map((c) => c.communityId)
  );
  return getLifeConvenienceDimensionBalance(60, 25, 8).filter((x) =>
    ids.has(x.communityId)
  ).slice(0, 3);
});
const lifeMarketNearTop = computed<DimensionCoverageEntry[]>(() => {
  const ids = communityIdsInCity(app.cityId);
  return getLifeConvenienceByDimensionCoverage("marketNear", 20)
    .filter((x) => ids.has(x.communityId))
    .slice(0, 5);
});
const lifeDistrictTop = computed<DistrictLifeConvenienceSummary[]>(() =>
  getLifeConvenienceByCityDistrict(app.cityId).slice(0, 5)
);
const lifeScoreTop = computed<LocalLifeConvenience[]>(() =>
  getLifeConvenienceTopByScore(app.cityId, 5)
);
const lifeCitySummary = computed<CityLifeConvenienceSummary | null>(() =>
  summarizeLifeConvenienceByCity().find((x) => x.cityId === app.cityId) ?? null
);
const lifeCitySummariesCross = computed<CityLifeConvenienceSummary[]>(() =>
  summarizeLifeConvenienceByCity()
);
// v0.46.0 map-11: 行政区 + 社区 marker 地图
const districtMap = ref<DistrictMapResponse | null>(null);
// v0.47.0 school-4: 学区指标细分
const schoolDims = ref<SchoolDimResponse | null>(null);
// v0.53.0 macro-1: LPR + 房贷利率
const lpr = ref<LprResponse | null>(null);
// v0.34.0 trend-16: 综合评分权重自定义
const csWeights = ref<{ life: number; school: number; commute: number }>({ life: 50, school: 30, commute: 20 });
const csPresets: { key: string; label: string; weights: { life: number; school: number; commute: number } }[] = [
  { key: "balanced", label: "⚖️ 均衡", weights: { life: 50, school: 30, commute: 20 } },
  { key: "school", label: "🎓 学区", weights: { life: 20, school: 60, commute: 20 } },
  { key: "commute", label: "🚇 通勤", weights: { life: 20, school: 20, commute: 60 } },
  { key: "life", label: "🧭 生活", weights: { life: 70, school: 20, commute: 10 } }
];
const csWeightSum = computed(() => csWeights.value.life + csWeights.value.school + csWeights.value.commute);

function applyCsPreset(p: { key: string; weights: { life: number; school: number; commute: number } }) {
  csWeights.value = { ...p.weights };
  reloadCommunityScore();
}

function csPresetActive(p: { key: string; weights: { life: number; school: number; commute: number } }): boolean {
  return (
    csWeights.value.life === p.weights.life &&
    csWeights.value.school === p.weights.school &&
    csWeights.value.commute === p.weights.commute
  );
}

function onCsWeightChange(dim: "life" | "school" | "commute", e: any) {
  // uni-app slider @change: e.detail.value
  const v = typeof e === "number" ? e : e?.detail?.value ?? csWeights.value[dim];
  csWeights.value = { ...csWeights.value, [dim]: Number(v) };
  reloadCommunityScore();
}

async function reloadCommunityScore() {
  try {
    communityScore.value = await getCommunityScoreRank({
      cityId: app.cityId,
      topN: 8,
      weights: csWeights.value
    });
  } catch (e) {
    console.warn("getCommunityScoreRank failed:", e);
  }
}

// v0.35.0 map-9: 地铁步行通勤
async function reloadMetroWalk() {
  try {
    metroWalk.value = await getMetroWalkRanking({
      cityId: app.cityId,
      topN: 10
    });
  } catch (e) {
    console.warn("getMetroWalkRanking failed:", e);
  }
}
function mwBandClass(min: number) {
  if (min <= 5) return "mw-min-green";
  if (min <= 10) return "mw-min-orange";
  return "mw-min-red";
}

// v0.36.0 map-10: 地铁规划受益
async function reloadMetroBenefit() {
  try {
    metroBenefit.value = await getMetroBenefitRanking({
      cityId: app.cityId,
      topN: 10
    });
  } catch (e) {
    console.warn("getMetroBenefitRanking failed:", e);
  }
}


// v0.41.0 trend-21: 房源新鲜度
async function reloadListingFreshness() {
  try {
    listingFreshness.value = await getListingFreshnessRanking({
      cityId: app.cityId,
      topN: 8,
      minListings: 5
    });
  } catch (e) {
    console.warn("getListingFreshnessRanking failed:", e);
    listingFreshness.value = null;
  }
}

function lfFreshClass(v: number): string {
  if (v >= 30) return "lf-fresh-up";
  if (v >= 15) return "lf-fresh-mid";
  return "lf-fresh-down";
}


// v0.46.0 map-11: 行政区 + 社区 marker 地图
async function reloadDistrictMap() {
  try {
    districtMap.value = await getDistrictMap(app.cityId);
  } catch (e) {
    console.warn("getDistrictMap failed:", e);
    districtMap.value = null;
  }
}

// v0.47.0 school-4: 学区指标细分
async function reloadSchoolDims() {
  try {
    schoolDims.value = await getSchoolDimensions(app.cityId);
  } catch (e) {
    console.warn("getSchoolDimensions failed:", e);
    schoolDims.value = null;
  }
}

// v0.53.0 macro-1
async function reloadLpr() {
  try {
    lpr.value = await getLprOverview();
  } catch (e) {
    console.warn("getLprOverview failed:", e);
    lpr.value = null;
  }
}

function schoolDimsColor(score: number): string {
  if (score >= 70) return "#34d399";
  if (score >= 50) return "#60a5fa";
  if (score >= 30) return "#fbbf24";
  return "#f87171";
}

const MAP_W = 660;
const MAP_H = 480;

/** lng/lat -> SVG x/y (flip lat because SVG y grows downward) */
function mapX(lng: number, minLng: number, maxLng: number): number {
  const range = Math.max(maxLng - minLng, 0.001);
  const innerW = MAP_W - 40;
  return 20 + ((lng - minLng) / range) * innerW;
}

function mapY(lat: number, minLat: number, maxLat: number): number {
  const range = Math.max(maxLat - minLat, 0.001);
  const innerH = MAP_H - 40;
  return 20 + innerH - ((lat - minLat) / range) * innerH;
}

/** ring -> SVG path */
function ringToPath(ring: Array<[number, number]>, minLng: number, maxLng: number, minLat: number, maxLat: number): string {
  if (ring.length === 0) return "";
  let d = "";
  for (let i = 0; i < ring.length; i++) {
    const [lng, lat] = ring[i];
    const x = mapX(lng, minLng, maxLng);
    const y = mapY(lat, minLat, maxLat);
    d += (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
  }
  return d + "Z";
}

/** district 多边形渲染 (用 fill-rule:evenodd 自动处理洞) */
function districtAllPath(districtPolygons: Array<Array<[number, number]>>, minLng: number, maxLng: number, minLat: number, maxLat: number): string {
  let d = "";
  for (const ring of districtPolygons) {
    d += ringToPath(ring, minLng, maxLng, minLat, maxLat);
  }
  return d;
}
function mbBandClass(score: number) {
  if (score >= 75) return "mb-tag-green";
  if (score >= 40) return "mb-tag-orange";
  return "mb-tag-red";
}
const schoolPremiumOverview = ref<SchoolPremiumOverview | null>(null);
const schoolPremiumCommunityItems = ref<SchoolPremiumCommunityItem[]>([]);
// v0.26.0 trend-11: 过滤 + 排序 controls
const spDistrictFilter = ref<string>(""); // '|'-separated district names
const spMinScore = ref<number>(0);
const spSort = ref<import("../../local/store").SchoolPremiumCommunitySort>("avg_school_score");
const weatherResp = ref<WeatherResponse | null>(null);
const listingPremiumOverview = ref<ListingSchoolPremiumOverview | null>(null);
const commercialResp = ref<CommercialRankingResponse | null>(null);
// v0.20.0 trend-8: 同区多小区对比
const selectedDistrict = ref<string | null>(null);
const districtCompareResp = ref<DistrictCommunityCompareResponse | null>(null);

const errorMsg = ref<string>("");
const loading = ref<boolean>(false);
const gzInventoryExpanded = ref(false);
const nbsSeriesExpanded = ref(false);
const gdProvidentExpanded = ref(false);

const nbsMacro = computed(() => getLatestNbsRealEstate());
const nbsYoyTrend = computed(() => getNbsYoyTrend(6));
const nbsImpliedUnitPrice = computed(() => getNbsImpliedContractUnitPrice(nbsMacro.value));
const nbsImpliedResidentialUnitPrice = computed(() =>
  getNbsImpliedResidentialUnitPrice(nbsMacro.value)
);
const nbsResidentialConstructionSharePct = computed(() =>
  getNbsResidentialConstructionSharePct(nbsMacro.value)
);
const nbsUnitPriceTrend = computed(() => getNbsImpliedUnitPriceTrend(6));
const nbsImpliedInventoryMonths = computed(() => getNbsImpliedInventoryMonths(nbsMacro.value));
const nbsInventoryMonthsTrend = computed(() => getNbsImpliedInventoryMonthsTrend(6));
const nbsHasSeriesDetail = computed(
  () =>
    nbsUnitPriceTrend.value.length > 1 ||
    nbsInventoryMonthsTrend.value.length > 1 ||
    nbsYoyTrend.value.length > 1
);
const gzInventory = computed(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return city === "广州" ? getGzInventoryOverview() : null;
});
const gzInventoryDelta = computed(() => {
  if (!gzInventory.value) return null;
  return getGzInventoryDayDelta();
});
const gzInventoryTopSharePct = computed(() => topDistrictAvailableSharePct(gzInventory.value));
const gzInventoryFresh = computed(() =>
  assessGzInventoryFreshness(gzInventory.value?.date ?? null)
);

const szPlannedSupply = computed<SzPlannedSupplyRow | null>(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return city === "深圳" ? getLatestSzPlannedSupply() : null;
});
const szSupplyQoQ = computed(() => (szPlannedSupply.value ? getSzSupplyQoQDelta() : null));
const szSupplyResidentialPct = computed(() => residentialSharePct(szPlannedSupply.value));
function formatSupplyArea(sqm: number): string {
  if (sqm >= 10000) return `${(sqm / 10000).toFixed(1)} 万㎡`;
  return `${sqm.toLocaleString()} ㎡`;
}

const gzHousingPlan = computed<GzHousingPlanRow | null>(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return city === "广州" ? getLatestGzHousingPlan() : null;
});
const gzHousingPlanYoY = computed(() => (gzHousingPlan.value ? getGzHousingPlanYoY() : null));
const gzAffordableRaised = computed<GzAffordableProjectsRow | null>(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return city === "广州" ? getLatestGzAffordableRaised() : null;
});
const gzAffordableCompleted = computed<GzAffordableProjectsRow | null>(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  if (city !== "广州") return null;
  const raised = gzAffordableRaised.value;
  return getLatestGzAffordableCompleted({
    preferYear: raised?.year,
    preferCategory: raised?.category
  });
});
/** 同口径竣工缺失时，脚注同年棚改竣工（不同口径，不并排 KPI） */
const gzAffordableShantyNote = computed<GzAffordableProjectsRow | null>(() => {
  if (gzAffordableCompleted.value || !gzAffordableRaised.value) return null;
  return getLatestGzAffordableShantytownCompleted(gzAffordableRaised.value.year);
});
const gzAffordableTargetRaised = computed<GzAffordableTargetRow | null>(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  if (city !== "广州") return null;
  const preferYear = gzAffordableRaised.value?.year;
  const raw = getLatestGzAffordableTargetRaised(preferYear);
  return resolveTargetWithProjectsActual(
    raw,
    gzAffordableRaised.value?.totalUnits ?? 0,
    gzAffordableRaised.value?.asOfMonth ?? 0
  );
});
const gzAffordableTargetCompleted = computed<GzAffordableTargetRow | null>(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  if (city !== "广州") return null;
  // 与筹集目标同年，避免 2025 卡脚注挂 2024 竣工目标
  const preferYear = gzAffordableTargetRaised.value?.year ?? gzAffordableRaised.value?.year;
  return getLatestGzAffordableTargetCompleted(preferYear);
});
const gzAffordableTargetPct = computed(() => progressPct(gzAffordableTargetRaised.value) ?? 0);
const gzAffordableTargetCompletedPct = computed(() => progressPct(gzAffordableTargetCompleted.value) ?? 0);
function formatWan(v: number, unit: string): string {
  if (!v) return "—";
  return `${v.toLocaleString()}${unit}`;
}

const gzLandSummary = computed(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return city === "广州" ? summarizeGzLandDeals() : null;
});
const gzLandLatest = computed<GzLandDeal[]>(() => (gzLandSummary.value ? getLatestGzLandDeals(3) : []));
const gzLandByMonth = computed(() => (gzLandSummary.value ? summarizeGzLandDealsByMonth(6) : []));
const szLandSummary = computed(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return city === "深圳" ? summarizeSzLandDeals() : null;
});
const szLandLatest = computed<SzLandDeal[]>(() => (szLandSummary.value ? getLatestSzLandDeals(3) : []));
const szLandByMonth = computed(() => (szLandSummary.value ? summarizeSzLandDealsByMonth(6) : []));
const szAffordableRaised = computed<SzAffordableProjectsRow | null>(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return city === "深圳" ? getLatestSzAffordableRaised() : null;
});
const szAffordableCompleted = computed<SzAffordableProjectsRow | null>(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return city === "深圳" ? getLatestSzAffordableCompleted() : null;
});
const zhAffordable = computed<ZhAffordableProgressRow | null>(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return city === "珠海" ? getLatestZhAffordableProgress() : null;
});
const zhAffordableMoM = computed(() => {
  if (!zhAffordable.value) return null;
  const mom = getZhAffordableProgressMoM();
  if (!mom) return null;
  // 跨年累计口径不同，环比无意义
  if (mom.prev.year !== zhAffordable.value.year) return null;
  return mom;
});
const zhBdcNew = computed<ZhBdcRegistrationRow | null>(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return city === "珠海" ? getLatestZhBdcByKind("new_commodity") : null;
});
const zhBdcStock = computed<ZhBdcRegistrationRow | null>(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return city === "珠海" ? getLatestZhBdcByKind("stock_transfer") : null;
});
const zhBdcNewQoQ = computed(() => (zhBdcNew.value ? getZhBdcResidentialQoQ("new_commodity") : null));
const zhBdcStockQoQ = computed(() =>
  zhBdcStock.value ? getZhBdcResidentialQoQ("stock_transfer") : null
);
const zhBdcNewDistricts = computed(() => getZhBdcDistrictsFor(zhBdcNew.value, "new_commodity"));
const zhBdcStockDistricts = computed(() => getZhBdcDistrictsFor(zhBdcStock.value, "stock_transfer"));
const zhPriceFiling = computed<ZhPriceFilingSummary | null>(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return city === "珠海" ? getZhPriceFilingSummary(8) : null;
});
function formatLandPrice(wan: number): string {
  return wan >= 10000 ? `${(wan / 10000).toFixed(2)} 亿元` : `${wan.toLocaleString()} 万元`;
}
function formatLandArea(sqm: number): string {
  return sqm >= 10000 ? `${(sqm / 10000).toFixed(2)} 万㎡` : `${sqm.toLocaleString()} ㎡`;
}
function formatInvDelta(v: number): string {
  if (v === 0) return "持平";
  return `${v > 0 ? "+" : ""}${v.toLocaleString()}`;
}
function invDeltaClass(v: number): string {
  if (v > 0) return "trend-up";
  if (v < 0) return "trend-down";
  return "muted";
}
/** 涨跌色：A 股惯例 涨红跌绿（利率升=红、降=绿） */
function rateDeltaClass(v: number): string {
  if (v > 0) return "trend-up";
  if (v < 0) return "trend-down";
  return "muted";
}
function rateDeltaArrow(v: number): string {
  if (v > 0) return "↑";
  if (v < 0) return "↓";
  return "·";
}
const providentRate = computed(() => getLatestProvidentFundRate());
const szProvidentAnnual = computed<SzProvidentAnnualRow | null>(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return city === "深圳" ? getLatestSzProvidentAnnual() : null;
});
const szProvidentExtractPct = computed(() => extractToDepositPct(szProvidentAnnual.value));
const szProvidentLoanBalancePct = computed(() => loanToDepositBalancePct(szProvidentAnnual.value));
const szProvidentYearDelta = computed(() =>
  szProvidentAnnual.value ? getSzProvidentYearDelta(szProvidentAnnual.value) : null
);
const gzProvidentAnnual = computed<GzProvidentAnnualRow | null>(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return city === "广州" ? getLatestGzProvidentAnnual() : null;
});
const gzProvidentExtractPct = computed(() => gzExtractToDepositPct(gzProvidentAnnual.value));
const gzProvidentLoanBalancePct = computed(() => gzLoanToDepositBalancePct(gzProvidentAnnual.value));
const gdProvidentAnnual = computed<GdProvidentAnnualRow | null>(() => getLatestGdProvidentAnnual());
const gdProvidentExtractPct = computed(() => gdExtractToDepositPct(gdProvidentAnnual.value));
const gdProvidentLoanBalancePct = computed(() => gdLoanToDepositBalancePct(gdProvidentAnnual.value));
const zhProvidentDynamics = computed<ZhProvidentDynamicsRow | null>(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return city === "珠海" ? getLatestZhProvidentDynamics() : null;
});
const zhProvidentFullYear = computed<ZhProvidentDynamicsRow | null>(() => {
  const city = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return city === "珠海" ? getLatestZhProvidentFullYear() : null;
});
const zhProvidentPeriodLabel = computed(() => formatZhProvidentPeriod(zhProvidentDynamics.value));
const zhProvidentSamePeriodDelta = computed(() => getZhProvidentSamePeriodDelta(zhProvidentDynamics.value));

function formatInventoryUnits(v: number) {
  return v >= 10000 ? `${(v / 10000).toFixed(1)} 万套` : `${v.toLocaleString()} 套`;
}
function pfMonthly100w() {
  const rate = providentRate.value?.firstOver5y ?? 0;
  return Math.round(monthlyPayment(1_000_000, rate, 30));
}

function pfSavingVsCommercial100w() {
  const commRate = lpr.value?.latest?.mortgageFirst ?? 0;
  const commercial = Math.round(monthlyPayment(1_000_000, commRate, 30));
  return Math.max(0, commercial - pfMonthly100w());
}

const COMBO_YEAR_OPTIONS = [10, 20, 30] as const;
const comboFundWan = ref(50);
const comboCommercialWan = ref(50);
const comboYears = ref(30);

function clampComboWan(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 1000) return 1000;
  return n;
}

function comboInputValue(e: Event | { detail?: { value?: string } }) {
  const maybeUni = e as { detail?: { value?: string } };
  if (maybeUni.detail?.value != null) return maybeUni.detail.value;
  const target = (e as Event).target as HTMLInputElement | null;
  return target?.value ?? "";
}

function onComboFundInput(e: Event) {
  comboFundWan.value = clampComboWan(comboInputValue(e));
}
function onComboCommercialInput(e: Event) {
  comboCommercialWan.value = clampComboWan(comboInputValue(e));
}
function onComboFundBlur(e: Event) {
  comboFundWan.value = clampComboWan(comboInputValue(e));
}
function onComboCommercialBlur(e: Event) {
  comboCommercialWan.value = clampComboWan(comboInputValue(e));
}

const comboFundRatePct = computed(() => {
  const rate = providentRate.value;
  if (!rate) return 0;
  return comboYears.value <= 5 ? rate.first5yOrLess : rate.firstOver5y;
});

const comboCommercialRatePct = computed(() => lpr.value?.latest?.mortgageFirst ?? 0);

const comboMonthly = computed(() => {
  const years = comboYears.value;
  const fund = comboFundWan.value * 10_000;
  const commercial = comboCommercialWan.value * 10_000;
  return Math.round(
    monthlyPayment(fund, comboFundRatePct.value, years)
    + monthlyPayment(commercial, comboCommercialRatePct.value, years)
  );
});

const comboSavingMonthly = computed(() => {
  const totalPrincipal = (comboFundWan.value + comboCommercialWan.value) * 10_000;
  if (totalPrincipal <= 0) return 0;
  const allCommercial = Math.round(
    monthlyPayment(totalPrincipal, comboCommercialRatePct.value, comboYears.value)
  );
  return Math.max(0, allCommercial - comboMonthly.value);
});

const comboTotalInterestWan = computed(() => {
  const principal = (comboFundWan.value + comboCommercialWan.value) * 10_000;
  if (principal <= 0) return "0";
  const months = comboYears.value * 12;
  const interest = comboMonthly.value * months - principal;
  return (Math.round(interest / 1000) / 10).toFixed(1);
});

function resetCombo() {
  comboFundWan.value = 50;
  comboCommercialWan.value = 50;
  comboYears.value = 30;
}

// F-ENTRY-01 首页多入口
const filterWorkbenchExpanded = ref(false);
// v1.121.138：跳转到数据工具独立页（14 张派生卡已迁移至此）
function goDataTools(): void {
  uni.navigateTo({ url: "/pages/data-tools/data-tools" });
}

// v1.121.149 Batch 10：跳转到深度可视化分析独立页（4 张可视化卡）
function goTrendAnalysis(): void {
  uni.navigateTo({ url: "/pages/trend-analysis/trend-analysis" });
}

// v1.121.153 Batch 14：跳转到全屏行政区地图独立页
function goMapAnalysis(): void {
  uni.navigateTo({ url: "/pages/map-analysis/map-analysis" });
}
const homeSearchMode = ref<HomeSearchMode>("school");
const homeSearchText = ref("");
const homeSearchPlaceholder = computed(
  () => HOME_SEARCH_MODES.find((m) => m.key === homeSearchMode.value)?.placeholder ?? "搜索"
);
function onHomeSearchInput(e: any) {
  homeSearchText.value = String(e?.detail?.value ?? e?.target?.value ?? "");
}
const homeScrollAvailability = computed<HomeScrollAvailability>(() => ({
  hasGzInventory: !!gzInventory.value,
  hasSzPlannedSupply: !!szPlannedSupply.value,
  hasGzHousingPlan: !!gzHousingPlan.value,
  hasZhAffordable: !!zhAffordable.value,
  hasZhBdcRegistration: !!zhBdcNew.value && !!zhBdcStock.value,
  hasDailyWangqian: !!currentWangqian.value,
  hasGzLand: !!gzLandSummary.value,
  hasSzLand: !!szLandSummary.value
}));
const supplyEntryOwner = computed(() => homeSupplyEntryOwner(homeScrollAvailability.value));
const landEntryOwner = computed(() => homeLandEntryOwner(homeScrollAvailability.value));

function jumpHomeAnchor(anchor: string) {
  const resolved = resolveHomeScrollAnchor(anchor, homeScrollAvailability.value);
  if (resolved.kind === "missing") {
    showToast(resolved.reason);
    return;
  }
  const target = resolved.id;
  // 供需/土地等卡挂在 overview|price；从学校/通勤/地图 tab 点金刚区需先切回可见 tab
  if (activeTab.value === "school" || activeTab.value === "transit" || activeTab.value === "map") {
    activeTab.value = "overview";
  }
  const doScroll = () => {
    if (typeof document !== "undefined") {
      const el = document.getElementById(target);
      if (el) {
        el.scrollIntoView({ behavior: "auto", block: "start" });
        // 避开顶部 sticky 入口条，避免滚过头
        window.setTimeout(() => {
          const top = el.getBoundingClientRect().top;
          if (top < 72 || top > 160) {
            window.scrollBy({ top: top - 96, left: 0, behavior: "auto" });
          }
        }, 40);
        return;
      }
      showToast("未找到对应区块");
      return;
    }
    uni.pageScrollTo({
      selector: `#${target}`,
      duration: 280,
      fail: () => showToast("未找到对应区块")
    });
  };
  nextTick(() => {
    nextTick(doScroll);
  });
}

/** F-ENTRY-01：频道条跳独立页 / Tab，禁止本页长滚 */
function onHomeChannel(c: HomeChannel) {
  const a = c.action;
  if (a.kind === "tab") {
    setDashTab(a.tab);
    return;
  }
  if (a.kind === "switchTab") {
    uni.switchTab({
      url: a.path,
      fail: (e) => showToast(`打开失败：${toErrorMessage(e)}`)
    });
    return;
  }
  if (a.kind === "navigate") {
    let url = a.path;
    if (url.includes("wangqian")) {
      const name = currentWangqianCityName.value;
      if (name === "深圳" || name === "广州" || name === "珠海") {
        url = `/pages/wangqian/wangqian?city=${encodeURIComponent(name)}`;
      }
    }
    uni.navigateTo({
      url,
      fail: (e) => showToast(`打开失败：${toErrorMessage(e)}`)
    });
  }
}

function submitHomeSearch() {
  const resolved = resolveHomeSearch(homeSearchMode.value, homeSearchText.value);
  if (resolved.kind === "none") {
    showToast(resolved.reason);
    return;
  }
  if (resolved.kind === "school") {
    setPendingSchoolQuery(resolved.q);
    uni.switchTab({
      url: "/pages/school/school",
      fail: (e) => showToast(`打开学校失败：${toErrorMessage(e)}`)
    });
    return;
  }
  if (resolved.kind === "listing") {
    if (resolved.q) setPendingListingQuery(resolved.q);
    uni.switchTab({
      url: resolved.path,
      fail: (e) => showToast(`打开房源失败：${toErrorMessage(e)}`)
    });
    return;
  }
  if (resolved.kind === "tab") {
    setDashTab(resolved.tab);
    return;
  }
  if (resolved.kind === "navigate") {
    uni.navigateTo({
      url: resolved.path,
      fail: (e) => showToast(`打开失败：${toErrorMessage(e)}`)
    });
    return;
  }
  if (resolved.kind === "scroll") {
    jumpHomeAnchor(resolved.anchor);
  }
}
function onHomeKingkong(k: HomeKingkongItem) {
  const a = k.action;
  if (a.kind === "tab") {
    setDashTab(a.tab);
    return;
  }
  if (a.kind === "city") {
    pickCity();
    return;
  }
  if (a.kind === "period") {
    uni.pageScrollTo({ scrollTop: 0, duration: 200 });
    filterWorkbenchExpanded.value = true;
    return;
  }
  if (a.kind === "scroll") {
    jumpHomeAnchor(a.anchor);
    return;
  }
  if (a.kind === "switchTab") {
    uni.switchTab({
      url: a.path,
      fail: (e) => showToast(`打开失败：${toErrorMessage(e)}`)
    });
    return;
  }
  if (a.kind === "navigate") {
    let url = a.path;
    if (url.includes("wangqian")) {
      const name = currentWangqianCityName.value;
      if (name === "深圳" || name === "广州" || name === "珠海") {
        url = `/pages/wangqian/wangqian?city=${encodeURIComponent(name)}`;
      }
    }
    uni.navigateTo({
      url,
      fail: (e) => showToast(`打开失败：${toErrorMessage(e)}`)
    });
  }
}

// v0.48.0 dashboard-tabs: 顶部 tab 切换
const activeTab = ref<DashTabKey>("overview");

// 概览页「精简模式」：默认尽量收敛信息流长度
const isOverviewCompact = computed(
  () => activeTab.value === "overview" && featuredMode.value
);

function setDashTab(tab: DashTabKey) {
  activeTab.value = tab;
  const fb = dashTabSwitchFeedback(tab);
  showToast(fb.toast);
  nextTick(() => {
    if (typeof document !== "undefined") {
      const el = document.getElementById("dash-tabs");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    uni.pageScrollTo({
      selector: fb.scrollSelector,
      duration: 280,
      fail: () => {
        /* App 部分端无 selector 时仍保留 toast + data-dash-tab */
      }
    });
  });
}

type OverviewGroupKey = "region" | "wangqian" | "transit" | "community" | "school" | "lpr";
const OVERVIEW_GROUP_KEYS: OverviewGroupKey[] = ["region", "wangqian", "transit", "community", "school", "lpr"];
const OVERVIEW_JUMPS: { key: OverviewGroupKey; label: string }[] = [
  { key: "region", label: "区域" },
  { key: "wangqian", label: "网签" },
  { key: "transit", label: "通勤" },
  { key: "community", label: "小区" },
  { key: "school", label: "学校" },
  { key: "lpr", label: "利率" }
];

const overviewOpenGroups = ref<Set<OverviewGroupKey>>(new Set());

const overviewAllExpanded = computed(() =>
  OVERVIEW_GROUP_KEYS.every((k) => overviewOpenGroups.value.has(k))
);

/** 概览分组不再折叠：始终展开（用户明确禁止折叠套路） */
function isOverviewGroupCollapsed(_key: OverviewGroupKey): boolean {
  return false;
}

function expandOverviewGroup(_key: OverviewGroupKey) {
  /* no-op：已取消折叠 */
}

function jumpOverviewGroup(key: OverviewGroupKey) {
  // 遗留兼容：改为进独立页 / Tab，禁止 scrollIntoView
  if (key === "wangqian") {
    uni.navigateTo({ url: "/pages/wangqian/wangqian" });
    return;
  }
  if (key === "school") {
    uni.switchTab({ url: "/pages/school/school" });
    return;
  }
  if (key === "lpr") {
    uni.navigateTo({ url: "/pages/macro-rates/macro-rates" });
    return;
  }
  if (key === "transit") {
    setDashTab("transit");
    return;
  }
  if (key === "region" || key === "community") {
    setDashTab("price");
  }
}

function toggleOverviewAll() {
  /* no-op：已取消全部展开/收起 */
}

function onOverviewCardClick(_key: OverviewGroupKey) {
  /* no-op：卡面不再靠点击展开 */
}

const overviewRegionSummary = computed(() => {
  const top = districtItems.value[0];
  if (!top) return "暂无区级对比数据";
  return `领先：${top.district_name} · ${formatBarValue(top)}`;
});

const overviewWangqianSummary = computed(() => {
  const top = districtWangqianRank.value?.items[0];
  if (!top) return "暂无网签热度数据";
  return `最热：${top.district} · ${top.totalUnits} 套`;
});

const overviewTransitSummary = computed(() => {
  const top = commuteRanking.value?.fastest[0];
  if (!top) return "暂无通勤数据";
  return `最快：${top.communityName} · ${Math.round(top.transitMinutes)} 分钟`;
});

const overviewCommunitySummary = computed(() => {
  const top = communityScore.value?.items[0];
  if (!top) return "暂无小区评分";
  return `榜首：${top.communityName} · ${top.totalScore.toFixed(0)} 分`;
});

const overviewSchoolSummary = computed(() => {
  const top = schoolDims.value?.topOverall[0];
  if (!top) return "暂无学校评分";
  return `综合第一：${top.schoolName} · ${top.compositeScore.toFixed(0)} 分`;
});

const overviewLprSummary = computed(() => {
  const latest = lpr.value?.latest;
  if (!latest) return "暂无 LPR 数据";
  return `首套参考 ${latest.mortgageFirst.toFixed(2)}% · 5Y LPR ${latest.lpr5y.toFixed(2)}%`;
});

// v0.55.0 hero-1: 顶部大盘轮播 — 城市级聚合 (从 snapshot 实时计算)
const listingCount = computed<number>(() => store.getListingsByCity(app.cityId).length);
const listingTrust = computed(() => summarizeListingTrust(store.getListingsByCity(app.cityId)));
const communityCount = computed<number>(() => {
  const seen = new Set<number>();
  for (const l of store.getListingsByCity(app.cityId)) seen.add(l.communityId);
  return seen.size;
});
const medianUnitPrice = computed<number>(() => {
  const arr = store.getListingsByCity(app.cityId)
    .map((l) => l.unitPrice)
    .filter((v): v is number => typeof v === "number" && v > 0)
    .sort((a, b) => a - b);
  if (arr.length === 0) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 === 0 ? Math.round((arr[mid - 1] + arr[mid]) / 2) : arr[mid];
});
const medianTotalPrice = computed<number>(() => {
  const arr = store.getListingsByCity(app.cityId)
    .map((l) => l.totalPrice10k)
    .filter((v): v is number => typeof v === "number" && v > 0)
    .sort((a, b) => a - b);
  if (arr.length === 0) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 === 0 ? Math.round((arr[mid - 1] + arr[mid]) / 2) : arr[mid];
});

// v0.55.0 hero-1: 顶部大盘轮播
type HeroSlide = {
  icon: string;
  label: string;
  value: string;
  unit?: string;
  sub: string;
  tone: "blue" | "green" | "red" | "amber" | "violet" | "rose";
  tab?: DashTabKey;
};
const heroIdx = ref(0);
const heroSlides = computed<HeroSlide[]>(() => {
  const cityName = store.getCityById(app.cityId)?.cityName ?? app.cityId.toString();
  const slides: HeroSlide[] = [];
  // 1. 总挂牌
  const totalListings = listingCount.value;
  slides.push({
    icon: "🏘️",
    label: `${cityName} · 总挂牌`,
    value: totalListings.toLocaleString(),
    unit: "套",
    sub: `${communityCount.value} 个小区在监控`,
    tone: "blue",
    tab: "overview"
  });
  // 2. 平均单价
  if (medianUnitPrice.value > 0) {
    slides.push({
      icon: "💰",
      label: listingMedianUnitPriceLabel(),
      value: medianUnitPrice.value.toLocaleString(),
      unit: "元/㎡",
      sub: `周 ${app.weekEnd || ""} · 卖方挂牌`,
      tone: "red",
      tab: "price"
    });
  }
  // 3. 平均总价
  if (medianTotalPrice.value > 0) {
    slides.push({
      icon: "💵",
      label: "全市中位总价",
      value: medianTotalPrice.value.toString(),
      unit: "万",
      sub: `覆盖 ${listingCount.value} 套`,
      tone: "amber",
      tab: "price"
    });
  }
  // 4. LPR
  if (lpr.value?.latest) {
    slides.push({
      icon: "🏦",
      label: "5Y+ LPR · 首套房贷",
      value: lpr.value.latest.mortgageFirst.toFixed(2),
      unit: "%",
      sub: `5Y LPR ${lpr.value.latest.lpr5y.toFixed(2)}% · 累计 -${lpr.value.cumDrop5y}pp`,
      tone: "violet",
      tab: "price"
    });
  }
  // 5. 平均通勤
  if (commuteRanking.value && commuteRanking.value.cityAvgMinutes != null) {
    const fastestMin = commuteRanking.value.fastest[0]?.transitMinutes ?? null;
    slides.push({
      icon: "🚇",
      label: `通勤 → ${commuteRanking.value.cbdName}`,
      value: commuteRanking.value.cityAvgMinutes.toFixed(0),
      unit: "min",
      sub: `最快 ${fastestMin != null ? fastestMin.toFixed(0) + "min" : "—"} · ${commuteRanking.value.totalCommunities} 小区`,
      tone: "green",
      tab: "transit"
    });
  }
  // 6. 学区评分
  if (schoolDims.value && schoolDims.value.total > 0) {
    slides.push({
      icon: "🏫",
      label: `${cityName} · 学区指标`,
      value: schoolDims.value.total.toString(),
      unit: "校",
      sub: "5 维评分加权排名",
      tone: "rose",
      tab: "school"
    });
  }
  return slides;
});

function onHeroChange(e: any) {
  const idx = Number(e?.detail?.current ?? 0);
  heroIdx.value = Math.max(0, Math.min(idx, heroSlides.value.length - 1));
}
function heroClick(i: number) {
  const s = heroSlides.value[i];
  if (s?.tab) setDashTab(s.tab);
}

const DASHBOARD_TABS: Array<{ key: DashTabKey; icon: string; label: string }> = [
  { key: "overview", icon: "📊", label: "概览" },
  { key: "price", icon: "💰", label: "价格画像" },
  { key: "school", icon: "🏫", label: "学区配套" },
  { key: "transit", icon: "🚇", label: "通勤地铁" },
  { key: "map", icon: "🗺️", label: "地图视图" }
];

// v0.49.0 topnav-1: 周期切换 helper
const currentPeriodIdx = computed(() => {
  if (!app.weekEnd || periods.value.length === 0) return -1;
  return periods.value.indexOf(app.weekEnd);
});
function stepPeriod(delta: number) {
  const list = periods.value;
  if (list.length === 0) return;
  const cur = currentPeriodIdx.value;
  const next = cur + delta;
  if (next < 0 || next >= list.length) return;
  const target = list[next];
  if (!target || target === app.weekEnd) return;
  app.setWeekEnd(target);
  loadRankingAndDistrict().then(() => {
    showToast(`已切到 ${target} · 上榜 ${rankingTotal.value} 小区`);
    // 滚到本周速览，让数字变化可见
    setTimeout(() => {
      try {
        uni.pageScrollTo({ selector: "#week-bound-strip", duration: 280 });
      } catch (_) {
        /* H5 / 部分端可能无 selector */
      }
    }, 50);
  });
}

const cityScoped = ref(true);
function applyCityScopedClass(on: boolean) {
  // .page.city-scoped 已由模板 :class 绑定（App 可达）；H5 双写 body 兼容旧 e2e
  if (typeof document === "undefined") return;
  document.body.classList.toggle("city-scoped", on);
}
function toggleCityScoped() {
  cityScoped.value = !cityScoped.value;
  applyCityScopedClass(cityScoped.value);
  showToast(cityScoped.value ? "已隐藏跨城对照" : "已显示跨城对照");
}
/** 仅本市模式下清空跨城数组，列表自然不渲染 */
function crossCityRows<T>(rows: T[]): T[] {
  return cityScoped.value ? [] : rows;
}

// 房源按周聚合，来源可能是真实挂牌或公开指标派生样本。
const periodHint = computed(() => {
  const list = periods.value;
  if (list.length === 0) return "";
  const latest = list[list.length - 1];
  return `房源快照最新周期 ${latest}（周维度，不代表当日实时挂牌）`;
});

// Picker 辅助
const currentCityLabel = computed(() => {
  const c = cities.value.find((c) => c.city_id === app.cityId);
  return c?.city_name || store.getCityById(app.cityId)?.cityName || "";
});

const metricLabels = ["均价", "挂牌数"];
const metricIndex = computed(() => (app.metric === "avg_unit_price" ? 0 : 1));

// 内置 popup 状态（比 uni.showActionSheet 更可靠，所有 uni-app 平台都通用）
const sheet = ref<{
  open: boolean;
  title: string;
  items: string[];
  currentIndex: number;
  onPick: (idx: number) => void;
}>({
  open: false,
  title: "",
  items: [],
  currentIndex: -1,
  onPick: () => {}
});

function openSheet(title: string, items: string[], currentIndex: number, onPick: (idx: number) => void) {
  sheet.value = {
    open: true,
    title,
    items,
    currentIndex,
    onPick
  };
}
function closeSheet() {
  sheet.value.open = false;
}
function sheetPick(idx: number) {
  const cb = sheet.value.onPick;
  closeSheet();
  cb(idx);
}

function pickCity() {
  if (cities.value.length === 0) {
    showToast("暂无城市列表");
    return;
  }
  const items = cities.value.map((c) => c.city_name);
  const cur = cities.value.findIndex((c) => c.city_id === app.cityId);
  openSheet("选择城市", items, cur, (idx) => {
    const c = cities.value[idx];
    if (c) {
      app.setCityId(c.city_id);
      loadAll();
      showToast(`已切换到 ${c.city_name}`);
    }
  });
}

function pickPeriod() {
  if (periods.value.length === 0) {
    showToast("暂无周期数据");
    return;
  }
  const list = periods.value.slice().reverse();   // 最近的在前
  const cur = periods.value.indexOf(app.weekEnd);
  const listCur = list.indexOf(app.weekEnd);
  openSheet(
    "选择周期（最近的在前）",
    list,
    listCur >= 0 ? listCur : 0,
    (idx) => {
      const p = list[idx];
      if (p) {
        app.setWeekEnd(p);
        loadRankingAndDistrict();
        showToast(`已选周期 ${p}`);
      }
    }
  );
}

function pickSource() {
  const items = ["全部", ...sourceOptions.value.map((s) => s.source || "(空来源)")];
  // 计算当前索引
  let cur = 0;
  if (app.source) {
    const idx = sourceOptions.value.findIndex((s) => s.source === app.source);
    if (idx >= 0) cur = idx + 1;
  }
  openSheet("数据来源", items, cur, (idx) => {
    if (idx === 0) {
      app.setSource("");
    } else {
      const s = sourceOptions.value[idx - 1];
      if (s) app.setSource(s.source);
    }
    loadRankingAndDistrict();
    loadCoverage();
  });
}

function pickMetric() {
  openSheet(
    "指标",
    metricLabels,
    metricIndex.value,
    (idx) => {
      app.setMetric(idx === 0 ? "avg_unit_price" : "listing_count");
      loadRankingAndDistrict();
    }
  );
}

async function loadAll() {
  if (!app.cityId) return;
  loading.value = true;
  errorMsg.value = "";
  try {
    await Promise.all([loadSources(), loadPeriods(), loadCoverage(), loadRuntime()]);
    if (!app.weekEnd && periods.value.length > 0) {
      app.setWeekEnd(periods.value[periods.value.length - 1]);
    } else if (!app.weekEnd) {
      const today = new Date().toISOString().slice(0, 10);
      app.setWeekEnd(today);
    }
    await loadRankingAndDistrict();
  } catch (e) {
    errorMsg.value = toErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

/**
 * 「刷新」= 先尝试从 CDN 镜像拉最新（安居客 listings + 深广网签），
 * 再重算本地视图。任一远端成功即提示已刷新；全失败则回退本地并提示网络问题。
 */
async function reload() {
  if (loading.value) return;
  loading.value = true;
  errorMsg.value = "";
  let remoteOk = false;
  try {
    const results = await Promise.allSettled([
      refreshFromRemote(),
      refreshWangqianFromRemote()
    ]);
    remoteOk = results.some(
      (r) => r.status === "fulfilled" && (r.value as { ok?: boolean })?.ok === true
    );
  } catch {
    // 忽略：远端不可用时回退本地数据
  }
  await loadAll();
  showToast(remoteOk ? "已刷新" : "网络不可用，仍用本地数据");
}

async function loadSources() {
  try {
    const res = await getSources({ cityId: app.cityId });
    sourceOptions.value = res.items || [];
    if (app.source && !sourceOptions.value.some((s) => s.source === app.source)) {
      app.setSource("");
    }
  } catch {
    sourceOptions.value = [];
  }
}

async function loadPeriods() {
  try {
    const res = await getPeriods({ cityId: app.cityId });
    periods.value = res.items || [];
  } catch (e) {
    errorMsg.value = `加载周期失败：${toErrorMessage(e)}`;
  }
}

async function loadCoverage() {
  try {
    coverage.value = await getCoverage({ cityId: app.cityId, source: app.source || undefined });
  } catch {
    coverage.value = null;
  }
}

async function loadRuntime() {
  try {
    runtime.value = await getRuntimeMeta();
  } catch {
    runtime.value = null;
  }
}

async function loadRankingAndDistrict() {
  if (!app.cityId || !app.weekEnd) return;
  try {
    const [r, d] = await Promise.all([
      getCommunityRanking({
        cityId: app.cityId,
        weekEnd: app.weekEnd,
        metric: app.metric,
        top: 20,
        page: 1,
        pageSize: 20,
        source: app.source || undefined
      }),
      getDistrictCompare({
        cityId: app.cityId,
        weekEnd: app.weekEnd,
        source: app.source || undefined
      })
    ]);
    ranking.value = r.data || [];
    rankingTotal.value = Number(r.total || r.data?.length || 0);
    districtItems.value = d.items || [];
    // v0.8.0 区级近 N 周趋势
    if (app.cityId) {
      trendItems.value = await getCityDistrictOverview({ cityId: app.cityId });
      // v0.10.0 网签热度榜：广州只有新房数据，深圳有新房+二手
      const citiesRes = await getCities();
      const city = citiesRes.items.find((c) => c.city_id === app.cityId);
      const cityName = city?.city_name ?? "";
      const preferredCat: "新房" | "二手" = cityName === "广州" ? "新房" : "二手";
      let heat = await getWangqianHeatmap({
        cityId: app.cityId,
        category: preferredCat,
        weeksBack: 4,
        limit: 10
      });
      // 兜底：再试另一个 category
      if (!heat || heat.items.length === 0) {
        heat = await getWangqianHeatmap({
          cityId: app.cityId,
          category: preferredCat === "二手" ? "新房" : "二手",
          weeksBack: 4,
          limit: 10
        });
      }
      wangqianOverview.value = heat;
      // v0.23.0 trend-9: 全品类区级网签热度榜
      await loadDistrictWangqianRank();
      // v0.24.0 new-5: 通勤时长榜
      try {
        commuteRanking.value = await getCommuteRanking({
          cityId: app.cityId,
          limit: 10
        });
      } catch (e) {
        console.warn("getCommuteRanking failed:", e);
        commuteRanking.value = null;
      }
      // v0.25.0 户型/面积/朝向/装修分布
      try {
        layoutDistribution.value = await getLayoutDistribution({
          cityId: app.cityId
        });
      } catch (e) {
        console.warn("getLayoutDistribution failed:", e);
        layoutDistribution.value = null;
      }
      // v0.28.0 房源 tags 标签云
      try {
        tagCloud.value = await getListingTagCloud({
          cityId: app.cityId,
          limit: 30
        });
        tagCloudFilteredHint.value = "";
      } catch (e) {
        console.warn("getListingTagCloud failed:", e);
        tagCloud.value = null;
      }
      // v0.29.0 区房价指数
      try {
        districtIndex.value = await getDistrictIndex({
          cityId: app.cityId
        });
      } catch (e) {
        console.warn("getDistrictIndex failed:", e);
        districtIndex.value = null;
      }
      // v0.30.0 区涨幅榜
      try {
        districtChange.value = await getDistrictChangeRank({
          cityId: app.cityId
        });
      } catch (e) {
        console.warn("getDistrictChangeRank failed:", e);
        districtChange.value = null;
      }
      // v0.31.0 new-9 生活便利度榜
      try {
        lifeConvenience.value = await getLifeConvenienceRank({
          cityId: app.cityId,
          topN: 8
        });
      } catch (e) {
        console.warn("getLifeConvenienceRank failed:", e);
        lifeConvenience.value = null;
      }
      // v0.33.0 trend-15 小区综合评分榜
      try {
        communityScore.value = await getCommunityScoreRank({
          cityId: app.cityId,
          topN: 8,
          weights: csWeights.value
        });
      } catch (e) {
        console.warn("getCommunityScoreRank failed:", e);
        communityScore.value = null;
      }
      // v0.35.0 map-9 地铁步行通勤榜
      try {
        metroWalk.value = await getMetroWalkRanking({
          cityId: app.cityId,
          topN: 10
        });
      } catch (e) {
        console.warn("getMetroWalkRanking failed:", e);
        metroWalk.value = null;
      }
      // v0.36.0 map-10 地铁规划受益榜
      try {
        metroBenefit.value = await getMetroBenefitRanking({
          cityId: app.cityId,
          topN: 10
        });
      } catch (e) {
        console.warn("getMetroBenefitRanking failed:", e);
        metroBenefit.value = null;
      }
      // v0.41.0 trend-21 房源新鲜度
      await reloadListingFreshness();
      // v0.47.0 school-4 学区指标细分
      await reloadSchoolDims();
      // v0.53.0 macro-1 LPR + 房贷利率
      await reloadLpr();
      // v0.11.0 学区溢价榜
      schoolPremiumOverview.value = await getSchoolPremiumRank({
        cityId: app.cityId,
        limit: 10
      });
      // v0.14.0 + v0.26.0 学区评分 Top 小区 (增强：过滤 + 排序)
      const spc = await getSchoolPremiumCommunityRank({
        cityId: app.cityId,
        minScore: spMinScore.value,
        districtFilter: spDistrictFilter.value,
        sort: spSort.value,
        limit: 10
      });
      schoolPremiumCommunityItems.value = spc?.items ?? [];
    }

    // v0.16.0 实时天气 + 4 天预报
    try {
      weatherResp.value = await getWeather({ cityId: app.cityId });
    } catch (e) {
      console.warn("getWeather failed:", e);
    }

    // v0.17.0 listing 学区溢价榜
    try {
      listingPremiumOverview.value = await getTopListingsBySchoolPremium({
        cityId: app.cityId,
        minScore: 70,
        limit: 10
      });
    } catch (e) {
      console.warn("getTopListingsBySchoolPremium failed:", e);
    }

    // v0.19.0 商业热度榜
    try {
      commercialResp.value = await getCommercialRanking({
        cityId: app.cityId,
        limit: 10
      });
    } catch (e) {
      console.warn("getCommercialRanking failed:", e);
    }
  } catch (e) {
    errorMsg.value = `加载失败：${toErrorMessage(e)}`;
  }
}

function maxDistrictValue() {
  if (app.metric === "listing_count") {
    return Math.max(1, ...districtItems.value.map((i) => i.listing_count || 0));
  }
  const vals = districtItems.value.map((i) => i.avg_unit_price || 0);
  return Math.max(1, ...vals);
}

function districtPct(it: DistrictCompareItem): number {
  if (app.metric === "listing_count") {
    return ((it.listing_count || 0) / maxDistrictValue()) * 100;
  }
  return ((it.avg_unit_price || 0) / maxDistrictValue()) * 100;
}

// ----- v0.8.0 区级近 8 周趋势 -----
function trendDeltaClass(ratio: number | null): string {
  if (ratio == null) return "";
  if (ratio > 0.005) return "trend-up";
  if (ratio < -0.005) return "trend-down";
  return "trend-flat";
}

function trendArrow(ratio: number | null): string {
  if (ratio == null) return "—";
  if (ratio > 0.005) return "▲";
  if (ratio < -0.005) return "▼";
  return "—";
}

function trendPct(ratio: number | null): string {
  if (ratio == null) return "—";
  const pct = ratio * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function formatTrendPrice(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v).toLocaleString()} 元/㎡`;
}

function last4WAvgPrice(it: DistrictTrendItem): number | null {
  const tail = it.points.slice(-4);
  if (tail.length === 0) return null;
  const sum = tail.reduce((s, p) => s + p.avg_unit_price, 0);
  return sum / tail.length;
}

function trendBarPct(it: DistrictTrendItem, p: { avg_unit_price: number }): number {
  if (it.points.length === 0) return 0;
  const vals = it.points.map((q) => q.avg_unit_price);
  const maxV = Math.max(...vals);
  const minV = Math.min(...vals);
  if (maxV === minV) return 50;
  // normalize to 30-100%
  return 30 + ((p.avg_unit_price - minV) / (maxV - minV)) * 70;
}

// ----- v0.10.0 网签热度榜 -----
function rankClass(rank: number): string {
  if (rank === 1) return "wq-rank-gold";
  if (rank === 2) return "wq-rank-silver";
  if (rank === 3) return "wq-rank-bronze";
  return "wq-rank-normal";
}

function wangqianMaxUnits(): number {
  if (!wangqianOverview.value || wangqianOverview.value.items.length === 0) return 1;
  return Math.max(1, ...wangqianOverview.value.items.map((i) => i.totalUnits));
}

function wangqianPct(it: { totalUnits: number }): number {
  return (it.totalUnits / wangqianMaxUnits()) * 100;
}

// ----- v0.23.0 trend-9 全品类区级网签热度榜 -----
function wqRankPct(it: { totalUnits: number }): number {
  if (!districtWangqianRank.value || districtWangqianRank.value.items.length === 0) return 0;
  const max = Math.max(1, ...districtWangqianRank.value.items.map((i) => i.totalUnits));
  return (it.totalUnits / max) * 100;
}

async function setWqRankCat(cat: "新房" | "二手" | "全部") {
  wqRankCat.value = cat;
  await loadDistrictWangqianRank();
}

async function loadDistrictWangqianRank() {
  if (!app.cityId) {
    districtWangqianRank.value = null;
    return;
  }
  try {
    districtWangqianRank.value = await getDistrictWangqianRank({
      cityId: app.cityId,
      category: wqRankCat.value,
      weeksBack: 4,
      limit: 15
    });
  } catch (e) {
    console.warn("getDistrictWangqianRank failed:", e);
    districtWangqianRank.value = null;
  }
}

// ----- v0.11.0 学区溢价榜 -----
function formatNum(n: number): string {
  return n.toLocaleString("zh-CN");
}
function formatPremium(r: number): string {
  const pct = (r * 100).toFixed(1);
  if (r > 0) return `+${pct}%`;
  if (r < 0) return `${pct}%`;
  return "0%";
}
function premiumClass(r: number): string {
  if (r >= 0.15) return "sp-pos-strong";
  if (r > 0) return "sp-pos";
  if (r > -0.1) return "sp-flat";
  return "sp-neg";
}
function medalText(rank: number): string {
  if (rank === 1) return "1";
  if (rank === 2) return "2";
  if (rank === 3) return "3";
  return String(rank);
}
function medalClass(rank: number): string {
  if (rank === 1) return "medal-gold";
  if (rank === 2) return "medal-silver";
  if (rank === 3) return "medal-bronze";
  return "medal-flat";
}
function spMedalClass(rank: number): string {
  if (rank === 1) return "medal-gold";
  if (rank === 2) return "medal-silver";
  if (rank === 3) return "medal-bronze";
  return "medal-flat-mini";
}

// v0.26.0 trend-11 过滤 + 排序 controls
function _computeDistrictOptions(): string[] {
  const districts = new Set<string>();
  for (const c of schoolPremiumCommunityItems.value) {
    districts.add(c.districtName);
  }
  return [...districts].sort();
}

const spDistrictOptions = computed<string[]>(() => _computeDistrictOptions());
const spMinScoreOptions = [0, 70, 75, 80, 85];
const spSortOptions = [
  { value: "avg_school_score", label: "评分" },
  { value: "median_unit_price", label: "均价" },
  { value: "listing_count", label: "挂牌" },
  { value: "school_count", label: "校数" }
] as const;

function toggleSpDistrict(d: string): void {
  const list = spDistrictFilter.value ? spDistrictFilter.value.split("|") : [];
  const idx = list.indexOf(d);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(d);
  spDistrictFilter.value = list.filter(Boolean).join("|");
}

const spSortLabel = computed(() => {
  const opt = spSortOptions.find((o) => o.value === spSort.value);
  return opt ? `按${opt.label}排序` : "";
});

// v0.17.0 listing 学区评分等级 → medal class
function lpScoreClass(score: number): string {
  if (score >= 90) return "medal-gold";
  if (score >= 85) return "medal-silver";
  if (score >= 80) return "medal-bronze";
  return "medal-flat-mini";
}

// v0.17.0 跳到 listing 详情
function goListing(listingId: number) {
  uni.navigateTo({
    url: `/pages/listing-detail/listing-detail?id=${listingId}`
  });
}

// v0.52.0 map-12: 地图模式切换
type MapModeKey = "marker" | "count" | "price" | "school" | "metro";
const MAP_MODES: { key: MapModeKey; icon: string; label: string }[] = [
  { key: "marker", icon: "📍", label: "社区" },
  { key: "count", icon: "🔢", label: "小区数" },
  { key: "price", icon: "💰", label: "均价" },
  { key: "school", icon: "🏫", label: "学区" },
  { key: "metro", icon: "🚇", label: "地铁" }
];
const mapMode = ref<MapModeKey>("marker");

// 计算每个区的 4 项聚合指标: count / price / school / metro
const mapDistrictStats = computed<Record<string, { count: number; avgPrice: number; avgSchool: number; avgMetroMin: number }>>(() => {
  if (!districtMap.value) return {};
  const stats: Record<string, { count: number; sumPrice: number; sumSchool: number; sumMetro: number; cntPrice: number; cntSchool: number; cntMetro: number }> = {};
  // 1. count + price: 用 listings 聚合
  const listings = store.getListingsByCity(app.cityId).filter((l) => l.unitPrice && l.unitPrice > 0);
  for (const l of listings) {
    const m: { district: string } | undefined = districtMap.value.markers.find((x) => x.communityId === l.communityId);
    if (!m) continue;
    const d = m.district;
    if (!stats[d]) stats[d] = { count: 0, sumPrice: 0, sumSchool: 0, sumMetro: 0, cntPrice: 0, cntSchool: 0, cntMetro: 0 };
    stats[d].count += 1;
    stats[d].sumPrice += l.unitPrice!;
    stats[d].cntPrice += 1;
  }
  // 2. school: 用 listingSchoolPremium.csv 含 avgSchoolScore by community -> district
  const lsp = store.getListingSchoolPremiumByCity(app.cityId);
  for (const x of lsp) {
    const m: { district: string } | undefined = districtMap.value.markers.find((mm) => mm.communityId === x.communityId);
    if (!m) continue;
    const d = m.district;
    if (!stats[d]) stats[d] = { count: 0, sumPrice: 0, sumSchool: 0, sumMetro: 0, cntPrice: 0, cntSchool: 0, cntMetro: 0 };
    stats[d].sumSchool += x.avgSchoolScore;
    stats[d].cntSchool += 1;
  }
  // 3. metro: 用 metroWalk.items (含 walkMinutes)
  if (metroWalk.value && metroWalk.value.items.length > 0) {
    for (const it of metroWalk.value.items) {
      const m: { district: string } | undefined = districtMap.value.markers.find((mm) => mm.communityId === it.communityId);
      if (!m) continue;
      const d = m.district;
      if (!stats[d]) stats[d] = { count: 0, sumPrice: 0, sumSchool: 0, sumMetro: 0, cntPrice: 0, cntSchool: 0, cntMetro: 0 };
      if (it.walkMinutes != null) {
        stats[d].sumMetro += it.walkMinutes;
        stats[d].cntMetro += 1;
      }
    }
  }
  // 输出
  const out: Record<string, { count: number; avgPrice: number; avgSchool: number; avgMetroMin: number }> = {};
  for (const k of Object.keys(stats)) {
    const s = stats[k];
    out[k] = {
      count: s.count,
      avgPrice: s.cntPrice > 0 ? Math.round(s.sumPrice / s.cntPrice) : 0,
      avgSchool: s.cntSchool > 0 ? +(s.sumSchool / s.cntSchool).toFixed(1) : 0,
      avgMetroMin: s.cntMetro > 0 ? Math.round(s.sumMetro / s.cntMetro) : 0
    };
  }
  return out;
});

function districtStatLabel(name: string): string {
  const s = mapDistrictStats.value[name];
  if (!s) return "";
  if (mapMode.value === "count") return s.count + " 套";
  if (mapMode.value === "price") return s.avgPrice > 0 ? s.avgPrice + "" : "—";
  if (mapMode.value === "school") return s.avgSchool > 0 ? s.avgSchool.toFixed(1) : "—";
  if (mapMode.value === "metro") return s.avgMetroMin > 0 ? s.avgMetroMin + "'" : "—";
  return "";
}

// 全局 min/max (供颜色梯度用)
const mapStatRange = computed<{ min: number; max: number }>(() => {
  const list = Object.values(mapDistrictStats.value);
  if (list.length === 0) return { min: 0, max: 1 };
  if (mapMode.value === "count") {
    return { min: Math.min(...list.map((s) => s.count)), max: Math.max(...list.map((s) => s.count)) };
  }
  if (mapMode.value === "price") {
    const vs = list.map((s) => s.avgPrice).filter((v) => v > 0);
    return { min: Math.min(...vs), max: Math.max(...vs) };
  }
  if (mapMode.value === "school") {
    const vs = list.map((s) => s.avgSchool).filter((v) => v > 0);
    return { min: Math.min(...vs), max: Math.max(...vs) };
  }
  if (mapMode.value === "metro") {
    const vs = list.map((s) => s.avgMetroMin).filter((v) => v > 0);
    return { min: Math.min(...vs), max: Math.max(...vs) };
  }
  return { min: 0, max: 1 };
});

function districtFill(name: string): string {
  if (mapMode.value === "marker") return "#f1f5f9"; // 浅灰
  const s = mapDistrictStats.value[name];
  if (!s) return "#f1f5f9";
  const r = mapStatRange.value;
  let v = 0;
  if (mapMode.value === "count") v = s.count;
  else if (mapMode.value === "price") v = s.avgPrice;
  else if (mapMode.value === "school") v = s.avgSchool;
  else if (mapMode.value === "metro") v = s.avgMetroMin > 0 ? s.avgMetroMin : r.min;
  if (r.max === r.min) return "#bae6fd";
  const t = (v - r.min) / (r.max - r.min);
  // 颜色梯度: count/price/school: 绿→黄→红 (越高越深); metro: 红→黄→绿 (越低越好, 反转)
  const colors = mapMode.value === "metro"
    ? ["#86efac", "#fef08a", "#fca5a5", "#ef4444"] // low → high
    : ["#bae6fd", "#86efac", "#fde047", "#f97316", "#ef4444"]; // low → high
  const idx = Math.min(colors.length - 1, Math.floor(t * colors.length));
  return colors[Math.max(0, idx)];
}

const mapModeTitle = computed(() => {
  if (mapMode.value === "count") return "小区挂牌数 (越高越红)";
  if (mapMode.value === "price") return "区均价 元/㎡ (越高越红)";
  if (mapMode.value === "school") return "区学区评分 (越高越红)";
  if (mapMode.value === "metro") return "地铁步行分钟 (越低越好, 越绿越好)";
  return "";
});
const mapModeMin = computed(() => {
  const r = mapStatRange.value;
  return mapMode.value === "price" ? r.min.toLocaleString() : String(r.min);
});
const mapModeMax = computed(() => {
  const r = mapStatRange.value;
  return mapMode.value === "price" ? r.max.toLocaleString() : String(r.max);
});
const mapModeGradient = computed(() => {
  if (mapMode.value === "metro") return "linear-gradient(to right, #86efac, #fef08a, #fca5a5, #ef4444)";
  return "linear-gradient(to right, #bae6fd, #86efac, #fde047, #f97316, #ef4444)";
});

// v0.53.0 macro-1: LPR sparkline (近 36 月 5Y LPR)
const LPR_W = 600;
const LPR_H = 90;
const lprSpark5y = computed<{ path: string; last: { x: number; y: number } | null; yLabels: Array<{ y: number; text: string }> }>(() => {
  if (!lpr.value || lpr.value.series.length === 0) {
    return { path: "", last: null, yLabels: [] };
  }
  const data = lpr.value.series.slice(-36);
  const vals = data.map((d) => d.lpr5y);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = Math.max(0.01, max - min);
  const pad = 6;
  const innerW = LPR_W - pad * 2;
  const innerH = LPR_H - pad * 2;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const points = data.map((d, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (d.lpr5y - min) / range) * innerH;
    return { x, y };
  });
  let path = "";
  for (let i = 0; i < points.length; i++) {
    path += (i === 0 ? "M" : "L") + points[i].x.toFixed(1) + "," + points[i].y.toFixed(1) + " ";
  }
  const yLabels: Array<{ y: number; text: string }> = [];
  for (let i = 0; i < 3; i++) {
    const v = min + (range * (2 - i)) / 2;
    yLabels.push({ y: pad + (i * innerH) / 2, text: v.toFixed(2) });
  }
  return { path, last: points[points.length - 1] ?? null, yLabels };
});

// v0.19.0 商业热度评分色码 (>=80 高分 price-up / 50-80 中 muted / <50 低 price-down)
// 注：复用现有价格色码 — price-up 红 = 高商业热度, price-down 绿 = 低
function commercialScoreClass(score: number): string {
  if (score >= 80) return "price-up";
  if (score >= 50) return "muted";
  return "price-down";
}

// v0.24.0 new-5: 通勤时长颜色编码
// 比城市均值快 → 绿（更优）；接近 → 灰；比均值慢 > 30% → 红
function commuteMinutesClass(minutes: number, cityAvg: number | null): string {
  if (cityAvg == null || cityAvg <= 0) return "muted";
  const ratio = minutes / cityAvg;
  if (ratio < 0.85) return "price-down";   // 绿
  if (ratio > 1.3) return "price-up";      // 红
  return "muted";                            // 灰
}

// v0.25.0 户型分布 helpers
const layoutDims: { key: keyof LayoutDistributionResponse["dimensions"]; label: string }[] = [
  { key: "bedrooms", label: "户型" },
  { key: "area_sqm", label: "面积 (㎡)" },
  { key: "orientation", label: "朝向" },
  { key: "decorate", label: "装修" }
];

function formatShare(s: number): string {
  if (!Number.isFinite(s)) return "—";
  const pct = s * 100;
  return pct >= 10 ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`;
}

// v0.28.0 new-6 标签云 helpers
const tagCloudMaxCount = computed(() => {
  if (!tagCloud.value || tagCloud.value.tags.length === 0) return 1;
  return Math.max(...tagCloud.value.tags.map((t) => t.count));
});

function tagSizeClass(count: number, max: number): 1 | 2 | 3 | 4 | 5 {
  if (max <= 0) return 1;
  const ratio = count / max;
  if (ratio >= 0.8) return 5;
  if (ratio >= 0.6) return 4;
  if (ratio >= 0.4) return 3;
  if (ratio >= 0.2) return 2;
  return 1;
}

function onPickTag(tag: string): void {
  tagCloudFilteredHint.value = `已点击标签「${tag}」(v0.28.0 仅展示, 后续版本可联动过滤 listing 列表)`;
}

// v0.29.0 区房价指数 helpers
function diIndexClass(v: number): string {
  if (v >= 110) return "price-up";   // 涨 10%+ 红
  if (v >= 100) return "muted";       // +0-10% 灰
  if (v >= 90) return "muted";        // -0-10% 灰
  return "price-down";                 // -10%+ 绿
}

function diChangeClass(v: number | null): string {
  if (v == null) return "muted";
  if (v > 0.5) return "price-up";
  if (v < -0.5) return "price-down";
  return "muted";
}

/**
 * v0.31.0: 生活便利度分档颜色
 *   ≥80 高 (绿) / 60-79 中 (蓝) / <60 低 (灰)
 */
function lifeScoreClass(s: number): string {
  if (s >= 80) return "lc-score-high";
  if (s >= 60) return "lc-score-mid";
  return "lc-score-low";
}

/**
 * v0.33.0: 综合评分分档颜色
 *   ≥80 高 (绿) / 65-79 中 (蓝) / <65 低 (灰)
 */
function csTotalClass(s: number): string {
  if (s >= 80) return "cs-total-high";
  if (s >= 65) return "cs-total-mid";
  return "cs-total-low";
}

/** v0.33.0: 综合评分金牌前 3 名 */
function csMedalClass(rank: number): string {
  if (rank === 1) return "cs-medal-gold";
  if (rank === 2) return "cs-medal-silver";
  if (rank === 3) return "cs-medal-bronze";
  return "cs-medal-none";
}

function csMedalText(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

/** 把 weeklySeries 转成 sparkline 高度比例 (0-100) */
function sparkPoints(series: Array<{ indexValue: number }>): number[] {
  if (series.length === 0) return [];
  const min = Math.min(...series.map((s) => s.indexValue));
  const max = Math.max(...series.map((s) => s.indexValue));
  const range = max - min;
  if (range === 0) return series.map(() => 50);
  return series.map((s) => Math.round(((s.indexValue - min) / range) * 100));
}

function toggleDistrictIndexExpand(_name: string): void {
  // 此版本仅展示, 不展开额外面板
}

// v0.16.0 weather helpers
function weatherEmoji(cond: string): string {
  if (!cond) return "❓";
  if (cond.includes("晴")) return "☀️";
  if (cond.includes("多云")) return "⛅";
  if (cond.includes("阴")) return "☁️";
  if (cond.includes("雨")) {
    if (cond.includes("雷")) return "⛈️";
    if (cond.includes("大")) return "🌧️";
    return "🌦️";
  }
  if (cond.includes("雪")) return "❄️";
  if (cond.includes("雾")) return "🌫️";
  if (cond.includes("霾")) return "😷";
  return "🌡️";
}

const aqiChipClass = computed(() => {
  const lvl = weatherResp.value?.aqi_estimate?.level;
  if (lvl == null) return "aqi-unknown";
  if (lvl === 0) return "aqi-good";
  if (lvl === 1) return "aqi-ok";
  if (lvl === 2) return "aqi-light";
  return "aqi-mid";
});

const weatherFreshLabel = computed(() => {
  const days = daysAgoFromToday(weatherResp.value?.live?.report_time);
  if (days == null) return "";
  if (days <= 0) return "· 今日";
  return `· ${days} 天前${days > 2 ? "（已过期）" : ""}`;
});

function formatWqArea(sqm: number): string {
  if (sqm >= 10000) return `${(sqm / 10000).toFixed(1)} 万㎡`;
  return `${Math.round(sqm).toLocaleString()} ㎡`;
}

function formatBarValue(it: DistrictCompareItem): string {
  if (app.metric === "listing_count") return `${it.listing_count ?? 0}`;
  return formatUnitPrice(it.avg_unit_price);
}

function onPickDistrict(name: string) {
  // v0.20.0 trend-8: 点击区 → 加载该区所有小区对比
  selectedDistrict.value = name;
  uni.showToast({ title: `已选区：${name}`, icon: "none" });
  loadDistrictCompare(name);
}

async function loadDistrictCompare(districtName: string) {
  if (!app.cityId || !app.weekEnd) {
    districtCompareResp.value = null;
    return;
  }
  try {
    districtCompareResp.value = await getCommunityCompareByDistrict({
      cityId: app.cityId,
      weekEnd: app.weekEnd,
      districtName,
      metric: "avg_unit_price"
    });
  } catch (e) {
    console.warn("getCommunityCompareByDistrict failed:", e);
    districtCompareResp.value = null;
  }
}

function closeDistrictCompare() {
  selectedDistrict.value = null;
  districtCompareResp.value = null;
}

function districtBarPct(it: { avgUnitPrice: number | null; listingCount: number }, maxPrice: number): number {
  if (!it.avgUnitPrice || !maxPrice) return 0;
  return Math.max(2, Math.round((it.avgUnitPrice / maxPrice) * 100));
}

function districtMaxPrice(): number {
  const items = districtCompareResp.value?.items ?? [];
  return Math.max(1, ...items.map((it) => it.avgUnitPrice ?? 0));
}

function goCommunity(id: number) {
  uni.navigateTo({ url: `/pages/community/community?id=${id}` });
}

function goStats70() {
  uni.navigateTo({ url: "/pages/stats70/stats70" });
}

function goWangqian() {
  const name = currentWangqianCityName.value;
  if (name === "深圳" || name === "广州") {
    uni.navigateTo({ url: `/pages/wangqian/wangqian?city=${encodeURIComponent(name)}` });
    return;
  }
  if (zhBdcNew.value && zhBdcStock.value) {
    jumpHomeAnchor("entry-zh-bdc-registration");
    return;
  }
  showToast("当前城市暂无网签日更");
}

function onWangqianCardClick() {
  if (currentWangqian.value) {
    goWangqian();
    return;
  }
  if (zhBdcNew.value && zhBdcStock.value) {
    jumpHomeAnchor("entry-zh-bdc-registration");
  }
}

function openZhBdcSource() {
  const url = zhBdcNew.value?.sourceUrl;
  if (!url) return;
  // #ifdef H5
  window.open(url, "_blank");
  // #endif
  // #ifndef H5
  uni.setClipboardData({
    data: url,
    success: () => showToast("已复制官方公示链接")
  });
  // #endif
}

function openZhPriceFilingSource() {
  const url =
    zhPriceFiling.value?.recent[0]?.sourceUrl ||
    "https://zjj.zhuhai.gov.cn/zjj/hygl/ywgsgg/spfjgbags/";
  // #ifdef H5
  window.open(url, "_blank");
  // #endif
  // #ifndef H5
  uni.setClipboardData({
    data: url,
    success: () => showToast("已复制备案公示链接")
  });
  // #endif
}

// 70 城指数卡片 -------------------------------------------------------
const stats70Ready = computed(() => hasStats70());
const stats70MonthLabel = computed(() => {
  const m = getLatestMonth();
  if (!m) return "";
  return assessStats70Freshness(m).label;
});
const stats70TrendLatestMonth = computed(() => getStats70LatestMonthTrend());
const stats70RecentMonths = computed<string[]>(() =>
  getStats70MonthOptions().slice(-6).reverse()
);
const stats70LatestCities = computed<CityLatestIndex[]>(() => {
  if (!stats70Ready.value) return [];
  return ["深圳", "广州", "珠海"]
    .map((c) => getStats70LatestByCity(c))
    .filter((x): x is CityLatestIndex => x != null);
});

// v0.91.0 派生卡 (stats70-drift-card) 已迁出至 data-tools.vue；computed 删除

/** 用 cityId → 城市名（"深圳" / "广州" 等）。优先异步 cities，回退同步 store，避免首屏 city#id。 */
function cityNameForId(cityId: number): string {
  const c = cities.value.find((x) => x.city_id === cityId);
  if (c?.city_name) return c.city_name;
  return store.getCityById(cityId)?.cityName ?? `city#${cityId}`;
}

function metroLineName(lineId: number): string {
  return store.getMetroLines().find((l) => l.lineId === lineId)?.lineName ?? `线#${lineId}`;
}

// v0.92.0 派生卡（地铁步行可达性概览）已迁出至 data-tools.vue；computed 删除

// v0.93.0 派生卡（分区近 12 周均价变动排行）已迁出至 data-tools.vue；computed 删除

// v1.116.0 全国 70 城涨跌 Top + 当前城市排位 + 趋势方向
const stats70TopUpYoy = computed(() => {
  const date = getStats70LatestMonthTrend();
  if (!date) return [];
  return getStats70TopByTypeByMonth(date, "同比", "new_idx", 5);
});
const stats70TopDownYoy = computed(() => {
  const date = getStats70LatestMonthTrend();
  if (!date) return [];
  return getStats70TopByTypeByMonth(date, "同比", "new_idx", -5);
});
const stats70CityCounts = computed(() => {
  const date = getStats70LatestMonthTrend();
  if (!date) return [];
  return getStats70CrossCityByCityCount(date);
});
const stats70CurrentCityRank = computed(() => {
  if (!stats70Ready.value) return null;
  const name = cityNameForId(app.cityId).replace(/市$/, "");
  if (!name || name.startsWith("city#")) return null;
  return getStats70CurrentCityNationalRank(name, "同比", "new_idx");
});
const stats70CurrentCityTrend = computed(() => {
  if (!stats70Ready.value) return null;
  const name = cityNameForId(app.cityId).replace(/市$/, "");
  if (!name || name.startsWith("city#")) return null;
  return getStats70CityTrendDirection(name, "同比", "new_idx");
});

// v1.121.17 当前城市近 12 月指数序列 + 全国离散度
const stats70City12mName = computed(() => cityNameForId(app.cityId).replace(/市$/, "").replace(/^city#.*/, ""));
const stats70City12m = computed<City12MonthPoint[]>(() => {
  if (!stats70Ready.value || !stats70City12mName.value) return [];
  const all = getStats70CityOver12MonthChange(stats70City12mName.value);
  return all.slice(-6);
});
const stats70MonthSpread = computed<MonthSpreadEntry[]>(() => {
  const date = getStats70LatestMonthTrend();
  if (!date) return [];
  return getStats70CrossCityByMonthSpread(date);
});
function formatStats70Month(date: string): string {
  const parts = date.split("/");
  if (parts.length < 2) return date;
  return `${parts[0]}-${parts[1]!.padStart(2, "0")}`;
}
function idxTone(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "muted";
  if (v >= 100) return "trend-up";
  if (v < 100) return "trend-down";
  return "muted";
}

// v1.121.17 派生卡（重点学校维度）已迁出至 data-tools.vue；computed 删除
const schoolCompositeCrossCity = computed<CityTopComposite[]>(() =>
  crossCityRows(getCityByCompositeRank())
);
const schoolPremiumTier = computed<ThreeTierConsistency | null>(() =>
  getSchoolPremiumThreeTierConsistency().find((x) => x.cityId === app.cityId) ?? null
);
const schoolPremiumDistrictTop = computed<LocalSchoolPremiumDistrict[]>(() =>
  getSchoolPremiumDistrictByCityTop(app.cityId, 5)
);
const schoolPremiumDistrictCrossName = computed(
  () => schoolPremiumDistrictTop.value[0]?.districtName ?? ""
);
const schoolPremiumDistrictCross = computed<CrossCityDistrictEntry[]>(() => {
  const name = schoolPremiumDistrictCrossName.value;
  if (!name) return [];
  return getSchoolPremiumDistrictCrossCityByDistrict(name);
});
const schoolPremiumDistrictCitySummaries = computed<CitySchoolPremiumDistrictSummary[]>(() =>
  summarizeSchoolPremiumDistrictByCity()
);
const schoolPremiumFocusDistrictName = computed(
  () => schoolPremiumDistrictTop.value[0]?.districtName ?? ""
);
const schoolPremiumCommunityByFocusDistrict = computed<LocalSchoolPremiumCommunity[]>(() => {
  const name = schoolPremiumFocusDistrictName.value;
  if (!name) return [];
  return getSchoolPremiumCommunityByDistrict(app.cityId, name).slice(0, 5);
});
const orientationFloorCityBest = computed<CityOrientationFloorTopEntry[]>(() =>
  getOrientationFloorBestWorstByCity(2).best.filter((x) => x.cityId === app.cityId)
);
const orientationFloorCityWorst = computed<CityOrientationFloorTopEntry[]>(() =>
  getOrientationFloorBestWorstByCity(2).worst.filter((x) => x.cityId === app.cityId)
);
const orientationTongtouPriceTop = computed<LocalOrientationFloor[]>(() =>
  getOrientationFloorByOrientationLeaderboard("南北通透", 5)
);
const orientationTongtouFloors = computed<LocalOrientationFloor[]>(() =>
  getOrientationFloorByCityOrientation(app.cityId, "南北通透").slice(0, 5)
);
const orientationHighFloorBuckets = computed<LocalOrientationFloor[]>(() =>
  getOrientationFloorByCityFloorBucket(app.cityId, "高楼层").slice(0, 5)
);
const orientationTongtouHighCross = computed<CrossCityOrientationFloorEntry[]>(() =>
  crossCityRows(getOrientationFloorCrossCityByPair("南北通透", "高楼层"))
);
const orientationFloorCitySummaries = computed<CityOrientationFloorSummary[]>(() =>
  summarizeOrientationFloorByCity()
);

// v1.121.17 分区商业均分
const commercialDistrictTop = computed<DistrictCommercialSummary[]>(() =>
  getCommunityCommercialByCityDistrict(app.cityId).slice(0, 5)
);
const commercialNearestRestaurant = computed<LocalCommunityCommercial[]>(() =>
  getCommunityCommercialByNearest("restaurant", app.cityId, 5)
);
const commercialScoreTop = computed<LocalCommunityCommercial[]>(() =>
  getCommunityCommercialByScoreTopN(app.cityId, 5)
);
const commercialCitySummary = computed<CityCommercialSummary[]>(() =>
  summarizeCommunityCommercialByCity()
);
const schoolPremiumCommunityDeriveTop = computed<LocalSchoolPremiumCommunity[]>(() =>
  getSchoolPremiumCommunityTopByScore(app.cityId, 5)
);
const schoolPremiumCommunityCitySummaries = computed<CitySchoolPremiumCommunitySummary[]>(() =>
  summarizeSchoolPremiumCommunityByCity()
);
const decorateAgeDistBuckets = computed<DistributionRow[]>(() =>
  getDistributionByCityDimension(app.cityId, "精装").slice(0, 6)
);
// v0.25.0 户型分布跨城聚合 + 桶辅助函数（核心卡使用）
const distributionCitySummaries = computed<CityDistributionSummary[]>(() =>
  crossCityRows(summarizeDistributionByCity())
);
function distRowLabel(r: DistributionRow): string {
  if ("decorate" in r && "ageBucket" in r) {
    return `${r.decorate} · ${r.ageBucket}`;
  }
  if ("bedrooms" in r && "areaBucket" in r) {
    return `${r.bedrooms}室 · ${r.areaBucket}`;
  }
  const ld = r as LocalLayoutDistribution;
  return `${ld.dimension} · ${ld.bucket}`;
}
function distRowPrice(r: DistributionRow): number | null {
  return (r as { medianUnitPrice?: number | null }).medianUnitPrice ?? null;
}
const commercialDensityCity = computed<DensityDistanceBucket[]>(() => {
  const cityId = app.cityId;
  return getCommunityCommercialDensityVsDistance("restaurant").map((b) => {
    const communities = b.communities.filter(
      (c) => store.getCommunityById(c.communityId)?.cityId === cityId
    );
    return {
      bucket: b.bucket,
      count: communities.length,
      communities: communities.slice(0, 1)
    };
  });
});

function goSchool(schoolId: number) {
  uni.navigateTo({
    url: `/pages/school-detail/school-detail?id=${schoolId}`,
    fail: (e) => showToast(`打开学校详情失败：${String((e as any)?.errMsg ?? e)}`)
  });
}

// v1.117.0 LPR 与房贷利率信号
const lprLatest = computed(() => getLprLatest());
const lprYearLabel = computed(() => {
  const m = lprLatest.value?.month;
  if (!m) return String(new Date().getFullYear());
  return m.slice(0, 4);
});
const lprYearSeries = computed<LocalLprRow[]>(() => {
  const y = parseInt(lprYearLabel.value, 10);
  if (!Number.isFinite(y)) return [];
  return getLprByYear(y).slice(-6);
});
const lprRange12m = computed<LocalLprRow[]>(() => {
  const latest = lprLatest.value;
  if (!latest) return [];
  const parts = latest.month.split("-");
  if (parts.length < 2) return [];
  const y = parseInt(parts[0]!, 10);
  const m = parseInt(parts[1]!, 10);
  if (!y || !m) return [];
  const from = new Date(y, m - 1, 1);
  from.setMonth(from.getMonth() - 11);
  const minMonth = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;
  return getLprRange(minMonth, latest.month);
});
const lprDelta12m = computed(() => {
  const latest = lprLatest.value;
  if (!latest) return null;
  // 同比：当前月 vs 去年同月
  const parts = latest.month.split("-");
  if (parts.length < 2) return null;
  const y = parseInt(parts[0]!, 10);
  const m = parseInt(parts[1]!, 10);
  if (!y || !m) return null;
  const fromMonthStr = `${y - 1}-${m.toString().padStart(2, "0")}`;
  return getLprDelta(fromMonthStr, latest.month);
});
const lprDownwardCumulative = computed(() => getLprDownwardCumulative());
const lprLongestFlat = computed(() => getLprLongestFlatStreak());
const lprYearSummaries = computed(() => summarizeLprByYear());
const lprSpreadCurrent = computed<LprSpreadSnapshot | null>(
  () => summarizeLprSpread().current
);
const lprYoY = computed(() => summarizeLprCurrentVsYearAgo());
const lprVsAllTimeAvg = computed(() => {
  const avg = getLprMonthlyAverage();
  const latest = lprLatest.value;
  if (!avg || !latest) return null;
  return {
    ...avg,
    lpr5yDeltaBp: Math.round((latest.lpr5y - avg.lpr5yAvg) * 100),
    lpr1yDeltaBp: Math.round((latest.lpr1y - avg.lpr1yAvg) * 100),
    mortgageFirstDeltaBp: Math.round((latest.mortgageFirst - avg.mortgageFirstAvg) * 100)
  };
});
const lprRecentCycles = computed<LprCycle[]>(() =>
  detectLprCutCycles().slice(-5).reverse()
);
function formatBp(bp: number): string {
  return `${bp > 0 ? "+" : ""}${bp} bp`;
}
// v0.93.0 派生卡（分区近 12 周均价变动排行）已迁出至 data-tools.vue；computed 删除

// v0.94.0 派生卡（学校指标各维度 Top + 涨跌）已迁出至 data-tools.vue；computed 删除

const currentCityIndex = computed<LatestIndexForCity | null>(() => {
  if (!hasStats70()) return null;
  const name = cityNameForId(app.cityId).replace(/市$/, "");
  if (!name || name.startsWith("city#")) return null;
  return getLatestIndexForCity(name);
});

/** 贝壳/链家式首屏速览：把分散 KPI 收成 2×2 */
const todayHighlights = computed(() => {
  const items: Array<{ label: string; value: string; sub?: string; toneClass?: string }> = [];
  if (medianUnitPrice.value > 0) {
    items.push({
      label: listingMedianUnitPriceLabel(),
      value: `${medianUnitPrice.value.toLocaleString()} 元/㎡`,
      sub: "卖方挂牌 · 非成交价"
    });
  }
  const idx = currentCityIndex.value;
  if (idx?.secondMoM != null) {
    items.push({
      label: "二手价格指数环比",
      value: formatIndex(idx.secondMoM),
      sub: deltaLabel(idx.secondMoM),
      toneClass: trendClass(idx.secondMoM)
    });
  }
  const wq = wangqianOverview.value;
  if (wq && wq.totalUnits > 0) {
    items.push({
      label: "近4周网签套数",
      value: `${wq.totalUnits} 套`,
      sub: `${wq.cityName} · 成交量非均价`
    });
  }
  if (lprLatest.value) {
    items.push({
      label: "LPR 5年",
      value: `${lprLatest.value.lpr5y.toFixed(2)}%`,
      sub: lprLatest.value.month
    });
  }
  if (gzInventory.value) {
    items.push({
      label: "广州可售",
      value: formatInventoryUnits(gzInventory.value.availableUnits),
      sub: gzInventory.value.date
    });
  }
  return items.slice(0, 4);
});

const priceAxesHint = priceAxesDisclaimer();

function formatIndex(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(1);
}

function deltaLabel(v: number | null): string {
  if (v == null) return "";
  const d = v - 100;
  if (Math.abs(d) < 0.05) return "持平";
  return d > 0 ? `↑ ${d.toFixed(1)}` : `↓ ${Math.abs(d).toFixed(1)}`;
}

function trendClass(v: number | null): string {
  if (v == null) return "";
  if (v > 100) return "stats70-up";
  if (v < 100) return "stats70-down";
  return "stats70-flat";
}

// 政府网签卡片 -------------------------------------------------------
const wangqianReady = computed(() => hasDailyWangqian());

const currentWangqian = computed<CityDailySnapshot | null>(() => {
  if (!hasDailyWangqian()) return null;
  const name = currentWangqianCityName.value;
  if (!name) return null;
  if (name !== "深圳" && name !== "广州") return null;
  return getLatestCityDaily(name);
});

const currentWangqianCityName = computed(() => {
  const name = cityNameForId(app.cityId).replace(/市$/, "");
  return name.startsWith("city#") ? "" : name;
});

const wangqianTrendWeeklyReady = computed(() => getWangqianDistrictWeekly().length > 0);
const wangqianTrendCityName = computed(() => currentWangqianCityName.value);

function wowRowsForCity(city: string): DistrictWoWChange[] {
  if (!city) return [];
  return getWangqianWeeklyWoWChange().filter(
    (x) => x.city === city && Number.isFinite(x.changePct)
  );
}

const wangqianTrendWowUp = computed(() =>
  [...wowRowsForCity(wangqianTrendCityName.value)]
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 3)
);
const wangqianTrendWowDown = computed(() =>
  [...wowRowsForCity(wangqianTrendCityName.value)]
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, 3)
);
const wangqianTrendSpikes = computed((): DistrictSpike[] => {
  const city = wangqianTrendCityName.value;
  if (!city) return [];
  return getWangqianWeeklyRecentSpikes(4, 1.5).filter((x) => x.city === city);
});
const wangqianTrendVolatility = computed((): DistrictVolatility[] => {
  const city = wangqianTrendCityName.value;
  if (!city) return [];
  return getWangqianWeeklyVolatility()
    .filter((x) => x.city === city)
    .sort((a, b) => b.cv - a.cv)
    .slice(0, 3);
});
const wangqianCategoryTrend = computed((): CityCategoryTrend[] => {
  const city = wangqianTrendCityName.value;
  if (!city) return [];
  return getWangqianWeeklyByCityCategoryTrend(4).filter((x) => x.city === city);
});
const wangqianTrendHasCityData = computed(
  () =>
    wangqianTrendWowUp.value.length > 0 ||
    wangqianTrendWowDown.value.length > 0 ||
    wangqianTrendSpikes.value.length > 0
);

function formatWowPct(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}
function formatWqSpikeMultiplier(m: number): string {
  return `×${m.toFixed(1)}`;
}

const wangqianDateLabel = computed(() => {
  const d = currentWangqian.value?.date;
  return d || "";
});

const wangqianDaysAgo = computed(() =>
  daysAgoFromToday(currentWangqian.value?.date)
);
const wangqianFreshLabel = computed(() => {
  const n = wangqianDaysAgo.value;
  if (n == null) return "";
  if (n <= 0) return "今日";
  if (n === 1) return "昨日";
  return `${n} 天前`;
});
const wangqianFreshClass = computed(() => {
  const n = wangqianDaysAgo.value;
  if (n == null) return "";
  if (n <= 3) return "wq-fresh-ok";
  if (n <= 7) return "wq-fresh-warn";
  return "wq-fresh-stale";
});

function formatWangqianUnits(v: number | null): string {
  if (v == null) return "—";
  return String(v);
}

function formatWangqianArea(v: number | null): string {
  if (v == null) return "";
  if (v >= 10000) return `${(v / 10000).toFixed(1)} 万㎡`;
  return `${Math.round(v)} ㎡`;
}

const wangqianWeeklyDistrictTop = computed<DistrictWeeklySummary[]>(() => {
  const city = hospitalCityName.value.replace(/市$/, "");
  return summarizeWangqianWeeklyByDistrict()
    .filter((x) => x.city === city && x.category === "二手")
    .sort((a, b) => b.totalUnits - a.totalUnits)
    .slice(0, 5);
});

// v0.48.0 dashboard-tabs: H5 only — apply active tab via body attribute
function applyTabClass() {
  if (typeof document === "undefined") return;
  const k = activeTab.value;
  document.body.setAttribute("data-dash-tab", k);
}
watch(activeTab, () => {
  applyTabClass();
});

onMounted(async () => {
  uni.$on(SNAPSHOT_UPDATED_EVENT, loadAll);
  loadHiddenCards();
  loadUiState();
  applyTabClass();
  applyCityScopedClass(cityScoped.value);
  const res = await getCities();
  cities.value = res.items || [];
  if (cities.value.length > 0) {
    if (!cities.value.some((c) => c.city_id === app.cityId)) {
      app.setCityId(cities.value[0].city_id);
    }
  } else {
    errorMsg.value = "未获取到城市列表，请检查后端 /api/v1/cities";
  }
  await loadAll();
});

onUnmounted(() => {
  uni.$off(SNAPSHOT_UPDATED_EVENT, loadAll);
  if (typeof document !== "undefined") {
    document.body.removeAttribute("data-dash-tab");
    document.body.classList.remove("city-scoped");
  }
});

onPullDownRefresh(async () => {
  await reload();
  uni.stopPullDownRefresh();
});

// 监听筛选条件变化：切城市或切周期立即重新加载数据
let _lastCityId = -1;
let _lastWeekEnd = "";
let _skipFirstFilterWatch = true;
watch(
  () => [app.cityId, app.weekEnd] as const,
  async ([cityId, weekEnd]) => {
    if (cityId == null || weekEnd == null) return;
    if (_skipFirstFilterWatch) {
      _skipFirstFilterWatch = false;
      _lastCityId = cityId;
      _lastWeekEnd = weekEnd;
      return;
    }
    if (cityId === _lastCityId && weekEnd === _lastWeekEnd) return;
    _lastCityId = cityId;
    _lastWeekEnd = weekEnd;
    // v0.26.0 trend-11: 切城市时重置过滤 (区/最低评分/排序保留)
    spDistrictFilter.value = "";
    spMinScore.value = 0;
    spSort.value = "avg_school_score";
    tagCloudFilteredHint.value = "";
    await loadAll();
  }
);

// v0.26.0 trend-11: 过滤/排序变化时重新加载该卡
watch(
  () => [spDistrictFilter.value, spMinScore.value, spSort.value] as const,
  async () => {
    const cid = app.cityId;
    if (cid == null) return;
    const spc = await getSchoolPremiumCommunityRank({
      cityId: cid,
      minScore: spMinScore.value,
      districtFilter: spDistrictFilter.value,
      sort: spSort.value,
      limit: 10
    });
    schoolPremiumCommunityItems.value = spc?.items ?? [];
  }
);

onShow(async () => {
  // 切回 tab 时若 cityId 变了也重新加载
  if (app.cityId !== _lastCityId) {
    _lastCityId = app.cityId;
    await loadAll();
  }
});
</script>

<style lang="scss" scoped>
/* 总览信息流：同色连续表面 + hairline（对照 MD3 Lists / 贝壳首页 Feed）
 * 验收：docs/DASHBOARD_FEED_ACCEPTANCE.md
 */
.home-personalize-row {
  margin-top: 12rpx;
  display: flex;
  justify-content: flex-end;
}
.home-personalize-btn {
  margin: 0;
  font-size: 22rpx;
  padding: 0 18rpx;
  border-radius: 999px !important;
  background: var(--color-soft, #f5f5f5) !important;
  color: var(--color-text, #333) !important;
}
.home-guide-card {
  /* 默认跟深色主题；浅色用下方选择器覆盖——禁止硬编码浅色渐变当默认（启动白闪） */
  background: linear-gradient(
    135deg,
    rgba(34, 197, 94, 0.14) 0%,
    rgba(59, 130, 246, 0.12) 100%
  );
  border: 1rpx solid rgba(148, 163, 184, 0.28);
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
}
.page[data-realty-theme="light"] .home-guide-card,
[data-realty-theme="light"] .home-guide-card {
  background: linear-gradient(135deg, #f0f4ff 0%, #fef3c7 100%);
  border-color: #c7d2fe;
}
.home-guide-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--color-primary, #4f46e5);
}
.home-guide-close {
  margin: 0;
  font-size: 22rpx;
  padding: 0 12rpx;
  border-radius: 999px !important;
  background: rgba(0, 0, 0, 0.05) !important;
  color: var(--color-muted, #999) !important;
}
.home-guide-list {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.home-guide-row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}
.home-guide-step {
  flex: 0 0 36rpx;
  width: 36rpx;
  height: 36rpx;
  background: var(--color-primary, #4f46e5);
  color: #fff;
  border-radius: 50%;
  font-size: 22rpx;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.home-guide-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  min-width: 0;
}
.home-guide-name {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--color-text, #333);
}
.overview-mode-toggle {
  margin: 0 8rpx;
  font-size: 22rpx;
  padding: 0 18rpx;
  border-radius: 999px !important;
  background: var(--color-primary, #4f46e5) !important;
  color: #fff !important;
}
.advanced-section {
  background: var(--color-panel-soft, #fafafa);
}
.advanced-list {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.advanced-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10rpx 14rpx;
  background: var(--color-surface, #fff);
  border-radius: 8rpx;
  border: 1rpx solid var(--color-border-soft, #eee);
}
.advanced-row--hidden {
  opacity: 0.6;
}
.advanced-info {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  min-width: 0;
}
.advanced-name {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--color-text, #333);
}
.advanced-hot-tag {
  display: inline-block;
  font-size: 20rpx;
  font-weight: 700;
  padding: 0 8rpx;
  margin-right: 6rpx;
  border-radius: 8rpx;
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: #fff;
  vertical-align: middle;
}
.advanced-toggle {
  flex: 0 0 auto;
  margin: 0;
  font-size: 22rpx;
  padding: 0 22rpx;
  border-radius: 999px !important;
  background: var(--color-soft, #f5f5f5) !important;
  color: var(--color-text, #333) !important;
}
.advanced-actions {
  margin-top: 16rpx;
  display: flex;
  justify-content: center;
}
.advanced-expand-btn {
  margin: 0;
  font-size: 24rpx;
  padding: 0 28rpx;
  border-radius: 999px !important;
  background: var(--color-soft, #f5f5f5) !important;
  color: var(--color-primary, #4f46e5) !important;
  font-weight: 600;
}
.card-hide-btn {
  margin: 0 0 0 8rpx;
  font-size: 22rpx;
  line-height: 1;
  padding: 0;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50% !important;
  background: transparent !important;
  color: var(--color-muted, #999) !important;
  border: 1rpx solid var(--color-border-soft, #eee) !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.card-hide-btn:hover {
  background: var(--color-soft, #f5f5f5) !important;
  color: var(--color-text, #333) !important;
}
.page {
  min-height: 100vh;
  /* 与卡片表面同色，避免 margin 露「对比色沟」 */
  background-color: var(--color-surface);
  background-image: none;
}

.container {
  /* 侧向留白保留；纵向靠 hairline 分块，不再靠大块 gutter */
  padding-top: 16rpx;
  padding-bottom: 32rpx;
}

.card {
  margin-bottom: 0;
  border-radius: 0;
  box-shadow: none;
  border-left: none;
  border-right: none;
  border-top: none;
  border-bottom: 1rpx solid var(--color-border);
  background: var(--color-surface);
}

/* 页头筛选：允许轻微抬起，作为唯一「浮层」锚点 */
.filter-card {
  position: relative;
  overflow: hidden;
  margin-bottom: 16rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(34, 197, 94, 0.24);
  box-shadow: var(--shadow-card);
  background: linear-gradient(145deg, var(--color-surface) 0%, rgba(22, 163, 74, 0.055) 100%);
}

.filter-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 22rpx;
}

.dashboard-eyebrow {
  color: var(--color-primary);
  font-size: 19rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  margin-bottom: 5rpx;
}

.data-trust-badge {
  flex: 0 0 auto;
  padding: 8rpx 14rpx;
  border: 1rpx solid rgba(34, 197, 94, 0.28);
  border-radius: 999rpx;
  background: rgba(34, 197, 94, 0.1);
  color: #4ade80;
  font-size: 21rpx;
}

.filter-actions {
  justify-content: flex-end;
}

.gz-inventory-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8rpx;
  margin-top: 16rpx;
}

.gz-inventory-kpi {
  background: var(--color-surface-raised);
  border-radius: 12rpx;
  padding: 16rpx;
}

.gz-inventory-value {
  font-size: 30rpx;
  font-weight: 700;
}

.gz-progress-track {
  margin-top: 8rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(148, 163, 184, 0.28);
  overflow: hidden;
}

.gz-progress-fill {
  height: 100%;
  border-radius: 999rpx;
  background: var(--color-accent, #0ea5e9);
}

.gz-inventory-row {
  display: grid;
  grid-template-columns: 1.2fr repeat(3, 1fr);
  gap: 8rpx;
  padding: 10rpx 0;
  font-size: 22rpx;
  border-bottom: 1rpx solid var(--color-border);
}

.pf-card {
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx dashed var(--color-border);
}

.pf-rate-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8rpx;
  margin-top: 12rpx;
}

.pf-rate-cell {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  font-size: 22rpx;
}

.pf-rate-value {
  font-weight: 700;
  color: var(--color-primary);
}

.pf-saving {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: var(--color-muted);
}

.overview-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 0;
  padding: 16rpx 20rpx;
  border-radius: 0;
  background: var(--color-surface);
  border: none;
  border-bottom: 1rpx solid var(--color-border);
}

.overview-mode-toggle {
  margin: 0;
  border: 1rpx solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.overview-card-summary {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
}

.combo-loan {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx dashed var(--color-border);
}

.combo-title {
  color: var(--color-heading);
  font-size: 25rpx;
  font-weight: 700;
}

.combo-input-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 12rpx;
}

.combo-field {
  display: flex;
  min-width: 0;
  color: var(--color-muted);
  font-size: 20rpx;
  flex-direction: column;
  gap: 7rpx;
}

.combo-input {
  height: 66rpx;
  padding: 0 14rpx;
  border: 1rpx solid var(--color-border);
  border-radius: 10rpx;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 26rpx;
}

.combo-years {
  display: flex;
  gap: 8rpx;
  margin-top: 12rpx;
  flex-wrap: wrap;
  align-items: center;
}

.combo-year-btn,
.combo-reset {
  margin: 0;
  border: 1rpx solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 21rpx;
}

.combo-year-btn--active {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-primary-text);
}

.combo-reset {
  margin-left: auto;
}

.combo-result {
  display: grid;
  gap: 8rpx;
  margin-top: 14rpx;
  padding: 14rpx 16rpx;
  border-radius: 12rpx;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 21rpx;
}

.combo-result > view {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
}

.combo-result-main {
  color: var(--color-heading);
  font-size: 28rpx;
  font-weight: 700;
}

.combo-result-saving {
  color: var(--color-primary);
  font-weight: 700;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-width: 280rpx;
  flex: 1 1 280rpx;
}

/* 用 button 渲染点击区时要清掉默认浏览器样式 */
.tap-row {
  background: transparent;
  border: 0;
  padding: 0;
  margin: 0;
  text-align: left;
  line-height: 1.4;
  font-size: 28rpx;
  color: inherit;
}

.tap-row::after {
  /* 去掉 button 在小程序/app-plus 的默认边框 */
  border: 0;
}

.tap-row--active {
  opacity: 0.7;
}

.form-label {
  color: var(--color-muted);
  font-size: 26rpx;
  min-width: 140rpx;
}

.picker-value {
  background: var(--color-soft);
  border-radius: 8rpx;
  padding: 12rpx 20rpx;
  color: var(--color-heading);
  min-width: 200rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.picker-caret {
  color: var(--color-muted);
  font-size: 22rpx;
  margin-left: 8rpx;
}

.period-hint {
  display: block;
  margin-top: 12rpx;
  color: var(--color-muted);
  font-size: 22rpx;
  line-height: 1.4;
}

/* 内置 sheet popup */
.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.sheet {
  width: 100%;
  max-height: 70vh;
  background: var(--color-surface);
  border-top-left-radius: 24rpx;
  border-top-right-radius: 24rpx;
  display: flex;
  flex-direction: column;
  padding: 16rpx 0 calc(16rpx + var(--safe-area-bottom, 0px));
  box-sizing: border-box;
}

.sheet-title {
  text-align: center;
  font-size: 28rpx;
  color: var(--color-muted);
  padding: 16rpx;
  border-bottom: 1rpx solid var(--color-soft);
}

.sheet-list {
  flex: 1;
  max-height: 56vh;
  padding: 0 16rpx;
}

.sheet-item {
  padding: 24rpx 16rpx;
  border-bottom: 1rpx solid var(--color-soft);
  color: var(--color-heading);
  font-size: 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sheet-item--active {
  color: #4ade80;
  background: var(--color-soft);
}

.sheet-check {
  color: #4ade80;
  font-weight: bold;
}

.sheet-cancel {
  text-align: center;
  padding: 28rpx 0;
  color: var(--color-muted);
  font-size: 30rpx;
  border-top: 1rpx solid var(--color-soft);
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 0;
}

.bar-name {
  width: 140rpx;
  color: #cbd5e1;
  font-size: 24rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-track {
  flex: 1;
  height: 16rpx;
  background: var(--color-soft-strong);
  border-radius: 8rpx;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #4ade80);
  border-radius: 8rpx;
}

.bar-value {
  width: 200rpx;
  text-align: right;
  color: var(--color-heading);
  font-size: 24rpx;
}

.district-note {
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid var(--color-soft-strong);
  font-size: 22rpx;
  line-height: 1.5;
  color: var(--color-muted);
}

.community-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--color-soft-strong);
}

.community-row:last-child {
  border-bottom: none;
}

.community-rank {
  width: 80rpx;
  font-weight: 600;
  color: #4ade80;
}

.community-main {
  flex: 1;
}

.community-name {
  font-size: 30rpx;
  color: var(--color-heading);
  margin-bottom: 4rpx;
}

/* ---------------- 70 城指数卡片 ---------------- */
.stats70-card {
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-panel) 100%);
  border: 1rpx solid var(--color-border);
}

.stats70-foot {
  margin-top: 16rpx;
  text-align: right;
  font-size: 22rpx;
  color: #4ade80;
}

/* F-ENTRY-01 首页多入口 */
.home-entry-card {
  padding-bottom: 18rpx;
}
.home-loc-search {
  display: flex;
  gap: 12rpx;
  align-items: stretch;
}
.home-city-chip {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  box-sizing: border-box;
  min-height: 76rpx;
  padding: 0 18rpx;
  margin: 0;
  border-radius: 999rpx;
  border: 1rpx solid var(--color-border);
  background: var(--color-soft);
  color: var(--color-heading);
  font-size: 26rpx;
  line-height: 1.2;
}
.home-city-chip::after {
  border: none;
}
.home-city-name {
  max-width: 140rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.home-city-caret {
  opacity: 0.6;
  font-size: 22rpx;
}
.home-search {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 6rpx 8rpx 6rpx 18rpx;
  border-radius: 999rpx;
  border: 1rpx solid var(--color-border);
  background: var(--color-surface);
}
.home-search-input {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  height: 64rpx;
  line-height: 64rpx;
  padding: 0;
  font-size: 26rpx;
  color: var(--color-text);
}
.home-search-btn {
  margin: 0;
  border-radius: 999rpx !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  height: 56rpx;
  padding: 0 20rpx;
  line-height: 1;
}
.home-search-modes {
  display: flex;
  gap: 10rpx;
  margin-top: 14rpx;
}
.home-mode-chip {
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  color: var(--color-muted);
  background: var(--color-soft);
  border: 1rpx solid transparent;
}
.home-mode-chip--on {
  color: var(--color-heading);
  border-color: var(--color-border);
  background: var(--color-surface);
  font-weight: 600;
}
.home-channel-scroll {
  margin-top: 14rpx;
  width: 100%;
  white-space: nowrap;
}
.home-channel-row {
  display: inline-flex;
  gap: 12rpx;
  padding: 2rpx 0;
}
.home-channel-chip {
  display: inline-flex;
  padding: 10rpx 22rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  font-weight: 600;
  color: var(--color-heading);
  background: var(--color-soft);
  border: 1rpx solid var(--color-border);
}
.home-kingkong {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12rpx 6rpx;
  margin-top: 18rpx;
}
.home-king-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 0;
}
.home-king-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  background: var(--color-soft);
}
.home-king-icon--blue { background: rgba(37, 99, 235, 0.12); }
.home-king-icon--green { background: rgba(22, 163, 74, 0.14); }
.home-king-icon--red { background: rgba(220, 38, 38, 0.12); }
.home-king-icon--amber { background: rgba(217, 119, 6, 0.14); }
.home-king-icon--violet { background: rgba(79, 70, 229, 0.12); }
.home-king-icon--rose { background: rgba(225, 29, 72, 0.12); }
.home-king-icon--slate { background: rgba(71, 85, 105, 0.14); }
.home-king-label {
  font-size: 22rpx;
  color: var(--color-text);
}
.home-entry-hint {
  display: block;
  margin-top: 12rpx;
  font-size: 20rpx;
  line-height: 1.45;
}

.macro-kicker {
  font-size: 20rpx;
  color: var(--color-muted, #888);
  letter-spacing: 0.06em;
  margin-bottom: 6rpx;
}
.macro-note {
  margin-top: 10rpx;
  font-size: 20rpx;
  line-height: 1.45;
  color: var(--color-muted, #888);
}
.macro-series {
  margin-top: 8rpx;
  font-size: 21rpx;
  line-height: 1.5;
  color: var(--color-muted, #888);
}
.macro-derived .rank-val {
  font-size: 26rpx;
}
.macro-card .gz-inventory-toggle {
  margin-top: 8rpx;
}

.today-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 16rpx;
  gap: 10rpx;
}
.today-cell {
  background: var(--color-soft);
  border: 1rpx solid var(--color-border);
  border-radius: 12rpx;
  padding: 16rpx 18rpx;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.today-label {
  font-size: 20rpx;
}
.today-value {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--color-heading);
}
.today-sub {
  font-size: 20rpx;
}

@media (min-width: 900px) {
  .stats70-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .today-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.stats70-cell {
  flex: 1 1 calc(50% - 8rpx);
  background: var(--color-surface);
  border: 1rpx solid var(--color-soft-strong);
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

/* v1.116.0 全国 70 城涨跌 Top 卡片样式 */
.trend-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 16rpx;
}
.trend-cell {
  background: var(--color-surface);
  border: 1rpx solid var(--color-soft-strong);
  border-radius: 12rpx;
  padding: 14rpx 18rpx;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.rank-row,
.trend-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
  padding: 12rpx 16rpx;
  background: var(--color-panel);
  border: 1rpx solid var(--color-soft);
  border-radius: 10rpx;
}
.rank-val {
  font-size: 26rpx;
  color: var(--color-heading);
  font-weight: 600;
}
.top-section {
  margin-top: 18rpx;
}
.top-line {
  padding: 6rpx 0;
}
.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 12rpx;
  border-bottom: 1rpx solid var(--color-soft-strong);
  font-size: 26rpx;
}
.top-rank {
  color: #cbd5e1;
  font-weight: 500;
}
.top-val {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.trend-up {
  color: #f87171;
}
.trend-down {
  color: #4ade80;
}

.cell-label {
  color: var(--color-muted);
  font-size: 24rpx;
}

.cell-value {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--color-heading);
}

.cell-sub {
  font-size: 22rpx;
  color: var(--color-muted);
}

.stats70-up {
  color: #ef4444 !important;
}

.stats70-down {
  color: #22c55e !important;
}

.stats70-flat {
  color: var(--color-muted) !important;
}

.wangqian-card {
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-panel) 100%);
  border: 1rpx solid var(--color-border);
}

.wangqian-up {
  color: #ef4444 !important;
}

.wangqian-down {
  color: #22c55e !important;
}

.wq-fresh {
  margin-left: 10rpx;
  padding: 2rpx 10rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
}
.wq-fresh-ok {
  background: rgba(34, 197, 94, 0.18);
  color: #4ade80;
}
.wq-fresh-warn {
  background: rgba(234, 179, 8, 0.18);
  color: #facc15;
}
.wq-fresh-stale {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}

.wangqian-res {
  color: #38bdf8 !important;
}

.wangqian-all {
  color: #f59e0b !important;
}

/* v0.8.0 区级近 8 周趋势 */
.trend-row {
  padding: 12rpx 0;
  border-bottom: 1rpx solid var(--color-soft-strong);
}
.trend-row:last-child {
  border-bottom: none;
}
.trend-row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}
.trend-name {
  font-size: 26rpx;
  color: var(--color-heading);
  font-weight: 500;
  min-width: 140rpx;
}
.trend-meta {
  flex: 1;
  text-align: right;
}
.trend-change {
  font-size: 24rpx;
  font-weight: 600;
  min-width: 100rpx;
  text-align: right;
}
.trend-up {
  color: #ef4444;
}
.trend-down {
  color: #22c55e;
}
.trend-flat {
  color: var(--color-muted);
}
.trend-bars {
  display: flex;
  align-items: flex-end;
  height: 60rpx;
  gap: 4rpx;
  margin-top: 8rpx;
}
.trend-bar-col {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.trend-bar-fill {
  width: 80%;
  background: linear-gradient(180deg, #38bdf8 0%, #0ea5e9 100%);
  border-radius: 2rpx 2rpx 0 0;
  min-height: 4rpx;
}
.trend-axis {
  margin-top: 4rpx;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
}
.trend-axis .muted {
  display: block;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}

/* v0.11.0 学区溢价榜 */
.sp-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #f1f5f9;
}
.sp-row:last-of-type {
  border-bottom: none;
}
.sp-rank {
  width: 56rpx;
  text-align: center;
}
.sp-medal {
  display: inline-block;
  width: 40rpx;
  height: 40rpx;
  line-height: 40rpx;
  border-radius: 50%;
  font-weight: 600;
  font-size: 22rpx;
  text-align: center;
  color: #fff;
}
.medal-gold {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
}
.medal-silver {
  background: linear-gradient(135deg, #cbd5e1, #94a3b8);
}
.medal-bronze {
  background: linear-gradient(135deg, #d97706, #b45309);
}
.medal-flat {
  background: var(--color-soft-strong);
  color: #475569;
}
.medal-flat-mini {
  background: var(--color-soft);
  color: var(--color-muted);
}
.sp-medal-mini {
  display: inline-block;
  width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  border-radius: 50%;
  font-weight: 600;
  font-size: 22rpx;
  text-align: center;
  color: #fff;
}
.sp-up {
  color: #0ea5e9;
  font-weight: 600;
  font-family: "Menlo", "Consolas", monospace;
}
.community-sp-price {
  text-align: right;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* v0.16.0 weather */
.weather-live {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8rpx;
  flex-wrap: wrap;
  gap: 12rpx;
}
.weather-main {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.weather-icon {
  font-size: 60rpx;
  line-height: 1;
}
.weather-info {
  display: flex;
  flex-direction: column;
}
.weather-temp {
  font-size: 48rpx;
  font-weight: 700;
  color: #f97316;
  line-height: 1.1;
}
.weather-cond {
  font-size: 24rpx;
  color: var(--color-muted);
}
.weather-stats {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
}
.weather-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: rgba(248, 250, 252, 0.7);
  border-radius: 8rpx;
  padding: 6rpx 12rpx;
}
.weather-stat-label {
  font-size: 20rpx;
  color: var(--color-muted);
}
.weather-stat-value {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--color-heading);
}
.aqi-chip {
  border-radius: 6rpx;
  padding: 2rpx 8rpx;
  font-size: 22rpx !important;
}
.aqi-good { background: rgba(34, 197, 94, 0.18); color: #15803d !important; }
.aqi-ok { background: rgba(132, 204, 22, 0.18); color: #65a30d !important; }
.aqi-light { background: rgba(234, 179, 8, 0.18); color: #b45309 !important; }
.aqi-mid { background: rgba(220, 38, 38, 0.18); color: #b91c1c !important; }
.aqi-unknown { background: rgba(148, 163, 184, 0.15); color: #475569 !important; }
.weather-forecast {
  margin-top: 12rpx;
}
.forecast-title {
  font-size: 22rpx;
  color: var(--color-muted);
  margin-bottom: 8rpx;
}
.forecast-grid {
  display: flex;
  gap: 8rpx;
  overflow-x: auto;
}
.forecast-day {
  flex: 1;
  min-width: 110rpx;
  background: rgba(248, 250, 252, 0.7);
  border-radius: 8rpx;
  padding: 8rpx 4rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
}
.forecast-week {
  font-size: 22rpx;
  font-weight: 600;
  color: var(--color-heading);
}
.forecast-date {
  font-size: 18rpx;
  color: var(--color-muted);
}
.forecast-icon {
  font-size: 36rpx;
  line-height: 1;
}
.forecast-temp {
  display: flex;
  gap: 4rpx;
}
.forecast-high {
  font-size: 24rpx;
  font-weight: 700;
  color: #dc2626;
}
.forecast-low {
  font-size: 22rpx;
  color: #0ea5e9;
}
.forecast-cond {
  font-size: 18rpx;
  color: #475569;
}

.sp-mid {
  flex: 1;
}
.sp-district {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--color-heading);
}
.sp-meta {
  font-size: 22rpx;
  color: #475569;
  margin-top: 4rpx;
}
.sp-right {
  text-align: right;
}
.sp-premium {
  font-size: 26rpx;
  font-weight: 700;
  font-family: "Menlo", "Consolas", monospace;
}
.sp-pos-strong { color: #16a34a; }
.sp-pos { color: #22c55e; }
.sp-flat { color: var(--color-muted); }
.sp-neg { color: #dc2626; }

/* v0.23.0 trend-9 全品类网签榜 tabs */
.wq-cat-tabs {
  display: flex;
  gap: 8rpx;
  margin: 8rpx 0;
}
.wq-cat-tab {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 16rpx;
  border: 1rpx solid #475569;
}
.wq-cat-tab-on {
  background: #0ea5e9;
  color: #ffffff;
  border-color: #0ea5e9;
}
.wq-cat-tab-off {
  background: transparent;
  color: #cbd5e1;
}

/* 网签周环比 + 突增区 */
.wq-trend-section-title {
  margin: 8rpx 0 4rpx;
  font-size: 22rpx;
}
.wq-trend-block {
  margin-bottom: 12rpx;
}
.wq-trend-sub {
  font-size: 22rpx;
  margin-bottom: 4rpx;
}
.wq-trend-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8rpx;
  padding: 6rpx 0;
  border-bottom: 1rpx solid var(--color-border);
  font-size: 24rpx;
}
.wq-trend-row:last-child {
  border-bottom: none;
}
.wq-trend-row--spike {
  background: var(--color-soft);
  border-radius: 8rpx;
  padding: 8rpx 10rpx;
  margin-bottom: 6rpx;
  border-bottom: none;
}
.wq-trend-idx {
  width: 36rpx;
  font-size: 22rpx;
  color: var(--color-muted);
  flex-shrink: 0;
}
.wq-trend-name {
  flex: 1 1 140rpx;
  min-width: 120rpx;
  color: var(--color-heading);
  font-weight: 500;
}
.wq-trend-cat {
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 12rpx;
  border: 1rpx solid var(--color-border);
  background: var(--color-soft);
  color: var(--color-muted);
  flex-shrink: 0;
}
.wq-trend-pct {
  font-weight: 600;
  font-family: "Menlo", "Consolas", monospace;
  flex-shrink: 0;
}
.wq-trend-up {
  color: #ef4444;
}
.wq-trend-down {
  color: #22c55e;
}
.wq-trend-mult {
  font-weight: 700;
  color: var(--color-on-warn-soft, var(--color-heading));
}
.wq-trend-units {
  font-size: 20rpx;
  flex: 0 0 auto;
}

/* v0.24.0 new-5: 通勤时长 badge */
.commute-badge {
  display: inline-block;
  font-size: 22rpx;
  font-weight: 600;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
}
.wq-area {
  flex: 0 0 100rpx;
  font-size: 22rpx;
  color: var(--color-muted);
  text-align: right;
}

/* v0.25.0 户型分布 */
.ld-dim-title {
  font-size: 24rpx;
  font-weight: 600;
  color: #cbd5e1;
  margin-bottom: 6rpx;
  padding-left: 4rpx;
}
.ld-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 4rpx 0;
  font-size: 22rpx;
}
.ld-bucket {
  flex: 0 0 90rpx;
  color: #cbd5e1;
  font-weight: 500;
}
.ld-bar-wrap {
  flex: 1 1 auto;
  height: 16rpx;
  background: var(--color-soft-strong);
  border-radius: 8rpx;
  overflow: hidden;
}
.ld-bar {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #0ea5e9);
  border-radius: 8rpx;
  min-width: 4rpx;
}
.ld-count {
  flex: 0 0 80rpx;
  text-align: right;
  color: #cbd5e1;
}
.ld-pct {
  flex: 0 0 80rpx;
  text-align: right;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

/* v0.26.0 trend-11 学区评分小区榜 - 过滤/排序控件 */
.spc-controls {
  padding: 8rpx 0 12rpx;
  border-bottom: 1rpx dashed var(--color-soft-strong);
  margin-bottom: 6rpx;
}
.spc-row {
  display: flex;
  align-items: flex-start;
  gap: 8rpx;
  padding: 4rpx 0;
  font-size: 22rpx;
}
.spc-label {
  flex: 0 0 90rpx;
  color: var(--color-muted);
  padding-top: 6rpx;
}
.spc-chips {
  flex: 1 1 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 6rpx;
}
.spc-chip {
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  background: var(--color-panel);
  border: 1rpx solid #334155;
  color: #cbd5e1;
  font-size: 22rpx;
}
.spc-chip-on {
  background: #0ea5e9;
  color: #fff;
  border-color: #38bdf8;
}

/* v0.28.0 new-6 标签云 */
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  padding: 6rpx 0 4rpx;
}
.tag-chip {
  display: inline-block;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: var(--color-panel);
  border: 1rpx solid #334155;
  color: #cbd5e1;
  font-weight: 500;
}
.tag-chip:active {
  background: #0ea5e9;
  color: #fff;
  border-color: #38bdf8;
}
.tag-size-1 {
  font-size: 22rpx;
}
.tag-size-2 {
  font-size: 26rpx;
  color: var(--color-text);
}
.tag-size-3 {
  font-size: 30rpx;
  color: #f1f5f9;
  background: var(--color-soft);
}
.tag-size-4 {
  font-size: 34rpx;
  color: #fff;
  background: #0c4a6e;
  border-color: #0ea5e9;
}
.tag-size-5 {
  font-size: 40rpx;
  color: #fff;
  background: linear-gradient(90deg, #0ea5e9, #38bdf8);
  border-color: #38bdf8;
  font-weight: 600;
}

/* v0.29.0 区房价指数 */
.di-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 10rpx 0;
  border-bottom: 1rpx solid var(--color-soft-strong);
}
.di-mid {
  flex: 1 1 auto;
  min-width: 0;
}
.di-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #f1f5f9;
}
.di-right {
  flex: 0 0 auto;
  text-align: right;
}
.di-index {
  font-size: 36rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.di-spark-wrap {
  flex: 0 0 220rpx;
  display: flex;
  align-items: flex-end;
  gap: 2rpx;
  height: 40rpx;
}
.di-spark-bar {
  flex: 1 1 auto;
  background: #38bdf8;
  border-radius: 2rpx;
  min-height: 4rpx;
  opacity: 0.7;
}

/* v0.30.0 区涨幅榜 */
.dc-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 0;
  border-bottom: 1rpx solid var(--color-soft-strong);
}
.dc-rank {
  flex: 0 0 60rpx;
}
.dc-mid {
  flex: 1 1 auto;
  min-width: 0;
}
.dc-name {
  font-size: 28rpx;
  font-weight: 500;
  color: var(--color-text);
}
.dc-right {
  flex: 0 0 auto;
  text-align: right;
}
.dc-4w {
  font-size: 32rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* v0.31.0 生活便利度榜 */
.lc-summary {
  font-size: 22rpx;
  margin-bottom: 8rpx;
}
.lc-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 0;
  border-bottom: 1rpx solid var(--color-border);
}
.lc-row:last-child {
  border-bottom: none;
}
.lc-mid {
  flex: 1;
  min-width: 0;
}
.lc-name {
  font-size: 26rpx;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lc-dist {
  font-size: 20rpx;
}
.lc-scores {
  display: flex;
  gap: 6rpx;
  flex-wrap: nowrap;
}
.lc-dim {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--color-soft);
  border-radius: 6rpx;
  padding: 2rpx 6rpx;
  min-width: 32rpx;
}
.lc-dim-label {
  font-size: 18rpx;
  color: var(--color-muted);
  font-weight: 600;
}
.lc-dim-val {
  font-size: 22rpx;
  color: var(--color-chip-text);
  font-variant-numeric: tabular-nums;
}
.lc-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 60rpx;
}
.lc-score {
  font-size: 32rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* v1.121.15 医院坐标对 / 周边商业 / 菜市场 */
.hosp-geo-pair,
.pc-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 8rpx 0;
  border-bottom: 1rpx solid var(--color-border);
}
.hosp-geo-pair:last-child,
.pc-row:last-child {
  border-bottom: none;
}
.hosp-geo-rank,
.pc-rank {
  width: 36rpx;
  font-size: 22rpx;
  text-align: center;
}
.hosp-geo-names {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hosp-geo-km,
.pc-dist,
.pc-score {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--color-heading);
  font-variant-numeric: tabular-nums;
}
.pc-summary {
  display: flex;
  gap: 10rpx;
  margin: 8rpx 0 4rpx;
}
.pc-kpi {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 6rpx;
  border-radius: 12rpx;
  background: var(--color-soft);
  border: 1rpx solid var(--color-border);
}
.pc-kpi-val {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--color-heading);
  font-variant-numeric: tabular-nums;
}
.pc-kpi-label {
  font-size: 20rpx;
  margin-top: 2rpx;
}
.pc-mid {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.pc-name {
  font-size: 26rpx;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pc-meta {
  font-size: 20rpx;
}

/* v1.121.19 商业密度×距离分桶 */
.dens-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}
.dens-cell {
  flex: 1;
  min-width: 140rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10rpx 6rpx;
  border-radius: 12rpx;
  background: var(--color-soft);
  border: 1rpx solid var(--color-border);
}
.dens-n {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--color-heading);
  font-variant-numeric: tabular-nums;
}
.dens-l {
  font-size: 20rpx;
  margin-top: 2rpx;
}
.dens-ex {
  font-size: 18rpx;
  margin-top: 4rpx;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lc-score-high {
  color: #22c55e;
}
.lc-score-mid {
  color: #38bdf8;
}
.lc-score-low {
  color: var(--color-muted);
}

/* v0.33.0 小区综合评分榜 */
.cs-summary {
  font-size: 22rpx;
  margin-bottom: 8rpx;
}
.cs-weights {
  background: var(--color-panel);
  border-radius: 8rpx;
  padding: 10rpx 12rpx;
  margin-bottom: 12rpx;
}
.cs-presets {
  display: flex;
  gap: 8rpx;
  margin-bottom: 12rpx;
  flex-wrap: wrap;
}
.cs-preset-chip {
  font-size: 22rpx;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: var(--color-soft);
  color: #cbd5e1;
  border: 1rpx solid #334155;
}
.cs-preset-on {
  background: #38bdf8;
  color: var(--color-heading);
  border-color: #38bdf8;
  font-weight: 600;
}
.cs-slider-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 4rpx;
}
.cs-slider-label {
  font-size: 22rpx;
  color: var(--color-muted);
  min-width: 60rpx;
}
.cs-slider {
  flex: 1;
}
.cs-slider-val {
  font-size: 22rpx;
  color: var(--color-text);
  min-width: 60rpx;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.cs-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 0;
  border-bottom: 1rpx solid var(--color-soft-strong);
}
.cs-row:last-child {
  border-bottom: none;
}
.cs-rank {
  width: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cs-medal {
  font-size: 36rpx;
  font-weight: 700;
}
.cs-medal-gold {
  color: #fbbf24;
}
.cs-medal-silver {
  color: #d1d5db;
}
.cs-medal-bronze {
  color: #fb923c;
}
.cs-medal-none {
  color: var(--color-muted);
  font-size: 28rpx;
}
.cs-mid {
  flex: 1;
  min-width: 0;
}
.cs-name {
  font-size: 26rpx;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cs-dist {
  font-size: 20rpx;
}
.cs-scores {
  display: flex;
  gap: 6rpx;
  flex-wrap: nowrap;
}
.cs-dim {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--color-soft);
  border-radius: 6rpx;
  padding: 2rpx 6rpx;
  min-width: 50rpx;
}
.cs-dim-label {
  font-size: 18rpx;
  color: var(--color-muted);
  font-weight: 600;
}
.cs-dim-val {
  font-size: 22rpx;
  color: #cbd5e1;
  font-variant-numeric: tabular-nums;
}
.cs-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 60rpx;
}
.cs-total {
  font-size: 36rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.cs-total-high {
  color: #22c55e;
}
.cs-total-mid {
  color: #38bdf8;
}
.cs-total-low {
  color: var(--color-muted);
}

/* v0.10.0 网签热度榜 */
.wq-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 0;
  border-bottom: 1rpx solid var(--color-soft-strong);
}
.wq-row:last-child {
  border-bottom: none;
}
.wq-rank {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 600;
  background: #334155;
  color: #cbd5e1;
  flex-shrink: 0;
}
.wq-rank-gold {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: var(--color-text);
}
.wq-rank-silver {
  background: linear-gradient(135deg, #e5e7eb 0%, #94a3b8 100%);
  color: var(--color-text);
}
.wq-rank-bronze {
  background: linear-gradient(135deg, #d97706 0%, #92400e 100%);
  color: #fffbeb;
}
.wq-rank-normal {
  background: var(--color-soft);
  color: var(--color-muted);
}
.wq-name {
  width: 140rpx;
  font-size: 26rpx;
  color: var(--color-heading);
  font-weight: 500;
  flex-shrink: 0;
}
.wq-track {
  flex: 1;
  height: 14rpx;
  background: var(--color-soft);
  border-radius: 4rpx;
  overflow: hidden;
}
.wq-fill {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8 0%, #0ea5e9 100%);
  border-radius: 4rpx;
}
.wq-units {
  width: 180rpx;
  font-size: 24rpx;
  color: var(--color-heading);
  text-align: right;
  flex-shrink: 0;
}
.tc-bar {
  background: linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%);
  border-radius: 6rpx;
}

/* v0.41.0 trend-21: 房源新鲜度 */
.lf-section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--color-heading);
  margin: 16rpx 0 8rpx;
  padding-left: 6rpx;
  border-left: 6rpx solid #0ea5e9;
}
.lf-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 10rpx 0;
  border-bottom: 1rpx solid #f1f5f9;
}
.lf-row:last-child {
  border-bottom: none;
}
.lf-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2rpx;
}
.lf-name {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--color-heading);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lf-mid {
  display: flex;
  gap: 18rpx;
  font-size: 22rpx;
  flex-shrink: 0;
}
.lf-line {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
  min-width: 70rpx;
}
.lf-k {
  font-size: 20rpx;
  color: var(--color-muted);
}
.lf-v {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--color-heading);
}
.lf-score {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 700;
  flex-shrink: 0;
}
.lf-fresh-up {
  background: var(--color-success-soft);
  color: #16a34a;
}
.lf-fresh-mid {
  background: var(--color-warn-soft);
  color: #d97706;
}
.lf-fresh-down {
  background: var(--color-danger-soft);
  color: #dc2626;
}

.map-wrap {
  width: 100%;
  margin-top: 12rpx;
  background: var(--color-soft);
  border-radius: 8rpx;
  padding: 8rpx;
  overflow: hidden;
}
.map-svg {
  width: 100%;
  height: auto;
  max-height: 60vh;
  display: block;
  background: var(--color-soft);
  border-radius: 4rpx;
}
.map-district-p {
  fill: rgba(186, 230, 253, 0.55);
  stroke: #1e40af;
  stroke-width: 1.5;
  stroke-opacity: 0.85;
  stroke-linejoin: round;
  transition: fill 0.2s;
}

/* v0.52.0 map-12: 地图模式 tab + legend */
.map-mode-tabs {
  display: flex;
  gap: 8rpx;
  margin: 8rpx 0;
  flex-wrap: wrap;
}
.map-mode-tab {
  flex: 1;
  min-width: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  padding: 8rpx 12rpx;
  border-radius: 8rpx;
  background: var(--color-soft);
  font-size: 22rpx;
  color: #475569;
  cursor: pointer;
  transition: background 0.15s;
}
.map-mode-tab:hover {
  background: var(--color-soft-strong);
}
.map-mode-tab--active {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-weight: 600;
}
.map-mode-icon {
  font-size: 22rpx;
}
.map-mode-label {
  font-size: 22rpx;
}
.map-legend {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin: 4rpx 0 8rpx;
  font-size: 20rpx;
  color: #475569;
}
.map-legend-title {
  white-space: nowrap;
  font-size: 20rpx;
}
.map-legend-bar {
  flex: 1;
  height: 14rpx;
  border-radius: 4rpx;
  min-width: 80rpx;
}
.map-legend-min, .map-legend-max {
  font-size: 20rpx;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--color-chip-text);
}
.map-district-val {
  font-size: 12px;
  font-weight: 700;
  fill: var(--color-soft);
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.85);
  stroke-width: 3;
  stroke-linejoin: round;
}

/* v0.53.0 macro-1 LPR 卡片样式 */
.lpr-kpi {
  display: flex;
  gap: 8rpx;
  margin: 12rpx 0;
}
.lpr-kpi-cell {
  flex: 1;
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  border-radius: 10rpx;
  padding: 14rpx 10rpx;
  text-align: center;
  border: 1rpx solid #fcd34d;
}
.lpr-kpi-cell--5y {
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  border-color: #f87171;
}
.lpr-kpi-label {
  font-size: 20rpx;
  color: #78350f;
  margin-bottom: 4rpx;
}
.lpr-kpi-val {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--color-heading);
  font-variant-numeric: tabular-nums;
}
.lpr-kpi-val--down {
  color: #15803d;
}
.lpr-kpi-unit {
  font-size: 20rpx;
  font-weight: 500;
  margin-left: 2rpx;
}
.lpr-drop-row {
  display: flex;
  gap: 12rpx;
  margin: 8rpx 0 12rpx;
}
.lpr-drop-cell {
  flex: 1;
  background: var(--color-panel);
  border-radius: 8rpx;
  padding: 10rpx 12rpx;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.lpr-drop-label {
  font-size: 20rpx;
  color: var(--color-muted);
}
.lpr-drop-val {
  font-size: 22rpx;
  font-weight: 600;
  color: var(--color-chip-text);
  font-variant-numeric: tabular-nums;
}
.lpr-drop-val--down {
  color: #16a34a;
}
.lpr-drop-val--up {
  color: #dc2626;
}
.lpr-chart-title {
  font-size: 24rpx;
  color: var(--color-chip-text);
  font-weight: 600;
  margin: 8rpx 0 4rpx;
}
.lpr-chart-wrap {
  background: var(--color-panel);
  border-radius: 8rpx;
  padding: 4rpx;
}
.lpr-chart {
  display: block;
  width: 100%;
  height: 140rpx;
}
.lpr-chart-ylbl {
  font-size: 9px;
  fill: #94a3b8;
}
.lpr-chart-xlbl {
  font-size: 9px;
  fill: #94a3b8;
}
/* v0.52.0 map-12: 模式叠加时禁用默认 fill, 使用 :fill 属性 */
.map-district-p--mode {
  fill-opacity: 0.85;
}
.map-district-p:hover {
  fill: rgba(254, 215, 170, 0.7);
}
.map-district-lbl {
  font-size: 14px;
  font-weight: 600;
  fill: #1e3a8a;
  pointer-events: none;
  text-shadow: 0 0 4px rgba(255, 255, 255, 0.9);
}
.map-marker {
  fill: #dc2626;
  stroke: white;
  stroke-width: 1.5;
  fill-opacity: 0.85;
}
.map-marker-bare {
  fill: #dc2626;
  fill-opacity: 0.7;
}
.map-marker-lbl {
  font-size: 11px;
  font-weight: 500;
  fill: #991b1b;
  text-shadow: 0 0 3px rgba(255, 255, 255, 0.9);
  pointer-events: none;
}

/* v0.47.0 school-4: 学区指标 */
.sd-block {
  margin-bottom: 16rpx;
}
.sd-block-title {
  font-weight: 600;
  font-size: 26rpx;
  margin: 12rpx 0 8rpx;
  color: var(--color-heading);
}
.sd-ovr {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.sd-ovr-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 10rpx 12rpx;
  background: var(--color-panel);
  border-radius: 8rpx;
}
.sd-rank {
  font-size: 28rpx;
  font-weight: 700;
  color: #6366f1;
  min-width: 28rpx;
  text-align: center;
}
.sd-info {
  flex: 1;
  min-width: 0;
}
.sd-name {
  font-size: 26rpx;
  font-weight: 500;
  color: var(--color-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sd-meta {
  font-size: 20rpx;
  margin-top: 2rpx;
}
.sd-score-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 110rpx;
}
.sd-score-bar {
  width: 100rpx;
  height: 8rpx;
  background: var(--color-soft-strong);
  border-radius: 4rpx;
  overflow: hidden;
  margin-bottom: 4rpx;
}
.sd-score-fill {
  height: 100%;
  border-radius: 4rpx;
}
.sd-score-num {
  font-size: 22rpx;
  font-weight: 700;
  color: var(--color-heading);
}
.sd-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
}
.sd-cell {
  background: var(--color-panel);
  border-radius: 8rpx;
  padding: 12rpx;
}
.sd-cell-h {
  font-size: 22rpx;
  font-weight: 600;
  color: #475569;
  margin-bottom: 6rpx;
}
.sd-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 22rpx;
  line-height: 1.7;
}
.sd-rank-sm {
  font-weight: 700;
  color: #6366f1;
  width: 18rpx;
  text-align: center;
}
.sd-name-sm {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sd-val {
  font-weight: 700;
  color: var(--color-heading);
  font-size: 22rpx;
}
.sd-pos {
  color: #16a34a;
}
.sd-neg {
  color: #dc2626;
}

/* v0.50.0 drill-1: 小区 drill-down */
.scatter-row.tap-row {
  cursor: pointer;
  transition: background 0.15s;
}
.scatter-pt {
  cursor: pointer;
  transition: fill-opacity 0.15s, r 0.1s;
}
.scatter-pt:hover {
  fill-opacity: 0.95;
  stroke: #fde047;
  stroke-width: 2.5;
}
.map-marker-g {
  cursor: pointer;
}
.map-marker-g:hover .map-marker {
  fill: #ef4444;
  r: 7;
}
.map-marker-bare.tap-row {
  cursor: pointer;
}
.map-marker-bare.tap-row:hover {
  fill: #ef4444;
}

/* v0.49.0 topnav-1: 周次切换 sticky bar
 * 信息流同色表面（对照贝壳/链家顶栏：浅底+细分隔，非深色浮岛）
 */
.topnav-period {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 16rpx 24rpx 12rpx;
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: 0;
  margin: 0;
  box-shadow: none;
  border-bottom: 1rpx solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 50;
}
.topnav-p-week {
  font-size: 28rpx;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  color: var(--color-text-secondary);
}
.topnav-p-num {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--color-primary);
  font-family: "SF Mono", Consolas, monospace;
}
.topnav-p-btns {
  display: flex;
  gap: 12rpx;
}
.topnav-p-btn {
  flex: 1;
  padding: 10rpx 0;
  border-radius: 10rpx;
  background: var(--color-soft);
  color: var(--color-text);
  font-size: 24rpx;
  font-weight: 600;
  text-align: center;
  border: 1rpx solid var(--color-border);
  transition: background 0.15s, transform 0.1s;
}
.topnav-p-btn:active {
  background: var(--color-primary-soft, rgba(29, 78, 216, 0.12));
  transform: scale(0.97);
}
.topnav-p-btn--disabled {
  opacity: 0.35;
  pointer-events: none;
}

</style>

<!-- v0.48.0 / v1.121.117：App+H5 用 .page[data-dash-tab]；H5 双写 body 兼容旧 smoke -->
<style lang="scss">
.page[data-dash-tab="overview"] .card[data-tab]:not([data-tab*="overview"]):not([data-tab*="all"]),
body[data-dash-tab="overview"] .card[data-tab]:not([data-tab*="overview"]):not([data-tab*="all"]),
.page[data-dash-tab="price"] .card[data-tab]:not([data-tab*="price"]):not([data-tab*="all"]),
body[data-dash-tab="price"] .card[data-tab]:not([data-tab*="price"]):not([data-tab*="all"]),
.page[data-dash-tab="school"] .card[data-tab]:not([data-tab*="school"]):not([data-tab*="all"]),
body[data-dash-tab="school"] .card[data-tab]:not([data-tab*="school"]):not([data-tab*="all"]),
.page[data-dash-tab="transit"] .card[data-tab]:not([data-tab*="transit"]):not([data-tab*="all"]),
body[data-dash-tab="transit"] .card[data-tab]:not([data-tab*="transit"]):not([data-tab*="all"]),
.page[data-dash-tab="map"] .card[data-tab]:not([data-tab*="map"]):not([data-tab*="all"]),
body[data-dash-tab="map"] .card[data-tab]:not([data-tab*="map"]):not([data-tab*="all"]) {
  display: none !important;
}

/* 默认仅看本市：隐藏标注了跨城对照的区块 */
.page.city-scoped [data-cross-city],
body.city-scoped [data-cross-city] {
  display: none !important;
}
</style>
