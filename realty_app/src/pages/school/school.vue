<template>
  <view class="page">
    <view class="container">
      <view class="card school-hero">
        <view class="hero-eyebrow">EDUCATION SEARCH</view>
        <view class="card-title" style="margin-bottom: 0">学校查询</view>
        <view class="muted">从学校名称开始查询，结果会标注官方逐校来源或整理样本。</view>
      </view>

      <view v-if="educationOverview" class="card" data-education-overview>
        <view class="card-title">官方教育事业统计 · {{ currentCityLabel }}</view>
        <view class="muted">{{ educationOverview.period }} 年 · {{ educationOverview.sourceOrg }} · {{ educationOverview.publishDate }}</view>
        <view class="edu-grid">
          <view class="edu-cell"><text class="muted">学校总数</text><text>{{ educationOverview.totalSchools.toLocaleString() }}</text></view>
          <view class="edu-cell"><text class="muted">在校学生</text><text>{{ educationOverview.totalStudents10k }} 万</text></view>
          <view class="edu-cell"><text class="muted">义务教育</text><text>{{ educationOverview.compulsoryCount.toLocaleString() }}</text></view>
          <view class="edu-cell"><text class="muted">小学/初中</text><text>{{ educationOverview.primaryCount }}/{{ educationOverview.juniorHighCount }}</text></view>
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
import { getCities, searchSchools } from "../../local/queries";
import type { CityItem, SchoolItem } from "../../api/contracts";
import { toErrorMessage } from "../../utils/errorMessage";
import { useAppStore } from "../../store/app";
import { showToast } from "../../utils/format";
import { getEducationOverview } from "../../local/educationOverview";

const app = useAppStore();
const cities = ref<CityItem[]>([]);
const keyword = ref("");
const results = ref<SchoolItem[] | null>(null);
const errorMsg = ref("");

const cityLabels = computed(() => cities.value.map((c) => c.city_name));
const cityIndex = computed(() => cities.value.findIndex((c) => c.city_id === app.cityId));
const currentCityLabel = computed(() => {
  const c = cities.value.find((c) => c.city_id === app.cityId);
  return c?.city_name || "";
});
const educationOverview = computed(() => getEducationOverview(currentCityLabel.value.replace(/市$/, "")));

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

onMounted(async () => {
  uni.$on(SNAPSHOT_UPDATED_EVENT, loadCities);
  await loadCities();
});

onUnmounted(() => {
  uni.$off(SNAPSHOT_UPDATED_EVENT, loadCities);
});
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
  color: #94a3b8;
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
