<template>
  <view class="page">
    <view class="container">
      <view class="card school-hero">
        <view class="hero-eyebrow">EDUCATION SEARCH</view>
        <view class="card-title" style="margin-bottom: 0">学校查询</view>
        <view class="muted">从学校名称开始查询，结果会标注官方逐校来源或整理样本。</view>
      </view>

      <view v-if="educationOverview" class="card" data-education-overview>
        <view class="card-title">官方教育事业统计 · {{ educationCityLabel }}</view>
        <view class="muted">{{ formatEducationPeriodLabel(educationOverview) }} · {{ educationOverview.sourceOrg }} · {{ educationOverview.publishDate }}</view>
        <view class="edu-grid">
          <view class="edu-cell"><text class="muted">学校总数</text><text>{{ educationOverview.totalSchools.toLocaleString() }}</text></view>
          <view class="edu-cell">
            <text class="muted">在校学生</text>
            <text>{{ educationOverview.totalStudents10k > 0 ? educationOverview.totalStudents10k + " 万" : "—" }}</text>
          </view>
          <view class="edu-cell">
            <text class="muted">{{ educationHasSplit ? "义务教育" : "普通中小学" }}</text>
            <text>{{ educationOverview.compulsoryCount.toLocaleString() }}</text>
          </view>
          <view v-if="educationHasSplit" class="edu-cell">
            <text class="muted">小学/初中</text>
            <text>{{ educationOverview.primaryCount }}/{{ educationOverview.juniorHighCount }}</text>
          </view>
          <view v-if="educationOverview.kindergartenCount > 0" class="edu-cell">
            <text class="muted">幼儿园</text>
            <text>{{ educationOverview.kindergartenCount.toLocaleString() }}</text>
          </view>
        </view>
        <view v-if="educationOverview.city === '珠海'" class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          基础教育学校数官方表；在校生未公布不伪造。期间为学年，非自然年。
        </view>
        <view v-else-if="!educationHasSplit" class="muted" style="margin-top: 8rpx; font-size: 22rpx">
          官方口径为「普通中小学」合计，不伪造小学/初中分项。
        </view>
      </view>

      <!-- v0.97.0 重点学校维度细分 (派生：基于 school_dimensions.csv) -->
      <view
        v-if="dimCitySummary.length > 0"
        class="card"
        data-school-dimensions
      >
        <view class="row-between">
          <view class="card-title" style="margin-bottom: 0">🏫 重点学校维度细分</view>
          <view class="muted" style="font-size: 22rpx">
            {{ dimCitySummary.reduce((s, c) => s + c.schoolCount, 0) }} 所重点校 ·
            {{ dimCitySummary.length }} 个城市
          </view>
        </view>
        <view
          v-if="dimPolymathList.length > 0"
          style="margin-top: 14rpx"
        >
          <view class="muted" style="font-size: 22rpx; margin-bottom: 6rpx">
            🛡️ 全维度学校
            <text class="muted" style="font-size: 20rpx">
              （综合≥80 / 集团实力≥70 / 区均衡度≥70）
            </text>
          </view>
          <view
            v-for="(row, i) in dimPolymathList.slice(0, 4)"
            :key="'poly' + row.schoolId"
            class="drift-row"
          >
            <text class="drift-rank">{{ i + 1 }}</text>
            <text class="drift-city">
              {{ row.schoolName }}
              <text class="muted" style="font-size: 18rpx">
                ({{ row.cityName }}·{{ row.districtName }}·{{ row.schoolType }})
              </text>
            </text>
            <text class="drift-value drift-up">{{ row.score.toFixed(1) }}</text>
          </view>
        </view>

        <view
          v-if="dimTopLevel.length > 0 || dimTopGroup.length > 0 || dimTopBalance.length > 0"
          style="margin-top: 14rpx"
        >
          <view class="muted" style="font-size: 22rpx; margin-bottom: 6rpx">
            三维度 Top 1（每城市当前）
          </view>
          <view class="stats70-grid">
            <view class="stats70-cell">
              <text class="cell-label">综合排名分</text>
              <text class="cell-value">
                {{ dimTopLevel[0]?.schoolName ?? "-" }}
              </text>
              <text class="cell-sub muted">
                {{ dimTopLevel[0]?.score?.toFixed(1) ?? "-" }} 分
              </text>
            </view>
            <view class="stats70-cell">
              <text class="cell-label">集团校实力</text>
              <text class="cell-value">
                {{ dimTopGroup[0]?.schoolName ?? "-" }}
              </text>
              <text class="cell-sub muted">
                {{ dimTopGroup[0]?.score?.toFixed(1) ?? "-" }} 分
              </text>
            </view>
            <view class="stats70-cell">
              <text class="cell-label">区均衡度</text>
              <text class="cell-value">
                {{ dimTopBalance[0]?.schoolName ?? "-" }}
              </text>
              <text class="cell-sub muted">
                {{ dimTopBalance[0]?.score?.toFixed(1) ?? "-" }} 分
              </text>
            </view>
          </view>
        </view>

        <view
          v-if="cityByComposite.length > 0"
          style="margin-top: 14rpx"
        >
          <view class="muted" style="font-size: 22rpx; margin-bottom: 6rpx">
            各市综合得分最强
          </view>
          <view
            v-for="(row, i) in cityByComposite"
            :key="'ctc' + row.cityId"
            class="drift-row"
          >
            <text class="drift-rank">{{ i + 1 }}</text>
            <text class="drift-city">
              {{ row.cityName }} · {{ row.topSchool?.schoolName ?? "-" }}
            </text>
            <text class="drift-value drift-up">
              {{ row.topSchool?.score?.toFixed(1) ?? "-" }}
            </text>
          </view>
        </view>
        <view class="muted" style="font-size: 20rpx; margin-top: 8rpx">
          派生：snapshot.schoolDimensions（仅重点学校子集）。
          "六边形战士" 同时满足综合≥80 / 集团实力≥70 / 区均衡度≥70。
        </view>
      </view>

      <view class="card">
        <view class="form-grid">
          <view class="form-item">
            <text class="form-label">城市</text>
            <picker mode="selector" :range="cityLabels" :value="cityIndex" @change="onCityChange">
              <view class="picker-value">{{ currentCityLabel }}</view>
            </picker>
          </view>
          <view class="form-item search-input">
            <input
              class="input"
              type="text"
              v-model="keyword"
              placeholder="输入学校名关键字"
              @confirm="search"
            />
            <button class="btn" size="mini" @click="search">搜索</button>
          </view>
        </view>
      </view>

      <view v-if="errorMsg" class="error">{{ errorMsg }}</view>

      <view class="card">
        <view class="row-between">
          <view class="card-title">结果</view>
          <view class="muted result-count" v-if="results">共 {{ results.length }} 所</view>
        </view>
        <view v-if="!results || results.length === 0" class="empty search-empty">
          <text class="search-empty-icon">{{ keyword ? "⌕" : "🏫" }}</text>
          <text class="search-empty-title">{{ keyword ? "无匹配学校" : "从学校名称开始查询" }}</text>
          <text class="muted">{{ keyword ? "可尝试缩短关键字或切换城市" : "例如：实验、外国语、第一中学" }}</text>
        </view>
        <view
          v-for="s in results"
          :key="s.school_id"
          class="school-row tap-target"
          role="button"
          tabindex="0"
          hover-class="row-active"
          @click="openSchool(s.school_id)"
        >
          <view class="school-main">
            <view class="school-name">{{ s.display_name || s.official_name }}</view>
            <view class="muted">
              类型：{{ s.school_type || "-" }}
              <text v-if="s.province_key_flag" class="tag tag-success">省重点</text>
              <text v-if="s.city_key_flag" class="tag tag-warn">市重点</text>
              <text v-if="'source_kind' in s" :class="schoolSourceLabel(s).cls">
                {{ schoolSourceLabel(s).text }}
              </text>
            </view>
          </view>
          <view class="muted">→</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { SNAPSHOT_UPDATED_EVENT } from "../../config";
