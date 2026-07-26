<template>
  <view class="page">
    <view class="container">
      <!-- 顶部筛选：用 view+tap 触发 action sheet，避开 picker 兼容问题 -->
      <view class="card filter-card">
        <view class="filter-card-head">
          <view>
            <view class="dashboard-eyebrow">REALTY ANALYTICS</view>
            <view class="card-title" style="margin-bottom: 0">市场数据工作台</view>
          </view>
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
      <view class="card" v-if="stats70Ready">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">全国 70 城 · 涨跌 Top</view>
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
      <view class="card" v-if="lprLatest">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🏦 LPR 与房贷利率</view>
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

      <!-- 政府每日网签（摘要，点击进详情页） -->
      <view
        class="card wangqian-card tap-target"
        role="button"
        tabindex="0"
        hover-class="card-active"
        @click="goWangqian"
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

        <view class="stats70-foot">点击查看 90 日趋势与分区 ›</view>
      </view>

      <!-- v0.91.0 70 城 12 月趋势对比（派生：基于 stats_70.csv） -->
      <view
        v-if="stats70Ready && driftReady"
        class="card stats70-drift-card tap-target"
        role="button"
        tabindex="0"
        hover-class="card-active"
        @click="goStats70"
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">全国 70 城 · 近 12 月同比趋势</view>
          <view class="muted" style="font-size: 22rpx">派生 / {{ driftLatestLabel || "—" }}</view>
        </view>
        <view class="stats70-grid">
          <view class="stats70-cell">
            <text class="cell-label">扩张</text>
            <text class="cell-value drift-up">{{ driftDistribution?.expanding.length ?? 0 }}</text>
            <text class="cell-sub muted">个</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">收缩</text>
            <text class="cell-value drift-down">{{ driftDistribution?.contracting.length ?? 0 }}</text>
            <text class="cell-sub muted">个</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">数据不足</text>
            <text class="cell-value drift-unknown">{{ driftDistribution?.unknown ?? 0 }}</text>
            <text class="cell-sub muted">个</text>
          </view>
        </view>

        <view v-if="driftTop.length" style="margin-top: 12rpx">
          <view class="muted" style="font-size: 22rpx; margin-bottom: 6rpx">
            扩张 Top 3（二手）
          </view>
          <view
            v-for="(row, i) in driftTop"
            :key="'up' + row.city"
            class="drift-row"
          >
            <text class="drift-rank">{{ i + 1 }}</text>
            <text class="drift-city">{{ row.city }}</text>
            <text class="drift-value drift-up">
              +{{ fmtPct(row.drift) }}
            </text>
          </view>
          <view class="muted" style="font-size: 22rpx; margin: 12rpx 0 6rpx">
            收缩 Top 3（二手）
          </view>
          <view
            v-for="(row, i) in driftBottom"
            :key="'dn' + row.city"
            class="drift-row"
          >
            <text class="drift-rank">{{ i + 1 }}</text>
            <text class="drift-city">{{ row.city }}</text>
            <text class="drift-value drift-down">
              {{ fmtPct(row.drift) }}
            </text>
          </view>
        </view>
        <view class="muted" style="font-size: 20rpx; margin-top: 8rpx">
          派生：最近 12 月指数均值 / 前 12 月指数均值 -1，数据源 stats_70.csv，仅二手指数
        </view>
      </view>

      <!-- v0.92.0 地铁步行可达性概览（派生：基于 metro_walk.csv） -->
      <view
        v-if="metroWalkSummary.length"
        class="card metro-walk-card"
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🚶 地铁步行可达性</view>
          <view class="muted" style="font-size: 22rpx">深度站 / 全市场</view>
        </view>

        <view class="stats70-grid">
          <view
            v-for="row in metroWalkSummary"
            :key="'mw' + row.cityId"
            class="stats70-cell"
          >
            <text class="cell-label">{{ cityNameForId(row.cityId) }}</text>
            <text class="cell-value">{{ formatPct(row.pct5Min) }}</text>
            <text class="cell-sub muted">
              ≤5min {{ row.within5Min }}/{{ row.totalCommunities }} · ≤10min {{ row.within10Min }}
            </text>
          </view>
        </view>

        <view
          v-if="metroWalkTop.length"
          style="margin-top: 14rpx"
        >
          <view class="muted" style="font-size: 22rpx; margin-bottom: 6rpx">
            步行最少 Top 3（深广全市场）
          </view>
          <view
            v-for="(row, i) in metroWalkTop.slice(0, 3)"
            :key="'mwt' + row.communityId"
            class="drift-row"
          >
            <text class="drift-rank">{{ i + 1 }}</text>
            <text class="drift-city">{{ row.communityName }} → {{ row.stationName }}</text>
            <text class="drift-value drift-up">{{ row.walkMinutes.toFixed(1) }}min</text>
          </view>
        </view>
        <view
          v-if="metroWalkCityTop.length"
          style="margin-top: 10rpx"
        >
          <view class="muted" style="font-size: 22rpx; margin-bottom: 6rpx">
            本市步行最少 Top（派生）
          </view>
          <view
            v-for="(row, i) in metroWalkCityTop"
            :key="'mwct' + row.communityId"
            class="drift-row"
          >
            <text class="drift-rank">{{ i + 1 }}</text>
            <text class="drift-city">{{ row.communityName }} → {{ row.stationName }}</text>
            <text class="drift-value drift-up">{{ row.walkMinutes.toFixed(1) }}min</text>
          </view>
        </view>
        <view class="muted" style="font-size: 20rpx; margin-top: 8rpx">
          派生：snapshot.metroWalks（{{
            metroWalkSummary.reduce((s, r) => s + r.totalCommunities, 0)
          }} 个小区）。优先选 5 分钟覆盖比例最高城市。
        </view>
      </view>

      <!-- v0.93.0 分区近 12 周均价变动排行（派生：基于 district_trend.csv） -->
      <view
        v-if="district12wChange.length"
        class="card district-drift-card"
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">📊 分区近 12 周均价变动</view>
          <view class="muted" style="font-size: 22rpx">
            <text v-if="districtChangeDistribution.strictTotal > 0">
              ≥13 周 · 涨 {{ districtChangeDistribution.strictUp }} ·
              跌 {{ districtChangeDistribution.strictDown }}
              <text class="muted" style="font-size: 18rpx">
                ({{ districtChangeDistribution.strictTotal }} 区)
              </text>
            </text>
            <text v-else>
              涨 {{ districtChangeDistribution.up }} ·
              跌 {{ districtChangeDistribution.down }}
              <text class="muted" style="font-size: 18rpx">
                (全 {{ districtChangeDistribution.total }} 区样本不足时回退)
              </text>
            </text>
          </view>
        </view>

        <view class="stats70-grid">
          <view
            v-for="row in district12wChange.slice(0, 6)"
            :key="'dd' + row.cityId + row.districtName"
            class="stats70-cell"
          >
            <text class="cell-label">{{ cityNameForId(row.cityId) }} · {{ row.districtName }}</text>
            <text class="cell-value" :class="row.change > 0 ? 'drift-up' : row.change < 0 ? 'drift-down' : ''">
              {{ formatPct(row.change) }}
            </text>
            <text class="cell-sub muted">
              {{ formatUnitPrice(row.latestPrice) }} ({{ row.weeksAvailable }}w)
            </text>
          </view>
        </view>

        <view
          v-if="districtMomentumRank.length"
          style="margin-top: 14rpx"
        >
          <view class="muted" style="font-size: 22rpx; margin-bottom: 6rpx">
            近 4 周 vs 前 4 周动量 · Top 3
          </view>
          <view
            v-for="(row, i) in districtMomentumRank.slice(0, 3)"
            :key="'mm' + row.cityId + row.districtName"
            class="drift-row"
          >
            <text class="drift-rank">{{ i + 1 }}</text>
            <text class="drift-city">{{ cityNameForId(row.cityId) }} · {{ row.districtName }}</text>
            <text
              v-if="row.momentum != null"
              class="drift-value"
              :class="row.momentum > 0 ? 'drift-up' : row.momentum < 0 ? 'drift-down' : ''"
            >
              {{ formatPct(row.momentum) }}
            </text>
            <text v-else class="drift-value muted">—</text>
          </view>
        </view>
        <view class="muted" style="font-size: 20rpx; margin-top: 8rpx">
          派生：snapshot.districtTrends（{{ districtDriftTotalWeeks }} 周样本 /
          {{ districtDriftTotalDistricts }} 区），当前严格 12 周对比仅
          {{ districtChangeDistribution.strictTotal }} 区。卡片严格口径排序，宽松口径作为兜底。
        </view>
      </view>

      <!-- v0.94.0 学校指标各维度 Top 5（派生：基于 school_indicators.csv） -->
      <view
        v-if="schoolIndicatorSummary.total > 0"
        class="card school-indicator-card"
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🎓 学校指标 · 各维度 Top 5</view>
          <view class="muted" style="font-size: 22rpx">
            综合 ≥ 90 {{ formatPct(schoolIndicatorSummary.highLevelRate) }} ·
            集团校 {{ formatPct(schoolIndicatorSummary.groupSchoolRate) }}
          </view>
        </view>

        <view class="stats70-grid">
          <view class="stats70-cell">
            <text class="cell-label">综合排名分</text>
            <text class="cell-value">#{{ schoolTopLevel[0]?.schoolId ?? "-" }}</text>
            <text class="cell-sub muted">
              {{ schoolTopLevel[0]?.score?.toFixed(1) ?? "-" }} 分
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">集团校实力</text>
            <text class="cell-value">#{{ schoolTopGroup[0]?.schoolId ?? "-" }}</text>
            <text class="cell-sub muted">
              {{ schoolTopGroup[0]?.score?.toFixed(1) ?? "-" }} 分
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">区域均衡度</text>
            <text class="cell-value">#{{ schoolTopBalance[0]?.schoolId ?? "-" }}</text>
            <text class="cell-sub muted">
              {{ schoolTopBalance[0]?.score?.toFixed(1) ?? "-" }} 分
            </text>
          </view>
        </view>

        <view
          v-if="schoolTrendRising.length || schoolTrendDeclining.length"
          style="margin-top: 14rpx"
        >
          <view class="muted" style="font-size: 22rpx; margin-bottom: 6rpx">
            上升 {{ schoolIndicatorSummary.risingCount }} ·
            下滑 {{ schoolIndicatorSummary.decliningCount }} ·
            不变 {{ schoolIndicatorSummary.flatCount }}
          </view>
          <view
            v-if="schoolTrendRising.length"
            style="margin-bottom: 6rpx"
          >
            <view class="muted" style="font-size: 20rpx">上升 Top</view>
            <view
              v-for="(row, i) in schoolTrendRising.slice(0, 3)"
              :key="'sup' + row.schoolId"
              class="drift-row"
            >
              <text class="drift-rank">{{ i + 1 }}</text>
              <text class="drift-city">学校 #{{ row.schoolId }}</text>
              <text class="drift-value drift-up">
                +{{ row.trendDelta.toFixed(2) }}
              </text>
            </view>
          </view>
          <view v-if="schoolTrendDeclining.length">
            <view class="muted" style="font-size: 20rpx">下滑 Top</view>
            <view
              v-for="(row, i) in schoolTrendDeclining.slice(0, 3)"
              :key="'sdn' + row.schoolId"
              class="drift-row"
            >
              <text class="drift-rank">{{ i + 1 }}</text>
              <text class="drift-city">学校 #{{ row.schoolId }}</text>
              <text class="drift-value drift-down">
                {{ row.trendDelta.toFixed(2) }}
              </text>
            </view>
          </view>
        </view>
        <view class="muted" style="font-size: 20rpx; margin-top: 8rpx">
          派生：snapshot.schoolIndicators（{{ schoolIndicatorSummary.total }} 所学校）。
          Top 列仅按各维度分数排序，综合分用于横向参考；具体名称见下方「重点学校维度」。
        </view>
      </view>

      <!-- v1.121.17 重点学校维度（schoolDimensionRanking，学校页已有；仪表盘此前只有无校名的指标 ID） -->
      <view v-if="dimCityReady" class="card" data-tab="all,school">
        <view class="row-between">
          <view class="card-title">🏫 重点学校维度 · {{ hospitalCityName }}</view>
          <view class="muted">{{ dimCitySummaryLocal?.schoolCount ?? 0 }} 所</view>
        </view>
        <view v-if="dimCitySummaryLocal" class="edu-summary">
          <view class="edu-kpi">
            <text class="edu-kpi-val">{{ dimCitySummaryLocal.avgComposite.toFixed(1) }}</text>
            <text class="edu-kpi-label muted">均综合</text>
          </view>
          <view class="edu-kpi">
            <text class="edu-kpi-val">
              {{ dimCitySummaryLocal.avgTrendDelta == null ? "—" : dimCitySummaryLocal.avgTrendDelta.toFixed(2) }}
            </text>
            <text class="edu-kpi-label muted">均趋势Δ</text>
          </view>
          <view class="edu-kpi">
            <text class="edu-kpi-val">{{ dimPolymathCity.length }}</text>
            <text class="edu-kpi-label muted">全维度</text>
          </view>
        </view>
        <view class="stats70-grid" style="margin-top: 8rpx">
          <view class="stats70-cell">
            <text class="cell-label">综合排名分</text>
            <text class="cell-value dim-name">{{ dimTopLevelCity[0]?.schoolName ?? "—" }}</text>
            <text class="cell-sub muted">{{ dimTopLevelCity[0]?.score?.toFixed(1) ?? "—" }} · {{ dimTopLevelCity[0]?.districtName ?? "" }}</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">集团校实力</text>
            <text class="cell-value dim-name">{{ dimTopGroupCity[0]?.schoolName ?? "—" }}</text>
            <text class="cell-sub muted">{{ dimTopGroupCity[0]?.score?.toFixed(1) ?? "—" }} · {{ dimTopGroupCity[0]?.districtName ?? "" }}</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">区域均衡度</text>
            <text class="cell-value dim-name">{{ dimTopBalanceCity[0]?.schoolName ?? "—" }}</text>
            <text class="cell-sub muted">{{ dimTopBalanceCity[0]?.score?.toFixed(1) ?? "—" }} · {{ dimTopBalanceCity[0]?.districtName ?? "" }}</text>
          </view>
        </view>
        <view v-if="dimPolymathCity.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          全维度学校（综合≥80 / 集团≥70 / 均衡≥70）
        </view>
        <view
          v-for="(row, i) in dimPolymathCity"
          :key="'poly-' + row.schoolId"
          class="dim-row tap-row"
          hover-class="tap-row--active"
          @click="goSchool(row.schoolId)"
        >
          <text class="dim-rank muted">{{ i + 1 }}</text>
          <view class="dim-mid">
            <text class="dim-school">{{ row.schoolName }}</text>
            <text class="dim-meta muted">{{ row.districtName }} · {{ row.schoolType }}</text>
          </view>
          <text class="dim-score">{{ row.score.toFixed(1) }}</text>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：school_dimensions.csv（重点校子集，含校名）。与上方「学校指标」平行但更适合点名阅读。
        </view>
      </view>

      <!-- v1.121.16 教育事业概览（educationOverview，学校页已有，仪表盘此前未展示） -->
      <view v-if="eduOverview" class="card" data-tab="all,school" data-education-overview>
        <view class="row-between">
          <view class="card-title">📚 教育事业 · {{ eduOverview.city }}</view>
          <view class="muted">{{ formatEducationPeriodLabel(eduOverview) }}</view>
        </view>
        <view class="edu-summary">
          <view class="edu-kpi">
            <text class="edu-kpi-val">{{ eduOverview.totalSchools }}</text>
            <text class="edu-kpi-label muted">学校</text>
          </view>
          <view class="edu-kpi">
            <text class="edu-kpi-val">{{ eduOverview.totalStudents10k > 0 ? eduOverview.totalStudents10k.toFixed(1) : "—" }}</text>
            <text class="edu-kpi-label muted">在校生万</text>
          </view>
          <template v-if="eduHasPrimaryJuniorSplit">
            <view class="edu-kpi">
              <text class="edu-kpi-val">{{ eduOverview.primaryCount }}</text>
              <text class="edu-kpi-label muted">小学</text>
            </view>
            <view class="edu-kpi">
              <text class="edu-kpi-val">{{ eduOverview.juniorHighCount }}</text>
              <text class="edu-kpi-label muted">初中</text>
            </view>
          </template>
          <template v-else>
            <view class="edu-kpi">
              <text class="edu-kpi-val">{{ eduOverview.compulsoryCount }}</text>
              <text class="edu-kpi-label muted">普通中小学</text>
            </view>
            <view class="edu-kpi">
              <text class="edu-kpi-val">{{ eduOverview.kindergartenCount }}</text>
              <text class="edu-kpi-label muted">幼儿园</text>
            </view>
          </template>
        </view>
        <view class="edu-grid">
          <text v-if="eduHasPrimaryJuniorSplit" class="edu-chip">幼儿园 {{ eduOverview.kindergartenCount }}</text>
          <text v-if="eduOverview.seniorHighCount > 0" class="edu-chip">高中 {{ eduOverview.seniorHighCount }}</text>
          <text v-if="eduOverview.vocationalCount > 0" class="edu-chip">职校 {{ eduOverview.vocationalCount }}</text>
          <text v-if="eduOverview.privateCount > 0" class="edu-chip">民办 {{ eduOverview.privateCount }}</text>
          <text v-if="eduOverview.specialCount > 0" class="edu-chip">特殊教育 {{ eduOverview.specialCount }}</text>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          {{ eduOverview.sourceOrg }} · {{ eduOverview.publishDate }} 发布。
          <text v-if="eduOverview.city === '珠海'">基础教育学校数官方表；在校生/民办未公布不伪造。</text>
          <text v-else-if="!eduHasPrimaryJuniorSplit">官方口径为「普通中小学」合计，不伪造小学/初中分项。</text>
        </view>
      </view>

      <!-- v1.121.16 行政区划（adminDistrictRanking） -->
      <view v-if="adminSummary" class="card" data-tab="all,school">
        <view class="row-between">
          <view class="card-title">🗺️ 行政区划 · {{ hospitalCityName }}</view>
          <view class="muted">{{ adminSummary.districtCount }} 区 · {{ adminSummary.cityCode }}</view>
        </view>
        <view class="admin-type-row">
          <view v-for="t in adminTypeCounts" :key="t.type" class="admin-type-chip">
            <text class="admin-type-n">{{ t.count }}</text>
            <text class="admin-type-l muted">{{ t.type }}</text>
          </view>
        </view>
        <view
          v-for="d in adminDistrictList"
          :key="d.districtCode"
          class="admin-dist-row"
        >
          <text class="admin-code muted">{{ d.districtCode }}</text>
          <text class="admin-name">{{ d.districtName }}</text>
          <text class="admin-type muted">{{ adminSuffixType(d.districtCode) }}</text>
        </view>
        <view v-if="!adminGaps.isContiguous" class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          区号末两位存在缺号（{{ adminGaps.missingSuffixes.join("、") }}），常见于行政区调整。
        </view>
        <view v-if="adminMetroCross" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          与规划地铁覆盖交叉
        </view>
        <view v-if="adminMetroCross" class="admin-type-row">
          <view class="admin-type-chip">
            <text class="admin-type-n">{{ adminMetroCross.inBoth.length }}</text>
            <text class="admin-type-l muted">两边都有</text>
          </view>
          <view class="admin-type-chip">
            <text class="admin-type-n">{{ adminMetroCross.onlyAdmin.length }}</text>
            <text class="admin-type-l muted">仅区划</text>
          </view>
          <view class="admin-type-chip">
            <text class="admin-type-n">{{ adminMetroCross.onlyMetro.length }}</text>
            <text class="admin-type-l muted">仅地铁</text>
          </view>
        </view>
        <view v-if="adminMetroCross?.onlyAdmin.length" class="muted" style="font-size: 20rpx; margin-top: 4rpx">
          仅区划：{{ adminMetroCross.onlyAdmin.join("、") }}
        </view>
        <view v-if="adminMetroCross?.onlyMetro.length" class="muted" style="font-size: 20rpx; margin-top: 2rpx">
          仅地铁文案：{{ adminMetroCross.onlyMetro.join("、") }}
        </view>
        <view v-if="adminXinQuList.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          名含「新区」
        </view>
        <view
          v-for="d in adminXinQuList"
          :key="'axq-' + d.districtCode"
          class="admin-dist-row"
        >
          <text class="admin-code muted">{{ d.districtCode }}</text>
          <text class="admin-name">{{ cityNameForId(d.cityId) }} · {{ d.districtName }}</text>
          <text class="admin-type muted">{{ adminSuffixType(d.districtCode) }}</text>
        </view>
        <view data-cross-city v-if="adminHaiList.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          跨城名含「海」
        </view>
        <view
          v-for="d in adminHaiList"
          :key="'ahai-' + d.districtCode"
          class="admin-dist-row"
        >
          <text class="admin-code muted">{{ d.districtCode }}</text>
          <text class="admin-name">{{ cityNameForId(d.cityId) }} · {{ d.districtName }}</text>
        </view>
        <view data-cross-city v-if="adminSuffixShared.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          同末两位区号跨城对照
        </view>
        <view
          v-for="s in adminSuffixShared"
          :key="'asfx-' + s.suffix"
          class="admin-dist-row"
        >
          <text class="admin-code muted">…{{ String(s.suffix).padStart(2, "0") }}</text>
          <text class="admin-name">{{ s.cityNames.join(" / ") }}</text>
          <text class="admin-type muted">{{ s.districtNames.slice(0, 2).join("、") }}</text>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：admin_districts.csv × metro_planning.districts。交叉用于发现命名不一致。
        </view>
      </view>

      <view v-if="nbsMacro" class="card macro-card" data-tab="overview,price">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">全国房地产开发与销售</view>
          <view class="muted" style="font-size: 22rpx">{{ nbsMacro.publishDate }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <view class="stats70-cell">
            <text class="cell-label">开发投资</text>
            <text class="cell-value">{{ formatMacro100m(nbsMacro.investmentCny100m) }}</text>
            <text class="cell-sub" :class="macroTrendClass(nbsMacro.investmentYoyPct)">同比 {{ formatMacroPct(nbsMacro.investmentYoyPct) }}</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">新房销售额</text>
            <text class="cell-value">{{ formatMacro100m(nbsMacro.salesAmountCny100m) }}</text>
            <text class="cell-sub" :class="macroTrendClass(nbsMacro.salesAmountYoyPct)">同比 {{ formatMacroPct(nbsMacro.salesAmountYoyPct) }}</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">新房销售面积</text>
            <text class="cell-value">{{ formatMacroArea(nbsMacro.salesArea10kSqm) }}</text>
            <text class="cell-sub" :class="macroTrendClass(nbsMacro.salesAreaYoyPct)">同比 {{ formatMacroPct(nbsMacro.salesAreaYoyPct) }}</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">商品房待售面积</text>
            <text class="cell-value">{{ formatMacroArea(nbsMacro.inventoryArea10kSqm) }}</text>
            <text class="cell-sub" :class="macroTrendClass(nbsMacro.inventoryAreaYoyPct)">同比 {{ formatMacroPct(nbsMacro.inventoryAreaYoyPct) }}</text>
          </view>
        </view>
        <view v-if="nbsImpliedUnitPrice != null" class="rank-row" style="margin-top: 12rpx">
          <text class="muted" style="font-size: 22rpx">全国合同均价（销售额÷面积）</text>
          <text class="rank-val">
            {{ nbsImpliedUnitPrice.toLocaleString() }} 元/㎡
            <template v-if="nbsImpliedInventoryMonths != null">
              · 粗算可售约 {{ nbsImpliedInventoryMonths }} 个月
            </template>
          </text>
        </view>
        <view class="muted" style="margin-top: 10rpx; font-size: 21rpx">
          国家统计局累计口径：{{ nbsMacro.period.replace("_to_", " 至 ") }}。销售面积和销售额为新建商品房合同口径；上方均价为销售额÷面积派生值；可售月数 = 待售面积÷（累计销售面积/月数），不是城市去化周期，也不是 70 城价格指数。
        </view>
        <button
          v-if="nbsHasSeriesDetail"
          class="gz-inventory-toggle"
          size="mini"
          data-nbs-series-toggle
          :aria-expanded="nbsSeriesExpanded"
          @click="nbsSeriesExpanded = !nbsSeriesExpanded"
        >
          {{ nbsSeriesExpanded ? "收起多期序列" : "展开多期序列" }}
        </button>
        <template v-if="nbsSeriesExpanded">
          <view v-if="nbsUnitPriceTrend.length > 1" class="muted" style="margin-top: 10rpx; font-size: 22rpx" data-nbs-series-detail>
            合同均价（多期，累计口径勿直接环比）：
            <text v-for="(p, i) in nbsUnitPriceTrend" :key="'up-' + p.period">
              {{ p.shortLabel }} {{ p.unitPriceYuanPerSqm.toLocaleString() }}<text v-if="i < nbsUnitPriceTrend.length - 1"> · </text>
            </text>
          </view>
          <view v-if="nbsInventoryMonthsTrend.length > 1" class="muted" style="margin-top: 10rpx; font-size: 22rpx" data-nbs-series-detail>
            粗算可售月数（多期，累计口径勿直接环比）：
            <text v-for="(p, i) in nbsInventoryMonthsTrend" :key="'im-' + p.period">
              {{ p.shortLabel }} {{ p.inventoryMonths }}月<template v-if="i < nbsInventoryMonthsTrend.length - 1"> · </template>
            </text>
          </view>
          <view v-if="nbsYoyTrend.length > 1" class="muted" style="margin-top: 10rpx; font-size: 22rpx" data-nbs-series-detail>
            销售面积同比（多期）：
            <text v-for="(p, i) in nbsYoyTrend" :key="p.period">
              {{ p.shortLabel }} {{ formatMacroPct(p.salesAreaYoyPct) }}<text v-if="i < nbsYoyTrend.length - 1"> · </text>
            </text>
          </view>
          <view v-if="nbsYoyTrend.length > 1" class="muted" style="margin-top: 10rpx; font-size: 22rpx" data-nbs-series-detail>
            销售额同比（多期）：
            <text v-for="(p, i) in nbsYoyTrend" :key="'sa-' + p.period">
              {{ p.shortLabel }} {{ formatMacroPct(p.salesAmountYoyPct) }}<text v-if="i < nbsYoyTrend.length - 1"> · </text>
            </text>
          </view>
          <view v-if="nbsYoyTrend.length > 1" class="muted" style="margin-top: 10rpx; font-size: 22rpx" data-nbs-series-detail>
            开发投资同比（多期）：
            <text v-for="(p, i) in nbsYoyTrend" :key="'inv-' + p.period">
              {{ p.shortLabel }} {{ formatMacroPct(p.investmentYoyPct) }}<text v-if="i < nbsYoyTrend.length - 1"> · </text>
            </text>
          </view>
          <view v-if="nbsYoyTrend.length > 1" class="muted" style="margin-top: 10rpx; font-size: 22rpx" data-nbs-series-detail>
            到位资金同比（多期）：
            <text v-for="(p, i) in nbsYoyTrend" :key="'fund-' + p.period">
              {{ p.shortLabel }} {{ formatMacroPct(p.fundsYoyPct) }}<text v-if="i < nbsYoyTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>

      <view v-if="gdRealEstateBrief" class="card macro-card" data-tab="overview,price" data-gd-real-estate-brief>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">广东房地产市场运行</view>
          <view class="muted" style="font-size: 22rpx">{{ gdRealEstateBrief.periodLabel }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <view class="stats70-cell">
            <text class="cell-label">开发投资</text>
            <text class="cell-value">{{ formatMacro100m(gdRealEstateBrief.investmentYi) }}</text>
            <text class="cell-sub" :class="macroTrendClass(gdRealEstateBrief.investmentYoyPct)">
              同比 {{ formatMacroPct(gdRealEstateBrief.investmentYoyPct) }}
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">新房销售额</text>
            <text class="cell-value">{{ formatMacro100m(gdRealEstateBrief.salesAmountYi) }}</text>
            <text class="cell-sub" :class="macroTrendClass(gdRealEstateBrief.salesAmountYoyPct)">
              同比 {{ formatMacroPct(gdRealEstateBrief.salesAmountYoyPct) }}
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">新房销售面积</text>
            <text class="cell-value">{{ formatMacroArea(gdRealEstateBrief.salesAreaWanSqm) }}</text>
            <text class="cell-sub" :class="macroTrendClass(gdRealEstateBrief.salesAreaYoyPct)">
              同比 {{ formatMacroPct(gdRealEstateBrief.salesAreaYoyPct) }}
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">珠三角销售面积</text>
            <text class="cell-value">{{ formatMacroArea(gdRealEstateBrief.prSalesAreaWanSqm) }}</text>
            <text class="cell-sub muted">投资 {{ gdRealEstateBrief.prInvestmentYi.toLocaleString() }} 亿</text>
          </view>
        </view>
        <view v-if="gdBriefUnitPrice != null" class="rank-row" style="margin-top: 12rpx">
          <text class="muted" style="font-size: 22rpx">全省合同均价（销售额÷面积）</text>
          <text class="rank-val">{{ gdBriefUnitPrice.toLocaleString() }} 元/㎡</text>
        </view>
        <view class="muted" style="margin-top: 10rpx; font-size: 21rpx">
          {{ gdRealEstateBrief.sourceOrg }} · {{ gdRealEstateBrief.publishDate || gdRealEstateBrief.periodLabel }}。
          全省累计合同口径；均价为派生值；≠城市挂牌/网签均价、≠70城指数。
        </view>
        <button
          v-if="gdBriefTrend.length > 1"
          class="gz-inventory-toggle"
          size="mini"
          data-gd-brief-series-toggle
          :aria-expanded="gdBriefSeriesExpanded"
          @click="gdBriefSeriesExpanded = !gdBriefSeriesExpanded"
        >
          {{ gdBriefSeriesExpanded ? "收起多期序列" : "展开多期序列" }}
        </button>
        <template v-if="gdBriefSeriesExpanded">
          <view class="muted" style="margin-top: 10rpx; font-size: 22rpx" data-gd-brief-series-detail>
            销售面积同比（累计口径勿直接环比）：
            <text v-for="(p, i) in gdBriefTrend" :key="'gd-a-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.salesAreaYoyPct) }}<text v-if="i < gdBriefTrend.length - 1"> · </text>
            </text>
          </view>
          <view class="muted" style="margin-top: 10rpx; font-size: 22rpx" data-gd-brief-series-detail>
            销售额同比：
            <text v-for="(p, i) in gdBriefTrend" :key="'gd-s-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.salesAmountYoyPct) }}<text v-if="i < gdBriefTrend.length - 1"> · </text>
            </text>
          </view>
          <view class="muted" style="margin-top: 10rpx; font-size: 22rpx" data-gd-brief-series-detail>
            开发投资同比：
            <text v-for="(p, i) in gdBriefTrend" :key="'gd-i-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.investmentYoyPct) }}<text v-if="i < gdBriefTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>

      <view v-if="gdEconomy" class="card macro-card" data-tab="overview,price" data-gd-economy>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">广东经济运行</view>
          <view class="muted" style="font-size: 22rpx">{{ gdEconomy.periodLabel }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <view class="stats70-cell">
            <text class="cell-label">地区生产总值</text>
            <text class="cell-value">{{ formatMacro100m(gdEconomy.gdpYi) }}</text>
            <text class="cell-sub" :class="macroTrendClass(gdEconomy.gdpYoyPct)">
              同比 {{ formatMacroPct(gdEconomy.gdpYoyPct) }}
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">房开投资同比</text>
            <text class="cell-value" :class="macroTrendClass(gdEconomy.reInvestmentYoyPct)">
              {{ formatMacroPct(gdEconomy.reInvestmentYoyPct) }}
            </text>
            <text class="cell-sub muted">固投 {{ formatMacroPct(gdEconomy.faYoyPct) }}</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">规上工业同比</text>
            <text class="cell-value" :class="macroTrendClass(gdEconomy.industryYoyPct)">
              {{ formatMacroPct(gdEconomy.industryYoyPct) }}
            </text>
            <text class="cell-sub muted">社消零 {{ formatMacroPct(gdEconomy.retailYoyPct) }}</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">人均可支配收入</text>
            <text class="cell-value">{{ formatMacroYuan(gdEconomy.disposableYuan) }}</text>
            <text class="cell-sub" :class="macroTrendClass(gdEconomy.disposableNominalYoyPct)">
              名义 {{ formatMacroPct(gdEconomy.disposableNominalYoyPct) }}
              · 实际 {{ formatMacroPct(gdEconomy.disposableRealYoyPct) }}
            </text>
          </view>
        </view>
        <view class="muted" style="margin-top: 10rpx; font-size: 21rpx">
          {{ gdEconomy.sourceOrg }} · {{ gdEconomy.publishDate || gdEconomy.periodLabel }}。
          不变价 GDP；房开投资≠房价均价；人均可支配收入为全省住户调查口径；月度无 GDP 的简况不入库。
          <template v-if="gdEconomy.urbanDisposableYuan > 0">
            城镇 {{ formatMacroYuan(gdEconomy.urbanDisposableYuan) }}（{{ formatMacroPct(gdEconomy.urbanNominalYoyPct) }}）
            · 农村 {{ formatMacroYuan(gdEconomy.ruralDisposableYuan) }}（{{ formatMacroPct(gdEconomy.ruralNominalYoyPct) }}）；
            CPI {{ formatMacroPct(gdEconomy.cpiYoyPct) }}。
          </template>
        </view>
        <button
          v-if="gdEconomyTrend.length > 1"
          class="gz-inventory-toggle"
          size="mini"
          data-gd-economy-series-toggle
          :aria-expanded="gdEconomySeriesExpanded"
          @click="gdEconomySeriesExpanded = !gdEconomySeriesExpanded"
        >
          {{ gdEconomySeriesExpanded ? "收起多期序列" : "展开多期序列" }}
        </button>
        <template v-if="gdEconomySeriesExpanded">
          <view class="muted" style="margin-top: 10rpx; font-size: 22rpx" data-gd-economy-series-detail>
            GDP 同比（累计口径勿直接环比）：
            <text v-for="(p, i) in gdEconomyTrend" :key="'econ-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.gdpYoyPct) }}<text v-if="i < gdEconomyTrend.length - 1"> · </text>
            </text>
          </view>
          <view class="muted" style="margin-top: 6rpx; font-size: 22rpx">
            房开投资同比：
            <text v-for="(p, i) in gdEconomyTrend" :key="'econ-re-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.reInvestmentYoyPct) }}<text v-if="i < gdEconomyTrend.length - 1"> · </text>
            </text>
          </view>
          <view class="muted" style="margin-top: 6rpx; font-size: 22rpx">
            人均可支配收入名义同比：
            <text v-for="(p, i) in gdEconomyTrend" :key="'econ-disp-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.disposableNominalYoyPct) }}<text v-if="i < gdEconomyTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>

      <view v-if="gdFaInvestment" class="card macro-card" data-tab="overview,price" data-gd-fa-investment>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">广东固定资产投资</view>
          <view class="muted" style="font-size: 22rpx">{{ gdFaInvestment.periodLabel }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <view class="stats70-cell">
            <text class="cell-label">全省固投同比</text>
            <text class="cell-value" :class="macroTrendClass(gdFaInvestment.faYoyPct)">
              {{ formatMacroPct(gdFaInvestment.faYoyPct) }}
            </text>
            <text class="cell-sub muted">名义增速 · 不含农户</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">工业投资同比</text>
            <text class="cell-value" :class="macroTrendClass(gdFaInvestment.industryYoyPct)">
              {{ formatMacroPct(gdFaInvestment.industryYoyPct) }}
            </text>
            <text class="cell-sub muted">制造 {{ formatMacroPct(gdFaInvestment.manufacturingYoyPct) }}</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">第三产业同比</text>
            <text class="cell-value" :class="macroTrendClass(gdFaInvestment.tertiaryYoyPct)">
              {{ formatMacroPct(gdFaInvestment.tertiaryYoyPct) }}
            </text>
            <text class="cell-sub muted">二产 {{ formatMacroPct(gdFaInvestment.secondaryYoyPct) }}</text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">珠三角同比</text>
            <text class="cell-value" :class="macroTrendClass(gdFaInvestment.prYoyPct)">
              {{ formatMacroPct(gdFaInvestment.prYoyPct) }}
            </text>
            <text class="cell-sub muted">粤东 {{ formatMacroPct(gdFaInvestment.eastYoyPct) }}</text>
          </view>
        </view>
        <view class="muted" style="margin-top: 10rpx; font-size: 21rpx">
          {{ gdFaInvestment.sourceOrg }} · {{ gdFaInvestment.publishDate || gdFaInvestment.periodLabel }}。
          官方简况多为同比、无绝对额；含全部房地产开发项目投资，≠城市挂牌/网签均价。
        </view>
        <button
          v-if="gdFaTrend.length > 1"
          class="gz-inventory-toggle"
          size="mini"
          data-gd-fa-series-toggle
          :aria-expanded="gdFaSeriesExpanded"
          @click="gdFaSeriesExpanded = !gdFaSeriesExpanded"
        >
          {{ gdFaSeriesExpanded ? "收起多期序列" : "展开多期序列" }}
        </button>
        <template v-if="gdFaSeriesExpanded">
          <view class="muted" style="margin-top: 10rpx; font-size: 22rpx" data-gd-fa-series-detail>
            固投同比（累计口径勿直接环比）：
            <text v-for="(p, i) in gdFaTrend" :key="'fa-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.faYoyPct) }}<text v-if="i < gdFaTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>

      <view v-if="gdConstruction" class="card macro-card" data-tab="overview,price" data-gd-construction>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">广东建筑业生产运行</view>
          <view class="muted" style="font-size: 22rpx">{{ gdConstruction.periodLabel }}</view>
        </view>
        <view class="stats70-grid" style="margin-top: 16rpx">
          <view class="stats70-cell">
            <text class="cell-label">建筑业总产值</text>
            <text class="cell-value">{{ formatMacro100m(gdConstruction.totalOutputYi) }}</text>
            <text class="cell-sub" :class="macroTrendClass(gdConstruction.totalOutputYoyPct)">
              同比 {{ formatMacroPct(gdConstruction.totalOutputYoyPct) }}
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">房屋建筑业产值</text>
            <text class="cell-value">{{ formatMacro100m(gdConstruction.housingOutputYi) }}</text>
            <text class="cell-sub" :class="macroTrendClass(gdConstruction.housingOutputYoyPct)">
              同比 {{ formatMacroPct(gdConstruction.housingOutputYoyPct) }}
              <template v-if="gdConstructionHousingShare != null">
                · 占比 {{ gdConstructionHousingShare }}%
              </template>
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">土木工程产值</text>
            <text class="cell-value">{{ formatMacro100m(gdConstruction.civilOutputYi) }}</text>
            <text class="cell-sub" :class="macroTrendClass(gdConstruction.civilOutputYoyPct)">
              同比 {{ formatMacroPct(gdConstruction.civilOutputYoyPct) }}
            </text>
          </view>
          <view class="stats70-cell">
            <text class="cell-label">珠三角总产值</text>
            <text class="cell-value">{{ formatMacro100m(gdConstruction.prOutputYi) }}</text>
            <text class="cell-sub" :class="macroTrendClass(gdConstruction.prOutputYoyPct)">
              同比 {{ formatMacroPct(gdConstruction.prOutputYoyPct) }}
            </text>
          </view>
        </view>
        <view class="muted" style="margin-top: 10rpx; font-size: 21rpx">
          {{ gdConstruction.sourceOrg }} · {{ gdConstruction.publishDate || gdConstruction.periodLabel }}。
          资质建筑业企业产值口径；房屋建筑业 ≠ 商品房销售/挂牌均价。
        </view>
        <button
          v-if="gdConstructionTrend.length > 1"
          class="gz-inventory-toggle"
          size="mini"
          data-gd-construction-series-toggle
          :aria-expanded="gdConstructionSeriesExpanded"
          @click="gdConstructionSeriesExpanded = !gdConstructionSeriesExpanded"
        >
          {{ gdConstructionSeriesExpanded ? "收起多期序列" : "展开多期序列" }}
        </button>
        <template v-if="gdConstructionSeriesExpanded">
          <view class="muted" style="margin-top: 10rpx; font-size: 22rpx" data-gd-construction-series-detail>
            总产值同比：
            <text v-for="(p, i) in gdConstructionTrend" :key="'gc-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.totalOutputYoyPct) }}<text v-if="i < gdConstructionTrend.length - 1"> · </text>
            </text>
          </view>
          <view class="muted" style="margin-top: 10rpx; font-size: 22rpx" data-gd-construction-series-detail>
            房屋建筑业同比：
            <text v-for="(p, i) in gdConstructionTrend" :key="'gh-' + p.period">
              {{ p.periodLabel }} {{ formatMacroPct(p.housingOutputYoyPct) }}<text v-if="i < gdConstructionTrend.length - 1"> · </text>
            </text>
          </view>
        </template>
      </view>

      <view v-if="gzInventory" class="card gz-inventory-card" data-tab="overview,price">
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

      <view v-if="szPlannedSupply" class="card" data-tab="overview,price" data-sz-planned-supply>
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

      <view v-if="gzHousingPlan" class="card" data-tab="overview,price" data-gz-housing-plan>
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

      <view v-if="gzAffordableRaised || gzAffordableCompleted" class="card" data-tab="overview,price" data-gz-affordable-projects>
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

      <view v-if="gzLandSummary" class="card" data-tab="overview,price" data-gz-land-deals>
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

      <view v-if="szLandSummary" class="card" data-tab="overview,price" data-sz-land-deals>
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

      <view v-if="szAffordableRaised || szAffordableCompleted" class="card" data-tab="overview,price" data-sz-affordable-projects>
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

      <view v-if="zhAffordable" class="card" data-tab="overview,price" data-zh-affordable-progress>
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

      <!-- v0.48.0 dashboard-tabs: 顶部 tab 切换 -->
      <view class="dash-tabs">
        <view
          v-for="t in DASHBOARD_TABS"
          :key="t.key"
          :class="['dash-tab', { 'dash-tab--active': activeTab === t.key }]"
          @click="activeTab = t.key"
          :data-tab="t.key"
        >
          <text class="dash-tab-icon">{{ t.icon }}</text>
          <text class="dash-tab-label">{{ t.label }}</text>
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
        <view class="quick-grid">
          <view
            v-for="q in QUICK_SHORTCUTS"
            :key="q.key"
            class="quick-tile"
            :data-quick-key="q.key"
            @click="quickClick(q)"
          >
            <view class="quick-tile-icon" :class="'quick-tile-icon--' + q.tone">{{ q.icon }}</view>
            <view class="quick-tile-label">{{ q.label }}</view>
          </view>
        </view>
      </view>

      <!-- v0.59.0 概览渐进式布局：快捷导航 + 全部展开/收起 -->
      <view v-if="activeTab === 'overview'" class="overview-toolbar">
        <view class="overview-jump-row">
          <button
            v-for="j in OVERVIEW_JUMPS"
            :key="j.key"
            class="overview-jump"
            size="mini"
            @click.stop="jumpOverviewGroup(j.key)"
          >{{ j.label }}</button>
        </view>
        <button class="overview-toggle-all" size="mini" @click.stop="toggleOverviewAll">
          {{ overviewAllExpanded ? "全部收起" : "全部展开" }}
        </button>
      </view>

      <!-- 区/板块对比 -->
      <view
        id="overview-region"
        class="card overview-card"
        :class="{ 'overview-card--collapsed': isOverviewGroupCollapsed('region') }"
        data-tab="overview,price"
        @click="onOverviewCardClick('region')"
      >
        <view class="row-between">
          <view class="card-title">区/板块对比</view>
          <view class="muted">{{ app.metric === "listing_count" ? "挂牌数" : "均价(元/㎡)" }}</view>
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
      <view v-if="trendItems.length > 0" class="card">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">区级近 8 周房价趋势</view>
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
      <view v-if="wangqianOverview && wangqianOverview.items.length > 0" class="card" data-tab="all,price">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">
            近 4 周二手网签热度榜 · {{ wangqianOverview.cityName }}
          </view>
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
        v-if="districtWangqianRank && districtWangqianRank.items.length > 0"
        id="overview-wangqian"
        class="card overview-card"
        :class="{ 'overview-card--collapsed': isOverviewGroupCollapsed('wangqian') }"
        data-tab="overview,price"
        @click="onOverviewCardClick('wangqian')"
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">
            🔥 全品类区级网签热度榜 · {{ districtWangqianRank.cityName }}
          </view>
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
      <view v-if="wangqianTrendWeeklyReady" class="card" data-tab="all,price">
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
        v-if="commuteRanking && commuteRanking.fastest.length > 0"
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
      <view v-if="layoutDistribution && layoutDistribution.totalListings > 0" class="card" data-tab="all,price">
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
      <view v-if="tagCloud && tagCloud.tags.length > 0" class="card" data-tab="all,school">
        <view class="row-between">
          <view class="card-title">🏷️ 房源标签云 · {{ tagCloud.cityName }}</view>
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
      <view v-if="districtIndex && districtIndex.items.length > 0" class="card" data-tab="all,price">
        <view class="row-between">
          <view class="card-title">📈 区房价指数 · {{ districtIndex.cityName }}</view>
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
      <view v-if="districtChange && districtChange.items.length > 0" class="card" data-tab="all,price">
        <view class="row-between">
          <view class="card-title">🚀 区涨幅榜 (近 4 周) · {{ districtChange.cityName }}</view>
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
        v-if="communityScore && communityScore.items.length > 0"
        id="overview-community"
        class="card overview-card"
        :class="{ 'overview-card--collapsed': isOverviewGroupCollapsed('community') }"
        data-tab="overview,price"
        @click="onOverviewCardClick('community')"
      >
        <view class="row-between">
          <view class="card-title">🏅 小区综合评分 Top 小区 · {{ communityScore.cityName }}</view>
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

      <!-- v0.35.0 map-9 地铁步行通勤榜 (community → 最近地铁站, 步行时长) -->
      <view v-if="metroWalk && metroWalk.items.length > 0" class="card" data-tab="all,transit">
        <view class="row-between">
          <view class="card-title">🚶 地铁步行通勤 Top · {{ metroWalk.cityName }}</view>
          <view class="muted">Top {{ metroWalk.items.length }}</view>
        </view>
        <view class="mw-summary muted">
          平均步行 {{ metroWalk.avgMinutes }}min · 最快 {{ metroWalk.fastestMinutes }}min ({{ metroWalk.fastestCommunity }})
          · 共 {{ metroWalk.totalCount }} 个小区
        </view>
        <view
          v-for="it in metroWalk.items"
          :key="it.communityId"
          class="mw-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="mw-rank">
            <text :class="['mw-min', mwBandClass(it.walkMinutes)]">{{ it.walkMinutes.toFixed(0) }}min</text>
          </view>
          <view class="mw-mid">
            <view class="mw-name">{{ it.communityName }}</view>
            <view class="mw-dist muted">{{ it.districtName }} · → {{ it.stationName }}</view>
          </view>
          <view class="mw-right">
            <view class="muted" style="font-size: 20rpx">{{ it.walkDistanceM }}m</view>
            <view class="mw-src muted" v-if="it.source">{{ it.source === 'AMAP_API' ? '高德' : '估算' }}</view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：poi_seed.csv (subway) → 高德 /v3/direction/walking。
          步行时长按距离升序；绿/橙/红三档 (≤5 / ≤10 / &gt;10min)，AMAP_API 是高德实测，其余为启发式估算（直线×1.45 / 80m·min⁻¹）。
        </view>
        <view v-if="metroWalkCityTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          派生层本市步行最少 Top
        </view>
        <view
          v-for="(it, idx) in metroWalkCityTop"
          :key="'mwc-' + it.communityId"
          class="mw-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="mw-rank">
            <text :class="['mw-min', mwBandClass(it.walkMinutes)]">{{ it.walkMinutes.toFixed(0) }}min</text>
          </view>
          <view class="mw-mid">
            <view class="mw-name">{{ it.communityName }}</view>
            <view class="mw-dist muted">→ {{ it.stationName }} · {{ it.walkDistanceM }}m</view>
          </view>
        </view>
      </view>

      <!-- v0.36.0 map-10 地铁规划受益榜 (规划/在建线路 + 距离 → 受益分) -->
      <view v-if="metroBenefit && metroBenefit.items.length > 0" class="card" data-tab="all,transit">
        <view class="row-between">
          <view class="card-title">🚇 地铁规划受益 Top · {{ metroBenefit.cityName }}</view>
          <view class="muted">Top {{ metroBenefit.items.length }}</view>
        </view>
        <view class="mb-summary muted">
          平均受益 {{ metroBenefit.avgScore }} · 最高 {{ metroBenefit.maxScore }} · {{ metroBenefit.nearCount }} 个小区真近地铁 (≥60)
        </view>
        <view
          v-for="it in metroBenefit.items"
          :key="it.communityId"
          class="mb-row tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(it.communityId)"
        >
          <view class="mb-rank">
            <text :class="['mb-tag', mbBandClass(it.benefitScore)]">{{ it.benefitScore }}</text>
          </view>
          <view class="mb-mid">
            <view class="mb-name">{{ it.communityName }}</view>
            <view class="mb-dist muted">{{ it.districtName }} · → {{ it.lineName }}「{{ it.stationName }}」</view>
          </view>
          <view class="mb-right">
            <view :class="['mb-status', 'mb-st-' + (it.lineStatus === '即将开通' ? 'open' : it.lineStatus === '在建' ? 'build' : 'plan')]">
              {{ it.lineStatus || '规划' }}
            </view>
            <view class="muted" style="font-size: 20rpx">{{ it.distanceM }}m · {{ it.openYear ?? '?' }}</view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：metro_planning_geo.csv + metro_planning.csv → scripts/compute_metro_benefit.py。
          受益分 = 距离分 × status 权重 (即将开通×1.5 / 在建×1.2 / 规划×1.0)。按受益分降序。
        </view>
      </view>

      <!-- v1.121.14 规划地铁线路概览（metroPlanningRanking 已派生，此前未接 UI） -->
      <view v-if="metroPlanSummary" class="card" data-tab="all,transit">
        <view class="row-between">
          <view class="card-title">🛤️ 规划地铁 · {{ metroPlanCityName }}</view>
          <view class="muted">{{ metroPlanSummary.lineCount }} 条</view>
        </view>
        <view class="mp-summary">
          <view class="mp-kpi">
            <text class="mp-kpi-val">{{ metroPlanSummary.totalLengthKm.toFixed(0) }}</text>
            <text class="mp-kpi-label muted">公里</text>
          </view>
          <view class="mp-kpi">
            <text class="mp-kpi-val">{{ metroPlanSummary.totalStations }}</text>
            <text class="mp-kpi-label muted">站</text>
          </view>
          <view class="mp-kpi">
            <text class="mp-kpi-val">{{ metroPlanBuildCount }}</text>
            <text class="mp-kpi-label muted">在建</text>
          </view>
          <view class="mp-kpi">
            <text class="mp-kpi-val">{{ metroPlanSoonCount }}</text>
            <text class="mp-kpi-label muted">即将开通</text>
          </view>
        </view>
        <view v-if="metroPlanYears.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          预计开通年份
        </view>
        <view v-if="metroPlanYears.length" class="mp-year-row">
          <view v-for="y in metroPlanYears" :key="y.year" class="mp-year-chip">
            <text class="mp-year-y">{{ y.year }}</text>
            <text class="mp-year-n muted">{{ y.lineCount }} 条 · {{ y.totalLengthKm.toFixed(0) }}km</text>
          </view>
        </view>
        <view v-if="metroPlanTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          里程 Top {{ metroPlanTop.length }}
        </view>
        <view
          v-for="(it, idx) in metroPlanTop"
          :key="it.lineName + idx"
          class="mp-line-row"
        >
          <text class="mp-line-rank muted">{{ idx + 1 }}</text>
          <view class="mp-line-mid">
            <text class="mp-line-name">{{ it.lineName }}</text>
            <text class="mp-line-meta muted">
              {{ it.status }}
              <text v-if="it.openYearExpected"> · {{ it.openYearExpected }} 年</text>
              · {{ it.stationCount }} 站
            </text>
          </view>
          <text class="mp-line-km">{{ it.lengthKm.toFixed(1) }} km</text>
        </view>
        <view v-if="metroPlanTopStations.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          站数 Top {{ metroPlanTopStations.length }}
        </view>
        <view
          v-for="(it, idx) in metroPlanTopStations"
          :key="'mps-' + it.lineName + idx"
          class="mp-line-row"
        >
          <text class="mp-line-rank muted">{{ idx + 1 }}</text>
          <view class="mp-line-mid">
            <text class="mp-line-name">{{ it.lineName }}</text>
            <text class="mp-line-meta muted">
              {{ it.status }}
              <text v-if="it.openYearExpected"> · {{ it.openYearExpected }} 年</text>
              · {{ it.lengthKm.toFixed(1) }} km
            </text>
          </view>
          <text class="mp-line-km">{{ it.stationCount }} 站</text>
        </view>
        <view v-if="metroCurvatureTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          线路弯曲系数 Top（实际里程 ÷ 起终点直线）
        </view>
        <view
          v-for="(c, idx) in metroCurvatureTop"
          :key="'curv-' + c.lineId"
          class="mp-line-row"
        >
          <text class="mp-line-rank muted">{{ idx + 1 }}</text>
          <view class="mp-line-mid">
            <text class="mp-line-name">{{ c.lineName }}</text>
            <text class="mp-line-meta muted">
              直线 {{ c.straightLineKm.toFixed(1) }} km
              <text v-if="c.actualLengthKm != null"> · 规划 {{ c.actualLengthKm.toFixed(1) }} km</text>
            </text>
          </view>
          <text class="mp-line-km">{{ c.curvatureRatio?.toFixed(2) ?? "—" }}×</text>
        </view>
        <view v-if="metroPlanGeoCoverage" class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          全国端点坐标覆盖
          {{ metroPlanGeoCoverage.completeEndpoints }}/{{ metroPlanGeoCoverage.totalEndpoints }}
          （{{ (metroPlanGeoCoverage.coverageRatio * 100).toFixed(0) }}%）
        </view>
        <view v-if="metroManualFallback" class="muted" style="margin-top: 4rpx; font-size: 22rpx">
          本市手工坐标兜底
          {{ metroManualFallback.manualLines }}/{{ metroManualFallback.totalLines }}
          （{{ (metroManualFallback.manualRatio * 100).toFixed(0) }}%）
          <text v-if="metroMissingEndpoints.length">
            · 缺端点 {{ metroMissingEndpoints.length }} 条
          </text>
        </view>
        <view v-if="metroGeoCitySummary" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          本市起终点置信 · 直距均 {{ metroGeoCitySummary.avgStraightLineKm.toFixed(1) }} km
          · 最长 {{ metroGeoCitySummary.maxStraightLineKm.toFixed(1) }} km
        </view>
        <view v-if="metroGeoCitySummary" class="mp-year-row">
          <view class="mp-year-chip">
            <text class="mp-year-y">高</text>
            <text class="mp-year-n muted">起 {{ metroGeoCitySummary.startConfidence.high }} / 终 {{ metroGeoCitySummary.endConfidence.high }}</text>
          </view>
          <view class="mp-year-chip">
            <text class="mp-year-y">中</text>
            <text class="mp-year-n muted">起 {{ metroGeoCitySummary.startConfidence.medium }} / 终 {{ metroGeoCitySummary.endConfidence.medium }}</text>
          </view>
          <view class="mp-year-chip">
            <text class="mp-year-y">手</text>
            <text class="mp-year-n muted">起 {{ metroGeoCitySummary.startConfidence.manual }} / 终 {{ metroGeoCitySummary.endConfidence.manual }}</text>
          </view>
        </view>
        <view v-if="metroGeoConfNational.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          全国坐标置信分布
        </view>
        <view
          v-for="c in metroGeoConfNational"
          :key="'mgc-' + c.level"
          class="mp-line-row"
        >
          <text class="mp-line-rank muted">{{ c.level }}</text>
          <view class="mp-line-mid">
            <text class="mp-line-name">{{ c.count }} 条 · {{ c.cityCount }} 城</text>
            <text v-if="c.topLineNames.length" class="mp-line-meta muted">
              例：{{ c.topLineNames.slice(0, 2).join("、") }}
            </text>
          </view>
        </view>
        <view data-cross-city v-if="metroGeoHighCrossCity.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          高置信线路跨城对照
        </view>
        <view
          v-for="c in metroGeoHighCrossCity"
          :key="'mgh-' + c.cityId"
          class="mp-line-row"
        >
          <text class="mp-line-name">{{ cityNameForId(c.cityId) }}</text>
          <text class="mp-line-km">{{ c.lineCount }} 条</text>
        </view>
        <view v-if="metroGeoManualLines.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          手工坐标兜底线路（派生）
        </view>
        <view
          v-for="(g, idx) in metroGeoManualLines"
          :key="'mgm-' + g.lineId"
          class="mp-line-row"
        >
          <text class="mp-line-rank muted">{{ idx + 1 }}</text>
          <view class="mp-line-mid">
            <text class="mp-line-name">{{ metroLineName(g.lineId) }}</text>
            <text class="mp-line-meta muted">
              起 {{ g.startConfidence }} / 终 {{ g.endConfidence }}
            </text>
          </view>
        </view>
        <view v-if="metroFastLines.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          本市快线（≥100km/h）
        </view>
        <view
          v-for="(ln, idx) in metroFastLines"
          :key="'fast-' + ln.lineId"
          class="mp-line-row"
        >
          <text class="mp-line-rank muted">{{ idx + 1 }}</text>
          <view class="mp-line-mid">
            <text class="mp-line-name">{{ ln.lineName }}</text>
            <text class="mp-line-meta muted">{{ ln.status }} · {{ ln.stationCount }} 站</text>
          </view>
          <text class="mp-line-km">{{ ln.maxSpeedKmh }} km/h</text>
        </view>
        <view v-if="metroStraightLineTop.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          起终点直线距离 Top（派生）
        </view>
        <view
          v-for="(ln, idx) in metroStraightLineTop"
          :key="'msl-' + ln.lineId"
          class="mp-line-row"
        >
          <text class="mp-line-rank muted">{{ idx + 1 }}</text>
          <view class="mp-line-mid">
            <text class="mp-line-name">{{ ln.lineName }}</text>
            <text class="mp-line-meta muted">{{ ln.startStation }} → {{ ln.endStation }}</text>
          </view>
          <text class="mp-line-km">{{ ln.straightLineKm.toFixed(1) }} km</text>
        </view>
        <view v-if="metroStatusStations.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          本市状态 × 站数
        </view>
        <view
          v-for="s in metroStatusStations"
          :key="'mss-' + s.status"
          class="mp-year-chip"
          style="margin-right: 8rpx; margin-bottom: 6rpx"
        >
          <text class="mp-year-y">{{ s.status }}</text>
          <text class="mp-year-n muted">{{ s.lineCount }} 条 · {{ s.totalStations }} 站</text>
        </view>
        <view v-if="metroStatusNational.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          全国规划状态汇总
        </view>
        <view
          v-for="s in metroStatusNational"
          :key="'msn-' + s.status"
          class="mp-year-chip"
          style="margin-right: 8rpx; margin-bottom: 6rpx"
        >
          <text class="mp-year-y">{{ s.status }}</text>
          <text class="mp-year-n muted">{{ s.lineCount }} 条 · {{ s.totalLengthKm.toFixed(0) }} km</text>
        </view>
        <view v-if="metroStartEndLines.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          本市起终点直距一览
        </view>
        <view
          v-for="(g, idx) in metroStartEndLines"
          :key="'mse-' + g.lineId"
          class="mp-line-row"
        >
          <text class="mp-line-rank muted">{{ idx + 1 }}</text>
          <view class="mp-line-mid">
            <text class="mp-line-name">{{ metroLineName(g.lineId) }}</text>
            <text class="mp-line-meta muted">{{ g.startStation }} → {{ g.endStation }}</text>
          </view>
          <text class="mp-line-km">
            {{ g.straightLineM != null ? (g.straightLineM / 1000).toFixed(1) + " km" : "—" }}
          </text>
        </view>
        <view data-cross-city v-if="metroCrossYear2028.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          跨城 2028 预计开通线路
        </view>
        <view
          v-for="row in metroCrossYear2028"
          :key="'m28-' + row.cityId"
          class="mp-year-chip"
          style="margin-right: 8rpx; margin-bottom: 6rpx"
        >
          <text class="mp-year-y">{{ row.cityName }}</text>
          <text class="mp-year-n muted">{{ row.lines.join("、") }}</text>
        </view>
        <view v-if="metroDistrictLines.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          「{{ metroDistrictFocus }}」覆盖线路
        </view>
        <view
          v-for="(ln, idx) in metroDistrictLines"
          :key="'mdl-' + ln.lineId"
          class="mp-line-row"
        >
          <text class="mp-line-rank muted">{{ idx + 1 }}</text>
          <view class="mp-line-mid">
            <text class="mp-line-name">{{ ln.lineName }}</text>
            <text class="mp-line-meta muted">{{ ln.status }} · {{ ln.stationCount ?? "—" }} 站</text>
          </view>
          <text class="mp-line-km">
            {{ ln.lengthKm != null ? ln.lengthKm.toFixed(1) + " km" : "—" }}
          </text>
        </view>
        <view v-if="metroPhaseSummary.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          全国建设分期结构
        </view>
        <view
          v-for="ph in metroPhaseSummary"
          :key="'mph-' + ph.phase"
          class="mp-year-chip"
          style="margin-right: 8rpx; margin-bottom: 6rpx"
        >
          <text class="mp-year-y">{{ ph.phase }}</text>
          <text class="mp-year-n muted">
            {{ ph.lineCount }} 条 · {{ ph.totalLengthKm.toFixed(0) }}km · {{ ph.totalStations }} 站
          </text>
        </view>
        <view v-if="metroOpenYearTimeline.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          全国开通年份时间线（近 {{ metroOpenYearTimeline.length }} 档）
        </view>
        <view
          v-for="oy in metroOpenYearTimeline"
          :key="'moyt-' + oy.year"
          class="mp-year-chip"
          style="margin-right: 8rpx; margin-bottom: 6rpx"
        >
          <text class="mp-year-y">{{ oy.year }}</text>
          <text class="mp-year-n muted">
            {{ oy.lineCount }} 条 · {{ oy.totalLengthKm.toFixed(0) }}km · {{ oy.totalStations }} 站
          </text>
        </view>
        <view v-if="metroOpenYear2028.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          全国 2028 开通线路（按里程）
        </view>
        <view
          v-for="(ln, idx) in metroOpenYear2028"
          :key="'moy-' + ln.lineId"
          class="mp-line-row"
        >
          <text class="mp-line-rank muted">{{ idx + 1 }}</text>
          <view class="mp-line-mid">
            <text class="mp-line-name">{{ cityNameForId(ln.cityId) }} · {{ ln.lineName }}</text>
            <text class="mp-line-meta muted">{{ ln.status }} · {{ ln.stationCount ?? "—" }} 站</text>
          </view>
          <text class="mp-line-km">
            {{ ln.lengthKm != null ? ln.lengthKm.toFixed(1) + " km" : "—" }}
          </text>
        </view>
        <view v-if="metroBuildingLines.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          本市在建线路
        </view>
        <view
          v-for="(ln, idx) in metroBuildingLines"
          :key="'mbl-' + ln.lineId"
          class="mp-line-row"
        >
          <text class="mp-line-rank muted">{{ idx + 1 }}</text>
          <view class="mp-line-mid">
            <text class="mp-line-name">{{ ln.lineName }}</text>
            <text class="mp-line-meta muted">
              {{ ln.openYearExpected ?? "—" }} 年 · {{ ln.stationCount ?? "—" }} 站
            </text>
          </view>
          <text class="mp-line-km">
            {{ ln.lengthKm != null ? ln.lengthKm.toFixed(1) + " km" : "—" }}
          </text>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：metro_planning.csv + metro_planning_geo.csv。弯曲系数 ≥1.3 表示线路明显绕行。
        </view>
      </view>

      <!-- v1.121.18 挂牌结构占比（distributionRanking + layout_distribution） -->
      <view v-if="layoutBedroomShare.length || layoutOrientShare.length" class="card" data-tab="all,price">
        <view class="row-between">
          <view class="card-title">📐 挂牌结构占比 · {{ hospitalCityName }}</view>
          <view class="muted">layout</view>
        </view>
        <view v-if="layoutBedroomShare.length" class="muted" style="margin: 4rpx 0; font-size: 22rpx">户型</view>
        <view
          v-for="(r, idx) in layoutBedroomShare"
          :key="'bed-' + layoutBucket(r)"
          class="ltk-row"
        >
          <text class="ltk-rank muted">{{ idx + 1 }}</text>
          <text class="ltk-tag">{{ layoutBucket(r) }}</text>
          <view class="ltk-bar-wrap">
            <view class="ltk-bar" :style="{ width: Math.min(100, (r.share / (layoutBedroomShare[0]?.share || 0.01)) * 100) + '%' }" />
          </view>
          <text class="ltk-share">{{ (r.share * 100).toFixed(1) }}%</text>
          <text class="ltk-count muted">{{ r.count }}</text>
        </view>
        <view v-if="layoutOrientShare.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">朝向</view>
        <view
          v-for="(r, idx) in layoutOrientShare"
          :key="'ori-' + layoutBucket(r)"
          class="ltk-row"
        >
          <text class="ltk-rank muted">{{ idx + 1 }}</text>
          <text class="ltk-tag">{{ layoutBucket(r) }}</text>
          <view class="ltk-bar-wrap">
            <view class="ltk-bar" :style="{ width: Math.min(100, (r.share / (layoutOrientShare[0]?.share || 0.01)) * 100) + '%' }" />
          </view>
          <text class="ltk-share">{{ (r.share * 100).toFixed(1) }}%</text>
          <text class="ltk-count muted">{{ r.count }}</text>
        </view>
        <view data-cross-city v-if="layoutThreeBedCrossCity.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          跨城「3室」占比
        </view>
        <view
          v-for="r in layoutThreeBedCrossCity"
          :key="'3b-' + r.cityId"
          class="ltk-row"
        >
          <text class="ltk-tag" style="width: 100rpx">{{ r.cityName }}</text>
          <view class="ltk-bar-wrap">
            <view
              class="ltk-bar"
              :style="{ width: Math.min(100, (r.share / (layoutThreeBedCrossCity[0]?.share || 0.01)) * 100) + '%' }"
            />
          </view>
          <text class="ltk-share">{{ (r.share * 100).toFixed(1) }}%</text>
          <text class="ltk-count muted">{{ r.count }}</text>
        </view>
        <view data-cross-city v-if="layoutDecorateCrossCity.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          跨城「精装」占比
        </view>
        <view
          v-for="r in layoutDecorateCrossCity"
          :key="'dec-' + r.cityId"
          class="ltk-row"
        >
          <text class="ltk-tag" style="width: 100rpx">{{ r.cityName }}</text>
          <view class="ltk-bar-wrap">
            <view
              class="ltk-bar"
              :style="{ width: Math.min(100, (r.share / (layoutDecorateCrossCity[0]?.share || 0.01)) * 100) + '%' }"
            />
          </view>
          <text class="ltk-share">{{ (r.share * 100).toFixed(1) }}%</text>
          <text class="ltk-count muted">{{ r.count }}</text>
        </view>
        <view data-cross-city v-if="bedroomAreaCrossCityPrice.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          跨城「3室 · 80-110㎡」中位单价
        </view>
        <view
          v-for="r in bedroomAreaCrossCityPrice"
          :key="'ba3-' + r.cityId"
          class="ltk-row"
        >
          <text class="ltk-tag" style="width: 100rpx">{{ r.cityName }}</text>
          <view class="ltk-bar-wrap">
            <view
              class="ltk-bar"
              :style="{
                width:
                  Math.min(
                    100,
                    ((r.medianUnitPrice ?? 0) /
                      (bedroomAreaCrossCityPrice[0]?.medianUnitPrice || 1)) *
                      100
                  ) + '%'
              }"
            />
          </view>
          <text class="ltk-share">
            {{ r.medianUnitPrice != null ? Math.round(r.medianUnitPrice / 1000) + "k" : "—" }}
          </text>
          <text class="ltk-count muted">{{ r.count }}</text>
        </view>
        <view data-cross-city v-if="layoutTwoBedShareCross.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          跨城「2室」占比（layout）
        </view>
        <view
          v-for="r in layoutTwoBedShareCross"
          :key="'2b-' + r.cityId"
          class="ltk-row"
        >
          <text class="ltk-tag" style="width: 100rpx">{{ r.cityName }}</text>
          <view class="ltk-bar-wrap">
            <view
              class="ltk-bar"
              :style="{
                width:
                  Math.min(
                    100,
                    (r.share / (layoutTwoBedShareCross[0]?.share || 0.01)) * 100
                  ) + '%'
              }"
            />
          </view>
          <text class="ltk-share">{{ (r.share * 100).toFixed(1) }}%</text>
          <text class="ltk-count muted">{{ r.count }}</text>
        </view>
        <view v-if="layoutMedianPriceTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          本市结构桶中位单价 Top
        </view>
        <view
          v-for="(r, idx) in layoutMedianPriceTop"
          :key="'lmp-' + idx + distRowLabel(r)"
          class="ltk-row"
        >
          <text class="ltk-rank muted">{{ idx + 1 }}</text>
          <text class="ltk-tag" style="flex: 1">{{ distRowLabel(r) }}</text>
          <text class="ltk-share">
            {{
              distRowPrice(r) != null
                ? Math.round((distRowPrice(r) as number) / 1000) + "k"
                : "—"
            }}
          </text>
          <text class="ltk-count muted">×{{ r.count }}</text>
        </view>
        <view data-cross-city class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：layout_distribution.csv + bedroom_area.csv。与户型×面积矩阵卡互补（本卡看单维占比与跨城结构）。
        </view>
      </view>

      <!-- v0.38.0 trend-18 区情画像 (行政区代码 + 房价指数 + 学区评分 + 挂牌量 + 楼龄) -->
      <view v-if="districtMeta && districtMeta.items.length > 0" class="card" data-tab="all,school">
        <view class="row-between">
          <view class="card-title">📋 区情画像 · {{ districtMeta.cityName }}</view>
          <view class="muted">{{ districtMeta.items.length }} 区 · {{ districtMeta.withPrice }} 有均价 · {{ districtMeta.withSchool }} 有学区</view>
        </view>
        <view class="dm-chips">
          <view
            v-for="s in [
              { key: 'price', label: '按均价' },
              { key: 'school', label: '按学区' },
              { key: 'mom', label: '按月环比' },
              { key: 'listing', label: '按挂牌' },
              { key: 'default', label: '按区码' }
            ]"
            :key="s.key"
            :class="['dm-chip', districtMetaSortBy === s.key ? 'dm-chip-on' : '']"
            @click="setDmSort(s.key as any)"
          >{{ s.label }}</view>
          <view
            :class="['dm-chip', districtMetaHideEmpty ? 'dm-chip-on' : '']"
            @click="toggleDmHideEmpty()"
          >仅显示有数据</view>
        </view>
        <view
          v-for="d in districtMeta.items"
          :key="d.districtName"
          class="dm-row"
        >
          <view class="dm-left">
            <view class="dm-name">{{ d.districtName }}</view>
            <view class="muted" style="font-size: 22rpx">区码 {{ d.adminCode || '—' }} · 片区代码 {{ d.areaCode || '—' }}</view>
          </view>
          <view class="dm-mid">
            <view class="dm-line">
              <text class="dm-k">挂牌</text>
              <text class="dm-v">{{ d.listingCount }}</text>
              <text class="dm-sub muted">{{ d.communityCount }} 小区</text>
            </view>
            <view class="dm-line">
              <text class="dm-k">均价</text>
              <text class="dm-v">{{ d.medianUnitPrice ? (d.medianUnitPrice / 10000).toFixed(1) + 'w' : '—' }}</text>
              <text :class="['dm-mom', momClass(d.momChangePct)]">
                {{ d.momChangePct != null ? (d.momChangePct >= 0 ? '+' : '') + d.momChangePct + '%' : '—' }}
              </text>
            </view>
            <view class="dm-line">
              <text class="dm-k">学区</text>
              <text class="dm-v">{{ d.avgSchoolScore != null ? d.avgSchoolScore : '—' }}</text>
              <text class="dm-sub muted">{{ d.schoolCount }} 校</text>
            </view>
            <view class="dm-line">
              <text class="dm-k">楼龄</text>
              <text class="dm-v">{{ d.medianBuildYear ?? '—' }}</text>
              <text class="dm-sub muted">{{ d.medianBuildYear ? (2026 - d.medianBuildYear) + '年' : '' }}</text>
            </view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：admin_districts.csv + district_index.csv + school_premium_district.csv + listings.csv → scripts/compute_district_metadata.py。
        </view>
      </view>

      <!-- v0.39.0 trend-19 特征画像溢价 (户型/面积/朝向/装修 哪类更贵/更便宜) -->
      <view v-if="featurePremium && featurePremium.totalCount > 0" class="card" data-tab="all,price">
        <view class="row-between">
          <view class="card-title">💎 特征画像溢价 · {{ featurePremium.cityName }}</view>
          <view class="muted">基线 = 城市中位单价 · {{ featurePremium.totalCount }} 桶 · minCount ≥ 5</view>
        </view>
        <view class="fp-dim-row">
          <view
            v-for="d in featurePremium.dimensions"
            :key="d.dimension"
            class="fp-dim-block"
          >
            <view class="fp-dim-head">
              <text class="fp-dim-name">{{ fpDimLabel(d.dimension) }}</text>
              <text class="muted">{{ d.count }} 桶</text>
            </view>
            <view
              v-for="it in d.items.slice(0, 3)"
              :key="d.dimension + '_' + it.bucket"
              class="fp-row"
            >
              <view class="fp-bucket">{{ it.bucket }}</view>
              <view class="fp-bar-wrap">
                <view
                  class="fp-bar"
                  :class="fpBarClass(it.premiumPct)"
                  :style="{ width: fpBarWidth(it.premiumPct) + '%' }"
                />
              </view>
              <view :class="['fp-pct', fpPctClass(it.premiumPct)]">
                {{ it.premiumPct >= 0 ? '+' : '' }}{{ it.premiumPct.toFixed(1) }}%
              </view>
            </view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：listings.csv (中位单价) + cities.csv → scripts/compute_feature_premium.py。<br>
          公式：premium% = (bucket 桶中位单价 ÷ 城市中位单价 − 1) × 100。
        </view>
        <view data-cross-city v-if="featurePremiumCrossBedrooms.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          跨城「户型」最高溢价桶
        </view>
        <view
          v-for="r in featurePremiumCrossBedrooms"
          :key="'fpb-' + r.cityId"
          class="fp-row"
        >
          <view class="fp-bucket">{{ r.cityName }} · {{ r.bucket }}</view>
          <view :class="['fp-pct', fpPctClass(r.premiumPct)]">
            {{ r.premiumPct >= 0 ? '+' : '' }}{{ r.premiumPct.toFixed(1) }}%
          </view>
        </view>
        <view v-if="featurePremiumAbsTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          全国 |溢价| 最大桶
        </view>
        <view
          v-for="(r, idx) in featurePremiumAbsTop"
          :key="'fpa-' + r.cityId + r.dimension + r.bucket"
          class="fp-row"
        >
          <view class="fp-bucket">
            {{ idx + 1 }}. {{ r.cityName }} · {{ fpDimLabel(r.dimension) }} · {{ r.bucket }}
          </view>
          <view :class="['fp-pct', fpPctClass(r.premiumPct)]">
            {{ r.premiumPct >= 0 ? '+' : '' }}{{ r.premiumPct.toFixed(1) }}%
          </view>
        </view>
        <view v-if="featurePremiumCityTops.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          本市各维最高溢价桶
        </view>
        <view
          v-for="r in featurePremiumCityTops"
          :key="'fpt-' + r.dimension"
          class="fp-row"
        >
          <view class="fp-bucket">{{ fpDimLabel(r.dimension) }} · {{ r.bucket }}</view>
          <view :class="['fp-pct', fpPctClass(r.premiumPct)]">
            {{ r.premiumPct >= 0 ? '+' : '' }}{{ r.premiumPct.toFixed(1) }}%
          </view>
        </view>
        <view v-if="featurePremiumCitySummary" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          本市极值桶摘要（派生 summarizeFeaturePremiumByCity）
        </view>
        <view v-if="featurePremiumCitySummary?.topBucket" class="fp-row">
          <view class="fp-bucket">
            最高 · {{ fpDimLabel(featurePremiumCitySummary.topBucket.dimension) }} ·
            {{ featurePremiumCitySummary.topBucket.bucket }}
          </view>
          <view :class="['fp-pct', fpPctClass(featurePremiumCitySummary.topBucket.premiumPct)]">
            +{{ featurePremiumCitySummary.topBucket.premiumPct.toFixed(1) }}%
          </view>
        </view>
        <view v-if="featurePremiumCitySummary?.bottomBucket" class="fp-row">
          <view class="fp-bucket">
            最低 · {{ fpDimLabel(featurePremiumCitySummary.bottomBucket.dimension) }} ·
            {{ featurePremiumCitySummary.bottomBucket.bucket }}
          </view>
          <view :class="['fp-pct', fpPctClass(featurePremiumCitySummary.bottomBucket.premiumPct)]">
            {{ featurePremiumCitySummary.bottomBucket.premiumPct.toFixed(1) }}%
          </view>
        </view>
        <view v-if="featurePremiumDecorateBuckets.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          本市装修维全部桶
        </view>
        <view
          v-for="r in featurePremiumDecorateBuckets"
          :key="'fpd-' + r.bucket"
          class="fp-row"
        >
          <view class="fp-bucket">{{ r.bucket }} · {{ r.count }} 套</view>
          <view :class="['fp-pct', fpPctClass(r.premiumPct)]">
            {{ r.premiumPct >= 0 ? '+' : '' }}{{ r.premiumPct.toFixed(1) }}%
          </view>
        </view>
      </view>

      <!-- v1.121.14 挂牌标签热度（listingTagsComparison，筛选项页已用，仪表盘此前未展示） -->
      <view v-if="listingTagCitySummary" class="card" data-tab="all,price">
        <view class="row-between">
          <view class="card-title">🔖 挂牌标签热度 · {{ listingTagCitySummary.cityName }}</view>
          <view class="muted">{{ listingTagCitySummary.totalTags }} 标签</view>
        </view>
        <view
          v-for="(t, idx) in listingTagCitySummary.topTags"
          :key="t.tag"
          class="ltk-row"
        >
          <text class="ltk-rank muted">{{ idx + 1 }}</text>
          <text class="ltk-tag">{{ t.tag }}</text>
          <view class="ltk-bar-wrap">
            <view
              class="ltk-bar"
              :style="{ width: Math.min(100, (t.share / (listingTagTopShare || 0.01)) * 100) + '%' }"
            />
          </view>
          <text class="ltk-share">{{ (t.share * 100).toFixed(1) }}%</text>
          <text class="ltk-count muted">{{ t.count }}</text>
        </view>
        <view v-if="listingTagSignature.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          本市特色（相对他城 ≥1.5×）
        </view>
        <view
          v-for="s in listingTagSignature"
          :key="s.tag"
          class="ltk-sig-row"
        >
          <text class="ltk-sig-tag">{{ s.tag }}</text>
          <text class="ltk-sig-share">{{ (s.share * 100).toFixed(1) }}%</text>
          <text class="ltk-sig-vs muted">他城均 {{ (s.otherAvg * 100).toFixed(1) }}%</text>
        </view>
        <view data-cross-city v-if="listingTagPenetrationTop.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          跨城共有标签渗透（本市）
        </view>
        <view
          v-for="t in listingTagPenetrationTop"
          :key="'pen-' + t.tag"
          class="ltk-row"
        >
          <text class="ltk-tag">{{ t.tag }}</text>
          <view class="ltk-bar-wrap">
            <view
              class="ltk-bar"
              :style="{
                width:
                  Math.min(
                    100,
                    ((t.cityShare ?? 0) / (listingTagPenetrationTop[0]?.cityShare || 0.01)) * 100
                  ) + '%'
              }"
            />
          </view>
          <text class="ltk-share">{{ ((t.cityShare ?? 0) * 100).toFixed(1) }}%</text>
          <text class="ltk-count muted">均 {{ (t.avgShare * 100).toFixed(1) }}%</text>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：listing_tags_summary.csv。与「标签组合」不同：本卡看单标签渗透与城市特色。
        </view>
        <view v-if="listingKeywordsCity.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          标题关键词（listing_keyword）
        </view>
        <view
          v-for="k in listingKeywordsCity"
          :key="'kw-' + k.keyword"
          class="ltk-row"
        >
          <text class="ltk-tag">{{ k.keyword }}</text>
          <view class="ltk-bar-wrap">
            <view
              class="ltk-bar"
              :style="{
                width:
                  Math.min(
                    100,
                    (k.share / (listingKeywordsCity[0]?.share || 0.01)) * 100
                  ) + '%'
              }"
            />
          </view>
          <text class="ltk-share">{{ (k.share * 100).toFixed(1) }}%</text>
          <text class="ltk-count muted">{{ k.count }}</text>
        </view>
        <view data-cross-city v-if="listingKeywordTongtouCross.length" class="muted" style="margin: 8rpx 0 4rpx; font-size: 22rpx">
          跨城「南北通透」渗透
        </view>
        <view
          v-for="k in listingKeywordTongtouCross"
          :key="'tt-' + k.cityId"
          class="ltk-row"
        >
          <text class="ltk-tag" style="width: 100rpx">{{ k.cityName }}</text>
          <view class="ltk-bar-wrap">
            <view
              class="ltk-bar"
              :style="{
                width:
                  Math.min(
                    100,
                    (k.share / (listingKeywordTongtouCross[0]?.share || 0.01)) * 100
                  ) + '%'
              }"
            />
          </view>
          <text class="ltk-share">{{ (k.share * 100).toFixed(1) }}%</text>
        </view>
      </view>

      <!-- v0.40.0 trend-20 标签组合热度 (最常一起出现的 2 标签) -->
      <view v-if="tagCombination && tagCombination.topN.length > 0" class="card" data-tab="all,price">
        <view class="row-between">
          <view class="card-title">🏷️ 标签组合热度 · {{ tagCombination.cityName }}</view>
          <view class="muted">top {{ tagCombination.topN.length }} · 共 {{ tagCombination.totalCount }} 对</view>
        </view>
        <view
          v-for="(it, idx) in tagCombination.topN"
          :key="idx"
          class="tc-row"
        >
          <view class="tc-rank">{{ idx + 1 }}</view>
          <view class="tc-mid">
            <view class="tc-pair">
              <text class="tc-tag">{{ it.tagA }}</text>
              <text class="tc-plus">+</text>
              <text class="tc-tag">{{ it.tagB }}</text>
            </view>
            <view class="tc-meta muted">
              出现 {{ it.count }} 套 · 占比 {{ (it.share * 100).toFixed(1) }}% · 中位单价
              <text v-if="it.avgUnitPrice" class="tc-price">{{ Math.round(it.avgUnitPrice / 1000) }}k 元/㎡</text>
              <text v-else>—</text>
            </view>
          </view>
          <view class="tc-bar-wrap">
            <view
              class="tc-bar"
              :style="{ width: tcBarWidth(it.count, tagCombination.topN[0].count) + '%' }"
            />
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：listing_tags.csv (7518 行) → scripts/compute_tag_combination.py。<br>
          公式：对每个 listing 取 4-7 个 tag, C(2) 算 2-组合, count ≥ 5 才入榜。
        </view>
        <view data-cross-city v-if="tagComboCrossCity.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          跨城共有标签对
        </view>
        <view
          v-for="(it, idx) in tagComboCrossCity"
          :key="'tcc-' + it.tagA + it.tagB"
          class="tc-row"
        >
          <view class="tc-rank">{{ idx + 1 }}</view>
          <view class="tc-mid">
            <view class="tc-pair">
              <text class="tc-tag">{{ it.tagA }}</text>
              <text class="tc-plus">+</text>
              <text class="tc-tag">{{ it.tagB }}</text>
            </view>
            <view class="tc-meta muted">
              {{ it.cities.join(" / ") }} · 合计 {{ it.totalCount }} 套
            </view>
          </view>
        </view>
        <view v-if="tagComboPremiumLocal.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          本市均价最高标签对
        </view>
        <view
          v-for="(it, idx) in tagComboPremiumLocal"
          :key="'tcp-' + it.tagA + it.tagB"
          class="tc-row"
        >
          <view class="tc-rank">{{ idx + 1 }}</view>
          <view class="tc-mid">
            <view class="tc-pair">
              <text class="tc-tag">{{ it.tagA }}</text>
              <text class="tc-plus">+</text>
              <text class="tc-tag">{{ it.tagB }}</text>
            </view>
            <view class="tc-meta muted">
              {{ it.count }} 套
              <text v-if="it.avgUnitPrice" class="tc-price">
                · {{ Math.round(it.avgUnitPrice / 1000) }}k 元/㎡
              </text>
            </view>
          </view>
        </view>
        <view v-if="tagComboPopularLocal.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          派生层最常见标签对
        </view>
        <view
          v-for="(it, idx) in tagComboPopularLocal"
          :key="'tpop-' + it.tagA + it.tagB"
          class="tc-row"
        >
          <view class="tc-rank">{{ idx + 1 }}</view>
          <view class="tc-mid">
            <view class="tc-pair">
              <text class="tc-tag">{{ it.tagA }}</text>
              <text class="tc-plus">+</text>
              <text class="tc-tag">{{ it.tagB }}</text>
            </view>
            <view class="tc-meta muted">
              {{ it.count }} 套 · {{ (it.share * 100).toFixed(1) }}%
            </view>
          </view>
        </view>
        <view data-cross-city v-if="tagComboMetroPartners" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          「地铁可达」常搭配（跨城）
        </view>
        <view
          v-for="(p, idx) in tagComboMetroPartners?.pairs ?? []"
          :key="'tmp-' + p.otherTag"
          class="tc-row"
        >
          <view class="tc-rank">{{ idx + 1 }}</view>
          <view class="tc-mid">
            <view class="tc-pair">
              <text class="tc-tag">地铁可达</text>
              <text class="tc-plus">+</text>
              <text class="tc-tag">{{ p.otherTag }}</text>
            </view>
            <view class="tc-meta muted">{{ p.cities }} 城 · 合计 {{ p.totalCount }} 套</view>
          </view>
        </view>
        <view data-cross-city v-if="tagComboCitySummaries.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          跨城标签组合密度
        </view>
        <view
          v-for="c in tagComboCitySummaries"
          :key="'tccs-' + c.cityId"
          class="tc-row"
        >
          <view class="tc-mid">
            <view class="tc-pair">
              <text class="tc-tag">{{ c.cityName }}</text>
            </view>
            <view class="tc-meta muted">
              {{ c.combinationCount }} 对 · 均 share {{ (c.avgShare * 100).toFixed(1) }}% · 均 {{ c.avgCount.toFixed(0) }} 套
            </view>
          </view>
        </view>
      </view>

      <!-- v0.41.0 trend-21 房源新鲜度 (新挂牌多 + 滞销) -->
      <view v-if="listingFreshness && listingFreshness.totalCount > 0" class="card" data-tab="all,price">
        <view class="row-between">
          <view class="card-title">📅 房源新鲜度 · {{ listingFreshness.cityName }}</view>
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

      <!-- v0.42.0 trend-22 户型 × 面积 联合热图 -->
      <view v-if="bedroomArea && bedroomArea.bedrooms.length > 0" class="card" data-tab="all,price">
        <view class="row-between">
          <view class="card-title">📐 户型 × 面积 分布 · {{ bedroomArea.cityName }}</view>
          <view class="muted">minCount ≥ 3 · 共 {{ bedroomArea.totalCount }} 套</view>
        </view>
        <view class="ba-heatmap">
          <view class="ba-row ba-header">
            <view class="ba-corner"></view>
            <view
              v-for="ab in bedroomArea.areaBuckets"
              :key="'h_' + ab"
              class="ba-col-h"
            >{{ ab }}</view>
          </view>
          <view
            v-for="(bed, bedIdx) in bedroomArea.bedrooms"
            :key="'r_' + bed"
            class="ba-row"
          >
            <view class="ba-row-h">{{ bed }}室</view>
            <view
              v-for="(cell, cIdx) in bedroomArea.grid[bedIdx]"
              :key="'c_' + bed + '_' + cIdx"
              :class="['ba-cell', cell.count > 0 ? 'ba-cell-on' : 'ba-cell-off']"
              :style="{ opacity: baCellOpacity(cell.count, baMaxCount) }"
            >
              <text class="ba-cell-n">{{ baCellLabel(cell.count) }}</text>
              <text v-if="cell.count > 0" class="ba-cell-p">
                {{ Math.round(cell.medianUnitPrice / 1000) }}k
              </text>
            </view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：listings.csv (bedrooms + area_sqm) → scripts/compute_bedroom_area.py。<br>
          显示：上=套数 / 下=中位单价(千元/㎡)，颜色深浅=热度。
        </view>
      </view>

      <!-- v0.43.0 trend-23 朝向 × 楼层 溢价矩阵 -->
      <view v-if="orientationFloor && orientationFloor.orientations.length > 0" class="card" data-tab="all,price">
        <view class="row-between">
          <view class="card-title">🧭 朝向 × 楼层 溢价 · {{ orientationFloor.cityName }}</view>
          <view class="muted">vs 全城中位 {{ Math.round(orientationFloor.cityMedian) }} 元/㎡ · minCount ≥ 5</view>
        </view>
        <view class="of-section-title">📈 溢价 Top 5</view>
        <view
          v-for="(p, idx) in orientationFloor.topPremium"
          :key="'p_' + idx + '_' + p.orientation + p.floorBucket"
          class="of-row of-row-up"
        >
          <text class="of-rank">#{{ idx + 1 }}</text>
          <text class="of-key">{{ p.orientation }} · {{ p.floorBucket }}</text>
          <text class="of-pct">+{{ p.premiumPct }}%</text>
          <text class="of-px">{{ Math.round(p.medianUnitPrice) }} 元</text>
          <text class="of-n">×{{ p.count }}</text>
        </view>
        <view class="of-section-title">📉 折价 Top 5</view>
        <view
          v-for="(p, idx) in orientationFloor.topDiscount"
          :key="'d_' + idx + '_' + p.orientation + p.floorBucket"
          class="of-row of-row-down"
        >
          <text class="of-rank">#{{ idx + 1 }}</text>
          <text class="of-key">{{ p.orientation }} · {{ p.floorBucket }}</text>
          <text class="of-pct">{{ p.premiumPct }}%</text>
          <text class="of-px">{{ Math.round(p.medianUnitPrice) }} 元</text>
          <text class="of-n">×{{ p.count }}</text>
        </view>
        <view class="of-section-title">🟦 矩阵 (行=朝向 · 列=楼层 · 颜色=溢价%)</view>
        <view class="of-matrix">
          <view class="of-mrow of-mheader">
            <view class="of-mcorner">朝向\楼层</view>
            <view
              v-for="fb in orientationFloor.floorBuckets"
              :key="'h_' + fb"
              class="of-mcol-h"
            >{{ fb }}</view>
          </view>
          <view
            v-for="(o, oIdx) in orientationFloor.orientations"
            :key="'r_' + o"
            class="of-mrow"
          >
            <view class="of-mrow-h">{{ o }}</view>
            <view
              v-for="(cell, cIdx) in orientationFloor.grid[oIdx]"
              :key="'c_' + o + '_' + cIdx"
              :class="['of-mcell', ofCellClass(cell)]"
            >
              <text class="of-mcell-n">{{ ofCellLabel(cell) }}</text>
              <text v-if="cell.count > 0" class="of-mcell-p">{{ ofCellPctLabel(cell) }}</text>
            </view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：listings.csv (orientation + floor_number) → scripts/compute_orientation_floor.py。<br>
          公式：premium_pct = (cell_median - city_median) ÷ city_median × 100<br>
          颜色：绿=溢价 ≥3%, 红=折价 ≤-3%, 灰=中性
        </view>
        <view v-if="orientationFloorCityBest.length" class="of-section-title">
          本市极值桶（派生层）
        </view>
        <view
          v-for="(p, idx) in orientationFloorCityBest"
          :key="'ofb-' + idx"
          class="of-row of-row-up"
        >
          <text class="of-rank">↑{{ idx + 1 }}</text>
          <text class="of-key">{{ p.orientation }} · {{ p.floorBucket }}</text>
          <text class="of-pct">+{{ p.premiumPct.toFixed(1) }}%</text>
        </view>
        <view
          v-for="(p, idx) in orientationFloorCityWorst"
          :key="'ofw-' + idx"
          class="of-row of-row-down"
        >
          <text class="of-rank">↓{{ idx + 1 }}</text>
          <text class="of-key">{{ p.orientation }} · {{ p.floorBucket }}</text>
          <text class="of-pct">{{ p.premiumPct.toFixed(1) }}%</text>
        </view>
        <view v-if="orientationTongtouFloors.length" class="of-section-title">
          「南北通透」本市各楼层溢价
        </view>
        <view
          v-for="(p, idx) in orientationTongtouFloors"
          :key="'oftf-' + p.floorBucket"
          class="of-row"
        >
          <text class="of-rank">#{{ idx + 1 }}</text>
          <text class="of-key">{{ p.floorBucket }}</text>
          <text class="of-pct">{{ p.premiumPct >= 0 ? "+" : "" }}{{ p.premiumPct.toFixed(1) }}%</text>
          <text class="of-n">×{{ p.count }}</text>
        </view>
        <view v-if="orientationHighFloorBuckets.length" class="of-section-title">
          「高楼层」本市各朝向溢价
        </view>
        <view
          v-for="(p, idx) in orientationHighFloorBuckets"
          :key="'ohf-' + p.orientation"
          class="of-row"
        >
          <text class="of-rank">#{{ idx + 1 }}</text>
          <text class="of-key">{{ p.orientation }}</text>
          <text class="of-pct">{{ p.premiumPct >= 0 ? "+" : "" }}{{ p.premiumPct.toFixed(1) }}%</text>
          <text class="of-n">×{{ p.count }}</text>
        </view>
        <view data-cross-city v-if="orientationTongtouPriceTop.length" class="of-section-title">
          「南北通透」跨城楼层单价 Top
        </view>
        <view
          v-for="(p, idx) in orientationTongtouPriceTop"
          :key="'oft-' + p.cityId + p.floorBucket"
          class="of-row"
        >
          <text class="of-rank">#{{ idx + 1 }}</text>
          <text class="of-key">{{ p.cityName }} · {{ p.floorBucket }}</text>
          <text class="of-px">{{ Math.round(p.medianUnitPrice) }} 元</text>
          <text class="of-n">×{{ p.count }}</text>
        </view>
        <view data-cross-city v-if="orientationTongtouHighCross.length" class="of-section-title">
          「南北通透 · 高楼层」跨城溢价
        </view>
        <view
          v-for="(p, idx) in orientationTongtouHighCross"
          :key="'ofh-' + p.cityId"
          class="of-row"
          :class="p.premiumPct >= 0 ? 'of-row-up' : 'of-row-down'"
        >
          <text class="of-rank">#{{ idx + 1 }}</text>
          <text class="of-key">{{ p.cityName }}</text>
          <text class="of-pct">
            {{ p.premiumPct >= 0 ? '+' : '' }}{{ p.premiumPct.toFixed(1) }}%
          </text>
          <text class="of-px">{{ Math.round(p.medianUnitPrice) }} 元</text>
        </view>
        <view data-cross-city v-if="orientationFloorCitySummaries.length" class="of-section-title">
          跨城朝向×楼层均溢价
        </view>
        <view
          v-for="c in orientationFloorCitySummaries"
          :key="'ofcs-' + c.cityId"
          class="of-row"
          :class="c.avgPremiumPct >= 0 ? 'of-row-up' : 'of-row-down'"
        >
          <text class="of-key">{{ c.cityName }}</text>
          <text class="of-pct">
            均 {{ c.avgPremiumPct >= 0 ? '+' : '' }}{{ c.avgPremiumPct.toFixed(1) }}%
          </text>
          <text class="of-n">×{{ c.totalListings }}</text>
          <text v-if="c.best" class="of-px muted">
            高 {{ c.best.orientation }}·{{ c.best.floorBucket }}
          </text>
        </view>
      </view>

      <!-- v0.44.0 trend-24 装修 × 楼龄 溢价矩阵 -->
      <view v-if="decorateAge && decorateAge.decorates.length > 0" class="card" data-tab="all,price">
        <view class="row-between">
          <view class="card-title">🛋️ 装修 × 楼龄 溢价 · {{ decorateAge.cityName }}</view>
          <view class="muted">vs 全城中位 {{ Math.round(decorateAge.cityMedian) }} 元/㎡ · minCount ≥ 5</view>
        </view>
        <view class="of-section-title">📈 溢价 Top 5</view>
        <view
          v-for="(p, idx) in decorateAge.topPremium"
          :key="'dp_' + idx + '_' + p.decorate + p.ageBucket"
          class="of-row of-row-up"
        >
          <text class="of-rank">#{{ idx + 1 }}</text>
          <text class="of-key">{{ p.decorate }} · {{ p.ageBucket }}</text>
          <text class="of-pct">+{{ p.premiumPct }}%</text>
          <text class="of-px">{{ Math.round(p.medianUnitPrice) }} 元</text>
          <text class="of-n">×{{ p.count }}</text>
        </view>
        <view class="of-section-title">📉 折价 Top 5</view>
        <view
          v-for="(p, idx) in decorateAge.topDiscount"
          :key="'dd_' + idx + '_' + p.decorate + p.ageBucket"
          class="of-row of-row-down"
        >
          <text class="of-rank">#{{ idx + 1 }}</text>
          <text class="of-key">{{ p.decorate }} · {{ p.ageBucket }}</text>
          <text class="of-pct">{{ p.premiumPct }}%</text>
          <text class="of-px">{{ Math.round(p.medianUnitPrice) }} 元</text>
          <text class="of-n">×{{ p.count }}</text>
        </view>
        <view class="of-section-title">🟦 矩阵 (行=装修 · 列=楼龄 · 颜色=溢价%)</view>
        <view class="of-matrix">
          <view class="of-mrow of-mheader">
            <view class="of-mcorner">装修\楼龄</view>
            <view
              v-for="ab in decorateAge.ageBuckets"
              :key="'h_' + ab"
              class="of-mcol-h"
            >{{ ab }}</view>
          </view>
          <view
            v-for="(d, dIdx) in decorateAge.decorates"
            :key="'r_' + d"
            class="of-mrow"
          >
            <view class="of-mrow-h">{{ d }}</view>
            <view
              v-for="(cell, cIdx) in decorateAge.grid[dIdx]"
              :key="'c_' + d + '_' + cIdx"
              :class="['of-mcell', daCellClass(cell)]"
            >
              <text class="of-mcell-n">{{ daCellLabel(cell) }}</text>
              <text v-if="cell.count > 0" class="of-mcell-p">{{ daCellPctLabel(cell) }}</text>
            </view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：listings.csv (decorate_type + build_year) → scripts/compute_decorate_age.py。<br>
          楼龄段：≤1999/2000-2004/2005-2009/2010-2014/2015-2019/2020+<br>
          颜色：深绿=溢价 ≥10%, 浅绿=≥3%, 深红=折价 ≤-10%, 浅红=≤-3%
        </view>
        <view v-if="decorateAgeDistBuckets.length" class="of-section-title">
          精装 × 楼龄分布桶（派生 getDistributionByCityDimension）
        </view>
        <view
          v-for="(r, idx) in decorateAgeDistBuckets"
          :key="'dad-' + idx"
          class="of-row"
        >
          <text class="of-rank">#{{ idx + 1 }}</text>
          <text class="of-key">{{ distRowLabel(r) }}</text>
          <text class="of-n">{{ r.count }} 套 · {{ (r.share * 100).toFixed(0) }}%</text>
        </view>
      </view>

      <!-- v0.45.0 trend-25 社区 总价 × 单价 双轴散点 -->
      <view v-if="scatter && scatter.points.length > 0" class="card" data-tab="all,price,map">
        <view class="row-between">
          <view class="card-title">💹 社区 总价 × 单价 散点 · {{ scatter.cityName }}</view>
          <view class="muted">共 {{ scatter.points.length }} 社区 (≥3 套)</view>
        </view>
        <view class="scatter-legend">
          <view class="scatter-leg-item">
            <view class="scatter-leg-dot" style="background:#dc2626"></view>
            <text>豪宅板块 ({{ scatter.byQuadrant["豪宅板块"]?.length || 0 }})</text>
          </view>
          <view class="scatter-leg-item">
            <view class="scatter-leg-dot" style="background:#059669"></view>
            <text>学区刚需 ({{ scatter.byQuadrant["学区刚需"]?.length || 0 }})</text>
          </view>
          <view class="scatter-leg-item">
            <view class="scatter-leg-dot" style="background:#2563eb"></view>
            <text>改善低密 ({{ scatter.byQuadrant["改善低密"]?.length || 0 }})</text>
          </view>
          <view class="scatter-leg-item">
            <view class="scatter-leg-dot" style="background:#9333ea"></view>
            <text>价值洼地 ({{ scatter.byQuadrant["价值洼地"]?.length || 0 }})</text>
          </view>
        </view>
        <view v-if="scatterCitySummary" class="muted" style="margin: 8rpx 0; font-size: 22rpx">
          本市聚合 {{ scatterCitySummary.communityCount }} 小区
          · 均单价 {{ Math.round(scatterCitySummary.avgUnitPrice / 1000) }}k
          · 均总价 {{ Math.round(scatterCitySummary.avgTotalPrice10w) }} 万
          · 均面积 {{ Math.round(scatterCitySummary.avgArea) }}㎡
        </view>
        <view v-if="scatterQuadrantSummary.length" class="muted" style="margin: 4rpx 0; font-size: 20rpx">
          象限：
          <text
            v-for="(q, i) in scatterQuadrantSummary"
            :key="'sqs-' + q.quadrant"
          >
            {{ i ? " · " : "" }}{{ q.quadrant }} {{ q.communityCount }}
          </text>
        </view>
        <view v-if="scatterAreaCohortSummary.length" class="muted" style="margin: 4rpx 0 8rpx; font-size: 20rpx">
          面积段：
          <text
            v-for="(a, i) in scatterAreaCohortSummary"
            :key="'sas-' + a.areaCohort"
          >
            {{ i ? " · " : "" }}{{ a.areaCohort }} {{ a.communityCount }}
          </text>
        </view>
        <view class="scatter-wrap">
          <svg :viewBox="`0 0 ${SCATTER_W} ${SCATTER_H}`" class="scatter-svg" xmlns="http://www.w3.org/2000/svg">
            <!-- 中位十字线 -->
            <line
              :x1="scatterX(scatter.cityMedianUnit, scatter.xMin, scatter.xMax)"
              :y1="SCATTER_MARGIN.top"
              :x2="scatterX(scatter.cityMedianUnit, scatter.xMin, scatter.xMax)"
              :y2="SCATTER_H - SCATTER_MARGIN.bottom"
              stroke="#94a3b8"
              stroke-width="1"
              stroke-dasharray="4,3"
            />
            <line
              :x1="SCATTER_MARGIN.left"
              :y1="scatterY(scatter.cityMedianTotal, scatter.yMin, scatter.yMax)"
              :x2="SCATTER_W - SCATTER_MARGIN.right"
              :y2="scatterY(scatter.cityMedianTotal, scatter.yMin, scatter.yMax)"
              stroke="#94a3b8"
              stroke-width="1"
              stroke-dasharray="4,3"
            />
            <!-- X axis ticks -->
            <g v-if="scatterAxisTicks">
              <text
                v-for="(tx, i) in scatterAxisTicks.xs"
                :key="'xt_' + i"
                :x="scatterX(tx, scatter.xMin, scatter.xMax)"
                :y="SCATTER_H - SCATTER_MARGIN.bottom + 18"
                text-anchor="middle"
                font-size="11"
                fill="#64748b"
              >{{ Math.round(tx / 1000) }}k</text>
              <text
                v-for="(ty, i) in scatterAxisTicks.ys"
                :key="'yt_' + i"
                :x="SCATTER_MARGIN.left - 8"
                :y="scatterY(ty, scatter.yMin, scatter.yMax) + 4"
                text-anchor="end"
                font-size="11"
                fill="#64748b"
              >{{ Math.round(ty) }}</text>
            </g>
            <!-- Axes labels -->
            <text
              :x="SCATTER_W / 2"
              :y="SCATTER_H - 8"
              text-anchor="middle"
              font-size="13"
              fill="var(--color-panel)"
              font-weight="600"
            >单价 元/㎡</text>
            <text
              :x="14"
              :y="SCATTER_H / 2"
              text-anchor="middle"
              font-size="13"
              fill="var(--color-panel)"
              font-weight="600"
              :transform="`rotate(-90, 14, ${SCATTER_H / 2})`"
            >总价 万</text>
            <!-- Points -->
            <circle
              v-for="p in scatter.points"
              :key="'pt_' + p.communityId"
              :cx="scatterX(p.medianUnitPrice, scatter.xMin, scatter.xMax)"
              :cy="scatterY(p.medianTotalPrice10w, scatter.yMin, scatter.yMax)"
              :r="Math.max(6, Math.min(14, p.count / 2))"
              :fill="scatterColor(p.quadrant)"
              fill-opacity="0.55"
              stroke="white"
              stroke-width="1.5"
              class="scatter-pt"
              :data-community-id="p.communityId"
              :data-name="p.communityName"
              @click="goCommunity(p.communityId)"
            ><title>{{ p.communityName }} · {{ p.quadrant }}</title></circle>
          </svg>
        </view>
        <view v-for="q in ['豪宅板块', '学区刚需', '改善低密', '价值洼地']" :key="'q_' + q" class="scatter-q-section">
          <view class="scatter-q-title">
            <view class="scatter-q-dot" :style="{ background: scatterColor(q) }"></view>
            <text>{{ q }} ({{ scatter.byQuadrant[q]?.length || 0 }})</text>
          </view>
          <view
            v-for="(p, i) in (scatter.byQuadrant[q] || []).slice(0, 3)"
            :key="'qrow_' + q + '_' + i"
            class="scatter-row tap-row"
            hover-class="tap-row--active"
            @click="goCommunity(p.communityId)"
          >
            <text class="scatter-rank">#{{ i + 1 }}</text>
            <text class="scatter-name">{{ p.communityName }}</text>
            <text class="scatter-meta">{{ p.areaCohort }} {{ Math.round(p.medianArea) }}㎡ ›</text>
            <text class="scatter-up">{{ Math.round(p.medianUnitPrice / 1000) }}k</text>
            <text class="scatter-tp">{{ Math.round(p.medianTotalPrice10w) }}万</text>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：listings.csv (community median) → scripts/compute_community_scatter.py。<br>
          X=单价 元/㎡, Y=总价 万元; 虚线=城市中位, 4 象限: 豪宅板块 / 学区刚需 / 改善低密 / 价值洼地
        </view>
        <view v-if="scatterPriceExtremes.top.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          总价最高
        </view>
        <view
          v-for="(p, i) in scatterPriceExtremes.top"
          :key="'sct-' + p.communityId"
          class="scatter-qrow tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(p.communityId)"
        >
          <text class="scatter-rank">#{{ i + 1 }}</text>
          <text class="scatter-name">{{ p.communityName }}</text>
          <text class="scatter-tp">{{ Math.round(p.medianTotalPrice10w) }}万</text>
          <text class="scatter-up">{{ Math.round(p.medianUnitPrice / 1000) }}k</text>
        </view>
        <view v-if="scatterPriceExtremes.bottom.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          总价最低（上车盘）
        </view>
        <view
          v-for="(p, i) in scatterPriceExtremes.bottom"
          :key="'scb-' + p.communityId"
          class="scatter-qrow tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(p.communityId)"
        >
          <text class="scatter-rank">#{{ i + 1 }}</text>
          <text class="scatter-name">{{ p.communityName }}</text>
          <text class="scatter-tp">{{ Math.round(p.medianTotalPrice10w) }}万</text>
          <text class="scatter-up">{{ Math.round(p.medianUnitPrice / 1000) }}k</text>
        </view>
        <view v-if="scatterImproveValue.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          改善户型 · 单价≤6万 · 面积优先
        </view>
        <view
          v-for="(p, i) in scatterImproveValue"
          :key="'spv-' + p.communityId"
          class="scatter-qrow tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(p.communityId)"
        >
          <text class="scatter-rank">#{{ i + 1 }}</text>
          <text class="scatter-name">{{ p.communityName }}</text>
          <text class="scatter-meta">{{ Math.round(p.medianArea) }}㎡ · {{ p.quadrant }}</text>
          <text class="scatter-up">{{ Math.round(p.medianUnitPrice / 1000) }}k</text>
        </view>
        <view v-if="scatterImproveCohort.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          本市「改善」面积段小区
        </view>
        <view
          v-for="(p, i) in scatterImproveCohort"
          :key="'sic-' + p.communityId"
          class="scatter-qrow tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(p.communityId)"
        >
          <text class="scatter-rank">#{{ i + 1 }}</text>
          <text class="scatter-name">{{ p.communityName }}</text>
          <text class="scatter-meta">{{ Math.round(p.medianArea) }}㎡ · {{ p.quadrant }}</text>
          <text class="scatter-up">{{ Math.round(p.medianUnitPrice / 1000) }}k</text>
        </view>
        <view v-if="scatterValueDip.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          本市「价值洼地」象限
        </view>
        <view
          v-for="(p, i) in scatterValueDip"
          :key="'svd-' + p.communityId"
          class="scatter-qrow tap-row"
          hover-class="tap-row--active"
          @click="goCommunity(p.communityId)"
        >
          <text class="scatter-rank">#{{ i + 1 }}</text>
          <text class="scatter-name">{{ p.communityName }}</text>
          <text class="scatter-tp">{{ Math.round(p.medianTotalPrice10w) }}万</text>
          <text class="scatter-up">{{ Math.round(p.medianUnitPrice / 1000) }}k</text>
        </view>
        <view data-cross-city v-if="scatterValueDipCrossCity.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
          跨城「价值洼地」最高单价代表盘
        </view>
        <view
          v-for="(p, i) in scatterValueDipCrossCity"
          :key="'svdx-' + p.cityId"
          class="scatter-qrow"
        >
          <text class="scatter-rank">#{{ i + 1 }}</text>
          <text class="scatter-name">{{ p.cityName }} · {{ p.communityName }}</text>
          <text class="scatter-tp">{{ Math.round(p.medianTotalPrice10w) }}万</text>
          <text class="scatter-up">{{ Math.round(p.medianUnitPrice / 1000) }}k</text>
        </view>
      </view>

      <!-- v0.46.0 map-11 行政区 + 社区 marker 地图 -->
      <view v-if="districtMap && districtMap.districts.length > 0" class="card" data-tab="all,map">
        <view class="row-between">
          <view class="card-title">🗺️ 行政区域图 · {{ districtMap.cityName }}</view>
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
        v-if="schoolDims && schoolDims.total > 0"
        id="overview-school"
        class="card overview-card"
        :class="{ 'overview-card--collapsed': isOverviewGroupCollapsed('school') }"
        data-tab="overview,school"
        @click="onOverviewCardClick('school')"
      >
        <view class="row-between">
          <view class="card-title">🏫 学区 5 维评分 · {{ schoolDims.cityName }}</view>
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
        v-if="lpr && lpr.total > 0"
        id="overview-lpr"
        class="card overview-card"
        :class="{ 'overview-card--collapsed': isOverviewGroupCollapsed('lpr') }"
        data-tab="overview,price"
        @click="onOverviewCardClick('lpr')"
      >
        <view class="row-between">
          <view class="card-title">💰 LPR + 房贷利率 · 全国</view>
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
      <view v-if="hospitalCitySummary" class="card" data-tab="all,school">
        <view class="row-between">
          <view class="card-title">🏥 医疗资源 · {{ hospitalCityName }}</view>
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
      <view v-if="commercialReady" class="card" data-tab="all,transit">
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
      <view v-if="marketNearTop.length" class="card" data-tab="all,transit">
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
      <view v-if="lifeConvenience && lifeConvenience.items.length > 0" class="card" data-tab="all,transit">
        <view class="row-between">
          <view class="card-title">🧭 生活便利度 Top 小区 · {{ lifeConvenience.cityName }}</view>
          <view class="muted">Top {{ lifeConvenience.items.length }}</view>
        </view>
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
      <view v-if="schoolPremiumOverview && schoolPremiumOverview.items.length > 0" class="card" data-tab="all,school">
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
      <view v-if="schoolPremiumCommunityItems.length > 0" class="card">
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
      <view v-if="listingPremiumOverview && listingPremiumOverview.items.length > 0" class="card" data-tab="all,price">
        <view class="row-between">
          <view class="card-title">🏫 高学区评分房源 · {{ listingPremiumOverview.cityName }}</view>
          <view class="muted">Top {{ listingPremiumOverview.items.length }} / 共 {{ listingPremiumOverview.total }}</view>
        </view>
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
      <view v-if="commercialResp && commercialResp.items.length > 0" class="card" data-tab="all,transit">
        <view class="row-between">
          <view class="card-title">🛒 商业热度 Top {{ commercialResp.items.length }} · {{ commercialResp.cityName }}</view>
          <view class="muted">共 {{ commercialResp.total }} 个小区上榜</view>
        </view>
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
      <view v-if="districtCompareResp && districtCompareResp.items.length > 0" class="card" data-tab="all,school">
        <view class="row-between">
          <view class="card-title">📊 {{ districtCompareResp.districtName }} · {{ districtCompareResp.cityName }} 小区对比</view>
          <view class="muted tap-target" @click="closeDistrictCompare">✕ 关闭</view>
        </view>
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
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import { useAppStore } from "../../store/app";
import { toErrorMessage } from "../../utils/errorMessage";
import { getCities, getCoverage, getPeriods, getRuntimeMeta, getSources } from "../../local/queries";
import { getCommunityRanking, getDistrictCompare, getCityDistrictOverview, getWangqianHeatmap, getSchoolPremiumRank, getSchoolPremiumCommunityRank, getWeather, getTopListingsBySchoolPremium, getCommercialRanking, getCommunityCompareByDistrict, getDistrictWangqianRank, getCommuteRanking, getLayoutDistribution, getListingTagCloud, getDistrictIndex, getDistrictChangeRank, getLifeConvenienceRank, getCommunityScoreRank, getMetroWalkRanking, getMetroBenefitRanking, getDistrictMetaRanking,
  getFeaturePremiumRanking,
  getTagCombinationRanking,
  getListingFreshnessRanking,
  getBedroomAreaDistribution,
  getOrientationFloorMatrix,
  getDecorateAgeMatrix,
  getCommunityScatter,
  getDistrictMap,
  getSchoolDimensions,
  getLprOverview,
  type SchoolDimResponse,
  type LprResponse,
  type DistrictTrendItem, type WangqianOverviewItem, type SchoolPremiumOverview, type SchoolPremiumCommunityItem, type WeatherResponse, type ListingSchoolPremiumOverview, type CommercialRankingResponse, type DistrictCommunityCompareResponse, type DistrictWangqianRankResponse, type CommuteRankingResponse, type LayoutDistributionResponse, type TagCloudResponse, type DistrictIndexResponse, type DistrictChangeResponse, type LifeConvenienceResponse, type CommunityScoreResponse, type MetroWalkResponse, type MetroBenefitResponse, type DistrictMetaResponse, type FeaturePremiumResponse, type TagCombinationResponse, type ListingFreshnessResponse, type BedroomAreaResponse, type OrientationFloorResponse, type DecorateAgeResponse, type CommunityScatterResponse, type DistrictMapResponse } from "../../local/queries";
