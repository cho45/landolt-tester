import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useGestureCamera } from './useGestureCamera'
import { ref } from 'vue'

vi.mock('../lib/gesture', () => {
    return {
        initGestureRecognizer: vi.fn().mockResolvedValue(true),
        detectGesture: vi.fn()
    }
})

describe('useGestureCamera composable', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('initializes state correctly', () => {
        // Suppress console.warn specifically for this test
        const originalWarn = console.warn
        console.warn = vi.fn()

        const videoEl = ref<HTMLVideoElement | null>(null)
        const onGestureInput = vi.fn()
        const isTestActive = vi.fn().mockReturnValue(true)
        const freezeUntil = vi.fn().mockReturnValue(0)
        const onCanvasDraw = vi.fn()

        const { isCameraActive, isLoadingAI, lastGesture, activeGestureProgress, activeGesture } = useGestureCamera(
            videoEl,
            onGestureInput,
            isTestActive,
            freezeUntil,
            onCanvasDraw
        )

        expect(isCameraActive.value).toBe(false)
        expect(isLoadingAI.value).toBe(true)
        expect(lastGesture.value).toBe('none')
        expect(activeGesture.value).toBe('none')
        expect(activeGestureProgress.value).toBe(0)

        // Restore warn
        console.warn = originalWarn
    })
})
