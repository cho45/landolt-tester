<template>
  <div class="test-view">
    <div class="camera-preview" v-show="isCameraActive">
      <video ref="videoEl" autoplay playsinline muted></video>
      <div class="gesture-badge">
          {{ lastGesture }} <br/>
          <span style="font-size:0.7em; color:yellow;">Conf: {{ debugScore.toFixed(2) }}</span>
      </div>
    </div>

    <!-- Overlay for instructions/feedback -->
    <Transition name="fade">
      <div v-if="feedback" class="feedback-overlay" :class="feedbackType">
        {{ feedback }}
      </div>
    </Transition>

    <div class="header">
      <div class="header-left">
        <span class="acuity-level">{{ $t('test.target') }}: {{ targetAcuity.toFixed(1) }}</span>
        <span class="limit-info">(Limit: {{ maxAcuityLimit.toFixed(1) }})</span>
      </div>
      <span class="distance-info">📏 {{ distanceM.toFixed(1) }}m</span>
      <span class="progress" v-if="currentPhase === 'warmup'">Warmup</span>
      <span class="progress" v-else-if="currentPhase === 'screening'">Screening</span>
      <span class="progress" v-else-if="currentPhase === 'determination'">{{ passCount }}⭕ {{ failCount }}❌</span>
    </div>

    <!-- Top floating commands -->
    <div class="top-actions">
      <button class="btn btn-sm btn-outline" @click="openSettings" title="Settings">⚙️ {{ $t('test.settings') }}</button>
      <button class="btn btn-sm btn-outline btn-danger" @click="cancelTest" title="Cancel Test">✖ {{ $t('test.cancel') }}</button>
    </div>

    <div v-if="isLoadingAI" class="loading-overlay">
      <p>{{ $t('test.loadingAI') }}</p>
    </div>

    <!-- The actual drawing canvas -->
    <div class="canvas-container">
      <canvas ref="canvasEl"></canvas>
    </div>

    <!-- Manual controls (Fallback/Debug) -->
    <div class="controls debug-controls" :class="{ 'opacity-50': isCameraActive }">
      <div class="d-pad">
        <button class="btn btn-ctrl up" @click="handleInput(6)">▲</button>
        <button class="btn btn-ctrl left" @click="handleInput(4)">◀</button>
        <div class="center-dummy"></div>
        <button class="btn btn-ctrl right" @click="handleInput(0)">▶</button>
        <button class="btn btn-ctrl down" @click="handleInput(2)">▼</button>
      </div>
      <button class="btn btn-ctrl unknown" @click="handleInput(-1)">?</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { drawLandoltC, calculateGapSizeMm, Direction, calculateMaxMeasurableAcuity, getMaxTestableAcuity, getValidAcuityLevels } from '../lib/landolt'
import { type RecognizedGesture, type NormalizedLandmark } from '../lib/gesture'
import { VisionTestSession } from '../lib/vision-test-session'
import { ppi, distanceM, maxLimit, finalResult, testHistory } from '../lib/store'
import { useGestureCamera } from '../composables/useGestureCamera'

const { t } = useI18n()
const emit = defineEmits(['next', 'cancel', 'settings'])
const canvasEl = ref<HTMLCanvasElement | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)

// State
const dpr = ref(1)

const validAcuityLevels = ref<number[]>([])
const maxAcuityLimit = ref(2.0)

const session = ref<VisionTestSession | null>(null)
const targetAcuity = computed(() => session.value ? session.value.getCurrentAcuity() : 0.1)
const currentPhase = computed(() => session.value ? session.value.getPhase() : 'warmup')
const passCount = computed(() => session.value ? session.value.getCurrentPassCount() : 0)
const failCount = computed(() => session.value ? session.value.getCurrentFailCount() : 0)

const currentDirection = ref<Direction>(Direction.Right)
const feedback = ref<string | null>(null)
const feedbackType = ref<'correct' | 'incorrect'>('correct')

let freezeInputUntil = 0 // Cooldown after a successful gesture

const {
  isCameraActive,
  isLoadingAI,
  lastGesture,
  debugScore,
  capturedLandmarks,
  activeGesture,
  activeGestureProgress,
  initAIAndCamera,
} = useGestureCamera(
  videoEl,
  (gesture: RecognizedGesture) => handleGestureInput(gesture),
  () => feedback.value === null, // Is test active (not showing feedback)
  () => freezeInputUntil,
  () => drawCurrentState() // Just trigger draw with the exact now
)

