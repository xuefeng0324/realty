<template>
  <view class="page">
    <view class="container">
      <!-- 顶部筛选：用 view+tap 触发 action sheet，避开 picker 兼容问题 -->
      <view class="card">
        <view class="card-title">筛选</view>
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
        <view class="row-gap" style="margin-top: 16rpx">
          <button class="btn" size="mini" @click="reload">刷新</button>
        </view>
        <text v-if="periodHint" class="muted period-hint">{{ periodHint }}</text>
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
        </view>

        <view class="stats70-foot muted">点击进入全国 70 城榜单 ›</view>
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

      <view v-if="runtime" class="card muted">
        <text>DB: {{ runtime.database_file || runtime.database_url }}</text>
        <text> · 规则: {{ runtime.rule_version_listing }}</text>
        <text> · 数据量: 城市 {{ runtime.data_counts.cities }} / 小区 {{ runtime.data_counts.communities }} / 房源 {{ runtime.data_counts.listings }}</text>
      </view>

      <view v-if="coverage" class="card" data-tab="all">
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

      <!-- 区/板块对比 -->
      <view class="card" data-tab="all,price">
        <view class="row-between">
          <view class="card-title">区/板块对比</view>
          <view class="muted">{{ app.metric === "listing_count" ? "挂牌数" : "均价(元/㎡)" }}</view>
        </view>
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
      </view>

      <!-- v0.23.0 trend-9: 全品类区级网签热度榜 (新房/二手/全部 tab 切换) -->
      <view v-if="districtWangqianRank && districtWangqianRank.items.length > 0" class="card" data-tab="all,price">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">
            🔥 全品类区级网签热度榜 · {{ districtWangqianRank.cityName }}
          </view>
          <view class="muted" style="font-size: 22rpx">
            累计 {{ districtWangqianRank.totalUnits }} 套 · {{ districtWangqianRank.totalDistricts }} 区
          </view>
        </view>
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
      </view>

      <!-- v0.24.0 new-5: 通勤时长榜 (community → 城市 CBD 公交通勤) -->
      <view v-if="commuteRanking && commuteRanking.fastest.length > 0" class="card" data-tab="all,transit">
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">
            🚇 通勤时长榜 · {{ commuteRanking.cityName }} → {{ commuteRanking.cbdName }}
          </view>
          <view class="muted" style="font-size: 22rpx">
            城市均 {{ commuteRanking.cityAvgMinutes ?? "—" }} 分钟
            · {{ commuteRanking.totalCommunities }} 小区
          </view>
        </view>
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
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：高德 /v3/direction/transit/integrated (公交通勤方案 1, 早 08:30)。
          深圳 → 福田CBD (30 小区, 38 次 API)；广州 → 珠江新城 (8 小区, 10 次 API)。
          行可点 → 小区详情。
        </view>
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
      <view v-if="communityScore && communityScore.items.length > 0" class="card" data-tab="all,price">
        <view class="row-between">
          <view class="card-title">🏅 小区综合评分 Top 小区 · {{ communityScore.cityName }}</view>
          <view class="muted">Top {{ communityScore.items.length }}</view>
        </view>
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
          class="cs-row"
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
          class="mw-row"
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
          class="mb-row"
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
          class="lf-row"
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
          class="lf-row"
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
              fill="#0f172a"
              font-weight="600"
            >单价 元/㎡</text>
            <text
              :x="14"
              :y="SCATTER_H / 2"
              text-anchor="middle"
              font-size="13"
              fill="#0f172a"
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
      </view>

      <!-- v0.46.0 map-11 行政区 + 社区 marker 地图 -->
      <view v-if="districtMap && districtMap.districts.length > 0" class="card" data-tab="all,map">
        <view class="row-between">
          <view class="card-title">🗺️ 行政区域图 · {{ districtMap.cityName }}</view>
          <view class="muted">{{ districtMap.districts.length }} 区 · {{ districtMap.markers.length }} 社区</view>
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
                :class="['map-district-p']"
                :data-name="d.districtName"
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
            <!-- 社区 marker (圆点 + 名字) -->
            <g v-if="districtMap.markers.length <= 30">
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
            <g v-else>
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
          </svg>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：高德 /v3/config/district (行政区边界) + communities_geo.csv (社区经纬度)<br>
          v0.46.0 区名 = 直辖市区 + 行政区; 社区 marker = 圆点 + 名字 (≤30 社区时显示, 超过则简化为点)
        </view>
      </view>

      <!-- v0.47.0 school-4 学区指标加权细分 -->
      <view v-if="schoolDims && schoolDims.total > 0" class="card" data-tab="all,school">
        <view class="row-between">
          <view class="card-title">🏫 学区 5 维评分 · {{ schoolDims.cityName }}</view>
          <view class="muted">{{ schoolDims.total }} 校</view>
        </view>
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
        <view
          v-for="it in lifeConvenience.items"
          :key="it.communityId"
          class="lc-row"
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
      </view>

      <!-- 小区排行 -->
      <view class="card">
        <view class="row-between">
          <view class="card-title">小区 Top {{ ranking.length }}</view>
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
      </view>

      <!-- v0.16.0 实时天气 + 4 天预报 -->
      <view v-if="weatherResp && (weatherResp.live || weatherResp.forecast.length > 0)" class="card">
        <view class="row-between">
          <view class="card-title">🌤️ {{ weatherResp.cityName }} 实时天气</view>
          <view class="muted">
            {{ weatherResp.live?.report_time || "—" }}
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
              <text class="weather-stat-label">🌫 AQI</text>
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
          AQI 因高德 API 不提供 AQI 字段，此处按湿度+风力+温度粗略估算，仅供参考。
        </view>
      </view>

      <!-- v0.17.0 listing 学区溢价榜（Top 高评分房源） -->
      <view v-if="listingPremiumOverview && listingPremiumOverview.items.length > 0" class="card" data-tab="all,price">
        <view class="row-between">
          <view class="card-title">🏫 高学区评分房源 · {{ listingPremiumOverview.cityName }}</view>
          <view class="muted">Top {{ listingPremiumOverview.items.length }} / 共 {{ listingPremiumOverview.total }}</view>
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
          数据源：listings.csv + schools.csv (district_name) + school_indicators.csv (latest_level_score_raw)。
          每个 listing 拿到其 community 所在区的平均学区评分；区中位单价/全市中位单价 = 板块溢价率。
        </view>
      </view>

      <!-- v0.19.0 商业热度榜 (小区维度) -->
      <view v-if="commercialResp && commercialResp.items.length > 0" class="card" data-tab="all,transit">
        <view class="row-between">
          <view class="card-title">🛒 商业热度 Top {{ commercialResp.items.length }} · {{ commercialResp.cityName }}</view>
          <view class="muted">共 {{ commercialResp.total }} 个小区上榜</view>
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
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：高德 /v3/place/around (餐饮/银行/便利店 3 类 POI，每类最近 3 个，按距离衰减加权)。
          评分 = 餐饮(50) + 银行(30) + 便利店(20)，每类按数量阶梯打分并乘以最近距离权重 (≤300m×1.0 / 800m×0.7 / 1500m×0.4 / 1500m+×0.1)。
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
import { computed, onMounted, ref, watch } from "vue";
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
  type SchoolDimResponse,
  type DistrictTrendItem, type WangqianOverviewItem, type SchoolPremiumOverview, type SchoolPremiumCommunityItem, type WeatherResponse, type ListingSchoolPremiumOverview, type CommercialRankingResponse, type DistrictCommunityCompareResponse, type DistrictWangqianRankResponse, type CommuteRankingResponse, type LayoutDistributionResponse, type TagCloudResponse, type DistrictIndexResponse, type DistrictChangeResponse, type LifeConvenienceResponse, type CommunityScoreResponse, type MetroWalkResponse, type MetroBenefitResponse, type DistrictMetaResponse, type FeaturePremiumResponse, type TagCombinationResponse, type ListingFreshnessResponse, type BedroomAreaResponse, type OrientationFloorResponse, type DecorateAgeResponse, type CommunityScatterResponse, type DistrictMapResponse } from "../../local/queries";
