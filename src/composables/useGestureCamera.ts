import { ref, type Ref, onUnmounted } from 'vue'
import { initGestureRecognizer, detectGesture, type RecognizedGesture, type NormalizedLandmark } from '../lib/gesture'

export function useGestureCamera(
  videoEl: Ref<HTMLVideoElement | null>,
  onGestureInput: (gesture: RecognizedGesture) => void,
  isTestActive: () => boolean,
  freezeUntil: () => number,
  onCanvasDraw: (now: number) => void
) {
  const isCameraActive = ref(false)
  const isLoadingAI = ref(true)
  const lastGesture = ref<string>('none')
  const debugScore = ref(0)
  const capturedLandmarks = ref<NormalizedLandmark[] | null>(null)

  const activeGesture = ref<RecognizedGesture | 'none'>('none')
  const activeGestureProgress = ref(0) // 0.0 to 1.0

  const requiredHoldTimeMs = 2000
  const gestureHistory = {
    gesture: 'none' as RecognizedGesture,
    firstSeenAt: 0,
    lastSeenAt: 0,
  }

  let stream: MediaStream | null = null
  let animationFrameId: number | null = null
  let lastVideoTime = -1

  const startCamera = async () => {
    if (!videoEl.value) return
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 }
      })
      videoEl.value.srcObject = stream
      isCameraActive.value = true
      
      videoEl.value.addEventListener("loadeddata", predictWebcam)
    } catch (e) {
      console.error("Failed to start camera", e)
      isCameraActive.value = false
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }
    isCameraActive.value = false
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }

  const resetGestureState = () => {
    gestureHistory.gesture = 'none'
    lastGesture.value = 'none'
    activeGesture.value = 'none'
    activeGestureProgress.value = 0
  }

  const predictWebcam = async () => {
    if (!videoEl.value || !isCameraActive.value) return
    
    const nowInMs = performance.now()
    if (videoEl.value.currentTime !== lastVideoTime) {
      lastVideoTime = videoEl.value.currentTime
      const result = detectGesture(nowInMs, videoEl.value)
      
      debugScore.value = result.score
      capturedLandmarks.value = result.landmarks
      
      if (!isTestActive() || nowInMs < freezeUntil()) {
         resetGestureState()
      } else if (result.gesture !== 'none' && result.gesture !== 'unknown') {
         if (gestureHistory.gesture === result.gesture) {
           // Ongoing gesture
           gestureHistory.lastSeenAt = nowInMs
           const holdDuration = nowInMs - gestureHistory.firstSeenAt
           activeGesture.value = result.gesture
           activeGestureProgress.value = Math.min(1.0, Math.max(0, holdDuration / requiredHoldTimeMs))

           if (holdDuration > requiredHoldTimeMs) {
               lastGesture.value = result.gesture
               onGestureInput(result.gesture)
               resetGestureState()
           } else {
              lastGesture.value = `${result.gesture} (Hold...)`
           }
         } else {
           // New gesture started
           gestureHistory.gesture = result.gesture
           gestureHistory.firstSeenAt = nowInMs
           gestureHistory.lastSeenAt = nowInMs
           lastGesture.value = `${result.gesture} (Start)`
           activeGesture.value = result.gesture
           activeGestureProgress.value = 0
         }
      } else {
         // Lost tracking or unrecognized
         if (nowInMs - gestureHistory.lastSeenAt > 500) {
             resetGestureState()
         }
      }
      
      // Trigger canvas drawing callback with the current state timestamp
      onCanvasDraw(nowInMs)
    }
    
    if (isCameraActive.value) {
      animationFrameId = requestAnimationFrame(predictWebcam)
    }
  }

  const initAIAndCamera = async () => {
    isLoadingAI.value = true
    try {
      await initGestureRecognizer()
      await startCamera()
    } catch (e) {
      console.error("Failed to init AI or camera", e)
    } finally {
      isLoadingAI.value = false
    }
  }

  onUnmounted(() => {
    stopCamera()
  })

  return {
    isCameraActive,
    isLoadingAI,
    lastGesture,
    debugScore,
    capturedLandmarks,
    activeGesture,
    activeGestureProgress,
    initAIAndCamera,
    stopCamera
  }
}
