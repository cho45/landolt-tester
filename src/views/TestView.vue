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
        <span class="acuity-level">{{ $t('test.target') }}: {{ (targetAcuity || 1.0).toFixed(1) }}</span>
        <span class="limit-info">(Limit: {{ maxAcuityLimit.toFixed(1) }})</span>
      </div>
      <span class="distance-info">📏 {{ distanceM.toFixed(1) }}m</span>
      <span class="progress">{{ $t('test.attempt') }}: {{ attempt }}/{{ maxAttempts }}</span>
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
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { drawLandoltC, calculateGapSizeMm, Direction } from '../lib/landolt'
import { initGestureRecognizer, detectGesture, type RecognizedGesture, type NormalizedLandmark } from '../lib/gesture'

const { t } = useI18n()
const emit = defineEmits(['next', 'cancel', 'settings'])
const canvasEl = ref<HTMLCanvasElement | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)

// State
const ppi = ref(150)
const distanceM = ref(1.0)
const dpr = ref(1)

const ALL_ACUITY_LEVELS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5, 2.0]
const validAcuityLevels = ref<number[]>([])
const maxAcuityLimit = ref(2.0)

const searchL = ref(0)
const searchR = ref(0)
const currentLevelIdx = ref(0)
const targetAcuity = ref<number>(0.1)
const isWarmupPhase = ref(true)

const attempt = ref(1)
const maxAttempts = 3
let currentPassCount = 0
let currentFailCount = 0

const currentDirection = ref<Direction>(Direction.Right)
const feedback = ref<string | null>(null)
const feedbackType = ref<'correct' | 'incorrect'>('correct')

type AttemptRecord = {
  acuity: number
  targetDirection: number
  inputDirection: number
  isCorrect: boolean
}
const testHistory = ref<AttemptRecord[]>([])

// Camera & AI State
const isCameraActive = ref(false)
const isLoadingAI = ref(true)
const lastGesture = ref<RecognizedGesture>('none')
// Gesture Confidence & Temporal State
const requiredHoldTimeMs = 2000
const gestureHistory = {
  gesture: 'none' as RecognizedGesture,
  firstSeenAt: 0,
  lastSeenAt: 0,
}
const debugScore = ref(0)
const capturedLandmarks = ref<NormalizedLandmark[] | null>(null)

let stream: MediaStream | null = null
let animationFrameId: number | null = null
let lastVideoTime = -1
let freezeInputUntil = 0 // Cooldown after a successful gesture

onMounted(async () => {
  const storedPpi = localStorage.getItem('vision_app_ppi')
  if (storedPpi) ppi.value = parseFloat(storedPpi)
  const storedDist = localStorage.getItem('vision_app_distance_m')
  if (storedDist) distanceM.value = parseFloat(storedDist)

  dpr.value = window.devicePixelRatio || 1

  // Calculate Device Max Measurable Acuity (1px gap threshold)
  const gapSizeMmFor1px = 25.4 / (ppi.value * dpr.value)
  const distanceMm = distanceM.value * 1000
  const radians = 2 * Math.atan(gapSizeMmFor1px / (2 * distanceMm))
  const arcMinutes = radians * (180 / Math.PI) * 60
  const maxMeasurableAcuity = 1.0 / arcMinutes
  maxAcuityLimit.value = maxMeasurableAcuity
  
  console.log(`[DEBUG] Max Measurable Acuity (1px limit): ${maxMeasurableAcuity.toFixed(2)}`)
  
  // Filter levels based on the physical limit
  validAcuityLevels.value = ALL_ACUITY_LEVELS.filter(a => a <= maxMeasurableAcuity)
  if (validAcuityLevels.value.length === 0) validAcuityLevels.value = [0.1]
  
  initCanvas()
  window.addEventListener('resize', handleResize)
  
  // Start AI init
  try {
    await initGestureRecognizer()
    await startCamera()
  } catch (e) {
    console.error("Failed to init AI or camera", e)
    // Fallback to manual mode
  } finally {
    isLoadingAI.value = false
    startWarmupRoutine() 
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  stopCamera()
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
})

const startCamera = async () => {
  if (!videoEl.value) return
  stream = await navigator.mediaDevices.getUserMedia({
     video: { facingMode: "user", width: 640, height: 480 }
  })
  videoEl.value.srcObject = stream
  isCameraActive.value = true
  
  // Wait for video to be ready to play
  videoEl.value.addEventListener("loadeddata", predictWebcam)
}

const stopCamera = () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
  }
  isCameraActive.value = false
}

