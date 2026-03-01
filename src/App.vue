<script setup lang="ts">
import { ref, onMounted } from 'vue'
import CalibrationView from './views/CalibrationView.vue'
import SetupView from './views/SetupView.vue'
import TestView from './views/TestView.vue'
import ResultView from './views/ResultView.vue'
import { isCalibrated, isConfigured } from './lib/store'

type ViewState = 'calibration' | 'setup' | 'test' | 'result'
const currentView = ref<ViewState>('calibration')

onMounted(() => {
  if (isConfigured.value) {
    // Setup and Calibration done, skip directly to test
    currentView.value = 'test'
  } else if (isCalibrated.value) {
    // Calibration done but not setup, skip to setup
    currentView.value = 'setup'
  }
})

const navigateTo = (view: ViewState | string) => {
  if (['calibration', 'setup', 'test', 'result'].includes(view as string)) {
    currentView.value = view as ViewState;
  } else {
    currentView.value = 'calibration';
  }
}
</script>

<template>
  <div class="app-background">
    <div class="app-content">
      <Transition name="fade" mode="out-in">
        <CalibrationView 
          v-if="currentView === 'calibration'" 
          @next="navigateTo('setup')" 
        />
        <SetupView 
          v-else-if="currentView === 'setup'" 
          @next="navigateTo('test')" 
          @calibrate="navigateTo('calibration')"
        />
        <TestView 
          v-else-if="currentView === 'test'" 
          @next="navigateTo('result')" 
          @cancel="navigateTo('result')"
          @settings="navigateTo('setup')"
        />
        <ResultView 
          v-else-if="currentView === 'result'" 
          @retry="(view) => navigateTo(view || 'calibration')" 
        />
      </Transition>
    </div>
  </div>
</template>

<style>
/* Global App Polish / Clinical Minimal Aesthetics */

:root {
  --bg-color: #f8fafc;
  --text-color: #0f172a;
  --accent-color: #0284c7; /* Clinical strong blue */
  --accent-hover: #0369a1;
  --card-bg: #ffffff;
  --border-color: #e2e8f0;
  --error-color: #ef4444;
  --success-color: #10b981;
}

body {
  background-color: var(--bg-color);
  color: var(--text-color);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  margin: 0;
  padding: 0;
}

.app-background {
  position: relative;
  width: 100vw;
  min-height: 100vh;
  background-color: var(--bg-color);
}

.app-content {
  position: relative;
  z-index: 10;
  width: 100%;
  min-height: 100%;
}

/* Clear containers */
.container > *:not(.actions) {
  position: relative;
  z-index: 2;
}

h1 {
  color: var(--text-color);
  font-weight: 700;
  margin-bottom: 1rem;
}

h2 {
  color: #334155;
}

.card-panel {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 2.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
}

.btn {
  padding: 0.75rem 1.5rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
}

.btn:hover {
  background: #e2e8f0;
}

.btn-primary {
  background: var(--accent-color);
  border: 1px solid var(--accent-hover);
  color: white;
  box-shadow: 0 1px 3px rgba(2, 132, 199, 0.3);
}

.btn-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(2, 132, 199, 0.3);
}
</style>
