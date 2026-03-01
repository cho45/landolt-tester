<template>
  <div class="container text-center setup-view">
    <div class="lang-selector">
      <select v-model="$i18n.locale" @change="saveLanguage($event)" class="custom-select">
        <option value="ja">日本語</option>
        <option value="en">English</option>
      </select>
    </div>

    <h1>{{ $t('setup.title') }}</h1>
    <p>{{ $t('setup.distanceDesc') }}</p>

    <div class="settings-box mt-4">
      <div class="setting-row">
        <label for="distance">{{ $t('setup.distanceLabel') }}:</label>
        <div class="distance-input">
          <button class="btn btn-sm" @click="distanceM = Math.max(0.5, distanceM - 0.5)">-</button>
          <span class="value">{{ distanceM.toFixed(1) }}m</span>
          <button class="btn btn-sm" @click="distanceM = Math.min(5.0, distanceM + 0.5)">+</button>
        </div>
      </div>
      <div class="setting-row limit-row mt-4" v-if="maxLimit > 0">
        <label>{{ $t('setup.maxLimitDesc') }}:</label>
        <span class="limit-value">{{ maxLimit.toFixed(1) }}</span>
      </div>
    </div>

    <div class="info-box mt-4">
      <h4>{{ $t('result.disclaimerTitle') }}</h4>
      <p class="disclaimer-text">{{ $t('result.disclaimerDetails') }}</p>
    </div>

    <div class="actions mt-4 action-group">
      <button class="btn" @click="goToCalibration">{{ $t('setup.recalibrate') }}</button>
      <button class="btn btn-primary" @click="saveAndStart">{{ $t('setup.startTest') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { calculateMaxMeasurableAcuity, getMaxTestableAcuity } from '../lib/landolt'
import { ppi, distanceM, appLang, isConfigured, isCalibrated } from '../lib/store'

const emit = defineEmits(['next', 'calibrate'])

const maxLimit = computed(() => {
  const dpr = window.devicePixelRatio || 1
  const rawMax = calculateMaxMeasurableAcuity(ppi.value, dpr, distanceM.value)
  return getMaxTestableAcuity(rawMax)
})

const saveAndStart = () => {
  isConfigured.value = true
  emit('next')
}

const goToCalibration = () => {
  isCalibrated.value = false
  isConfigured.value = false
  emit('calibrate')
}

const saveLanguage = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  appLang.value = target.value
}
</script>

<style scoped>
.setup-view {
  padding-top: 1rem;
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.lang-selector {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  margin-bottom: 0.5rem;
}

.custom-select {
  padding: 0.5rem;
  font-size: 1rem;
  border-radius: 0.5rem;
  background-color: var(--card-bg);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.settings-box {
  background-color: var(--card-bg);
  padding: 1.5rem;
  border-radius: 1rem;
  border: 1px solid var(--border-color);
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.distance-input {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.limit-row {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--border-color);
  font-size: 0.9rem;
  color: #64748b;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
}

.limit-value {
  font-weight: bold;
  color: var(--accent-color);
  background: #f1f5f9;
  padding: 0.2rem 0.6rem;
  border-radius: 0.5rem;
}

.action-group {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-weight: bold;
}

.value {
  font-size: 1.5rem;
  font-weight: bold;
  min-width: 60px;
}

.info-box {
  padding: 1rem;
  background-color: #f1f5f9;
  border-left: 4px solid var(--accent-color);
  border-radius: 0 0.5rem 0.5rem 0;
  text-align: left;
}

.info-box h4 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
  color: var(--text-color);
}

.disclaimer-text {
  font-size: 0.85rem;
  color: #475569;
  line-height: 1.5;
  margin: 0;
}

.mt-4 {
  margin-top: 1.5rem;
}
</style>