import { onShow } from "@dcloudio/uni-app";
import { getCities, searchSchools } from "../../local/queries";
import { takePendingSchoolQuery } from "../../local/homeEntry";
import type { CityItem, SchoolItem } from "../../api/contracts";
import { toErrorMessage } from "../../utils/errorMessage";
import { useAppStore } from "../../store/app";
import { showToast } from "../../utils/format";
import {
  getEducationOverview,
  educationHasPrimaryJuniorSplit,
  formatEducationPeriodLabel
} from "../../local/educationOverview";
import * as store from "../../local/store";
import {
  summarizeSchoolDimensionsByCity,
  getSchoolDimensionByDimensionTopN,
  getSchoolDimensionPolymath,
  getCityByCompositeRank,
  type CityDimensionSummary,
  type SchoolDimensionEntry,
  type CityTopComposite
} from "../../local/schoolDimensionRanking";

const app = useAppStore();
const cities = ref<CityItem[]>([]);
const keyword = ref("");
const results = ref<SchoolItem[] | null>(null);
const errorMsg = ref("");
const metaReady = ref(false);

onShow(async () => {
  const pending = takePendingSchoolQuery();
  if (!pending) return;
  keyword.value = pending;
  if (!metaReady.value) return;
  await search();
});

onMounted(async () => {
  uni.$on(SNAPSHOT_UPDATED_EVENT, loadCities);
  await loadCities();
  metaReady.value = true;
  if (keyword.value.trim()) {
    await search();
  }
});

