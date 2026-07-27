<template>
  <view class="page">
    <view class="container">
      <view class="page-header" data-data-tools-header>
        <view class="page-header-title">数据工具</view>
        <view class="page-header-sub muted">从仪表盘迁入的派生数据卡 · Batch 1-5 已迁 14 张 / 共 14 张</view>
      </view>

      <!-- v1.121.145 首页卡片管理（设置入口） -->
      <view class="card" data-dt-card-manager>
        <view class="row-between">
          <view class="card-title">⚙️ 首页卡片管理</view>
          <view class="muted">{{ hiddenCards.size }} 张已隐藏 · 共 {{ DASHBOARD_CARDS.length }} 张</view>
        </view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          在此关闭/打开首页上的核心分析卡。隐藏状态保存在本地存储，下次进入首页生效。
        </view>
        <view class="dt-card-list">
          <view
            v-for="c in DASHBOARD_CARDS"
            :key="c.key"
            class="dt-card-row"
          >
            <view class="dt-card-info">
              <view class="dt-card-name">{{ c.label }}</view>
              <view class="muted" style="font-size: 20rpx">{{ c.key }}</view>
            </view>
            <button
              class="dt-card-toggle"
              size="mini"
              :class="{ 'dt-card-toggle--off': hiddenCards.has(c.key) }"
              hover-class="tap-row--active"
              :data-dt-card-toggle="c.key"
              @click="toggleDashboardCard(c.key)"
            >{{ hiddenCards.has(c.key) ? "显示" : "隐藏" }}</button>
          </view>
        </view>
        <view class="dt-card-actions">
          <button class="dt-card-action" size="mini" hover-class="tap-row--active" @click="resetDashboardCards">恢复全部显示</button>
        </view>
      </view>

      <!-- v1.121.139 Batch 1：70 城 12 月同比趋势 -->
  <!-- v0.91.0 70 城 12 月趋势对比（派生：基于 stats_70.csv） -->
  <view
    v-if="stats70Ready && driftReady"
    class="card stats70-drift-card tap-target" data-dt-stats70-drift
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

      <!-- v1.121.139 Batch 1：地铁步行可达性 -->
  <!-- v0.92.0 地铁步行可达性概览（派生：基于 metro_walk.csv） -->
  <view
    v-if="metroWalkSummary.length"
    class="card metro-walk-card" data-dt-metro-walk
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
      v-if="metroWalkCityTopAll.length"
      style="margin-top: 10rpx"
    >
      <view class="muted" style="font-size: 22rpx; margin-bottom: 6rpx">
        本市步行最少 Top（派生）
      </view>
      <view
        v-for="(row, i) in metroWalkCityTopAll"
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

      <!-- v1.121.140 Batch 2：分区近 12 周均价变动 -->

  <!-- v0.93.0 分区近 12 周均价变动排行（派生：基于 district_trend.csv） -->
  <view
    v-if="district12wChange.length"
    class="card district-drift-card" data-dt-district-trend
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

      <!-- v1.121.140 Batch 2：教育事业概览 -->

  <!-- v1.121.16 教育事业概览（educationOverview，学校页已有，仪表盘此前未展示） -->
  <view v-if="eduOverview" class="card" data-tab="all,school" data-education-overview data-dt-edu-overview>
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

      <!-- v1.121.141 Batch 3：地铁步行通勤 Top -->
  <!-- v0.35.0 map-9 地铁步行通勤榜 (community → 最近地铁站, 步行时长) -->
  <view v-if="metroWalk && metroWalk.items.length > 0" class="card" data-tab="all,transit" data-dt-commute-walk>
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
    <view v-if="metroWalkCityTopAll.length" class="muted" style="margin: 12rpx 0 4rpx; font-size: 22rpx">
      派生层本市步行最少 Top
    </view>
    <view
      v-for="(it, idx) in metroWalkCityTopAll"
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

      <!-- v1.121.141 Batch 3：地铁规划受益 Top -->
  <!-- v0.36.0 map-10 地铁规划受益榜 (规划/在建线路 + 距离 → 受益分) -->
  <view v-if="metroBenefit && metroBenefit.items.length > 0" class="card" data-tab="all,transit" data-dt-plan-benefit>
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

      <!-- v1.121.142 Batch 4：挂牌结构占比 -->
  <!-- v1.121.18 挂牌结构占比（distributionRanking + layout_distribution） -->
  <view v-if="layoutBedroomShare.length || layoutOrientShare.length" class="card" data-tab="all,price" data-dt-listing-structure>
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
      <view v-if="districtMeta && districtMeta.items.length > 0" class="card" data-tab="all,school" data-dt-district-meta>
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
      <!-- v0.39.0 trend-19 特征画像溢价 (户型/面积/朝向/装修 哪类更贵/更便宜) -->
      <view v-if="featurePremium && featurePremium.totalCount > 0" class="card" data-tab="all,price" data-dt-feature-premium>
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
          数据源：listings.csv (中位单价) + cities.csv → scripts/compute_feature_premium.py。<br/>
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
  
      <!-- v1.121.142 Batch 4：挂牌标签热度 -->
  <!-- v1.121.14 挂牌标签热度（listingTagsComparison，筛选项页已用，仪表盘此前未展示） -->
  <view v-if="listingTagCitySummary" class="card" data-tab="all,price" data-dt-listing-tags>
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
      <view v-if="tagCombination && tagCombination.topN.length > 0" class="card" data-tab="all,price" data-dt-tag-combination>
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
          数据源：listing_tags.csv (7518 行) → scripts/compute_tag_combination.py。<br/>
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

      <!-- v1.121.142 Batch 4：学校指标各维度 Top 5 -->
  <!-- v0.94.0 学校指标各维度 Top 5（派生：基于 school_indicators.csv） -->
  <view
    v-if="schoolIndicatorSummary.total > 0"
    class="card school-indicator-card" data-dt-school-indicator
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

      <!-- v1.121.142 Batch 4：重点学校维度 -->
  <!-- v1.121.17 重点学校维度（schoolDimensionRanking，学校页已有；仪表盘此前只有无校名的指标 ID） -->
  <view v-if="dimCityReady" class="card" data-tab="all,school" data-dt-school-dimension>
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

      <!-- 行政区划（v1.121.137 已有） -->
      <view v-if="adminSummary" class="card" data-dt-admin-district>
        <view class="macro-kicker">行政区划</view>
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">行政区划</view>
          <view class="muted" style="font-size: 22rpx">{{ adminSummary.cityCode }}</view>
        </view>
        <view class="muted" style="margin-top: 8rpx">
          {{ adminSummary.districtCount }} 个行政区 · 城市码 {{ adminSummary.cityCode }}
        </view>
        <view class="muted" style="margin-top: 6rpx; font-size: 20rpx">
          数据源：admin_districts.csv
        </view>
      </view>
      <!-- v1.121.14 规划地铁线路概览（metroPlanningRanking 已派生，此前未接 UI） -->
      <view v-if="metroPlanSummary" class="card" data-tab="all,transit" data-dt-metro-plan>
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
          class="mp-row"
        >
          <view class="mp-rank">{{ idx + 1 }}</view>
          <view class="mp-mid">
            <view class="mp-line">{{ it.lineName }}</view>
            <view class="mp-meta muted">{{ it.status }} · {{ it.lengthKm?.toFixed(0) ?? '—' }}km · {{ it.stationCount ?? '—' }} 站</view>
          </view>
        </view>
      </view>

      <!-- 提示：剩余 0 张派生卡（全部已迁 Batch 5） -->
      <view class="card" data-dt-notice>
        <view class="card-title" style="margin-bottom: 0">剩余派生数据（待迁移）</view>
        <view class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          已迁 14 张：70 城 12 月趋势 + 地铁步行可达性 + 分区近 12 周 + 教育事业 + 通勤步行 + 规划受益 + 挂牌结构 + 区情画像 + 特征溢价 + 挂牌标签 + 标签组合 + 学校指标 + 重点学校 + 规划地铁。
          首页瘦身完成度 14/14 = 100%。
        </view>
        <view class="muted" style="margin-top: 6rpx; font-size: 20rpx">
          Batch 1-5 全部完成（v1.121.153）。
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 数据工具独立页（data-tools.vue，v1.121.142 Batch 4）
 *
 * 设计：
 *  - 从仪表盘迁入 14 张派生卡，当前 Batch 1-4 已迁 13 张。
 *  - 仅剩 1 张：规划地铁线路概览（v1.121.14，单独 Batch 5 处理）。
 *  - 提供「设置入口」式导航：dashboard 入口卡 → 独立页 → 完整派生数据。
 */
