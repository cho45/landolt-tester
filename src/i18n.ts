import { createI18n } from 'vue-i18n'
import { appLang } from './lib/store'

const messages = {
    en: {
        app: {
            title: 'Vision Acuity Test',
        },
        calibration: {
            title: 'Display Calibration',
            description: 'To ensure accurate sizing of the Landolt C, please match the on-screen box to a real-world object.',
            referenceObject: 'Reference Object',
            coin: '19.05mm (US Penny, 1¢)',
            card: '53.98mm (Credit/ID Card)',
            adjustSlider: 'Adjust the slider until the outline perfectly matches the physical item.',
            nextButton: 'Save & Continue'
        },
        setup: {
            title: 'Test Configuration',
            distanceLabel: 'Viewing Distance (meters)',
            distanceDesc: 'Please place your device exactly this far away from your eyes during the test.',
            maxLimitDesc: 'Measurable Limit',
            startTest: 'Begin Vision Test',
            languageLabel: 'Select Language',
            recalibrate: '🔍 Recalibrate Screen'
        },
        test: {
            loadingAI: 'Initializing Gesture Recognition...',
            settings: 'Settings',
            cancel: 'Cancel Test',
            target: 'Target Acuity',
            attempt: 'Attempt',
            hint: 'Point your index finger Up, Down, Left, or Right towards the gap for 2 seconds. Middle, Ring, and Pinky must be curled.',
            gestureUp: 'Pointing Up',
            gestureDown: 'Pointing Down',
            gestureLeft: 'Pointing Left',
            gestureRight: 'Pointing Right'
        },
        result: {
            title: 'Test Complete',
            estimatedAcuity: 'Estimated Visual Acuity',
            deviceLimit: 'Device Measurement Limit',
            disclaimerTitle: 'Disclaimer regarding Measurement Distance',
            disclaimerDetails: 'This application geometrically calculates visual acuity based on your device distance (e.g., Near Visual Acuity at 0.5m). Because human eye accommodation (focusing) works differently at close range compared to optical infinity (5m+), the results may differ from standard Distance Visual Acuity measured in health checkups. This is highly useful for checking your eyesight for near tasks like reading or PC work.',
            historyTitle: 'Attempt History',
            colAcuity: 'Target',
            colDir: 'Shown Gap',
            colInput: 'Your Input',
            colResult: 'Result',
            correct: 'Correct',
            incorrect: 'Incorrect',
            restartSetup: 'Restart Setup',
            testAgain: 'Test Again (Same settings)'
        }
    },
    ja: {
        app: {
            title: '視力検査アプリ',
        },
        calibration: {
            title: 'ディスプレイのキャリブレーション',
            description: '物理的に正確な大きさでランドルト環を描画するため、画面上の枠を実際のアイテムのサイズに合わせてください。',
            referenceObject: '基準アイテム',
            coin: '20mm (1円玉)',
            card: '53.98mm (クレジットカード/ICカード短辺)',
            adjustSlider: '画面に実際のアイテムを当てながら、外枠がぴったり重なるようにスライダーを調整してください。',
            nextButton: '保存して次へ'
        },
        setup: {
            title: '検査のセットアップ',
            distanceLabel: '目から画面までの距離 (メートル)',
            distanceDesc: '検査中は、設定した距離の分だけ端末から離れてください。',
            maxLimitDesc: '測定可能上限',
            startTest: '検査を開始する',
            languageLabel: '言語 / Language',
            recalibrate: '🔍 画面サイズを再設定'
        },
        test: {
            loadingAI: 'AIジェスチャー認識をロード中...',
            settings: '設定',
            cancel: '中止',
            target: '目標視力',
            attempt: '試行',
            hint: 'ランドルト環の開いている方向に向かって、人差し指を2秒間向けてください。中指・薬指・小指は握る必要があります。',
            gestureUp: '上の指示中',
            gestureDown: '下の指示中',
            gestureLeft: '左の指示中',
            gestureRight: '右の指示中'
        },
        result: {
            title: '検査終了',
            estimatedAcuity: '推定視力',
            deviceLimit: '端末の測定限界',
            disclaimerTitle: '測定距離に関する注意事項',
            disclaimerDetails: '本アプリは設定された距離（例: 0.5m）に基づき、視角1分を幾何学的に計算して「近見視力」を測定します。人間の眼のピント調節機能（調節力や輻輳）が介在するため、健康診断等で測る5m先の「遠見視力」とは結果が異なる場合があります。スマホやPC作業など「手元の見えやすさ」の指標としてご活用ください。',
            historyTitle: '試行履歴',
            colAcuity: '目標',
            colDir: '正解',
            colInput: '入力',
            colResult: '判定',
            correct: '正解',
            incorrect: '不正解',
            restartSetup: '設定からやり直す',
            testAgain: 'もう一度検査する (設定維持)'
        }
    }
}

// Simple browser language detection
const userLang = navigator.language.slice(0, 2)
const defaultLocale = userLang === 'ja' ? 'ja' : 'en'

// Read standard cache for previously set language if available
const storedLang = appLang.value

export const i18n = createI18n({
    legacy: false, // use Composition API
    locale: storedLang || defaultLocale,
    fallbackLocale: 'en',
    messages
})