import {
  getLatestIndexForCity,
  getLatestMonth,
  getCityDriftOverLastYear,
  summarizeCityDrift,
  type LatestIndexForCity,
  type City12MonthSummary,
  type DriftDistribution
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
  summarizeMetroWalkAccessibility,
  getMetroWalkRankingTopN,
  getMetroWalkRankingByCityTopN,
  type MetroWalkAccessibility,
  type MetroWalkRankingItem
} from "../../local/metro";
import {
  getDistrict12WeekChangeRank,
  getDistrictRecentMomentumRank,
  summarizeChangeDistribution,
  type DistrictChangeEntry,
  type DistrictMomentumEntry
} from "../../local/districtDrift";
import {
  getSchoolIndicatorDimensionTopN,
  getSchoolIndicatorTrendTop,
  summarizeSchoolIndicators,
  type SchoolIndicatorRankingEntry,
  type SchoolIndicatorSummary,
  type SchoolIndicatorTrendEntry
} from "../../local/schoolIndicatorRanking";
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
  summarizeMetroPlanningByCity,
  getMetroPlanningByCityTopByLength,
  getMetroPlanningByCityTopByStations,
  getMetroPlanningByCityFastLines,
  getMetroPlanningByCityStatusVsStations,
  getMetroPlanningCrossCityByYear,
  getMetroPlanningByDistrict,
  getMetroPlanningByOpenYear,
  getMetroPlanningByStatus,
  summarizeMetroPlanningByPhase,
  summarizeMetroPlanningByStatus,
  summarizeMetroPlanningByOpenYear,
  type CityMetroPlanningSummary,
  type OpenYearMetroPlanningSummary,
  type TopByMetric,
  type CityStatusStations,
  type PhaseMetroPlanningSummary,
  type StatusMetroPlanningSummary
} from "../../local/metroPlanningRanking";
import {
  getMetroPlanningGeoByCityCrossReference,
  getMetroPlanningGeoCoverageStats,
  getMetroPlanningGeoManualFallbackRate,
  getMetroPlanningGeoByCityMissingEndpoints,
  getMetroPlanningGeoByCityStraightLineTop,
  summarizeMetroPlanningGeoByCity,
  summarizeMetroPlanningGeoByConfidence,
  getMetroPlanningGeoCrossCityByConfidence,
  getMetroPlanningGeoByConfidence,
  getMetroPlanningGeoByCityStartEnd,
  type CurvatureEntry,
  type CoverageStats,
  type ManualFallbackRate,
  type StraightLineTop,
  type CityMetroPlanningGeoSummary,
  type ConfidenceLevelSummary
} from "../../local/metroPlanningGeoAnalysis";
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
  getFeaturePremiumCrossCityLeaderboard,
  getFeaturePremiumByDimensionCoverage,
  getFeaturePremiumTopByDimension,
  summarizeFeaturePremiumByCity,
  getFeaturePremiumByCityDimension,
  type CityPremiumSummary
} from "../../local/featurePremiumRanking";
import {
  getTagCombinationCrossCityMostCommon,
  getTagCombinationPremiumByCity,
  getTagCombinationPopularByCity,
  getTagCombinationCrossCityByTag,
  summarizeTagCombinationByCity,
  type TagPairAggregate,
  type TagCombinationByTag,
  type CityTagCombinationSummary
} from "../../local/tagCombinationRanking";
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
  summarizeSchoolDimensionsByCity,
  getSchoolDimensionByDimensionTopN,
  getSchoolDimensionPolymath,
  getCityByCompositeRank,
  type CityDimensionSummary,
  type SchoolDimensionEntry,
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
import { getEducationOverview, educationHasPrimaryJuniorSplit, formatEducationPeriodLabel, type EducationOverview } from "../../local/educationOverview";
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
import { coverageText, formatUnitPrice, showToast, daysAgoFromToday } from "../../utils/format";
import { SNAPSHOT_UPDATED_EVENT } from "../../config";
import {
  getLatestNbsRealEstate,
  getNbsImpliedContractUnitPrice,
  getNbsImpliedInventoryMonths,
  getNbsImpliedInventoryMonthsTrend,
  getNbsImpliedUnitPriceTrend,
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
import { assessGzInventoryFreshness } from "../../local/gzInventoryFreshness";
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
import {
  getLatestGdRealEstateBrief,
  getGdRealEstateBriefTrend,
  gdBriefImpliedUnitPrice,
  type GdRealEstateBriefRow
} from "../../local/gdRealEstateBrief";
import {
  getLatestGdFaInvestment,
  getGdFaInvestmentTrend,
  type GdFaInvestmentRow
} from "../../local/gdFaInvestment";
import {
  getLatestGdConstruction,
  getGdConstructionTrend,
  gdHousingSharePct,
  type GdConstructionRow
} from "../../local/gdConstruction";
import {
  getLatestGdEconomy,
  getGdEconomyTrend,
  type GdEconomyRow
} from "../../local/gdEconomy";

const app = useAppStore();

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

// v1.121.16 教育事业概览
const eduOverview = computed<EducationOverview | null>(() => {
  // 必须走 store（同步），不能依赖异步 getCities 的 cities.value，否则首屏会短暂无卡
  const name = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return getEducationOverview(name);
});
const eduHasPrimaryJuniorSplit = computed(() =>
  eduOverview.value ? educationHasPrimaryJuniorSplit(eduOverview.value) : false
);

// v1.121.16 行政区划
const adminSummary = computed<CityAdminDistrictSummary | null>(() => {
  return summarizeAdminDistrictByCity().find((x) => x.cityId === app.cityId) ?? null;
});
const adminTypeCounts = computed<CitySuffixTypeCount[]>(() =>
  summarizeAdminDistrictBySuffixType().filter((x) => x.cityId === app.cityId)
);
const adminDistrictList = computed<LocalAdminDistrict[]>(() =>
  getAdminDistrictByCityOrderedByCode(app.cityId)
);
const adminGaps = computed<AdminDistrictCodeGap>(() =>
  detectAdminDistrictCodeGaps(app.cityId)
);
function adminSuffixType(districtCode: string): AdminDistrictSuffixType {
  const sfx = parseInt(districtCode.slice(-2), 10);
  return classifyAdminDistrictSuffix(Number.isFinite(sfx) ? sfx : 0);
}
const adminMetroCross = computed<AdminMetroCrossRef | null>(() => {
  if (!adminSummary.value) return null;
  return getAdminDistrictByCityCrossReference(app.cityId);
});
const adminXinQuList = computed<LocalAdminDistrict[]>(() =>
  getAdminDistrictByNameLike("新区").filter((d) => d.cityId === app.cityId)
);
const adminHaiList = computed<LocalAdminDistrict[]>(() =>
  crossCityRows(getAdminDistrictCrossCityByNameLike("海").slice(0, 8))
);
const adminSuffixShared = computed<SuffixUsage[]>(() =>
  crossCityRows(
    summarizeAdminDistrictBySuffix().filter((s) => s.cities.length > 1).slice(0, 8)
  )
);

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

// v1.121.14 规划地铁线路概览
const metroPlanSummary = computed<CityMetroPlanningSummary | null>(() => {
  const all = summarizeMetroPlanningByCity();
  return all.find((x) => x.cityId === app.cityId) ?? null;
});
const metroPlanCityName = computed(() => cityNameForId(app.cityId));
const metroPlanBuildCount = computed(
  () => metroPlanSummary.value?.statusDistribution["在建"] ?? 0
);
const metroPlanSoonCount = computed(
  () => metroPlanSummary.value?.statusDistribution["即将开通"] ?? 0
);
const metroPlanYears = computed<OpenYearMetroPlanningSummary[]>(() => {
  const lines = store.getMetroLinesByCity(app.cityId);
  if (lines.length === 0) return [];
  const grouped = new Map<number, typeof lines>();
  for (const x of lines) {
    if (x.openYearExpected == null) continue;
    let arr = grouped.get(x.openYearExpected);
    if (!arr) {
      arr = [];
      grouped.set(x.openYearExpected, arr);
    }
    arr.push(x);
  }
  return [...grouped.entries()]
    .map(([year, arr]) => ({
      year,
      lineCount: arr.length,
      totalLengthKm: arr.reduce((s, x) => s + (x.lengthKm ?? 0), 0),
      totalStations: arr.reduce((s, x) => s + (x.stationCount ?? 0), 0)
    }))
    .sort((a, b) => a.year - b.year);
});
const metroPlanTop = computed<TopByMetric[]>(() =>
  getMetroPlanningByCityTopByLength(app.cityId, 5)
);
const metroPlanTopStations = computed<TopByMetric[]>(() =>
  getMetroPlanningByCityTopByStations(app.cityId, 5)
);
const metroCurvatureTop = computed<CurvatureEntry[]>(() =>
  getMetroPlanningGeoByCityCrossReference()
    .filter((x) => x.cityId === app.cityId && x.curvatureRatio != null)
    .slice(0, 5)
);
const metroPlanGeoCoverage = computed<CoverageStats>(() => getMetroPlanningGeoCoverageStats());
const metroStraightLineTop = computed<StraightLineTop[]>(() =>
  getMetroPlanningGeoByCityStraightLineTop(app.cityId, 5)
);
const metroManualFallback = computed<ManualFallbackRate | null>(() =>
  getMetroPlanningGeoManualFallbackRate().find((x) => x.cityId === app.cityId) ?? null
);
const metroGeoCitySummary = computed<CityMetroPlanningGeoSummary | null>(() =>
  summarizeMetroPlanningGeoByCity().find((x) => x.cityId === app.cityId) ?? null
);
const metroGeoConfNational = computed<ConfidenceLevelSummary[]>(() =>
  summarizeMetroPlanningGeoByConfidence()
);
const metroGeoHighCrossCity = computed<{ cityId: number; lineCount: number }[]>(() =>
  crossCityRows(getMetroPlanningGeoCrossCityByConfidence("high"))
);
const metroGeoManualLines = computed<LocalMetroLineGeo[]>(() =>
  getMetroPlanningGeoByConfidence("manual")
    .filter((x) => x.cityId === app.cityId)
    .slice(0, 5)
);
const metroMissingEndpoints = computed(() =>
  getMetroPlanningGeoByCityMissingEndpoints(app.cityId)
);
const metroFastLines = computed(() =>
  getMetroPlanningByCityFastLines(100).filter((x) => x.cityId === app.cityId).slice(0, 5)
);
const metroStatusStations = computed<CityStatusStations[]>(() =>
  getMetroPlanningByCityStatusVsStations().filter((x) => x.cityId === app.cityId)
);
const metroStatusNational = computed<StatusMetroPlanningSummary[]>(() =>
  summarizeMetroPlanningByStatus()
);
const metroStartEndLines = computed(() =>
  getMetroPlanningGeoByCityStartEnd(app.cityId).slice(0, 6)
);
const metroCrossYear2028 = computed(() => {
  const map = getMetroPlanningCrossCityByYear(2028);
  return crossCityRows(
    Object.entries(map)
      .map(([cityId, lines]) => ({
        cityId: Number(cityId),
        cityName: cityNameForId(Number(cityId)),
        lines
      }))
      .filter((x) => x.lines.length > 0)
      .sort((a, b) => b.lines.length - a.lines.length)
  );
});
const metroDistrictFocus = computed(() => {
  const fromSchool = schoolPremiumDistrictTop.value[0]?.districtName;
  if (fromSchool) return fromSchool;
  return adminDistrictList.value[0]?.districtName ?? "";
});
const metroDistrictLines = computed<LocalMetroLine[]>(() => {
  const name = metroDistrictFocus.value;
  if (!name) return [];
  return getMetroPlanningByDistrict(name, app.cityId).slice(0, 5);
});
const metroOpenYear2028 = computed<LocalMetroLine[]>(() =>
  getMetroPlanningByOpenYear(2028).slice(0, 6)
);
const metroPhaseSummary = computed<PhaseMetroPlanningSummary[]>(() =>
  summarizeMetroPlanningByPhase().slice(0, 6)
);
const metroOpenYearTimeline = computed<OpenYearMetroPlanningSummary[]>(() =>
  summarizeMetroPlanningByOpenYear().slice(-8)
);
const metroBuildingLines = computed<LocalMetroLine[]>(() =>
  getMetroPlanningByStatus("在建").filter((x) => x.cityId === app.cityId).slice(0, 5)
);

// v1.121.18 挂牌结构占比（layout_distribution）
const layoutBedroomShare = computed<LocalLayoutDistribution[]>(() =>
  store
    .getLayoutDistributions()
    .filter((x) => x.cityId === app.cityId && x.dimension === "bedrooms")
    .sort((a, b) => b.share - a.share)
    .slice(0, 5)
);
const layoutOrientShare = computed<LocalLayoutDistribution[]>(() =>
  store
    .getLayoutDistributions()
    .filter((x) => x.cityId === app.cityId && x.dimension === "orientation")
    .sort((a, b) => b.share - a.share)
    .slice(0, 5)
);
function layoutBucket(r: LocalLayoutDistribution): string {
  return r.bucket;
}
const layoutThreeBedCrossCity = computed(() =>
  crossCityRows(
    store
      .getLayoutDistributions()
      .filter((x) => x.dimension === "bedrooms" && x.bucket === "3室")
      .sort((a, b) => b.share - a.share)
  )
);
const layoutDecorateCrossCity = computed(() =>
  crossCityRows(
    store
      .getLayoutDistributions()
      .filter((x) => x.dimension === "decorate" && x.bucket === "精装")
      .sort((a, b) => b.share - a.share)
  )
);
const bedroomAreaCrossCityPrice = computed<CrossCityBucketEntry[]>(() =>
  crossCityRows(getDistributionCrossCityLeaderboard("3室", "80-110"))
);
const layoutTwoBedShareCross = computed<CrossCityShareEntry[]>(() =>
  crossCityRows(
    getDistributionShareLeaderboard("bedrooms").filter(
      (x) => x.dimensions[1] === "2室"
    )
  )
);
const layoutMedianPriceTop = computed<DistributionRow[]>(() =>
  getDistributionTopByMedianPrice(app.cityId, 5)
);
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

// v1.121.14 挂牌标签热度
const listingTagCitySummary = computed<CityTagSummary | null>(() => {
  return summarizeListingTagsByCity(8).find((x) => x.cityId === app.cityId) ?? null;
});
const listingTagTopShare = computed(
  () => listingTagCitySummary.value?.topTags[0]?.share ?? 0
);
const listingTagSignature = computed<TagSignatureEntry[]>(() =>
  getCityTagSignature(app.cityId, 1.5).slice(0, 5)
);
const listingTagPenetrationTop = computed(() => {
  const cityId = app.cityId;
  return getTagPenetrationCompare()
    .filter((t) => t.presentIn.length >= 2 && t.byCity[cityId] != null)
    .map((t) => ({
      tag: t.tag,
      avgShare: t.avgShare,
      cityShare: t.byCity[cityId]?.share ?? null
    }))
    .sort((a, b) => (b.cityShare ?? 0) - (a.cityShare ?? 0))
    .slice(0, 5);
});
const listingKeywordsCity = computed<ListingKeywordRow[]>(() =>
  getListingKeywordsByCity(app.cityId).slice(0, 6)
);
const listingKeywordTongtouCross = computed(() =>
  crossCityRows(getListingKeywordsCrossCity("南北通透"))
);

// v0.35.0 map-9: 地铁步行通勤
const metroWalk = ref<MetroWalkResponse | null>(null);
// v0.36.0 map-10: 地铁规划受益
const metroBenefit = ref<MetroBenefitResponse | null>(null);
// v0.39.0 trend-19: 特征画像溢价
const featurePremium = ref<FeaturePremiumResponse | null>(null);
// v0.40.0 trend-20: 标签组合热度
const tagCombination = ref<TagCombinationResponse | null>(null);
// v0.41.0 trend-21: 房源新鲜度
const listingFreshness = ref<ListingFreshnessResponse | null>(null);
// v0.42.0 trend-22: 户型 × 面积 联合分布
const bedroomArea = ref<BedroomAreaResponse | null>(null);
// v0.43.0 trend-23: 朝向 × 楼层 溢价分析
const orientationFloor = ref<OrientationFloorResponse | null>(null);
// v0.44.0 trend-24: 装修 × 楼龄 溢价分析
const decorateAge = ref<DecorateAgeResponse | null>(null);
// v0.45.0 trend-25: 总价 × 单价 双轴散点
const scatter = ref<CommunityScatterResponse | null>(null);
const featurePremiumCrossBedrooms = computed(() =>
  crossCityRows(getFeaturePremiumCrossCityLeaderboard("bedrooms").rows)
);
const featurePremiumAbsTop = computed<LocalFeaturePremium[]>(() =>
  getFeaturePremiumByDimensionCoverage(5)
);
const featurePremiumCityTops = computed<LocalFeaturePremium[]>(() => {
  const dims = ["bedrooms", "area_sqm", "orientation", "decorate"] as const;
  return dims
    .map((d) => getFeaturePremiumTopByDimension(app.cityId, d))
    .filter((x): x is LocalFeaturePremium => x != null);
});
const featurePremiumCitySummary = computed<CityPremiumSummary | null>(() =>
  summarizeFeaturePremiumByCity().find((x) => x.cityId === app.cityId) ?? null
);
const featurePremiumDecorateBuckets = computed<LocalFeaturePremium[]>(() =>
  getFeaturePremiumByCityDimension(app.cityId, "decorate").slice(0, 6)
);
const tagComboCrossCity = computed<TagPairAggregate[]>(() =>
  crossCityRows(getTagCombinationCrossCityMostCommon(5))
);
const tagComboPremiumLocal = computed<LocalTagCombination[]>(() =>
  getTagCombinationPremiumByCity(app.cityId, 5)
);
const tagComboPopularLocal = computed<LocalTagCombination[]>(() =>
  getTagCombinationPopularByCity(app.cityId, 5)
);
const tagComboMetroPartners = computed<TagCombinationByTag | null>(() =>
  getTagCombinationCrossCityByTag("地铁可达", 5)
);
const tagComboCitySummaries = computed<CityTagCombinationSummary[]>(() =>
  summarizeTagCombinationByCity()
);
const scatterPriceExtremes = computed(() =>
  getCommunityScatterByCityTotalPriceExtremes(app.cityId, 3)
);
const scatterCitySummary = computed<CityCommunityScatterSummary | null>(
  () => summarizeCommunityScatterByCity().find((x) => x.cityId === app.cityId) ?? null
);
const scatterQuadrantSummary = computed<QuadrantSummary[]>(() =>
  summarizeCommunityScatterByCityQuadrant()
    .filter((x) => x.cityId === app.cityId)
    .sort((a, b) => b.communityCount - a.communityCount)
);
const scatterAreaCohortSummary = computed<AreaCohortSummary[]>(() =>
  summarizeCommunityScatterByCityAreaCohort()
    .filter((x) => x.cityId === app.cityId)
    .sort((a, b) => b.communityCount - a.communityCount)
);
const scatterImproveValue = computed<ScatterParetoEntry[]>(() => {
  const ids = communityIdsInCity(app.cityId);
  return getCommunityScatterPareto("改善", 60000, 12)
    .filter((x) => ids.has(x.communityId))
    .slice(0, 5);
});
const scatterImproveCohort = computed<LocalCommunityScatter[]>(() =>
  [...getCommunityScatterByAreaCohort("改善", app.cityId)]
    .sort((a, b) => b.medianUnitPrice - a.medianUnitPrice)
    .slice(0, 5)
);
const scatterValueDip = computed<LocalCommunityScatter[]>(() =>
  [...getCommunityScatterByQuadrant("价值洼地", app.cityId)]
    .sort((a, b) => a.medianUnitPrice - b.medianUnitPrice)
    .slice(0, 5)
);
const scatterValueDipCrossCity = computed<CrossCityQuadrantEntry[]>(() =>
  crossCityRows(getCommunityScatterCrossCityByQuadrant("价值洼地"))
);
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
// v0.38.0 trend-18: 区情画像
const districtMeta = ref<DistrictMetaResponse | null>(null);
const districtMetaSortBy = ref<"default" | "price" | "school" | "mom" | "listing">("price");
const districtMetaHideEmpty = ref(false);
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

// v0.38.0 trend-18: 区情画像
async function reloadDistrictMeta() {
  try {
    districtMeta.value = await getDistrictMetaRanking({
      cityId: app.cityId,
      sortBy: districtMetaSortBy.value,
      hideEmpty: districtMetaHideEmpty.value
    });
  } catch (e) {
    console.warn("getDistrictMetaRanking failed:", e);
    districtMeta.value = null;
  }
}

async function setDmSort(s: "default" | "price" | "school" | "mom" | "listing") {
  districtMetaSortBy.value = s;
  await reloadDistrictMeta();
}

async function toggleDmHideEmpty() {
  districtMetaHideEmpty.value = !districtMetaHideEmpty.value;
  await reloadDistrictMeta();
}

function momClass(v: number | null): string {
  if (v == null) return "";
  if (v >= 5) return "dm-mom-up";
  if (v <= -5) return "dm-mom-down";
  return "dm-mom-flat";
}

// v0.39.0 trend-19: 特征画像溢价
async function reloadFeaturePremium() {
  try {
    featurePremium.value = await getFeaturePremiumRanking({
      cityId: app.cityId,
      minCount: 5,
      topN: 10
    });
  } catch (e) {
    console.warn("getFeaturePremiumRanking failed:", e);
    featurePremium.value = null;
  }
}

const FP_DIM_LABEL: Record<string, string> = {
  bedrooms: "户型",
  area_sqm: "面积",
  orientation: "朝向",
  decorate: "装修"
};

function fpDimLabel(d: string): string {
  return FP_DIM_LABEL[d] ?? d;
}

function fpPctClass(v: number): string {
  if (v >= 1) return "fp-pct-up";
  if (v <= -1) return "fp-pct-down";
  return "fp-pct-flat";
}

function fpBarClass(v: number): string {
  if (v >= 1) return "fp-bar-up";
  if (v <= -1) return "fp-bar-down";
  return "fp-bar-flat";
}

/** Bar width 50% = 0%, 最高 100% = ±30% (clamp) */
function fpBarWidth(v: number): number {
  const abs = Math.min(Math.abs(v), 30);
  return Math.max(5, (abs / 30) * 100);
}

// v0.40.0 trend-20: 标签组合热度
async function reloadTagCombination() {
  try {
    tagCombination.value = await getTagCombinationRanking({
      cityId: app.cityId,
      topN: 12,
      minCount: 5
    });
  } catch (e) {
    console.warn("getTagCombinationRanking failed:", e);
    tagCombination.value = null;
  }
}

function tcBarWidth(v: number, max: number): number {
  if (max <= 0) return 5;
  return Math.max(5, (v / max) * 100);
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

// v0.42.0 trend-22: 户型 × 面积 联合分布
async function reloadBedroomArea() {
  try {
    bedroomArea.value = await getBedroomAreaDistribution({
      cityId: app.cityId,
      minCount: 3
    });
  } catch (e) {
    console.warn("getBedroomAreaDistribution failed:", e);
    bedroomArea.value = null;
  }
}

const BA_BEDROOMS = [1, 2, 3, 4, 5];

/** 热图 cell 颜色深浅 = count 占比 */
function baCellOpacity(c: number, max: number): number {
  if (max <= 0 || c === 0) return 0;
  return Math.max(0.15, c / max);
}

function baCellLabel(c: number): string {
  if (c === 0) return "—";
  return c.toString();
}

const baMaxCount = computed(() => {
  if (!bedroomArea.value || bedroomArea.value.bedrooms.length === 0) return 0;
  let m = 0;
  for (const row of bedroomArea.value.grid) {
    for (const c of row) {
      if (c.count > m) m = c.count;
    }
  }
  return m;
});

// v0.43.0 trend-23: 朝向 × 楼层 溢价分析
async function reloadOrientationFloor() {
  try {
    orientationFloor.value = await getOrientationFloorMatrix({
      cityId: app.cityId,
      minCount: 5
    });
  } catch (e) {
    console.warn("getOrientationFloorMatrix failed:", e);
    orientationFloor.value = null;
  }
}

/** 朝向 × 楼层 矩阵 cell 显示: 上=套数, 下=溢价 % */
function ofCellLabel(cell: { count: number; premiumPct: number }): string {
  if (cell.count === 0) return "—";
  return cell.count.toString();
}

function ofCellPctLabel(cell: { count: number; premiumPct: number }): string {
  if (cell.count === 0) return "";
  const p = cell.premiumPct;
  const sign = p > 0 ? "+" : "";
  return `${sign}${p}%`;
}

/** cell 颜色: 越正 越绿, 越负 越红 */
function ofCellClass(cell: { count: number; premiumPct: number }): string {
  if (cell.count === 0) return "of-cell-off";
  const p = cell.premiumPct;
  if (p >= 10) return "of-cell-up-strong";
  if (p >= 3) return "of-cell-up";
  if (p <= -10) return "of-cell-down-strong";
  if (p <= -3) return "of-cell-down";
  return "of-cell-flat";
}

function ofPremiumLabel(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}%`;
}

// v0.44.0 trend-24: 装修 × 楼龄
async function reloadDecorateAge() {
  try {
    decorateAge.value = await getDecorateAgeMatrix({
      cityId: app.cityId,
      minCount: 5
    });
  } catch (e) {
    console.warn("getDecorateAgeMatrix failed:", e);
    decorateAge.value = null;
  }
}

function daCellClass(cell: { count: number; premiumPct: number }): string {
  if (cell.count === 0) return "da-cell-off";
  const p = cell.premiumPct;
  if (p >= 10) return "da-cell-up-strong";
  if (p >= 3) return "da-cell-up";
  if (p <= -10) return "da-cell-down-strong";
  if (p <= -3) return "da-cell-down";
  return "da-cell-flat";
}

function daCellLabel(cell: { count: number; premiumPct: number }): string {
  if (cell.count === 0) return "—";
  return cell.count.toString();
}

function daCellPctLabel(cell: { count: number; premiumPct: number }): string {
  if (cell.count === 0) return "";
  const p = cell.premiumPct;
  const sign = p > 0 ? "+" : "";
  return `${sign}${p}%`;
}

// v0.45.0 trend-25: 总价 × 单价 散点
const SCATTER_W = 660; // SVG width
const SCATTER_H = 360; // SVG height
const SCATTER_MARGIN = { top: 20, right: 16, bottom: 50, left: 70 };

async function reloadScatter() {
  try {
    scatter.value = await getCommunityScatter({ cityId: app.cityId });
  } catch (e) {
    console.warn("getCommunityScatter failed:", e);
    scatter.value = null;
  }
}

/** 散点坐标 (基于 SVG viewBox 0..SCATTER_W, 0..SCATTER_H) */
function scatterX(up: number, xMin: number, xMax: number): number {
  const range = Math.max(xMax - xMin, 1);
  const innerW = SCATTER_W - SCATTER_MARGIN.left - SCATTER_MARGIN.right;
  return SCATTER_MARGIN.left + ((up - xMin) / range) * innerW;
}
function scatterY(tp: number, yMin: number, yMax: number): number {
  const range = Math.max(yMax - yMin, 1);
  const innerH = SCATTER_H - SCATTER_MARGIN.top - SCATTER_MARGIN.bottom;
  return SCATTER_MARGIN.top + innerH - ((tp - yMin) / range) * innerH;
}

function scatterColor(q: string): string {
  switch (q) {
    case "豪宅板块": return "#dc2626";
    case "学区刚需": return "#059669";
    case "改善低密": return "#2563eb";
    case "价值洼地": return "#9333ea";
    default: return "#64748b";
  }
}

const scatterAxisTicks = computed(() => {
  if (!scatter.value) return null;
  const xMin = scatter.value.xMin;
  const xMax = scatter.value.xMax;
  const yMin = scatter.value.yMin;
  const yMax = scatter.value.yMax;
  // 4 ticks each
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= 3; i++) {
    xs.push(xMin + (xMax - xMin) * (i / 3));
    ys.push(yMin + (yMax - yMin) * (i / 3));
  }
  return { xs, ys };
});

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
const gdBriefSeriesExpanded = ref(false);
const gdFaSeriesExpanded = ref(false);
const gdConstructionSeriesExpanded = ref(false);
const gdEconomySeriesExpanded = ref(false);
const gdProvidentExpanded = ref(false);

const nbsMacro = computed(() => getLatestNbsRealEstate());
const nbsYoyTrend = computed(() => getNbsYoyTrend(6));
const nbsImpliedUnitPrice = computed(() => getNbsImpliedContractUnitPrice(nbsMacro.value));
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
const gdRealEstateBrief = computed<GdRealEstateBriefRow | null>(() => getLatestGdRealEstateBrief());
const gdBriefUnitPrice = computed(() => gdBriefImpliedUnitPrice(gdRealEstateBrief.value));
const gdBriefTrend = computed(() => getGdRealEstateBriefTrend(8));
const gdFaInvestment = computed<GdFaInvestmentRow | null>(() => getLatestGdFaInvestment());
const gdFaTrend = computed(() => getGdFaInvestmentTrend(6));
const gdConstruction = computed<GdConstructionRow | null>(() => getLatestGdConstruction());
const gdConstructionTrend = computed(() => getGdConstructionTrend(6));
const gdConstructionHousingShare = computed(() => gdHousingSharePct(gdConstruction.value));
const gdEconomy = computed<GdEconomyRow | null>(() => getLatestGdEconomy());
const gdEconomyTrend = computed(() => getGdEconomyTrend(6));
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

function formatMacro100m(v: number) {
  return `${v.toLocaleString()} 亿元`;
}
function formatMacroYuan(v: number) {
  return `${Math.round(v).toLocaleString()} 元`;
}
function formatMacroArea(v: number) {
  return `${v.toLocaleString()} 万㎡`;
}
function formatMacroPct(v: number) {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function macroTrendClass(v: number) {
  // 与 trend-* / stats70-* 统一：涨红跌绿
  if (v > 0) return "stats70-up";
  if (v < 0) return "stats70-down";
  return "stats70-flat";
}
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

// v0.48.0 dashboard-tabs: 顶部 tab 切换
type DashTabKey = "overview" | "price" | "school" | "transit" | "map";
const activeTab = ref<DashTabKey>("overview");

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

function isOverviewGroupCollapsed(key: OverviewGroupKey): boolean {
  if (activeTab.value !== "overview") return false;
  return !overviewOpenGroups.value.has(key);
}

function expandOverviewGroup(key: OverviewGroupKey) {
  overviewOpenGroups.value = new Set([...overviewOpenGroups.value, key]);
}

function jumpOverviewGroup(key: OverviewGroupKey) {
  expandOverviewGroup(key);
  if (typeof document !== "undefined") {
    document.getElementById(`overview-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function toggleOverviewAll() {
  if (overviewAllExpanded.value) {
    overviewOpenGroups.value = new Set();
  } else {
    overviewOpenGroups.value = new Set(OVERVIEW_GROUP_KEYS);
  }
}

function onOverviewCardClick(key: OverviewGroupKey) {
  if (isOverviewGroupCollapsed(key)) expandOverviewGroup(key);
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
  if (s?.tab) activeTab.value = s.tab;
}
// v0.55.0 hero-1: 快捷入口图标网格
type QuickShortcut = {
  key: string;
  icon: string;
  label: string;
  tone: "blue" | "green" | "red" | "amber" | "violet" | "rose";
  action: "tab" | "page" | "city";
  target?: DashTabKey | string;
};
const QUICK_SHORTCUTS: QuickShortcut[] = [
  { key: "price", icon: "💰", label: "价格画像", tone: "red", action: "tab", target: "price" },
  { key: "school", icon: "🏫", label: "学区配套", tone: "amber", action: "tab", target: "school" },
  { key: "transit", icon: "🚇", label: "通勤地铁", tone: "green", action: "tab", target: "transit" },
  { key: "map", icon: "🗺️", label: "地图视图", tone: "blue", action: "tab", target: "map" },
  { key: "city", icon: "🌆", label: "切换城市", tone: "violet", action: "city" },
  { key: "period", icon: "📅", label: "切换周次", tone: "rose", action: "page", target: "period" },
  { key: "settings", icon: "⚙️", label: "数据设置", tone: "blue", action: "page", target: "settings" },
  { key: "overview", icon: "📊", label: "返回概览", tone: "green", action: "tab", target: "overview" }
];
function quickClick(q: QuickShortcut) {
  if (q.action === "tab" && q.target) {
    activeTab.value = q.target as DashTabKey;
  } else if (q.action === "page" && q.target === "settings") {
    // 设置页属于 tabBar，navigateTo 在真机和 H5 都可能被框架拒绝。
    uni.switchTab({ url: "/pages/settings/settings" });
  } else if (q.action === "page" && q.target === "period") {
    // 滚动到顶部 (周期 sticky 已经固定, 滚动到位即可)
    uni.pageScrollTo({ scrollTop: 0, duration: 200 });
  } else if (q.action === "city") {
    pickCity();
  }
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
const cityLabels = computed(() => cities.value.map((c) => c.city_name));
const cityIndex = computed(() => cities.value.findIndex((c) => c.city_id === app.cityId));
const currentCityLabel = computed(() => {
  const c = cities.value.find((c) => c.city_id === app.cityId);
  return c?.city_name || store.getCityById(app.cityId)?.cityName || "";
});

const periodIndex = computed(() => {
  const idx = periods.value.findIndex((p) => p === app.weekEnd);
  return idx >= 0 ? idx : 0;
});

const sourceLabels = computed(() => ["全部", ...sourceOptions.value.map((s) => s.source || "(空来源)")]);
const sourceIndex = computed(() => {
  if (!app.source) return 0;
  const idx = sourceOptions.value.findIndex((s) => s.source === app.source);
  return idx >= 0 ? idx + 1 : 0;
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
      // v0.38.0 trend-18 区情画像
      await reloadDistrictMeta();
      // v0.39.0 trend-19 特征画像溢价
      await reloadFeaturePremium();
      // v0.40.0 trend-20 标签组合热度
      await reloadTagCombination();
      // v0.41.0 trend-21 房源新鲜度
      await reloadListingFreshness();
      // v0.42.0 trend-22 户型 × 面积
      await reloadBedroomArea();
      // v0.43.0 trend-23 朝向 × 楼层
      await reloadOrientationFloor();
      // v0.44.0 trend-24 装修 × 楼龄
      await reloadDecorateAge();
      // v0.45.0 trend-25 总价 × 单价 散点
      await reloadScatter();
      // v0.46.0 map-11 行政区 + 社区 marker
      await reloadDistrictMap();
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
  const city = name === "深圳" || name === "广州" ? name : "深圳";
  uni.navigateTo({ url: `/pages/wangqian/wangqian?city=${encodeURIComponent(city)}` });
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

// v0.91.0：70 城近 12 月同比趋势扩张 / 收缩派生
const cityDriftSummaries = computed<City12MonthSummary[]>(() => {
  if (!stats70Ready.value) return [];
  return getCityDriftOverLastYear("同比", "second");
});
const driftDistribution = computed<DriftDistribution | null>(() => {
  if (!stats70Ready.value) return null;
  return summarizeCityDrift(cityDriftSummaries.value);
});
const driftReady = computed(
  () => stats70Ready.value && cityDriftSummaries.value.length > 0
);
const driftTop = computed<City12MonthSummary[]>(
  () => driftDistribution.value?.expanding.slice(0, 3) ?? []
);
const driftBottom = computed<City12MonthSummary[]>(
  () => driftDistribution.value?.contracting.slice(0, 3) ?? []
);
const driftLatestLabel = computed(() => {
  const series = cityDriftSummaries.value;
  if (series.length === 0) return "";
  const ld = series[0].latestDate ?? "";
  if (!ld) return "";
  const parts = ld.split("/");
  if (parts.length < 3) return ld;
  return `${parts[0]}-${parts[1].padStart(2, "0")}`;
});
function fmtPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const pct = value * 100;
  return `${pct >= 0 ? "" : ""}${pct.toFixed(1)}%`;
}

// 把内部小数显示成百分比（与上面 fmtPct 同语义，但 alias 给模板用更清晰）
function formatPct(value: number | null): string {
  return fmtPct(value);
}

/** 用 cityId → 城市名（"深圳" / "广州" 等）。优先异步 cities，回退同步 store，避免首屏 city#id。 */
function cityNameForId(cityId: number): string {
  const c = cities.value.find((x) => x.city_id === cityId);
  if (c?.city_name) return c.city_name;
  return store.getCityById(cityId)?.cityName ?? `city#${cityId}`;
}

function metroLineName(lineId: number): string {
  return store.getMetroLines().find((l) => l.lineId === lineId)?.lineName ?? `线#${lineId}`;
}

// v0.92.0：地铁步行可达性
const metroWalkSummary = computed<MetroWalkAccessibility[]>(() =>
  summarizeMetroWalkAccessibility()
);
const metroWalkTop = computed<MetroWalkRankingItem[]>(() =>
  getMetroWalkRankingTopN(3)
);
const metroWalkCityTop = computed<MetroWalkRankingItem[]>(() =>
  getMetroWalkRankingByCityTopN(app.cityId, 5)
);

// v0.93.0：分区近 12 周均价变动
// 严格 12 周口径：≥13 周才算"近 12 周变动"（与卡片标题贴合）
const district12wChange = computed<DistrictChangeEntry[]>(() =>
  getDistrict12WeekChangeRank(undefined, { minWeeks: 13, strictBase: true })
);
const districtChangeDistribution = computed(() =>
  summarizeChangeDistribution()
);

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

// v1.121.17 重点学校维度（当前城市）
const dimCitySummaryLocal = computed<CityDimensionSummary | null>(() => {
  return summarizeSchoolDimensionsByCity().find((x) => x.cityId === app.cityId) ?? null;
});
const dimCityReady = computed(() => (dimCitySummaryLocal.value?.schoolCount ?? 0) > 0);
const dimTopLevelCity = computed<SchoolDimensionEntry[]>(() =>
  getSchoolDimensionByDimensionTopN("levelScore", app.cityId, 1)
);
const dimTopGroupCity = computed<SchoolDimensionEntry[]>(() =>
  getSchoolDimensionByDimensionTopN("groupStrength", app.cityId, 1)
);
const dimTopBalanceCity = computed<SchoolDimensionEntry[]>(() =>
  getSchoolDimensionByDimensionTopN("districtBalance", app.cityId, 1)
);
const dimPolymathCity = computed<SchoolDimensionEntry[]>(() =>
  getSchoolDimensionPolymath(app.cityId, {}).slice(0, 5)
);
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
const districtMomentumRank = computed<DistrictMomentumEntry[]>(() =>
  getDistrictRecentMomentumRank()
);
const districtDriftTotalWeeks = computed<number>(() => {
  const arr = store.getDistrictTrends();
  if (arr.length === 0) return 0;
  const latest = arr.reduce(
    (acc: string, t) => (t.weekEnd > acc ? t.weekEnd : acc),
    arr[0]!.weekEnd
  );
  const earliest = arr.reduce(
    (acc: string, t) => (t.weekEnd < acc ? t.weekEnd : acc),
    arr[0]!.weekEnd
  );
  // 估算周数差（粗略按 7 天，但只用来显示，不影响排序）
  const diff = (Date.parse(latest) - Date.parse(earliest)) / 86400000;
  return Math.max(0, Math.round(diff / 7) + 1);
});
const districtDriftTotalDistricts = computed<number>(() => {
  const set = new Set<string>();
  for (const t of store.getDistrictTrends()) {
    set.add(`${t.cityId}|${t.districtName}`);
  }
  return set.size;
});
const districtDriftWithEnough = computed<number>(
  () => district12wChange.value.filter((r) => r.weeksAvailable >= 13).length
);

// v0.94.0：学校指标各维度 Top + 涨跌
const schoolIndicatorSummary = computed<SchoolIndicatorSummary>(() =>
  summarizeSchoolIndicators()
);
const schoolTopLevel = computed<SchoolIndicatorRankingEntry[]>(() =>
  getSchoolIndicatorDimensionTopN("latestLevelScoreRaw", 5)
);
const schoolTopGroup = computed<SchoolIndicatorRankingEntry[]>(() =>
  getSchoolIndicatorDimensionTopN("groupSchoolStrengthRaw", 5)
);
const schoolTopBalance = computed<SchoolIndicatorRankingEntry[]>(() =>
  getSchoolIndicatorDimensionTopN("districtBalanceLevelRaw", 5)
);
const schoolTrendRising = computed<SchoolIndicatorTrendEntry[]>(() =>
  getSchoolIndicatorTrendTop("rising", 5)
);
const schoolTrendDeclining = computed<SchoolIndicatorTrendEntry[]>(() =>
  getSchoolIndicatorTrendTop("declining", 5)
);

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

.overview-jump-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.overview-jump,
.overview-toggle-all {
  margin: 0;
  border: 1rpx solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.overview-toggle-all {
  align-self: flex-start;
}

.overview-card--collapsed {
  position: relative;
  overflow: hidden;
  max-height: 220rpx;
}

.overview-card--collapsed::after {
  content: "展开完整数据";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 28rpx 0 12rpx;
  text-align: center;
  font-size: 21rpx;
  color: var(--color-primary);
  background: linear-gradient(180deg, transparent, var(--color-surface) 55%);
  pointer-events: none;
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
  background: linear-gradient(135deg, var(--color-surface) 0%, #0c1426 100%);
  border: 1rpx solid var(--color-soft-strong);
}

.stats70-foot {
  margin-top: 16rpx;
  text-align: right;
  font-size: 22rpx;
  color: #4ade80;
}

/* v0.91.0 70 城 12 月同比趋势派生卡 */
.drift-up {
  color: #ef4444;
}
.drift-down {
  color: #4ade80;
}
.drift-unknown {
  color: var(--color-muted);
}
.drift-row {
  display: flex;
  align-items: center;
  padding: 6rpx 0;
  font-size: 26rpx;
  border-bottom: 1rpx dashed var(--color-soft-strong);
}
.drift-row:last-child {
  border-bottom: 0;
}
.drift-rank {
  width: 40rpx;
  color: var(--color-muted);
  font-weight: 700;
}
.drift-city {
  flex: 1 1 auto;
  color: var(--color-text);
}
.drift-value {
  font-weight: 700;
  min-width: 100rpx;
  text-align: right;
}

.stats70-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 16rpx;
  gap: 8rpx;
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
  background: linear-gradient(135deg, var(--color-surface) 0%, #0c1a2e 100%);
  border: 1rpx solid #1e3a5f;
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

/* v1.121.12 医疗资源 */
.hosp-summary {
  display: flex;
  gap: 12rpx;
  margin: 8rpx 0 4rpx;
}
.hosp-kpi {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 8rpx;
  border-radius: 12rpx;
  background: var(--color-soft);
  border: 1rpx solid var(--color-border);
}
.hosp-kpi-val {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--color-heading);
  font-variant-numeric: tabular-nums;
}
.hosp-kpi-label {
  font-size: 20rpx;
  margin-top: 2rpx;
}
.hosp-dist-row,
.hosp-top-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 8rpx 0;
  border-bottom: 1rpx solid var(--color-border);
}
.hosp-dist-row:last-child,
.hosp-top-row:last-child {
  border-bottom: none;
}
.hosp-dist-rank,
.hosp-top-rank {
  width: 36rpx;
  font-size: 22rpx;
  text-align: center;
}
.hosp-dist-name {
  flex: 1;
  font-size: 26rpx;
  color: var(--color-text);
}
.hosp-dist-count {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--color-heading);
  font-variant-numeric: tabular-nums;
}
.hosp-dist-sj {
  font-size: 20rpx;
  min-width: 90rpx;
  text-align: right;
}
.hosp-top-mid {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.hosp-top-name {
  font-size: 26rpx;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hosp-top-meta {
  font-size: 20rpx;
}
.hosp-top-level {
  font-size: 22rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: var(--color-soft);
  color: var(--color-chip-text);
}
.hosp-lv--三甲 {
  background: var(--color-danger-soft);
  color: var(--color-on-danger-soft);
}
.hosp-lv--三级 {
  background: var(--color-warn-soft);
  color: var(--color-on-warn-soft);
}
.hosp-lv--二甲,
.hosp-lv--二级 {
  background: var(--color-info-soft);
  color: var(--color-accent);
}

/* v1.121.14 规划地铁 */
.mp-summary {
  display: flex;
  gap: 10rpx;
  margin: 8rpx 0 4rpx;
}
.mp-kpi {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 6rpx;
  border-radius: 12rpx;
  background: var(--color-soft);
  border: 1rpx solid var(--color-border);
}
.mp-kpi-val {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--color-heading);
  font-variant-numeric: tabular-nums;
}
.mp-kpi-label {
  font-size: 20rpx;
  margin-top: 2rpx;
}
.mp-year-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}
.mp-year-chip {
  display: flex;
  flex-direction: column;
  padding: 8rpx 12rpx;
  border-radius: 10rpx;
  background: var(--color-panel);
  border: 1rpx solid var(--color-border);
  min-width: 140rpx;
}
.mp-year-y {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--color-heading);
}
.mp-year-n {
  font-size: 20rpx;
}
.mp-line-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 8rpx 0;
  border-bottom: 1rpx solid var(--color-border);
}
.mp-line-row:last-child {
  border-bottom: none;
}
.mp-line-rank {
  width: 36rpx;
  font-size: 22rpx;
  text-align: center;
}
.mp-line-mid {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.mp-line-name {
  font-size: 26rpx;
  color: var(--color-text);
}
.mp-line-meta {
  font-size: 20rpx;
}
.mp-line-km {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--color-heading);
  font-variant-numeric: tabular-nums;
}

/* v1.121.14 挂牌标签热度 */
.ltk-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 0;
  border-bottom: 1rpx solid var(--color-border);
}
.ltk-row:last-child {
  border-bottom: none;
}
.ltk-rank {
  width: 32rpx;
  font-size: 22rpx;
  text-align: center;
}
.ltk-tag {
  width: 140rpx;
  font-size: 24rpx;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ltk-bar-wrap {
  flex: 1;
  height: 12rpx;
  border-radius: 999rpx;
  background: var(--color-soft);
  overflow: hidden;
}
.ltk-bar {
  height: 100%;
  border-radius: 999rpx;
  background: var(--color-primary, #3b82f6);
}
.ltk-share {
  width: 72rpx;
  text-align: right;
  font-size: 22rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-heading);
}
.ltk-count {
  width: 56rpx;
  text-align: right;
  font-size: 20rpx;
}
.ltk-sig-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 6rpx 0;
}
.ltk-sig-tag {
  flex: 1;
  font-size: 24rpx;
  color: var(--color-text);
}
.ltk-sig-share {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--color-heading);
  font-variant-numeric: tabular-nums;
}
.ltk-sig-vs {
  font-size: 20rpx;
  min-width: 140rpx;
  text-align: right;
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

/* v1.121.16 教育 / 区划 / 学区溢价分布 */
.edu-summary,
.lsp-summary {
  display: flex;
  gap: 10rpx;
  margin: 8rpx 0 4rpx;
}
.edu-kpi,
.lsp-kpi {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12rpx 6rpx;
  border-radius: 12rpx;
  background: var(--color-soft);
  border: 1rpx solid var(--color-border);
}
.edu-kpi-val,
.lsp-kpi-val {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--color-heading);
  font-variant-numeric: tabular-nums;
}
.edu-kpi-label,
.lsp-kpi-label {
  font-size: 20rpx;
  margin-top: 2rpx;
}
.edu-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 8rpx;
}
.edu-chip {
  font-size: 22rpx;
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: var(--color-panel);
  border: 1rpx solid var(--color-border);
  color: var(--color-text);
}
.admin-type-row {
  display: flex;
  gap: 10rpx;
  margin: 8rpx 0 4rpx;
}
.admin-type-chip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10rpx 6rpx;
  border-radius: 12rpx;
  background: var(--color-soft);
  border: 1rpx solid var(--color-border);
}
.admin-type-n {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--color-heading);
}
.admin-type-l {
  font-size: 20rpx;
}
.admin-dist-row,
.lsp-dist-item {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 8rpx 0;
  border-bottom: 1rpx solid var(--color-border);
}
.admin-dist-row:last-child,
.lsp-dist-item:last-child {
  border-bottom: none;
}
.admin-code {
  width: 110rpx;
  font-size: 20rpx;
  font-variant-numeric: tabular-nums;
}
.admin-name,
.lsp-dname {
  flex: 1;
  font-size: 26rpx;
  color: var(--color-text);
}
.admin-type {
  font-size: 20rpx;
  min-width: 100rpx;
  text-align: right;
}
.lsp-dist-row {
  display: flex;
  gap: 8rpx;
}
.lsp-bucket {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8rpx 4rpx;
  border-radius: 10rpx;
  background: var(--color-panel);
  border: 1rpx solid var(--color-border);
}
.lsp-bucket-n {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--color-heading);
  font-variant-numeric: tabular-nums;
}
.lsp-bucket-l,
.lsp-bucket-s {
  font-size: 18rpx;
}
.lsp-rank {
  width: 36rpx;
  font-size: 22rpx;
  text-align: center;
}
.lsp-meta {
  font-size: 20rpx;
  min-width: 160rpx;
}
.lsp-pct {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--color-heading);
  font-variant-numeric: tabular-nums;
}