import {
  getLatestIndexForCity,
  getLatestMonth,
  type LatestIndexForCity
} from "../../local/stats70";
import {
  getLatestCityDaily,
  type CityDailySnapshot
} from "../../local/dailyWangqian";
import { hasStats70, hasDailyWangqian } from "../../local/store";
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
const layoutDistribution = ref<LayoutDistributionResponse | null>(null);
const tagCloud = ref<TagCloudResponse | null>(null);
const tagCloudFilteredHint = ref<string>("");
const districtIndex = ref<DistrictIndexResponse | null>(null);
const districtChange = ref<DistrictChangeResponse | null>(null);
const lifeConvenience = ref<LifeConvenienceResponse | null>(null);
const communityScore = ref<CommunityScoreResponse | null>(null);
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
// v0.46.0 map-11: 行政区 + 社区 marker 地图
const districtMap = ref<DistrictMapResponse | null>(null);
// v0.47.0 school-4: 学区指标细分
const schoolDims = ref<SchoolDimResponse | null>(null);
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

// v0.48.0 dashboard-tabs: 顶部 tab 切换
type DashTabKey = "all" | "price" | "school" | "transit" | "map";
const activeTab = ref<DashTabKey>("all");
const DASHBOARD_TABS: Array<{ key: DashTabKey; icon: string; label: string }> = [
  { key: "all", icon: "📊", label: "全部" },
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
  loadRankingAndDistrict();
  showToast(`已切到 ${target}`);
}