onMounted(async () => {
  dpr.value = window.devicePixelRatio || 1

  // Calculate Device Max Measurable Acuity
  const maxMeasurableAcuity = calculateMaxMeasurableAcuity(ppi.value, dpr.value, distanceM.value)
  const testableLimit = getMaxTestableAcuity(maxMeasurableAcuity)
  maxAcuityLimit.value = testableLimit
  
  // Save max limit so ResultView knows if we hit the hardware limit
  maxLimit.value = testableLimit
  console.log(`[DEBUG] Max Measurable Acuity (1px limit): ${maxMeasurableAcuity.toFixed(2)}, Testable Limit: ${testableLimit.toFixed(1)}`)
  
  // Filter levels based on the physical limit
  validAcuityLevels.value = getValidAcuityLevels(maxMeasurableAcuity)
  
  initCanvas()
  window.addEventListener('resize', handleResize)
  
  // Start AI init
  initAIAndCamera().then(() => {
    startWarmupRoutine()
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})


const handleGestureInput = (gesture: RecognizedGesture) => {
  const now = performance.now()
  let inputDir = -1
  if (gesture === 'up') inputDir = 6
  else if (gesture === 'down') inputDir = 2
  else if (gesture === 'left') inputDir = 4
  else if (gesture === 'right') inputDir = 0
  
  if (inputDir !== -1) {
      handleInput(inputDir)
      freezeInputUntil = now + 1500 // 1.5s cooldown before next input
  }
}

const getPixelsFromMm = (mm: number, viewportPpi: number) => {
  const inches = mm / 25.4
  return inches * viewportPpi
}

const initCanvas = () => {
  if (!canvasEl.value) return
  const canvas = canvasEl.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = window.innerWidth * dpr.value
  canvas.height = window.innerHeight * dpr.value
  canvas.style.width = window.innerWidth + 'px'
  canvas.style.height = window.innerHeight + 'px'
}

const startWarmupRoutine = () => {
  session.value = new VisionTestSession(validAcuityLevels.value)
  drawNextTarget()
}

const drawCurrentState = () => {
  if (!canvasEl.value) return
  const canvas = canvasEl.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const gapSizeMm = calculateGapSizeMm(distanceM.value, targetAcuity.value)
  const gapSizePx = getPixelsFromMm(gapSizeMm, ppi.value) * dpr.value

  const cx = canvas.width / 2
  const cy = canvas.height / 2

  // Draw in pure black for maximum contrast on the clinical white background
  drawLandoltC(ctx, cx, cy, gapSizePx, currentDirection.value, '#000000')

  // Draw gesture progress bar
  if (activeGesture.value !== 'none' && activeGestureProgress.value > 0) {
      const progress = activeGestureProgress.value
      // Make the progress bar 50% of the screen bounds, but extra thick
      const maxRadius = Math.min(canvas.width, canvas.height) / 2
      const radius = maxRadius * 0.5
      
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(-Math.PI / 2) // Start from top
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2 * progress)
      ctx.lineWidth = 14 // Make it very thick and visible
      ctx.lineCap = 'round'
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.9)' // primary color
      ctx.stroke()
      ctx.restore()
      
      // Draw gesture text above the ring
      ctx.save()
      let gestureText = ''
      if (activeGesture.value === 'up') gestureText = t('test.gestureUp')
      else if (activeGesture.value === 'down') gestureText = t('test.gestureDown')
      else if (activeGesture.value === 'left') gestureText = t('test.gestureLeft')
      else if (activeGesture.value === 'right') gestureText = t('test.gestureRight')
      
      if (gestureText) {
          ctx.font = 'bold 64px sans-serif'
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)' // dark clinical gray instead of white
          ctx.textAlign = 'center'
          ctx.textBaseline = 'bottom'
          // Draw slightly above the top edge of the ring
          ctx.fillText(gestureText, cx, cy - radius - 30)
      }
      ctx.restore()
  }

  // Draw detected skeleton on top
  if (capturedLandmarks.value) {
      drawHandSkeleton(ctx, capturedLandmarks.value, canvas.width, canvas.height)
  }
}

const drawNextTarget = () => {
  const dirChoices = [0, 2, 4, 6]
  
  // Filter out the current direction to prevent consecutive identical targets
  let availableChoices = dirChoices.filter(d => d !== currentDirection.value)
  // Fallback if somehow empty (first run etc)
  if (availableChoices.length === 0) availableChoices = dirChoices
  
  currentDirection.value = availableChoices[Math.floor(Math.random() * availableChoices.length)] as Direction
  // Lock input for 1.0s after a new target is shown (avoids accidental superhuman speed inputs)
  freezeInputUntil = performance.now() + 1000
  drawCurrentState()
}

