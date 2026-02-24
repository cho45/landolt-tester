import { describe, it, expect } from 'vitest'
import { calculateGapSizeMm, Direction } from './landolt'

describe('Landolt C Math Logic', () => {
    it('calculates 1.0 acuity gap size correctly at 5m', () => {
        // Standard visual acuity of 1.0 at 5m means a 1.454 mm gap
        // 1 arcminute = 1/60 degrees
        // gap = 2 * 5000 * tan((1/60 * Math.PI / 180) / 2)
        const gapMm = calculateGapSizeMm(5.0, 1.0)
        expect(gapMm).toBeCloseTo(1.4544, 3)
    })

    it('calculates 1.0 acuity gap size correctly at 1m', () => {
        // Should be proportionally smaller, ~0.2908 mm
        const gapMm = calculateGapSizeMm(1.0, 1.0)
        expect(gapMm).toBeCloseTo(0.2908, 3)
    })

    it('calculates 0.1 acuity gap size correctly at 1m', () => {
        // 0.1 visual acuity means gap must be 10x larger than 1.0 acuity
        const gapMm = calculateGapSizeMm(1.0, 0.1)
        expect(gapMm).toBeCloseTo(2.9088, 3)
    })

    it('has correct Direction enum values', () => {
        expect(Direction.Right).toBe(0)
        expect(Direction.Bottom).toBe(2)
        expect(Direction.Left).toBe(4)
        expect(Direction.Top).toBe(6)
    })
})