// 房源来自安居客「每周快照」，最新周期是上一个完整周（周日结束），并非当天。
// 这里给一句说明，避免用户误以为"周期结束日没更新到今天"是 bug。
const periodHint = computed(() => {
  const list = periods.value;
  if (list.length === 0) return "";
  const latest = list[list.length - 1];
  return `房源为安居客每周快照，最新周期 ${latest}（非当日）`;
});

// Picker 辅助
const cityLabels = computed(() => cities.value.map((c) => c.city_name));
const cityIndex = computed(() => cities.value.findIndex((c) => c.city_id === app.cityId));
const currentCityLabel = computed(() => {
  const c = cities.value.find((c) => c.city_id === app.cityId);
  return c?.city_name || "";
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
  const parts = m.split("/");
  if (parts.length < 3) return m;
  return `${parts[0]}-${parts[1].padStart(2, "0")}`;
});

const currentCityIndex = computed<LatestIndexForCity | null>(() => {
  if (!hasStats70()) return null;
  const city = cities.value.find((c) => c.city_id === app.cityId);
  if (!city) return null;
  return getLatestIndexForCity(city.city_name);
});

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
  const city = cities.value.find((c) => c.city_id === app.cityId);
  return city?.city_name.replace(/市$/, "") ?? "";
});

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
  applyTabClass();
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
.page {
  min-height: 100vh;
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
  color: #94a3b8;
  font-size: 26rpx;
  min-width: 140rpx;
}

