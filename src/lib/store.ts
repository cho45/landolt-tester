import { reactive, watch, toRefs } from 'vue';

export type AttemptRecord = {
  acuity: number;
  targetDirection: number;
  inputDirection: number;
  isCorrect: boolean;
};

export type AppState = {
  isCalibrated: boolean;
  isConfigured: boolean;
  ppi: number;
  distanceM: number;
  maxLimit: number;
  finalResult: number;
  testHistory: AttemptRecord[];
  appLang: string;
};

const STORAGE_KEY = 'vision_app_state';

class StoreManager {
  static load(): AppState {
    const defaultLang = typeof navigator !== 'undefined' 
      ? (navigator.language.startsWith('ja') ? 'ja' : 'en') 
      : 'en';

    const defaultState: AppState = {
      isCalibrated: false,
      isConfigured: false,
      ppi: 150,
      distanceM: 1.0,
      maxLimit: 2.0,
      finalResult: 0.1,
      testHistory: [],
      appLang: defaultLang
    };
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultState, ...parsed };
      }
    } catch (e) {
      console.error('Failed to parse state from localStorage', e);
    }
    
    return defaultState;
  }

  static save(state: AppState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }
}

const state = reactive<AppState>(StoreManager.load());

watch(state, (newState) => {
  StoreManager.save(newState);
}, { deep: true });

export const { 
  isCalibrated, 
  isConfigured, 
  ppi, 
  distanceM, 
  maxLimit, 
  finalResult, 
  testHistory, 
  appLang 
} = toRefs(state);