import { computed, ref, onMounted } from "vue";
import { useAppStore } from "../../store/app";
import * as store from "../../local/store";
import { summarizeAdminDistrictByCity, type CityAdminDistrictSummary } from "../../local/adminDistrictRanking";
import { getCityDriftOverLastYear, summarizeCityDrift, type City12MonthSummary, type DriftDistribution } from "../../local/stats70";
import { summarizeMetroWalkAccessibility, getMetroWalkRankingTopN, getMetroWalkRankingByCityTopN, type MetroWalkAccessibility, type MetroWalkRankingItem } from "../../local/metro";
import { getDistrict12WeekChangeRank, getDistrictRecentMomentumRank, summarizeChangeDistribution, type DistrictChangeEntry, type DistrictMomentumEntry } from "../../local/districtDrift";
import { getEducationOverview, educationHasPrimaryJuniorSplit, formatEducationPeriodLabel, type EducationOverview } from "../../local/educationOverview";
import { getMetroWalkRanking, type MetroWalkResponse, getMetroBenefitRanking, type MetroBenefitResponse, getFeaturePremiumRanking, getTagCombinationRanking, getDistrictMetaRanking, type FeaturePremiumResponse, type TagCombinationResponse, type DistrictMetaResponse } from "../../local/queries";
import { summarizeMetroPlanningByCity, getMetroPlanningByCityTopByLength, getMetroPlanningByCityTopByStations, getMetroPlanningByCityFastLines, getMetroPlanningByCityStatusVsStations, getMetroPlanningCrossCityByYear, getMetroPlanningByDistrict, getMetroPlanningByOpenYear, getMetroPlanningByStatus, summarizeMetroPlanningByPhase, summarizeMetroPlanningByStatus, summarizeMetroPlanningByOpenYear, type CityMetroPlanningSummary, type OpenYearMetroPlanningSummary, type TopByMetric, type CityStatusStations, type PhaseMetroPlanningSummary, type StatusMetroPlanningSummary } from "../../local/metroPlanningRanking";
import { getMetroPlanningGeoByCityCrossReference, getMetroPlanningGeoCoverageStats, getMetroPlanningGeoManualFallbackRate, getMetroPlanningGeoByCityMissingEndpoints, getMetroPlanningGeoByCityStraightLineTop, summarizeMetroPlanningGeoByCity, summarizeMetroPlanningGeoByConfidence, getMetroPlanningGeoCrossCityByConfidence, getMetroPlanningGeoByConfidence, getMetroPlanningGeoByCityStartEnd, type CurvatureEntry, type CoverageStats, type ManualFallbackRate, type StraightLineTop, type CityMetroPlanningGeoSummary, type ConfidenceLevelSummary } from "../../local/metroPlanningGeoAnalysis";
import {
  getDistributionTopByMedianPrice,
  summarizeDistributionByCity,
  getDistributionByCityDimension,
  getDistributionCrossCityLeaderboard,
  getDistributionShareLeaderboard,
  type CrossCityBucketEntry,
  type CrossCityShareEntry,
  type DistributionRow,
  type CityDistributionSummary
} from "../../local/distributionRanking";
import {
  summarizeListingTagsByCity,
  getCityTagSignature,
  getTagPenetrationCompare,
  type CityTagSummary,
  type TagSignatureEntry,
  type TagPenetration
} from "../../local/listingTagsComparison";
import { getListingKeywordsByCity, getListingKeywordsCrossCity, type ListingKeywordRow } from "../../local/listingKeyword";
import {
  getFeaturePremiumByCityDimension,
  getFeaturePremiumTopByDimension,
  getFeaturePremiumCrossCityLeaderboard,
  getFeaturePremiumByDimensionCoverage,
  summarizeFeaturePremiumByCity,
  type CityPremiumSummary,
  type PremiumDimension
} from "../../local/featurePremiumRanking";
import {
  getTagCombinationPremiumByCity,
  getTagCombinationPopularByCity,
  getTagCombinationCrossCityByTag,
  getTagCombinationCrossCityMostCommon,
  summarizeTagCombinationByCity,
  type TagPairAggregate,
  type TagCombinationByTag,
  type CityTagCombinationSummary
} from "../../local/tagCombinationRanking";
import { type LocalFeaturePremium, type LocalTagCombination, type LocalLayoutDistribution } from "../../local/types";
import { summarizeSchoolDimensionsByCity, getSchoolDimensionByDimensionTopN, getSchoolDimensionPolymath, type CityDimensionSummary, type SchoolDimensionEntry } from "../../local/schoolDimensionRanking";
import { summarizeSchoolIndicators, getSchoolIndicatorDimensionTopN, getSchoolIndicatorTrendTop, type SchoolIndicatorSummary, type SchoolIndicatorRankingEntry, type SchoolIndicatorTrendEntry } from "../../local/schoolIndicatorRanking";

