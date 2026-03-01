<template>
  <div class="container text-center result-view">
    <div class="lang-selector">
      <select v-model="$i18n.locale" @change="saveLanguage($event)" class="custom-select">
        <option value="ja">日本語</option>
        <option value="en">English</option>
      </select>
    </div>

    <h1>{{ $t('result.title') }}</h1>
    <p>{{ $t('result.estimatedAcuity') }}</p>
    
    <div class="score-card mt-4">
      <h2 class="score">{{ finalResult.toFixed(1) }}</h2>
      <div v-if="isAtDeviceLimit" class="limit-badge mt-2">
        <span class="badge-warning">ⓘ {{ $t('result.deviceLimit') }}</span>
      </div>
    </div>

    <div class="info mt-4" v-if="distanceM < 5.0">
      <div class="disclaimer-alert">
        <strong>⚠️ {{ $t('result.disclaimerTitle') }}</strong>
        <p>{{ $t('result.disclaimerDetails') }}</p>
      </div>
    </div>

    <div class="history-section mt-4" v-if="testHistory.length > 0">
      <h3>{{ $t('result.historyTitle') }}</h3>
      <div class="table-container">
        <table class="history-table">
          <thead>
            <tr>
              <th>{{ $t('result.colAcuity') }}</th>
              <th>{{ $t('result.colDir') }}</th>
              <th>{{ $t('result.colInput') }}</th>
              <th>{{ $t('result.colResult') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(record, idx) in testHistory" :key="idx" :class="{ 'correct-row': record.isCorrect, 'incorrect-row': !record.isCorrect }">
              <td>{{ record.acuity.toFixed(1) }}</td>
              <td>{{ getDirectionLabel(record.targetDirection) }}</td>
              <td>{{ getDirectionLabel(record.inputDirection) }}</td>
              <td class="status-cell">
                <span class="status-badge" :class="record.isCorrect ? 'badge-success' : 'badge-error'">
                  {{ record.isCorrect ? $t('result.correct') : $t('result.incorrect') }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="actions mt-4 action-group">
      <button class="btn" @click="$emit('retry')">{{ $t('result.restartSetup') }}</button>
      <button class="btn btn-primary" @click="testAgainDirect">{{ $t('result.testAgain') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { finalResult, testHistory, maxLimit, distanceM, appLang } from '../lib/store'
import { ALL_ACUITY_LEVELS } from '../lib/landolt'

const { t } = useI18n()
const emit = defineEmits(['retry', 'next'])

const isAtDeviceLimit = computed(() => {
  const absoluteMax = ALL_ACUITY_LEVELS[ALL_ACUITY_LEVELS.length - 1]!
  return finalResult.value >= maxLimit.value && maxLimit.value < absoluteMax
})

const getDirectionLabel = (dir: number) => {
  if (dir === 0) return t('test.gestureRight')
  if (dir === 2) return t('test.gestureDown')
  if (dir === 4) return t('test.gestureLeft')
  if (dir === 6) return t('test.gestureUp')
  return '?'
}

const saveLanguage = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  appLang.value = target.value
}

const testAgainDirect = () => {
  emit('retry', 'test') 
}
</script>

<style scoped>
.result-view {
  padding-top: 1rem;
  padding-bottom: 4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
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

.score-card {
  background: white;
  padding: 2rem 4rem;
  border-radius: 1rem;
  border: 2px solid var(--accent-color);
  box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.1);
}

.score {
  font-size: 5rem;
  color: var(--accent-color);
  margin: 0;
  font-weight: 800;
}

.limit-badge {
  font-size: 0.9rem;
  color: #b45309;
}

.badge-warning {
  background: #fef3c7;
  padding: 0.3rem 0.6rem;
  border-radius: 999px;
  font-weight: bold;
}

.info {
  width: 100%;
  max-width: 600px;
}

.disclaimer-alert {
  background-color: #fffbeb;
  border-left: 4px solid #f59e0b;
  padding: 1rem;
  border-radius: 0.5rem;
  text-align: left;
  color: #92400e;
  font-size: 0.85rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.disclaimer-alert strong {
  display: block;
  margin-bottom: 0.5rem;
  color: #b45309;
}

.disclaimer-alert p {
  margin: 0;
  line-height: 1.5;
}

.action-group {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

/* History Table Styles */
.history-section {
  width: 100%;
  max-width: 600px;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.history-section h3 {
  margin-top: 0;
  color: #334155;
  font-size: 1.25rem;
}

.table-container {
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.95rem;
}

.history-table th {
  position: sticky;
  top: 0;
  background: #f8fafc;
  padding: 0.75rem 1rem;
  border-bottom: 2px solid var(--border-color);
  color: #475569;
  font-weight: 600;
}

.history-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  color: #334155;
}

.correct-row td {
  background-color: #f0fdf4;
}

.incorrect-row td {
  background-color: #fef2f2;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
}

.badge-success {
  background: #dcfce7;
  color: #166534;
}

.badge-error {
  background: #fee2e2;
  color: #991b1b;
}

.mt-4 {
  margin-top: 1.5rem;
}
</style>