const drawHandSkeleton = (ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[], w: number, h: number) => {
    ctx.save()
    // Video is mirrored horizontally via CSS, so coordinate x is mirrored
    // We must mirror the drawing here to match the user's proprioception
    
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)'
    ctx.lineWidth = 3
    
    // Draw full hand skeleton to reassure user of full tracking visibility
    const HAND_CONNECTIONS = [
        [0, 1], [1, 2], [2, 3], [3, 4], // thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // index
        [5, 9], [9, 10], [10, 11], [11, 12], // middle
        [9, 13], [13, 14], [14, 15], [15, 16], // ring
        [13, 17], [17, 18], [18, 19], [19, 20], // pinky
        [0, 17] // palm heel connection
    ] as [number, number][]

    ctx.beginPath()
    for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
        const start = landmarks[startIdx]
        const end = landmarks[endIdx]
        if (start && end) {
            ctx.moveTo((1 - start.x) * w, start.y * h)
            ctx.lineTo((1 - end.x) * w, end.y * h)
        }
    }
    ctx.stroke()
    
    for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i]
        if (!lm) continue
        ctx.beginPath()
        ctx.arc((1 - lm.x) * w, lm.y * h, i === 8 ? 8 : 4, 0, 2 * Math.PI)
        ctx.fillStyle = i === 8 ? 'rgba(239, 68, 68, 0.9)' : 'rgba(2, 132, 199, 0.8)'
        ctx.fill()
    }

    ctx.restore()
}

const showFeedback = (isCorrect: boolean) => {
  feedback.value = isCorrect ? 'O' : 'X'
  feedbackType.value = isCorrect ? 'correct' : 'incorrect'
  setTimeout(() => {
    feedback.value = null
  }, 500)
}

const handleInput = (inputDir: number) => {
  if (feedback.value || !session.value) return;

  const isCorrect = inputDir === currentDirection.value 
                   || (inputDir === -1 && false) // ? is always false

  testHistory.value.push({
    acuity: targetAcuity.value,
    targetDirection: currentDirection.value,
    inputDirection: inputDir,
    isCorrect
  })

  showFeedback(isCorrect)

  setTimeout(() => {
    if (!session.value) return;
    session.value.input(isCorrect);
    
    if (session.value.isFinished()) {
      finishTest(session.value.getFinalResult());
    } else {
      drawNextTarget();
    }
  }, 600)
}

const finishTest = (finalAcuity: number) => {
  finalResult.value = finalAcuity
  emit('next')
}

const cancelTest = () => {
  finishTest(targetAcuity.value || 1.0)
}

const openSettings = () => {
  emit('settings')
}

const handleResize = () => {
  initCanvas()
  drawCurrentState()
}

</script>

<style scoped>
.test-view {
  width: 100vw;
  height: 100vh;
  position: relative;
  background-color: var(--bg-color);
  overflow: hidden;
}

.camera-preview {
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  width: 160px;
  height: 120px;
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid var(--border-color);
  z-index: 40;
  background: #f8fafc;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.camera-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1); /* mirror */
}

.gesture-badge {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  background: rgba(255, 255, 255, 0.9);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  padding: 0.2rem 0.6rem;
  border-radius: 1rem;
  font-size: 0.8rem;
  font-weight: bold;
}

.loading-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255,255,255,0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 50;
  font-size: 1.5rem;
  color: var(--text-color);
}

.header {
  position: absolute;
  top: 1rem;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 2rem;
  padding: 0 2rem;
  color: var(--text-color);
  font-weight: bold;
  font-family: monospace;
  font-size: 1.2rem;
  pointer-events: none;
  z-index: 10;
}

.header-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.limit-info {
  font-size: 0.7rem;
  color: #64748b;
  font-weight: normal;
}

.top-actions {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  gap: 0.5rem;
  z-index: 50;
}

.btn-sm {
  padding: 0.4rem 0.8rem;
  font-size: 0.9rem;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-color);
  cursor: pointer;
  pointer-events: auto;
}

.btn-sm:hover {
  background: #f1f5f9;
}

.btn-danger {
  color: var(--error-color);
  border-color: rgba(239, 68, 68, 0.3);
}

.btn-danger:hover {
  background: #fef2f2;
}

.canvas-container {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.feedback-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 15rem;
  font-weight: bold;
  z-index: 20;
  pointer-events: none;
  text-shadow: 0 0 20px rgba(255,255,255,0.8);
}

.feedback-overlay.correct {
  color: var(--success-color);
}

.feedback-overlay.incorrect {
  color: var(--error-color);
}

.controls {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  z-index: 30;
  transition: opacity 0.3s;
}

.opacity-50 {
  opacity: 0.2;
}
.opacity-50:hover {
  opacity: 1;
}

.d-pad {
  display: grid;
  grid-template-columns: repeat(3, 60px);
  grid-template-rows: repeat(3, 60px);
  gap: 0.5rem;
}

.btn-ctrl {
  width: 60px;
  height: 60px;
  font-size: 1.5rem;
  border-radius: 50%;
  background-color: white;
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.d-pad .up { grid-column: 2; grid-row: 1; }
.d-pad .left { grid-column: 1; grid-row: 2; }
.d-pad .center-dummy { grid-column: 2; grid-row: 2; }
.d-pad .right { grid-column: 3; grid-row: 2; }
.d-pad .down { grid-column: 2; grid-row: 3; }

</style>