const app = useAppStore();

// v1.121.143 Batch 5: feature_premium (迁移自 dashboard)
const featurePremium = ref<FeaturePremiumResponse | null>(null);
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

// v1.121.143 Batch 5: tag_combination (迁移自 dashboard)
const tagCombination = ref<TagCombinationResponse | null>(null);
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

// v1.121.143 Batch 5: district_meta (迁移自 dashboard)
const districtMeta = ref<DistrictMetaResponse | null>(null);
const districtMetaSortBy = ref<"default" | "price" | "school" | "mom" | "listing">("price");
const districtMetaHideEmpty = ref(false);
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

// v1.121.145 首页卡片个性化管理（设置入口）
const HIDDEN_CARDS_KEY = "realty_dashboard_hidden_cards";
interface DashboardCardEntry { key: string; label: string; }
const DASHBOARD_CARDS: DashboardCardEntry[] = [
  { key: "region-compare", label: "区/板块对比" },
  { key: "district-8w-trend", label: "区级近 8 周价格趋势" },
  { key: "wangqian-rank-4w", label: "近 4 周网签热度榜" },
  { key: "district-wangqian-rank", label: "全品类区级网签热度榜" },
  { key: "district-wangqian-3cat", label: "区级网签 (新房/二手/全部 tab)" },
  { key: "commute-rank", label: "通勤时长榜" },
  { key: "layout-distribution", label: "户型/面积/朝向/装修分布" },
  { key: "listing-tag-cloud", label: "房源 tags 标签云" },
  { key: "district-index", label: "区房价指数" },
  { key: "district-4w-change", label: "区涨幅榜 (4 周累计)" },
  { key: "community-score-rank", label: "小区综合评分榜" },
  { key: "community-score-weights", label: "综合评分权重自定义" },
  { key: "listing-freshness", label: "房源新鲜度" },
  { key: "bedroom-area-heatmap", label: "户型 × 面积 联合热图" },
  { key: "orientation-floor-matrix", label: "朝向 × 楼层 溢价矩阵" },
  { key: "decorate-age-matrix", label: "装修 × 楼龄 溢价矩阵" },
  { key: "community-scatter", label: "社区 总价 × 单价 双轴散点" },
  { key: "district-map", label: "行政区 + 社区 marker 地图" },
  { key: "school-dim-weighted", label: "学区指标加权细分" },
  { key: "macro-lpr", label: "宏观·LPR+房贷利率" },
  { key: "stats70-drift", label: "70 城涨跌 Top" },
  { key: "lpr-mortgage-signal", label: "LPR 与房贷利率信号" },
  { key: "hospital-rank", label: "医疗资源榜" },
  { key: "poi-commercial", label: "周边商业 POI" },
  { key: "life-convenience", label: "生活便利度榜 v2 (6 维)" },
  { key: "school-premium-rank", label: "学区溢价榜" },
  { key: "school-top-community", label: "学区评分 Top 小区" },
  { key: "school-top-filter-sort", label: "学区 Top 过滤 + 排序" },
  { key: "listing-school-premium", label: "listing 学区溢价榜" },
  { key: "commercial-heat", label: "商业热度榜 (小区维度)" },
  { key: "multi-community-compare", label: "同区多小区对比" }
];
const hiddenCards = ref<Set<string>>(new Set());
function loadHiddenCards() {
  try {
    const raw = uni.getStorageSync(HIDDEN_CARDS_KEY);
    if (typeof raw === "string" && raw.length > 0) {
      const arr = JSON.parse(raw) as string[];
      hiddenCards.value = new Set(arr);
    }
  } catch (e) {
    console.warn("data-tools loadHiddenCards failed:", e);
  }
}
function saveHiddenCards() {
  try {
    uni.setStorageSync(HIDDEN_CARDS_KEY, JSON.stringify([...hiddenCards.value]));
  } catch (e) {
    console.warn("data-tools saveHiddenCards failed:", e);
  }
}
function toggleDashboardCard(key: string) {
  const s = new Set(hiddenCards.value);
  if (s.has(key)) s.delete(key);
  else s.add(key);
  hiddenCards.value = s;
  saveHiddenCards();
}
function resetDashboardCards() {
  hiddenCards.value = new Set();
  saveHiddenCards();
}