onUnmounted(() => {
  uni.$off(SNAPSHOT_UPDATED_EVENT, loadCities);
});

const cityLabels = computed(() => cities.value.map((c) => c.city_name));
const cityIndex = computed(() => cities.value.findIndex((c) => c.city_id === app.cityId));
const currentCityLabel = computed(() => {
  const c = cities.value.find((c) => c.city_id === app.cityId);
  return c?.city_name || store.getCityById(app.cityId)?.cityName || "";
});
/** 教育概览必须走同步 store，不能等异步 getCities，否则首屏无卡 */
const educationCityLabel = computed(
  () => store.getCityById(app.cityId)?.cityName?.replace(/市$/, "") ?? ""
);
const educationOverview = computed(() => getEducationOverview(educationCityLabel.value));
const educationHasSplit = computed(() =>
  educationOverview.value ? educationHasPrimaryJuniorSplit(educationOverview.value) : false
);

// v0.97.0：重点学校维度细分
const dimCitySummary = computed<CityDimensionSummary[]>(() =>
  summarizeSchoolDimensionsByCity()
);
const dimPolymathList = computed<SchoolDimensionEntry[]>(() =>
  getSchoolDimensionPolymath(undefined, {})
);
const dimTopLevel = computed<SchoolDimensionEntry[]>(() =>
  getSchoolDimensionByDimensionTopN("levelScore", app.cityId, 1)
);
const dimTopGroup = computed<SchoolDimensionEntry[]>(() =>
  getSchoolDimensionByDimensionTopN("groupStrength", app.cityId, 1)
);
const dimTopBalance = computed<SchoolDimensionEntry[]>(() =>
  getSchoolDimensionByDimensionTopN("districtBalance", app.cityId, 1)
);
const cityByComposite = computed<CityTopComposite[]>(() =>
  getCityByCompositeRank()
);

function onCityChange(e: { detail: { value: string } }) {
  const c = cities.value[Number(e.detail.value)];
  if (c) {
    app.setCityId(c.city_id);
    if (keyword.value) void search();
  }
}

async function search() {
  if (!app.cityId) {
    showToast("请先选择城市");
    return;
  }
  const q = keyword.value.trim();
  if (!q) {
    showToast("请输入关键字");
    return;
  }
  errorMsg.value = "";
  try {
    const res = await searchSchools({ cityId: app.cityId, q });
    results.value = res.items || [];
  } catch (e) {
    errorMsg.value = toErrorMessage(e);
    results.value = null;
  }
}

function schoolSourceLabel(s: SchoolItem) {
  const kind = (s as SchoolItem & { source_kind?: string }).source_kind;
  if (kind === "OFFICIAL") return { text: "官方逐校来源", cls: "tag tag-success" };
  return { text: "整理样本", cls: "tag tag-source-curated" };
}

function openSchool(id: number) {
  uni.navigateTo({
    url: `/pages/school-detail/school-detail?id=${id}`,
    fail: (e) => showToast(`打开学校详情失败：${toErrorMessage(e)}`)
  });
}

async function loadCities() {
  const res = await getCities();
  cities.value = res.items || [];
  if (cities.value.length > 0 && !cities.value.some((c) => c.city_id === app.cityId)) {
    app.setCityId(cities.value[0].city_id);
  }
}
</script>

<style lang="scss" scoped>
.school-hero {
  background: var(--color-surface);
  border-color: var(--color-border);
}

.hero-eyebrow {
  color: var(--color-primary);
  font-size: 19rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
  margin-bottom: 8rpx;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.search-input {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 8rpx;
}

.form-label {
  color: var(--color-muted);
  font-size: 24rpx;
}

.picker-value,
.input {
  background: var(--color-surface-raised);
  border-radius: 8rpx;
  padding: 12rpx 16rpx;
  color: var(--color-heading);
  font-size: 26rpx;
}

.edu-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 16rpx;
}

.edu-cell {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  padding: 12rpx;
  border-radius: 12rpx;
  background: var(--color-surface-raised);
}

.search-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 48rpx 16rpx;
}

.search-empty-icon {
  font-size: 48rpx;
}

.search-empty-title {
  font-size: 30rpx;
  font-weight: 600;
}

.school-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--color-border);
}

.school-name {
  font-size: 28rpx;
  font-weight: 600;
}

.tag-source-curated {
  background: rgba(148, 163, 184, 0.18);
  color: #cbd5e1;
}
</style>