/* v1.121.17 70 城 12 月序列 / 重点学校 / 分区商业 */
.s70-12m {
  max-height: 360rpx;
  overflow: hidden;
}
.s70-12m-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 4rpx 0;
  border-bottom: 1rpx solid var(--color-border);
}
.s70-12m-row:last-child {
  border-bottom: none;
}
.s70-12m-date {
  width: 120rpx;
  font-size: 20rpx;
  font-variant-numeric: tabular-nums;
}
.s70-12m-val {
  flex: 1;
  font-size: 22rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.s70-spread {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}
.s70-spread-cell {
  flex: 1;
  min-width: 140rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8rpx;
  border-radius: 10rpx;
  background: var(--color-soft);
  border: 1rpx solid var(--color-border);
}
.s70-spread-l {
  font-size: 18rpx;
}
.s70-spread-v {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--color-heading);
  font-variant-numeric: tabular-nums;
}
.dim-name {
  font-size: 22rpx !important;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.dim-row,
.cd-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 8rpx 0;
  border-bottom: 1rpx solid var(--color-border);
}
.dim-row:last-child,
.cd-row:last-child {
  border-bottom: none;
}
.dim-rank,
.cd-rank {
  width: 36rpx;
  font-size: 22rpx;
  text-align: center;
}
.dim-mid {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.dim-school,
.cd-name {
  font-size: 26rpx;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dim-meta,
.cd-meta {
  font-size: 20rpx;
}
.dim-score,
.cd-score {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--color-heading);
  font-variant-numeric: tabular-nums;
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

/* v0.35.0 map-9 地铁步行通勤 */
.mw-summary {
  font-size: 24rpx;
  margin: 8rpx 0 16rpx;
}
.mw-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 10rpx 0;
  border-bottom: 1rpx solid var(--color-soft-strong);
}
.mw-row:last-child {
  border-bottom: none;
}
.mw-rank {
  flex: 0 0 100rpx;
  text-align: center;
}
.mw-min {
  display: inline-block;
  padding: 6rpx 12rpx;
  border-radius: 12rpx;
  font-weight: 700;
  font-size: 28rpx;
  font-variant-numeric: tabular-nums;
  min-width: 80rpx;
}
.mw-min-green {
  background: rgba(34, 197, 94, 0.18);
  color: #22c55e;
}
.mw-min-orange {
  background: rgba(251, 191, 36, 0.18);
  color: #fbbf24;
}
.mw-min-red {
  background: rgba(248, 113, 113, 0.18);
  color: #f87171;
}
.mw-mid {
  flex: 1;
  min-width: 0;
}
.mw-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mw-dist {
  font-size: 22rpx;
  margin-top: 2rpx;
}
.mw-right {
  flex: 0 0 auto;
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.mw-src {
  font-size: 18rpx;
  margin-top: 4rpx;
}

/* v0.36.0 map-10 地铁规划受益 */
.mb-summary {
  font-size: 24rpx;
  margin: 8rpx 0 16rpx;
}
.mb-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 10rpx 0;
  border-bottom: 1rpx solid var(--color-soft-strong);
}
.mb-row:last-child {
  border-bottom: none;
}
.mb-rank {
  flex: 0 0 100rpx;
  text-align: center;
}
.mb-tag {
  display: inline-block;
  padding: 6rpx 12rpx;
  border-radius: 12rpx;
  font-weight: 700;
  font-size: 28rpx;
  font-variant-numeric: tabular-nums;
  min-width: 80rpx;
}
.mb-tag-green {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}
.mb-tag-orange {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}
.mb-tag-red {
  background: rgba(248, 113, 113, 0.2);
  color: #f87171;
}
.mb-mid {
  flex: 1;
  min-width: 0;
}
.mb-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mb-dist {
  font-size: 22rpx;
  margin-top: 2rpx;
}
.mb-right {
  flex: 0 0 auto;
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4rpx;
}
.mb-status {
  display: inline-block;
  padding: 4rpx 10rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  font-weight: 600;
}
.mb-st-open {
  background: rgba(34, 197, 94, 0.25);
  color: #22c55e;
}
.mb-st-build {
  background: rgba(251, 191, 36, 0.25);
  color: #fbbf24;
}
.mb-st-plan {
  background: rgba(148, 163, 184, 0.25);
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

/* v0.38.0 trend-18: 区情画像 */
.dm-chips {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  margin: 12rpx 0 18rpx;
}
.dm-chip {
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  background: var(--color-soft-strong);
  color: #374151;
  font-size: 24rpx;
  transition: all 0.15s;
}
.dm-chip-on {
  background: #0ea5e9;
  color: #fff;
}
.dm-row {
  display: flex;
  gap: 16rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #f1f5f9;
  align-items: center;
}
.dm-row:last-child {
  border-bottom: none;
}
.dm-left {
  flex: 0 0 180rpx;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.dm-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--color-heading);
}
.dm-mid {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  font-size: 24rpx;
}
.dm-line {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.dm-k {
  width: 80rpx;
  color: var(--color-muted);
  font-size: 22rpx;
}
.dm-v {
  font-weight: 600;
  color: var(--color-heading);
  min-width: 70rpx;
}
.dm-sub {
  font-size: 22rpx;
  color: var(--color-muted);
}
.dm-mom {
  font-size: 22rpx;
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
  margin-left: 4rpx;
}
.dm-mom-up {
  color: #dc2626;
  background: var(--color-danger-soft);
}
.dm-mom-down {
  color: #16a34a;
  background: var(--color-success-soft);
}
.dm-mom-flat {
  color: var(--color-muted);
  background: var(--color-soft);
}

/* v0.39.0 trend-19: 特征画像溢价 */
.fp-dim-row {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 12rpx;
}
.fp-dim-block {
  background: var(--color-panel);
  border-radius: 12rpx;
  padding: 14rpx 16rpx;
}
.fp-dim-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
  font-size: 26rpx;
}
.fp-dim-name {
  font-weight: 600;
  color: var(--color-heading);
}
.fp-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 4rpx 0;
  font-size: 24rpx;
}
.fp-bucket {
  width: 130rpx;
  color: #475569;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fp-bar-wrap {
  flex: 1;
  height: 14rpx;
  background: var(--color-soft-strong);
  border-radius: 8rpx;
  overflow: hidden;
}
.fp-bar {
  height: 100%;
  border-radius: 8rpx;
  transition: width 0.3s;
}
.fp-bar-up {
  background: linear-gradient(90deg, #fb923c 0%, #dc2626 100%);
}
.fp-bar-down {
  background: linear-gradient(90deg, #38bdf8 0%, #2563eb 100%);
}
.fp-bar-flat {
  background: var(--color-soft-strong);
}
.fp-pct {
  width: 100rpx;
  text-align: right;
  font-weight: 600;
  font-size: 24rpx;
  flex-shrink: 0;
}
.fp-pct-up {
  color: #dc2626;
}
.fp-pct-down {
  color: #2563eb;
}
.fp-pct-flat {
  color: var(--color-muted);
}

/* v0.40.0 trend-20: 标签组合 */
.tc-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 10rpx 0;
  border-bottom: 1rpx solid #f1f5f9;
}
.tc-row:last-child {
  border-bottom: none;
}
.tc-rank {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: var(--color-soft);
  color: var(--color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 600;
  flex-shrink: 0;
}
.tc-mid {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}
.tc-pair {
  display: flex;
  align-items: center;
  gap: 6rpx;
  flex-wrap: wrap;
}
.tc-tag {
  background: var(--color-violet-soft);
  color: #6d28d9;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  font-size: 24rpx;
  font-weight: 500;
}
.tc-plus {
  color: var(--color-muted);
  font-size: 22rpx;
  margin: 0 2rpx;
}
.tc-meta {
  font-size: 22rpx;
}
.tc-price {
  color: var(--color-heading);
  font-weight: 600;
}
.tc-bar-wrap {
  width: 120rpx;
  height: 10rpx;
  background: var(--color-soft-strong);
  border-radius: 6rpx;
  overflow: hidden;
  flex-shrink: 0;
}
.tc-bar {
  height: 100%;
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

/* v0.42.0 trend-22: 户型 × 面积 热图 */
.ba-heatmap {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  margin-top: 12rpx;
  font-size: 22rpx;
}
.ba-row {
  display: flex;
  gap: 4rpx;
  align-items: center;
}
.ba-header {
  font-size: 22rpx;
  color: var(--color-muted);
  margin-bottom: 4rpx;
}
.ba-corner,
.ba-col-h,
.ba-row-h {
  padding: 6rpx 8rpx;
  text-align: center;
  flex-shrink: 0;
}
.ba-corner {
  width: 80rpx;
}
.ba-col-h {
  flex: 1;
  font-size: 22rpx;
  color: #475569;
}
.ba-row-h {
  width: 80rpx;
  text-align: right;
  font-weight: 600;
  color: var(--color-heading);
  font-size: 24rpx;
}
.ba-cell {
  flex: 1;
  min-height: 80rpx;
  border-radius: 8rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6rpx 4rpx;
  text-align: center;
}
.ba-cell-on {
  background: linear-gradient(135deg, #38bdf8 0%, #2563eb 100%);
  color: #fff;
}
.ba-cell-off {
  background: var(--color-soft);
  color: #cbd5e1;
}
.ba-cell-n {
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1.1;
}
.ba-cell-p {
  font-size: 20rpx;
  opacity: 0.9;
  margin-top: 2rpx;
}

/* v0.43.0 trend-23: 朝向 × 楼层 溢价分析 */
.of-section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--color-heading);
  margin-top: 18rpx;
  margin-bottom: 8rpx;
}
.of-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 12rpx;
  border-radius: 6rpx;
  font-size: 22rpx;
  margin-bottom: 4rpx;
}
.of-row-up {
  background: var(--color-success-soft);
  border-left: 4rpx solid #10b981;
}
.of-row-down {
  background: var(--color-danger-soft);
  border-left: 4rpx solid #ef4444;
}
.of-rank {
  font-weight: 700;
  color: #475569;
  width: 40rpx;
}
.of-key {
  flex: 1;
  color: var(--color-heading);
  font-weight: 500;
}
.of-pct {
  font-weight: 700;
  font-size: 26rpx;
}
.of-row-up .of-pct { color: #059669; }
.of-row-down .of-pct { color: #dc2626; }
.of-px {
  color: var(--color-muted);
  font-size: 20rpx;
  width: 110rpx;
  text-align: right;
}
.of-n {
  color: var(--color-muted);
  font-size: 20rpx;
  width: 60rpx;
  text-align: right;
}
.of-matrix {
  margin-top: 8rpx;
  font-size: 22rpx;
}
.of-mrow {
  display: flex;
  gap: 3rpx;
  align-items: center;
  margin-bottom: 3rpx;
}
.of-mheader {
  margin-bottom: 4rpx;
}
.of-mcorner,
.of-mcol-h,
.of-mrow-h,
.of-mcell {
  padding: 6rpx 4rpx;
  text-align: center;
  flex-shrink: 0;
}
.of-mcorner,
.of-mcol-h {
  font-size: 20rpx;
  color: var(--color-muted);
}
.of-mcorner {
  width: 90rpx;
}
.of-mcol-h {
  flex: 1;
}
.of-mrow-h {
  width: 90rpx;
  text-align: right;
  font-weight: 600;
  color: var(--color-heading);
  font-size: 22rpx;
}
.of-mcell {
  flex: 1;
  min-height: 70rpx;
  border-radius: 6rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.of-cell-off {
  background: var(--color-soft);
  color: #cbd5e1;
}
.of-cell-up-strong {
  background: #059669;
  color: #fff;
}
.of-cell-up {
  background: #6ee7b7;
  color: #064e3b;
}
.of-cell-flat {
  background: var(--color-warn-soft);
  color: #78350f;
}
.of-cell-down {
  background: #fca5a5;
  color: #7f1d1d;
}
.of-cell-down-strong {
  background: #dc2626;
  color: #fff;
}
.of-mcell-n {
  font-size: 22rpx;
  font-weight: 700;
}
.of-mcell-p {
  font-size: 18rpx;
  opacity: 0.9;
}

/* v0.44.0 trend-24: 装修 × 楼龄 - 复用 of-* 的颜色逻辑, 这里只定义 da-* 别名 */
.da-cell-off {
  background: var(--color-soft);
  color: #cbd5e1;
}
.da-cell-up-strong { background: #059669; color: #fff; }
.da-cell-up { background: var(--color-success-soft); color: var(--color-on-success-soft); }
.da-cell-flat { background: var(--color-warn-soft); color: var(--color-on-warn-soft); }
.da-cell-down { background: var(--color-danger-soft); color: var(--color-on-danger-soft); }
.da-cell-down-strong { background: #dc2626; color: #fff; }

/* v0.45.0 trend-25: 总价 × 单价 散点 SVG */
.scatter-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #475569;
}
.scatter-leg-item {
  display: flex;
  align-items: center;
  gap: 4rpx;
}
.scatter-leg-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  display: inline-block;
}
.scatter-wrap {
  width: 100%;
  margin-top: 12rpx;
  background: var(--color-panel);
  border-radius: 8rpx;
  padding: 8rpx;
}
.scatter-svg {
  width: 100%;
  height: auto;
  display: block;
}
.scatter-q-section {
  margin-top: 18rpx;
}
.scatter-q-title {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--color-heading);
  margin-bottom: 6rpx;
}
.scatter-q-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  display: inline-block;
}
.scatter-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 12rpx;
  font-size: 22rpx;
  background: var(--color-panel);
  border-radius: 6rpx;
  margin-bottom: 4rpx;
}
.scatter-rank {
  font-weight: 700;
  color: #475569;
  width: 40rpx;
}
.scatter-name {
  flex: 1;
  color: var(--color-heading);
}
.scatter-meta {
  color: var(--color-muted);
  font-size: 20rpx;
  width: 160rpx;
}
.scatter-up {
  color: #059669;
  font-weight: 600;
  font-size: 22rpx;
  width: 90rpx;
  text-align: right;
}
.scatter-tp {
  color: #475569;
  font-weight: 500;
  font-size: 22rpx;
  width: 90rpx;
  text-align: right;
}

/* v0.46.0 map-11: 行政区 + 社区 marker 地图 */
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
  color: var(--color-soft);
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
  color: var(--color-soft);
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
  color: var(--color-soft);
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
  color: var(--color-soft);
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

/* v0.55.0 hero-1: 顶部大盘轮播 + 快捷入口 */
.hero-section {
  margin: 0;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--color-border);
}
.hero-carousel {
  position: relative;
  border-radius: 16rpx;
  overflow: hidden;
}
.hero-scroll {
  width: 100%;
  height: 200rpx;
}
.hero-slide {
  width: 100%;
  max-width: 100%;
  height: 200rpx;
  padding: 24rpx 28rpx;
  border-radius: 16rpx;
  cursor: pointer;
  transition: transform 0.15s;
  box-sizing: border-box;
  vertical-align: top;
  overflow: hidden;
}
.hero-slide:active {
  transform: scale(0.98);
}
.hero-slide--blue {
  background: linear-gradient(135deg, #dbeafe, #93c5fd);
  color: #1e3a8a;
}
.hero-slide--green {
  background: linear-gradient(135deg, #d1fae5, #6ee7b7);
  color: #064e3b;
}
.hero-slide--red {
  background: linear-gradient(135deg, #fee2e2, #fca5a5);
  color: #7f1d1d;
}
.hero-slide--amber {
  background: linear-gradient(135deg, #fef3c7, #fcd34d);
  color: #78350f;
}
.hero-slide--violet {
  background: linear-gradient(135deg, #ede9fe, #c4b5fd);
  color: #4c1d95;
}
.hero-slide--rose {
  background: linear-gradient(135deg, #ffe4e6, #fda4af);
  color: #881337;
}
.hero-slide-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}
.hero-slide-icon {
  font-size: 60rpx;
  flex-shrink: 0;
}
.hero-slide-mid {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.hero-slide-label {
  font-size: 24rpx;
  opacity: 0.85;
  font-weight: 500;
}
.hero-slide-val {
  font-size: 44rpx;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  margin: 4rpx 0;
  line-height: 1.1;
}
.hero-slide-unit {
  font-size: 24rpx;
  font-weight: 600;
  margin-left: 4rpx;
  opacity: 0.75;
}
.hero-slide-sub {
  font-size: 20rpx;
  opacity: 0.7;
}
.hero-dots {
  display: flex;
  justify-content: center;
  gap: 8rpx;
  margin-top: 8rpx;
}
.hero-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--color-soft-strong);
  cursor: pointer;
  transition: all 0.2s;
}
.hero-dot--active {
  width: 28rpx;
  border-radius: 6rpx;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
  margin-top: 16rpx;
  padding: 16rpx 12rpx;
  background: var(--color-panel);
  border-radius: 12rpx;
}
.quick-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  padding: 12rpx 4rpx;
  border-radius: 10rpx;
  background: var(--color-surface);
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 1rpx 3rpx rgba(0, 0, 0, 0.04);
}
.quick-tile:hover {
  transform: translateY(-2rpx);
  box-shadow: 0 4rpx 8rpx rgba(0, 0, 0, 0.08);
}
.quick-tile:active {
  transform: translateY(0);
}
.quick-tile-icon {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 36rpx;
  font-weight: 600;
}
.quick-tile-icon--blue {
  background: linear-gradient(135deg, #dbeafe, #93c5fd);
}
.quick-tile-icon--green {
  background: linear-gradient(135deg, #d1fae5, #6ee7b7);
}
.quick-tile-icon--red {
  background: linear-gradient(135deg, #fee2e2, #fca5a5);
}
.quick-tile-icon--amber {
  background: linear-gradient(135deg, #fef3c7, #fcd34d);
}
.quick-tile-icon--violet {
  background: linear-gradient(135deg, #ede9fe, #c4b5fd);
}
.quick-tile-icon--rose {
  background: linear-gradient(135deg, #ffe4e6, #fda4af);
}
.quick-tile-label {
  font-size: 22rpx;
  color: var(--color-chip-text);
  font-weight: 500;
}

/* v0.48.0 dashboard-tabs：同色条，去浮岛圆角与 gutter */
.dash-tabs {
  display: flex;
  gap: 8rpx;
  padding: 8rpx 12rpx;
  background: var(--color-surface);
  border-radius: 0;
  margin: 0;
  border-bottom: 1rpx solid var(--color-border);
  overflow-x: auto;
  scrollbar-width: none;
}
.dash-tabs::-webkit-scrollbar { display: none; }
.dash-tab {
  flex: 1 0 auto;
  min-width: 140rpx;
  padding: 12rpx 16rpx;
  border-radius: 12rpx;
  background: var(--color-soft);
  font-size: 26rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.dash-tab--active {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #fff;
  transform: scale(1.03);
  box-shadow: 0 4rpx 12rpx rgba(99, 102, 241, 0.25);
}
.dash-tab-icon {
  font-size: 32rpx;
  line-height: 1;
}
.dash-tab-label {
  font-size: 24rpx;
  font-weight: 600;
}
.dash-tab-count {
  font-size: 20rpx;
  opacity: 0.7;
}

.week-bound-strip {
  border-color: rgba(244, 63, 94, 0.28);
  background: linear-gradient(145deg, var(--color-surface) 0%, rgba(244, 63, 94, 0.06) 100%);
}
.week-bound-grid {
  display: flex;
  gap: 12rpx;
  margin-top: 12rpx;
}
.week-bound-kpi {
  flex: 1;
  min-width: 0;
  padding: 12rpx;
  border-radius: 12rpx;
  background: rgba(15, 23, 42, 0.35);
}
.week-bound-value {
  display: block;
  margin-top: 4rpx;
  font-size: 36rpx;
  font-weight: 700;
  color: var(--color-heading);
}
.week-bound-value--sm {
  font-size: 24rpx;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn-on {
  border-color: #4ade80 !important;
  color: #4ade80 !important;
}
</style>

<!-- v0.48.0 dashboard-tabs: 全局 (非 scoped) for body[data-dash-tab] 选择器 -->
<style lang="scss">
body[data-dash-tab="overview"] .card[data-tab]:not([data-tab*="overview"]):not([data-tab*="all"]),
body[data-dash-tab="price"] .card[data-tab]:not([data-tab*="price"]):not([data-tab*="all"]),
body[data-dash-tab="school"] .card[data-tab]:not([data-tab*="school"]):not([data-tab*="all"]),
body[data-dash-tab="transit"] .card[data-tab]:not([data-tab*="transit"]):not([data-tab*="all"]),
body[data-dash-tab="map"] .card[data-tab]:not([data-tab*="map"]):not([data-tab*="all"]) {
  display: none !important;
}

/* 默认仅看本市：隐藏标注了跨城对照的区块 */
body.city-scoped [data-cross-city] {
  display: none !important;
}
</style>
