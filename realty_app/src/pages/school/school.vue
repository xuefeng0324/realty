<template>
  <view class="page">
    <view class="container">
      <view class="card">
        <view class="card-title">学校查询</view>

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
          <view class="muted" v-if="results">共 {{ results.length }} 所</view>
        </view>
        <view v-if="!results || results.length === 0" class="empty">
          {{ keyword ? "无匹配学校" : "请输入关键字搜索" }}
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
            </view>
          </view>
          <view class="muted">→</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getCities } from "../../local/queries";
import { searchSchools } from "../../local/queries";
import type { CityItem, SchoolItem } from "../../api/contracts";
import { toErrorMessage } from "../../utils/errorMessage";
import { useAppStore } from "../../store/app";
import { showToast } from "../../utils/format";

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

function onCityChange(e: any) {
  const c = cities.value[Number(e.detail.value)];
  if (c) {
    app.setCityId(c.city_id);
    if (keyword.value) search();
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

function openSchool(id: number) {
  uni.showModal({
    title: "学校详情",
    content: `school_id = ${id}。手机端未单独做学校详情页，可调用 /api/v1/schools/{id}/future-score 获取未来趋势分。`,
    showCancel: false
  });
}

onMounted(async () => {
  const res = await getCities();
  cities.value = res.items || [];
  if (cities.value.length > 0 && !cities.value.some((c) => c.city_id === app.cityId)) {
    app.setCityId(cities.value[0].city_id);
  }
});
</script>

<style lang="scss" scoped>
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

.picker-value {
  background: #1e293b;
  border-radius: 8rpx;
  padding: 12rpx 16rpx;
  color: #f3f4f6;
  font-size: 26rpx;
}

.input {
  flex: 1;
  background: #1e293b;
  border-radius: 8rpx;
  padding: 12rpx 16rpx;
  color: #f3f4f6;
  font-size: 26rpx;
}

.school-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #1f2937;
}

.school-row:last-child {
  border-bottom: none;
}

.school-main {
  flex: 1;
}

.school-name {
  font-size: 28rpx;
  color: #f3f4f6;
  margin-bottom: 4rpx;
}
</style>