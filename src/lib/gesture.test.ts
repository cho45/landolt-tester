import { describe, it, expect, vi } from 'vitest'
import { detectGesture } from './gesture'

// Mock the MediaPipe module
vi.mock('@mediapipe/tasks-vision', () => {
    return {
        FilesetResolver: {
            forVisionTasks: vi.fn(),
        },
        HandLandmarker: {
            createFromOptions: vi.fn(),
        }
    }
})

describe('Gesture Recognition Heuristics', () => {
    it('returns none if recognizer is not initialized', () => {
        const video = document.createElement('video')
        expect(detectGesture(0, video)).toEqual({ gesture: 'none', score: 0, landmarks: null })
    })

    // To test the internal logic, we could export it, but testing the null state confirms
    // it doesn't crash before init.
})
