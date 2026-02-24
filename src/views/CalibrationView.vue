<template>
  <div class="container text-center calibration-view">
    <div class="lang-selector">
      <select v-model="$i18n.locale" @change="saveLanguage($event)" class="custom-select">
        <option value="ja">日本語</option>
        <option value="en">English</option>
      </select>
    </div>

    <h1>{{ $t('calibration.title') }}</h1>
    <p>{{ $t('calibration.description') }}</p>
    
    <div class="reference-selection mt-4">
      <label>{{ $t('calibration.referenceObject') }}:</label>
      <select v-model="selectedReference" class="custom-select">
        <option value="1yen">{{ $t('calibration.coin') }}</option>
        <option value="card">{{ $t('calibration.card') }}</option>
      </select>
    </div>

    <div class="calibration-interactive mt-4">
      <p class="instruction">{{ $t('calibration.adjustSlider') }}</p>
      
      <div class="interactive-area">
        <div 
          v-if="selectedReference === '1yen'"
          class="reference-shape shape-circle" 
          :style="{ width: shapeWidthPx + 'px', height: shapeHeightPx + 'px' }"
        >
          <span class="shape-label">{{ shapeWidthMm }}mm</span>
        </div>
        <div 
          v-else
          class="reference-shape shape-rect" 
          :style="{ height: shapeHeightPx + 'px' }"
        >
          <span class="shape-label">↕ {{ shapeHeightMm }}mm</span>
        </div>
      </div>

      <div class="slider-container mt-4">
        <input 
          type="range" 
          min="50" 
          max="300" 
          v-model.number="pixelsPerInch" 
          class="slider"
        >
        <p class="dpi-readout">Estimated: {{ pixelsPerInch }} PPI</p>
      </div>
    </div>

    <div class="actions mt-4">
      <button class="btn btn-primary" @click="saveAndNext">{{ $t('calibration.nextButton') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const emit = defineEmits(['next'])

const selectedReference = ref<'1yen' | 'card'>('1yen')

// We start with a guess based on window.devicePixelRatio or standard 150ppi
const pixelsPerInch = ref<number>(150)

onMounted(() => {
  // If already calibrated, use the saved value
  const savedPpi = localStorage.getItem('vision_app_ppi')
  if (savedPpi) {
    pixelsPerInch.value = parseFloat(savedPpi)
  } else {
    // Otherwise try to make an initial guess based on Dpr
    const basePpi = window.devicePixelRatio > 1 ? window.devicePixelRatio * 96 : 150
    pixelsPerInch.value = Math.round(basePpi)
  }
})

const saveLanguage = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  localStorage.setItem('vision_app_lang', target.value)
}

const getPixelsFromMm = (mm: number, ppi: number) => {
  const inches = mm / 25.4
  return inches * ppi
}

const shapeWidthMm = computed(() => 20) // Only used for 1yen now
const shapeHeightMm = computed(() => selectedReference.value === '1yen' ? 20 : 53.98)

const shapeWidthPx = computed(() => getPixelsFromMm(shapeWidthMm.value, pixelsPerInch.value))
const shapeHeightPx = computed(() => getPixelsFromMm(shapeHeightMm.value, pixelsPerInch.value))

const saveAndNext = () => {
  // Save PPI to local storage or global state here for the actual test to use
  localStorage.setItem('vision_app_ppi', pixelsPerInch.value.toString())
  emit('next')
}
</script>

<style scoped>
.calibration-view {
  padding-top: 1rem;
  padding-bottom: 2rem;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  overflow-y: auto;
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
  margin-left: 0.5rem;
}

.calibration-interactive {
  margin-left: -1rem;
  margin-right: -1rem;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.instruction {
  font-size: 0.9rem;
  color: #a0a0a0;
  margin-bottom: 1rem;
  padding: 0 1rem;
}

.interactive-area {
  width: 100%;
  flex-grow: 1;
  min-height: 40vh;
  background-color: var(--card-bg);
  border-top: 1px dashed var(--border-color);
  border-bottom: 1px dashed var(--border-color);
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  padding: 1rem 0;
}

.reference-shape {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--accent-color);
  box-shadow: 0 4px 6px rgba(0,0,0,0.3);
  flex-shrink: 0;
}

.shape-circle {
  margin: 0 auto;
  border-radius: 50%;
}

.shape-rect {
  margin-left: 50%;
  width: 50%;
  border-radius: 12px 0 0 12px;
  background: linear-gradient(90deg, var(--accent-color) 40%, rgba(2, 132, 199, 0) 100%);
}

.shape-label {
  color: white;
  font-weight: 600;
  font-size: 0.8rem;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  pointer-events: none;
}

.slider-container {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
}

.slider {
  width: 100%;
  appearance: none;
  background: var(--card-bg);
  height: 8px;
  border-radius: 4px;
  outline: none;
  border: 1px solid var(--border-color);
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent-color);
  cursor: pointer;
}

.dpi-readout {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #888;
}

.mt-4 {
  margin-top: 1.5rem;
}
</style>