const predictWebcam = async () => {
  if (!videoEl.value || !isCameraActive.value) return
  
  let nowInMs = performance.now()
  if (videoEl.value.currentTime !== lastVideoTime) {
    lastVideoTime = videoEl.value.currentTime
    const result = detectGesture(nowInMs, videoEl.value)
    
    debugScore.value = result.score
    capturedLandmarks.value = result.landmarks
    
    // Process Gesture temporally
    if (feedback.value || nowInMs < freezeInputUntil) {
       // Ignore gestures during cooldown or feedback display, but keep skeleton tracking
       gestureHistory.gesture = 'none'
       lastGesture.value = 'none'
    } else if (result.gesture !== 'none' && result.gesture !== 'unknown') {
       if (gestureHistory.gesture === result.gesture) {
         // Same gesture ongoing
         gestureHistory.lastSeenAt = nowInMs
         
         // Have they held it long enough?
         if (nowInMs - gestureHistory.firstSeenAt > requiredHoldTimeMs) {
             lastGesture.value = result.gesture
             handleGestureInput(result.gesture)
             // reset history to prevent rapid refiring
             gestureHistory.gesture = 'none'
         } else {
            // Actively holding, indicate intent visually
            lastGesture.value = `${result.gesture} (Hold...)` as RecognizedGesture
         }
       } else {
         // New gesture started
         gestureHistory.gesture = result.gesture
         gestureHistory.firstSeenAt = nowInMs
         gestureHistory.lastSeenAt = nowInMs
         lastGesture.value = `${result.gesture} (Start)` as RecognizedGesture
       }
    } else {
       // Lost tracking or none
       if (nowInMs - gestureHistory.lastSeenAt > 500) {
           // If we lose tracking for half a second, reset
           gestureHistory.gesture = 'none'
           lastGesture.value = 'none'
       }
    }
    
    // Rerender canvas for landmarks and progress bar
    drawCurrentState(nowInMs)
  }
  
  // Call this function again to keep predicting
  if (isCameraActive.value) {
    animationFrameId = requestAnimationFrame(predictWebcam)
  }
}

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
  isWarmupPhase.value = true
  searchL.value = 0
  searchR.value = validAcuityLevels.value.length - 1
  startLevel(0)
}

const startTestRoutine = () => {
  isWarmupPhase.value = false
  if (validAcuityLevels.value.length <= 1) {
    finishTest(validAcuityLevels.value[0] || targetAcuity.value)
    return
  }
  
  // Jump to the middle of the available array, ensuring we skip the 0th index 
  // which they just completed in the warmup.
  const mid = Math.floor((searchL.value + searchR.value) / 2)
  startLevel(Math.max(1, mid))
}

const startLevel = (idx: number) => {
  currentLevelIdx.value = idx
  targetAcuity.value = validAcuityLevels.value[idx] ?? validAcuityLevels.value[validAcuityLevels.value.length - 1] ?? 0.1
  attempt.value = 1
  currentPassCount = 0
  currentFailCount = 0
  drawNextTarget()
}

const drawCurrentState = (now: number = performance.now()) => {
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
  if (gestureHistory.gesture !== 'none' && gestureHistory.firstSeenAt > 0) {
      const holdDuration = now - gestureHistory.firstSeenAt
      if (holdDuration > 0 && holdDuration <= requiredHoldTimeMs) {
          const progress = holdDuration / requiredHoldTimeMs
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
          if (gestureHistory.gesture === 'up') gestureText = t('test.gestureUp')
          else if (gestureHistory.gesture === 'down') gestureText = t('test.gestureDown')
          else if (gestureHistory.gesture === 'left') gestureText = t('test.gestureLeft')
          else if (gestureHistory.gesture === 'right') gestureText = t('test.gestureRight')
          
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
  if (feedback.value) return;

  const isCorrect = inputDir === currentDirection.value 
                   || (inputDir === -1 && false) // ? is always false

  testHistory.value.push({
    acuity: targetAcuity.value,
    targetDirection: currentDirection.value,
    inputDirection: inputDir,
    isCorrect
  })

  showFeedback(isCorrect)

  if (isCorrect) currentPassCount++
  else currentFailCount++
  
  attempt.value++

  // Binary Search progression rule:
  // Pass node if 2 correct. Fail node if 2 incorrect.
  
  setTimeout(() => {
    if (isWarmupPhase.value) {
      if (currentPassCount >= 1) {
        // Passed warmup, jump into the actual test
        startTestRoutine()
      } else if (currentFailCount >= 1) {
        // Failed the easiest level, finish immediately
        finishTest(0.1) // Represents <0.1
      } else {
        drawNextTarget()
      }
      return
    }

    if (currentPassCount >= 2) {
      // Node Passed! Move right (harder)
      searchL.value = currentLevelIdx.value + 1
      if (searchL.value > searchR.value) {
        // Search depleted, user reached their limit or the top level
        finishTest(validAcuityLevels.value[currentLevelIdx.value] || targetAcuity.value)
      } else {
        const mid = Math.floor((searchL.value + searchR.value) / 2)
        startLevel(mid)
      }
    } else if (currentFailCount >= 2) {
      // Node Failed! Move left (easier)
      searchR.value = currentLevelIdx.value - 1
      if (searchL.value > searchR.value) {
        // Search depleted. The maximum passed level is searchR.
        // If searchR is < 0, they failed even the easiest. We fall back to 0.1 or `<0.1` representation.
        finishTest(validAcuityLevels.value[Math.max(0, searchR.value)] || 0.1)
      } else {
        const mid = Math.floor((searchL.value + searchR.value) / 2)
        startLevel(mid)
      }
    } else {
      // Need more attempts to determine pass/fail for this node (e.g., 1 correct, 1 fail)
      drawNextTarget()
    }
  }, 600)
}

const finishTest = (finalAcuity: number) => {
  localStorage.setItem('vision_app_result', finalAcuity.toString())
  localStorage.setItem('vision_app_history', JSON.stringify(testHistory.value))
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