// v1.121.143 Batch 5: metro_plan (迁移自 dashboard, 简化版)
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
    if (!arr) { arr = []; grouped.set(x.openYearExpected, arr); }
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

const adminSummary = computed<CityAdminDistrictSummary | null>(() => {
  return summarizeAdminDistrictByCity().find((x) => x.cityId === app.cityId) ?? null;
});

// v0.91.0 stats70-drift computed
const stats70Ready = computed(() => store.hasStats70());
const cityDriftSummaries = computed<City12MonthSummary[]>(() => {
  if (!stats70Ready.value) return [];
  return getCityDriftOverLastYear("同比", "second");
});
const driftDistribution = computed<DriftDistribution | null>(() => {
  if (!stats70Ready.value) return null;
  return summarizeCityDrift(cityDriftSummaries.value);
});
const driftReady = computed(() => stats70Ready.value && cityDriftSummaries.value.length > 0);
const driftTop = computed<City12MonthSummary[]>(() => driftDistribution.value?.expanding.slice(0, 3) ?? []);
const driftBottom = computed<City12MonthSummary[]>(() => driftDistribution.value?.contracting.slice(0, 3) ?? []);
const driftLatestLabel = computed(() => {
  const series = cityDriftSummaries.value;
  if (series.length === 0) return "";
  const ld = series[0].latestDate ?? "";
  if (!ld) return "";
  const parts = ld.split("/");
  if (parts.length < 3) return ld;
  return parts[0] + "-" + parts[1].padStart(2, "0");
});
function fmtPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const pct = value * 100;
  return (pct >= 0 ? "" : "") + pct.toFixed(1) + "%";
}
function formatPct(value: number | null): string {
  return fmtPct(value);
}
function goStats70(): void {
  uni.navigateTo({ url: "/pages/stats70/stats70" });
}

