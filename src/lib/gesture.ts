import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'

export type RecognizedGesture = 'up' | 'down' | 'left' | 'right' | 'unknown' | 'none'
export type NormalizedLandmark = { x: number, y: number, z: number }

export interface GestureDetectionResult {
    gesture: RecognizedGesture
    score: number
    landmarks: NormalizedLandmark[] | null
}

let recognizer: HandLandmarker | null = null

export async function initGestureRecognizer() {
    if (recognizer) return recognizer

    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    )

    recognizer = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
    })

    return recognizer
}

export function detectGesture(videoStartMs: number, videoElement: HTMLVideoElement): GestureDetectionResult {
    if (!recognizer) return { gesture: 'none', score: 0, landmarks: null }

    const results = recognizer.detectForVideo(videoElement, videoStartMs) as HandLandmarkerResult

    let currentLandmarks: NormalizedLandmark[] | null = null
    let handScore = 0

    if (results.landmarks && results.landmarks.length > 0 && results.landmarks[0]) {
        currentLandmarks = results.landmarks[0] as NormalizedLandmark[]
        if (results.handednesses && results.handednesses.length > 0) {
            handScore = results.handednesses[0]?.[0]?.score || 0
        }
    }

    // Require decent hand tracking confidence (lowered to 0.3 for downward awkward angles)
    if (currentLandmarks && handScore > 0.3) {
        const { gesture, score } = detectDirectionFromLandmarks(currentLandmarks)
        return { gesture, score: score * handScore, landmarks: currentLandmarks }
    }

    return { gesture: 'none', score: 0, landmarks: null }
}



function detectDirectionFromLandmarks(landmarks: NormalizedLandmark[]): { gesture: RecognizedGesture, score: number } {
    if (!landmarks || landmarks.length < 21) return { gesture: 'none', score: 0 }

    const dist = (a: NormalizedLandmark, b: NormalizedLandmark) => Math.hypot(a.x - b.x, a.y - b.y)
    const wrist = landmarks[0]

    // 人差し指の付け根(MCP)は5番、指先(Tip)は8番
    const base = landmarks[5]
    const tip = landmarks[8]

    if (!base || !tip || !wrist) return { gesture: 'none', score: 0 }

    const dx = tip.x - base.x
    const dy = tip.y - base.y

    const len = Math.sqrt(dx * dx + dy * dy)

    const handSize = dist(base, wrist)

    // 中指・薬指・小指が曲がっているかチェックする（指先から付け根までの距離が、人差し指の伸びより十分に短ければ曲がっていると判定）
    const isCurled = (tipIdx: number, mcpIdx: number) => {
        const t = landmarks[tipIdx]
        const m = landmarks[mcpIdx]
        if (!t || !m) return true // 人差し指の確実性を優先するためデフォルトでは曲がっているとみなす
        return dist(t, m) < len * 0.8 // 人差し指の長さより短くなければならない
    }

    // 中指・薬指・小指が曲がっていることを要求。親指（idx 4）はノイズになるため判定から完全に除外・無視する。
    if (!isCurled(12, 9) || !isCurled(16, 13) || !isCurled(20, 17)) {
        return { gesture: 'none', score: 0 }
    }

    // 2. 人差し指自体がしっかり伸びている必要がある

    // もし人差し指が曲がっている場合、付け根から指先までの距離が短くなる。
    // カメラに向かって真下を指差すなどの極端な遠近法（パースペクティブ）を考慮し、手全体の大きさの25%という緩い閾値にする
    if (len < handSize * 0.25) return { gesture: 'none', score: 0 }

    const nx = dx / len
    const ny = dy / len

    // スコアはいずれかの軸（XまたはY）にどれだけ強く沿っているかで計算される（最大 1.0）
    let score = 0
    let gesture: RecognizedGesture = 'none'

    if (Math.abs(nx) > Math.abs(ny)) {
        // 水平方向（左右）
        score = Math.abs(nx)
        // 斜め方向の誤爆を防ぐため、非常に強い軸一致（0.75以上）を要求する
        // NOTE: ビデオはCSSで左右反転（scaleX(-1)）されているため、物理的な右手での指差しは
        // 生のカメラ座標では負のXベクトルとなる。そこでここで左右の判定を意図的に反転させている。
        if (nx > 0.75) gesture = 'left'
        else if (nx < -0.75) gesture = 'right'
    } else {
        // 垂直方向（上下）
        score = Math.abs(ny)
        if (ny > 0.75) gesture = 'down'
        else if (ny < -0.75) gesture = 'up'
    }

    return { gesture, score }
}
