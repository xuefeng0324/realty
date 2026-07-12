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

      <view v-if="coverage" class="card">
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

      <!-- 区/板块对比 -->
      <view class="card">
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
      <view v-if="wangqianOverview && wangqianOverview.items.length > 0" class="card">
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
      <view v-if="districtWangqianRank && districtWangqianRank.items.length > 0" class="card">
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
      <view v-if="commuteRanking && commuteRanking.fastest.length > 0" class="card">
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
      <view v-if="layoutDistribution && layoutDistribution.totalListings > 0" class="card">
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
      <view v-if="tagCloud && tagCloud.tags.length > 0" class="card">
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
      <view v-if="districtIndex && districtIndex.items.length > 0" class="card">
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
      <view v-if="districtChange && districtChange.items.length > 0" class="card">
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

      <!-- v0.31.0 new-9 生活便利度榜 (5 维: mall/park/subway/school/hospital) -->
      <view v-if="lifeConvenience && lifeConvenience.items.length > 0" class="card">
        <view class="row-between">
          <view class="card-title">🧭 生活便利度 Top 小区 · {{ lifeConvenience.cityName }}</view>
          <view class="muted">Top {{ lifeConvenience.items.length }}</view>
        </view>
        <view v-if="lifeConvenience.items.length === 0" class="empty">暂无数据</view>
        <view class="lc-summary muted">
          城市均分 {{ lifeConvenience.avgScore }} · 最高 {{ lifeConvenience.maxScore }}
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
          </view>
          <view class="lc-right">
            <text :class="['lc-score', lifeScoreClass(it.score)]">{{ it.score }}</text>
            <view class="muted" style="font-size: 20rpx">/ 100</view>
          </view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          数据源：poi_seed.csv → life_convenience.csv (compute_life_convenience.py)。
          评分维度 M=商场 P=公园 S=地铁 X=学校 Y=医院。满分 100，按综合分降序。
        </view>
      </view>

      <!-- v0.11.0 学区溢价榜 -->
      <view v-if="schoolPremiumOverview && schoolPremiumOverview.items.length > 0" class="card">
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
      <view v-if="listingPremiumOverview && listingPremiumOverview.items.length > 0" class="card">
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
      <view v-if="commercialResp && commercialResp.items.length > 0" class="card">
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
      <view v-if="districtCompareResp && districtCompareResp.items.length > 0" class="card">
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
import { getCommunityRanking, getDistrictCompare, getCityDistrictOverview, getWangqianHeatmap, getSchoolPremiumRank, getSchoolPremiumCommunityRank, getWeather, getTopListingsBySchoolPremium, getCommercialRanking, getCommunityCompareByDistrict, getDistrictWangqianRank, getCommuteRanking, getLayoutDistribution, getListingTagCloud, getDistrictIndex, getDistrictChangeRank, getLifeConvenienceRank, type DistrictTrendItem, type WangqianOverviewItem, type SchoolPremiumOverview, type SchoolPremiumCommunityItem, type WeatherResponse, type ListingSchoolPremiumOverview, type CommercialRankingResponse, type DistrictCommunityCompareResponse, type DistrictWangqianRankResponse, type CommuteRankingResponse, type LayoutDistributionResponse, type TagCloudResponse, type DistrictIndexResponse, type DistrictChangeResponse, type LifeConvenienceResponse } from "../../local/queries";
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

// 房源来自安居客「每周快照」，最新周期是上一个完整周（周日结束），并非当天。
// 这里给一句说明，避免用户误以为“周期结束日没更新到今天”是 bug。
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

onMounted(async () => {
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
</style>