// v0.92.0 metro-walk computed
const metroWalkSummary = computed<MetroWalkAccessibility[]>(() => summarizeMetroWalkAccessibility());
const metroWalkTop = computed<MetroWalkRankingItem[]>(() => getMetroWalkRankingTopN(3));
const metroWalkCityTopAll = computed<MetroWalkRankingItem[]>(() => getMetroWalkRankingByCityTopN(app.cityId, 5));
function cityNameForId(id: number): string {
  const c = store.getCityById(id);
  return c?.cityName ?? "city#" + id;
}

// 仅本市模式下清空跨城数组（v1.121.142 Batch 4 跨城派生卡必需）
function crossCityRows<T>(rows: T[]): T[] {
  return rows; // data-tools 始终显示全城数据
}

// v0.93.0 district-trend computed
const district12wChange = computed<DistrictChangeEntry[]>(() =>
  getDistrict12WeekChangeRank(undefined, { minWeeks: 13, strictBase: true })
);
const districtChangeDistribution = computed(() => summarizeChangeDistribution());
const districtMomentumRank = computed<DistrictMomentumEntry[]>(() =>
  getDistrictRecentMomentumRank()
);
const districtDriftTotalWeeks = computed<number>(() => {
  const arr = store.getDistrictTrends();
  if (arr.length === 0) return 0;
  const latest = arr.reduce((acc: string, t) => (t.weekEnd > acc ? t.weekEnd : acc), arr[0]!.weekEnd);
  const earliest = arr.reduce((acc: string, t) => (t.weekEnd < acc ? t.weekEnd : acc), arr[0]!.weekEnd);
  const diff = (Date.parse(latest) - Date.parse(earliest)) / 86400000;
  return Math.max(0, Math.round(diff / 7) + 1);
});
const districtDriftTotalDistricts = computed<number>(() => {
  const set = new Set<string>();
  for (const t of store.getDistrictTrends()) set.add(t.cityId + "|" + t.districtName);
  return set.size;
});
function formatUnitPrice(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  return Math.round(p / 1000) + "k";
}