.picker-value {
  background: #1e293b;
  border-radius: 8rpx;
  padding: 12rpx 20rpx;
  color: #f3f4f6;
  min-width: 200rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.picker-caret {
  color: #64748b;
  font-size: 22rpx;
  margin-left: 8rpx;
}

.period-hint {
  display: block;
  margin-top: 12rpx;
  color: #94a3b8;
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
  background: #111827;
  border-top-left-radius: 24rpx;
  border-top-right-radius: 24rpx;
  display: flex;
  flex-direction: column;
  padding: 16rpx 0;
  box-sizing: border-box;
}

.sheet-title {
  text-align: center;
  font-size: 28rpx;
  color: #94a3b8;
  padding: 16rpx;
  border-bottom: 1rpx solid #1e293b;
}

.sheet-list {
  flex: 1;
  max-height: 56vh;
  padding: 0 16rpx;
}

.sheet-item {
  padding: 24rpx 16rpx;
  border-bottom: 1rpx solid #1e293b;
  color: #f3f4f6;
  font-size: 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sheet-item--active {
  color: #4ade80;
  background: #1e293b;
}

.sheet-check {
  color: #4ade80;
  font-weight: bold;
}

.sheet-cancel {
  text-align: center;
  padding: 28rpx 0;
  color: #94a3b8;
  font-size: 30rpx;
  border-top: 1rpx solid #1e293b;
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
  background: #1f2937;
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
  color: #f3f4f6;
  font-size: 24rpx;
}

.district-note {
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #1f2937;
  font-size: 22rpx;
  line-height: 1.5;
  color: #64748b;
}

.community-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #1f2937;
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
  color: #f3f4f6;
  margin-bottom: 4rpx;
}

/* ---------------- 70 城指数卡片 ---------------- */
.stats70-card {
  background: linear-gradient(135deg, #111827 0%, #0c1426 100%);
  border: 1rpx solid #1f2937;
}

.stats70-foot {
  margin-top: 16rpx;
  text-align: right;
  font-size: 22rpx;
  color: #4ade80;
}

.stats70-grid {
  display: flex;
  flex-wrap: wrap;
  margin-top: 16rpx;
  gap: 8rpx;
}

.stats70-cell {
  flex: 1 1 calc(50% - 8rpx);
  background: #111827;
  border: 1rpx solid #1f2937;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.cell-label {
  color: #94a3b8;
  font-size: 24rpx;
}

.cell-value {
  font-size: 36rpx;
  font-weight: 700;
  color: #f3f4f6;
}

.cell-sub {
  font-size: 22rpx;
  color: #64748b;
}

.stats70-up {
  color: #4ade80 !important;
}

.stats70-down {
  color: #fca5a5 !important;
}

.stats70-flat {
  color: #94a3b8 !important;
}

.wangqian-card {
  background: linear-gradient(135deg, #111827 0%, #0c1a2e 100%);
  border: 1rpx solid #1e3a5f;
}

.wangqian-up {
  color: #4ade80 !important;
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
  border-bottom: 1rpx solid #1f2937;
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
  color: #f3f4f6;
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
  color: #94a3b8;
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
  background: #e2e8f0;
  color: #475569;
}
.medal-flat-mini {
  background: #1e293b;
  color: #94a3b8;
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
  color: #64748b;
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
  color: #94a3b8;
}
.weather-stat-value {
  font-size: 24rpx;
  font-weight: 600;
  color: #0f172a;
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
  color: #64748b;
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
  color: #0f172a;
}
.forecast-date {
  font-size: 18rpx;
  color: #94a3b8;
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
  color: #0f172a;
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
.sp-flat { color: #64748b; }
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
  color: #94a3b8;
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
  background: #1f2937;
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
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

/* v0.26.0 trend-11 学区评分小区榜 - 过滤/排序控件 */
.spc-controls {
  padding: 8rpx 0 12rpx;
  border-bottom: 1rpx dashed #1f2937;
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
  color: #94a3b8;
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
  background: #0f172a;
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
  background: #0f172a;
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
  color: #e2e8f0;
}
.tag-size-3 {
  font-size: 30rpx;
  color: #f1f5f9;
  background: #1e293b;
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
  border-bottom: 1rpx solid #1f2937;
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
  border-bottom: 1rpx solid #1f2937;
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
  color: #e2e8f0;
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
  border-bottom: 1rpx solid #1f2937;
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
  color: #e2e8f0;
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
  background: #1e293b;
  border-radius: 6rpx;
  padding: 2rpx 6rpx;
  min-width: 32rpx;
}
.lc-dim-label {
  font-size: 18rpx;
  color: #94a3b8;
  font-weight: 600;
}
.lc-dim-val {
  font-size: 22rpx;
  color: #cbd5e1;
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
.lc-score-high {
  color: #22c55e;
}
.lc-score-mid {
  color: #38bdf8;
}
.lc-score-low {
  color: #94a3b8;
}

/* v0.33.0 小区综合评分榜 */
.cs-summary {
  font-size: 22rpx;
  margin-bottom: 8rpx;
}
.cs-weights {
  background: #0f172a;
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
  background: #1e293b;
  color: #cbd5e1;
  border: 1rpx solid #334155;
}
.cs-preset-on {
  background: #38bdf8;
  color: #0f172a;
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
  color: #94a3b8;
  min-width: 60rpx;
}
.cs-slider {
  flex: 1;
}
.cs-slider-val {
  font-size: 22rpx;
  color: #e2e8f0;
  min-width: 60rpx;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.cs-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 0;
  border-bottom: 1rpx solid #1f2937;
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
  color: #94a3b8;
  font-size: 28rpx;
}
.cs-mid {
  flex: 1;
  min-width: 0;
}
.cs-name {
  font-size: 26rpx;
  font-weight: 500;
  color: #e2e8f0;
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
  background: #1e293b;
  border-radius: 6rpx;
  padding: 2rpx 6rpx;
  min-width: 50rpx;
}
.cs-dim-label {
  font-size: 18rpx;
  color: #94a3b8;
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
  color: #94a3b8;
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
  border-bottom: 1rpx solid #1f2937;
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
  color: #e2e8f0;
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
  border-bottom: 1rpx solid #1f2937;
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
  color: #e2e8f0;
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
  color: #94a3b8;
}

/* v0.10.0 网签热度榜 */
.wq-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 0;
  border-bottom: 1rpx solid #1f2937;
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
  color: #1f2937;
}
.wq-rank-silver {
  background: linear-gradient(135deg, #e5e7eb 0%, #94a3b8 100%);
  color: #1f2937;
}
.wq-rank-bronze {
  background: linear-gradient(135deg, #d97706 0%, #92400e 100%);
  color: #fffbeb;
}
.wq-rank-normal {
  background: #1e293b;
  color: #94a3b8;
}
.wq-name {
  width: 140rpx;
  font-size: 26rpx;
  color: #f3f4f6;
  font-weight: 500;
  flex-shrink: 0;
}
.wq-track {
  flex: 1;
  height: 14rpx;
  background: #1e293b;
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
  color: #f3f4f6;
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
  background: #e5e7eb;
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
  color: #0f172a;
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
  color: #94a3b8;
  font-size: 22rpx;
}
.dm-v {
  font-weight: 600;
  color: #0f172a;
  min-width: 70rpx;
}
.dm-sub {
  font-size: 22rpx;
  color: #94a3b8;
}
.dm-mom {
  font-size: 22rpx;
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
  margin-left: 4rpx;
}
.dm-mom-up {
  color: #dc2626;
  background: #fef2f2;
}
.dm-mom-down {
  color: #16a34a;
  background: #f0fdf4;
}
.dm-mom-flat {
  color: #64748b;
  background: #f1f5f9;
}

/* v0.39.0 trend-19: 特征画像溢价 */
.fp-dim-row {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 12rpx;
}
.fp-dim-block {
  background: #f8fafc;
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
  color: #0f172a;
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
  background: #e2e8f0;
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
  background: #cbd5e1;
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
  color: #64748b;
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
  background: #f1f5f9;
  color: #64748b;
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
  background: #ede9fe;
  color: #6d28d9;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  font-size: 24rpx;
  font-weight: 500;
}
.tc-plus {
  color: #94a3b8;
  font-size: 22rpx;
  margin: 0 2rpx;
}
.tc-meta {
  font-size: 22rpx;
}
.tc-price {
  color: #0f172a;
  font-weight: 600;
}
.tc-bar-wrap {
  width: 120rpx;
  height: 10rpx;
  background: #e2e8f0;
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
  color: #0f172a;
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
  color: #0f172a;
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
  color: #94a3b8;
}
.lf-v {
  font-size: 26rpx;
  font-weight: 600;
  color: #0f172a;
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
  background: #dcfce7;
  color: #16a34a;
}
.lf-fresh-mid {
  background: #fef3c7;
  color: #d97706;
}
.lf-fresh-down {
  background: #fee2e2;
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
  color: #64748b;
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
  color: #0f172a;
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
  background: #f1f5f9;
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
  color: #0f172a;
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
  background: #ecfdf5;
  border-left: 4rpx solid #10b981;
}
.of-row-down {
  background: #fef2f2;
  border-left: 4rpx solid #ef4444;
}
.of-rank {
  font-weight: 700;
  color: #475569;
  width: 40rpx;
}
.of-key {
  flex: 1;
  color: #0f172a;
  font-weight: 500;
}
.of-pct {
  font-weight: 700;
  font-size: 26rpx;
}
.of-row-up .of-pct { color: #059669; }
.of-row-down .of-pct { color: #dc2626; }
.of-px {
  color: #64748b;
  font-size: 20rpx;
  width: 110rpx;
  text-align: right;
}
.of-n {
  color: #94a3b8;
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
  color: #64748b;
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
  color: #0f172a;
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
  background: #f1f5f9;
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
  background: #fef3c7;
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
  background: #f1f5f9;
  color: #cbd5e1;
}
.da-cell-up-strong { background: #059669; color: #fff; }
.da-cell-up { background: #6ee7b7; color: #064e3b; }
.da-cell-flat { background: #fef3c7; color: #78350f; }
.da-cell-down { background: #fca5a5; color: #7f1d1d; }
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
  background: #fafafa;
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
  color: #0f172a;
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
  background: #f8fafc;
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
  color: #0f172a;
}
.scatter-meta {
  color: #64748b;
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
  background: #f1f5f9;
  border-radius: 8rpx;
  padding: 8rpx;
  overflow: hidden;
}
.map-svg {
  width: 100%;
  height: auto;
  max-height: 60vh;
  display: block;
  background: #f1f5f9;
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
  color: #1e293b;
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
  background: #f8fafc;
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
  color: #0f172a;
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
  background: #e2e8f0;
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
  color: #1e293b;
}
.sd-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
}
.sd-cell {
  background: #f8fafc;
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
  color: #1e293b;
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

/* v0.49.0 topnav-1: 周次切换 sticky bar */
.topnav-period {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 16rpx 24rpx 12rpx;
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  color: #fff;
  border-radius: 16rpx;
  margin: 8rpx 0 0;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.15);
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
  color: #f1f5f9;
}
.topnav-p-num {
  font-size: 36rpx;
  font-weight: 700;
  color: #fbbf24;
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
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 24rpx;
  font-weight: 600;
  text-align: center;
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  transition: background 0.15s, transform 0.1s;
}
.topnav-p-btn:active {
  background: rgba(99, 102, 241, 0.35);
  transform: scale(0.97);
}
.topnav-p-btn--disabled {
  opacity: 0.35;
  pointer-events: none;
}

/* v0.48.0 dashboard-tabs */
.dash-tabs {
  display: flex;
  gap: 8rpx;
  padding: 8rpx 12rpx;
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
  border-radius: 16rpx;
  margin: 8rpx 0 16rpx;
  overflow-x: auto;
  scrollbar-width: none;
}
.dash-tabs::-webkit-scrollbar { display: none; }
.dash-tab {
  flex: 1 0 auto;
  min-width: 140rpx;
  padding: 12rpx 16rpx;
  border-radius: 12rpx;
  background: #f1f5f9;
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
</style>

<!-- v0.48.0 dashboard-tabs: 全局 (非 scoped) for body[data-dash-tab] 选择器 -->
<style lang="scss">
body[data-dash-tab="price"] .card:not([data-tab*="price"]),
body[data-dash-tab="school"] .card:not([data-tab*="school"]),
body[data-dash-tab="transit"] .card:not([data-tab*="transit"]),
body[data-dash-tab="map"] .card:not([data-tab*="map"]) {
  display: none !important;
}
</style>