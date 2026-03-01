import { describe, it, expect } from 'vitest'
import { calculateGapSizeMm, Direction, calculateMaxMeasurableAcuity, getMaxTestableAcuity } from './landolt'

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

describe('Max Measurable Acuity Logic', () => {
    it('calculates max acuity for standard 150ppi monitor at 1m (DPR 1)', () => {
        // 1 pixel gap at 150ppi is 25.4/150 = 0.1693mm
        // Distance is 1000mm. 
        const maxAcuity = calculateMaxMeasurableAcuity(150, 1, 1.0)
        // From physics: 1.0 acuity = 0.2908mm gap.
        // Thus, 0.1693mm corresponds to ~ 1.71 acuity.
        expect(maxAcuity).toBeGreaterThan(1.7)
        expect(maxAcuity).toBeLessThan(1.75)
    })

    it('calculates max acuity for high-res retina display (DPR 2) at 0.5m', () => {
        // 150 CSS PPI, DPR 2 -> 300 physical PPI.
        // 1 pixel = 25.4/300 = 0.0846mm.
        // Distance 500mm.
        // 1.0 acuity at 0.5m is 0.1454mm gap.
        // Thus, 0.0846mm gap = ~ 1.71 acuity.
        const maxAcuity = calculateMaxMeasurableAcuity(150, 2, 0.5)
        expect(maxAcuity).toBeCloseTo(1.717, 2)
    })

    it('returns 0 for invalid inputs', () => {
        expect(calculateMaxMeasurableAcuity(0, 1, 1)).toBe(0)
        expect(calculateMaxMeasurableAcuity(150, 0, 1)).toBe(0)
        expect(calculateMaxMeasurableAcuity(150, 1, 0)).toBe(0)
    })
})

describe('getMaxTestableAcuity', () => {
    it('returns exactly 2.0 when raw limit is 2.0', () => {
        expect(getMaxTestableAcuity(2.0)).toBe(2.0)
    })
    
    it('returns exactly 2.0 when raw limit is slightly below 2.0 due to floating point error', () => {
        expect(getMaxTestableAcuity(1.999999)).toBe(2.0)
    })

    it('returns 1.5 when raw limit is 1.96', () => {
        expect(getMaxTestableAcuity(1.96)).toBe(1.5)
    })

    it('returns 1.0 when raw limit is 1.1', () => {
        expect(getMaxTestableAcuity(1.1)).toBe(1.0)
    })

    it('returns minimum 0.1 when raw limit is extremely low', () => {
        expect(getMaxTestableAcuity(0.05)).toBe(0.1)
    })
})
