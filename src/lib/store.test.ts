import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isCalibrated, isConfigured, ppi, distanceM, maxLimit, finalResult, testHistory, appLang } from './store'
import { nextTick } from 'vue'

const STORAGE_KEY = 'vision_app_state'

describe('Reactive Store', () => {
  beforeEach(() => {
    localStorage.clear()
    
    // Reset to defaults
    isCalibrated.value = false;
    isConfigured.value = false;
    ppi.value = 150;
    distanceM.value = 1.0;
    maxLimit.value = 2.0;
    finalResult.value = 0.1;
    testHistory.value = [];
    appLang.value = 'en';
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('initializes with default values if localStorage is empty', () => {
    expect(isCalibrated.value).toBe(false)
    expect(isConfigured.value).toBe(false)
    expect(ppi.value).toBe(150)
    expect(distanceM.value).toBe(1.0)
    expect(maxLimit.value).toBe(2.0)
    expect(finalResult.value).toBe(0.1)
    expect(testHistory.value).toEqual([])
    expect(appLang.value).toBe('en')
  })

  it('reactively syncs setting flags to localStorage as JSON', async () => {
    isCalibrated.value = true
    isConfigured.value = true
    await nextTick()
    
    expect(isCalibrated.value).toBe(true)
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(state.isCalibrated).toBe(true)
    expect(state.isConfigured).toBe(true)
  })

  it('reactively syncs complex history objects to localStorage (deep watch)', async () => {
    const records = [{ acuity: 1.0, targetDirection: 0, inputDirection: 0, isCorrect: true }]
    testHistory.value = records
    await nextTick()
    
    expect(testHistory.value).toEqual(records)
    let state = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(state.testHistory).toEqual(records)
    
    testHistory.value.push({ acuity: 0.5, targetDirection: 2, inputDirection: 2, isCorrect: true })
    await nextTick()
    
    state = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(state.testHistory).toHaveLength(2)
  })

  it('reactively syncs language as JSON', async () => {
    appLang.value = 'ja'
    await nextTick()
    
    expect(appLang.value).toBe('ja')
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(state.appLang).toBe('ja')
  })
})