// v1.121.16 教育事业概览 computed
const eduOverview = computed<EducationOverview | null>(() => {
  const name = store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? "";
  return getEducationOverview(name);
});
const eduHasPrimaryJuniorSplit = computed(() =>
  eduOverview.value ? educationHasPrimaryJuniorSplit(eduOverview.value) : false
);
const hospitalCityName = computed(() => store.getCityById(app.cityId)?.cityName ?? "");
function goSchool(schoolId: number): void {
  uni.navigateTo({ url: "/pages/school/school?schoolId=" + schoolId });
}

// v1.121.141 Batch 3：v0.35.0 + v0.36.0
const metroWalk = ref<MetroWalkResponse | null>(null);
const metroBenefit = ref<MetroBenefitResponse | null>(null);
const metroWalkCityTopByCity = computed<MetroWalkRankingItem[]>(() => getMetroWalkRankingByCityTopN(app.cityId, 5));
function mwBandClass(min: number): string {
  if (min <= 5) return "mw-min-green";
  if (min <= 10) return "mw-min-orange";
  return "mw-min-red";
}
function mbBandClass(score: number): string {
  if (score >= 75) return "mb-tag-green";
  if (score >= 40) return "mb-tag-orange";
  return "mb-tag-red";
}
function goCommunity(id: number): void {
  uni.navigateTo({ url: "/pages/community/community?id=" + id });
}

// v1.121.142 Batch 4：listing_structure + feature_premium + listing_tags + tag_combination
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

// v0.35.0 map-9: 地铁步行通勤 (已在 Batch 3 定义)
// v0.36.0 map-10: 地铁规划受益 (已在 Batch 3 定义)
// v0.39.0 trend-19: 特征画像溢价 (卡 HTML 暂未迁，ref 暂不引入)
// v0.40.0 trend-20: 标签组合热度 (卡 HTML 暂未迁，ref 暂不引入)
// v0.41.0 trend-21: 房源新鲜度 (卡 HTML 暂未迁，ref 暂不引入)
// v0.42.0 trend-22: 户型 × 面积 联合分布 (卡 HTML 暂未迁，ref 暂不引入)
// v0.43.0 trend-23: 朝向 × 楼层 溢价分析 (卡 HTML 暂未迁，ref 暂不引入)
// v0.44.0 trend-24: 装修 × 楼龄 溢价分析 (卡 HTML 暂未迁，ref 暂不引入)
// v0.45.0 trend-25: 总价 × 单价 双轴散点 (卡 HTML 暂未迁，ref 暂不引入)

// v1.121.142 Batch 4: featurePremiumCrossBedrooms 等 core 派生 computed (必须保留)
// 注：featurePremium / tagCombination 等 ref 在 dashboard 仍有引用，data-tools 不再独立握持，仅依赖派生 computed 输出
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

// v0.38.0 区情画像 (ref/函数依赖未迁移，Batch 5 处理)

// v1.121.142 Batch 4：school_indicator + school_dimension
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

// v1.121.142 Batch 4: metroPlan 派生子 computed（已迁 HTML 但 metroPlanSummary 等仍需）
// 暂不接 metro_plan 卡本体（Batch 5）

onMounted(async () => {
  loadHiddenCards();
  try {
    metroWalk.value = await getMetroWalkRanking({ cityId: app.cityId, topN: 10 });
  } catch (e) {
    console.warn("data-tools metro walk failed:", e);
  }
  try {
    metroBenefit.value = await getMetroBenefitRanking({ cityId: app.cityId, topN: 10 });
  } catch (e) {
    console.warn("data-tools metro benefit failed:", e);
  }
  await reloadFeaturePremium();
  await reloadTagCombination();
  await reloadDistrictMeta();
});
</script>

<style lang="scss" scoped>
.page-header {
  padding: 24rpx 24rpx 16rpx;
}
.dt-card-list {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.dt-card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10rpx 14rpx;
  background: var(--color-panel, #fafafa);
  border-radius: 8rpx;
}
.dt-card-info {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  min-width: 0;
}
.dt-card-name {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--color-text);
}
.dt-card-toggle {
  flex: 0 0 auto;
  margin: 0;
  border-radius: 999px !important;
  background: var(--color-primary, #4f46e5) !important;
  color: #fff !important;
  font-size: 22rpx;
  padding: 0 22rpx;
}
.dt-card-toggle--off {
  background: var(--color-muted, #888) !important;
}
.dt-card-actions {
  margin-top: 16rpx;
  display: flex;
  justify-content: flex-end;
}
.dt-card-action {
  margin: 0;
  font-size: 22rpx;
}
.page-header-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #111;
}
.page-header-sub {
  font-size: 22rpx;
  margin-top: 4rpx;
}
.edu-summary {
  display: flex;
  gap: 16rpx;
  margin-top: 12rpx;
}
.edu-kpi {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8rpx 12rpx;
  background: var(--color-panel, #f5f5f5);
  border-radius: 8rpx;
  min-width: 100rpx;
}
.edu-kpi-val {
  font-size: 28rpx;
  font-weight: 600;
  color: #111;
}
.edu-kpi-label {
  font-size: 18rpx;
}
.edu-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}
.edu-chip {
  font-size: 22rpx;
  padding: 4rpx 10rpx;
  background: var(--color-panel, #f5f5f5);
  border-radius: 6rpx;
  color: #444;
}
</style>
