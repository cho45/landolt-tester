import { describe, it, expect, beforeEach } from 'vitest'
import { VisionTestSession } from './vision-test-session'

describe('VisionTestSession', () => {
  const levels = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5, 2.0]

  describe('Phase 1: Warmup', () => {
    let session: VisionTestSession

    beforeEach(() => {
      session = new VisionTestSession(levels)
    })

    it('初期状態はウォームアップとして最も低い視力(0.1)から始まる', () => {
      expect(session.getCurrentAcuity()).toBe(0.1)
      expect(session.isFinished()).toBe(false)
    })

    it('ウォームアップで1回でも間違えると即座に検査終了となり、結果は0.1となる', () => {
      session.input(false)
      expect(session.isFinished()).toBe(true)
      expect(session.getFinalResult()).toBe(0.1)
    })

    it('ウォームアップで1回正解すると、次のフェーズ（Screening）に移行し、視力レベルが上がる', () => {
      session.input(true)
      expect(session.isFinished()).toBe(false)
      // スクリーニングフェーズでは0.1の次は少し飛ばして0.3などになるはず
      expect(session.getCurrentAcuity()).toBeGreaterThan(0.1)
    })
  })

  describe('Phase 2: Screening', () => {
    let session: VisionTestSession

    beforeEach(() => {
      session = new VisionTestSession(levels)
      // ウォームアップをパスさせる
      session.input(true)
    })

    it('スクリーニング中は正解するたびに複数レベル（例: 2段階）飛ばして難しい視力へと進む', () => {
      // 0.1(index 0) の次は 0.3 (index 2)
      expect(session.getCurrentAcuity()).toBe(0.3)
      
      session.input(true)
      // 2段階飛ぶ (0.5 - index 4)
      expect(session.getCurrentAcuity()).toBe(0.5)
      
      session.input(true)
      // 2段階飛ぶ (0.7 - index 6)
      expect(session.getCurrentAcuity()).toBe(0.7)
    })

    it('スクリーニングで不正解になると、その1つ下のレベルに戻り、確定フェーズ(Determination)へ移行する', () => {
      // 現在0.3
      session.input(true)
      // 現在0.5 (index 4)
      expect(session.getCurrentAcuity()).toBe(0.5)
      
      // ここで間違える
      session.input(false)
      
      expect(session.isFinished()).toBe(false)
      // 間違えた0.5(index 4)の1つ前、つまり0.4(index 3)にフォールバックして確定フェーズを開始する
      expect(session.getCurrentAcuity()).toBe(0.4)
    })

    it('スクリーニングで最後まで到達した場合は、最上位レベルでの確定フェーズに入る', () => {
      // 0.3 から順次正解して最上位へ
      while (session.getPhase() === 'screening') {
        session.input(true)
      }
      expect(session.isFinished()).toBe(false)
      expect(session.getPhase()).toBe('determination')
      expect(session.getCurrentAcuity()).toBe(2.0) // 配列の最後
    })

    it('ウォームアップから確定フェーズまですべて全問正解した場合、最終結果は必ず最大視力（2.0）になる', () => {
      const perfectSession = new VisionTestSession(levels) // max: 2.0
      
      // テストが終了するまでひたすら正解を入力し続けるフェイルセーフなループ（無限ループ防止のため最大50回）
      let attempts = 0
      while (!perfectSession.isFinished() && attempts < 50) {
        perfectSession.input(true)
        attempts++
      }
      
      expect(perfectSession.isFinished()).toBe(true)
      expect(perfectSession.getFinalResult()).toBe(2.0)
    })
  })

  describe('Phase 3: Determination (確定フェーズ)', () => {
    let session: VisionTestSession

    beforeEach(() => {
      session = new VisionTestSession(levels)
      // ウォームアップ通過: index 0 -> 2 (0.3)
      session.input(true)
      // スクリーニングで一度正解: index 2 -> 4 (0.5)
      session.input(true)
      // スクリーニングで不正解になり確定フェーズへ: index 4 -> 3 (0.4) にフォールバック
      session.input(false)
    })

    it('同じレベルで3回正解すると次のレベル(1段階上)へ進む', () => {
      expect(session.getCurrentAcuity()).toBe(0.4)
      session.input(true)
      session.input(true)
      session.input(true) // 3回目正解
      
      expect(session.isFinished()).toBe(false)
      expect(session.getCurrentAcuity()).toBe(0.5) // index 3 -> 4 に上がる
    })

    it('同じレベルで3回間違えるとテストが終了し、最終確定視力は「1つ下のレベル」になる', () => {
      expect(session.getCurrentAcuity()).toBe(0.4) // index 3
      session.input(false)
      session.input(false)
      session.input(false) // 3回目不正解
      
      expect(session.isFinished()).toBe(true)
      // 0.4の確定テストで落ちたので、最後に確実だったレベル、つまりその1つ下の0.3(index 2)が最終結果
      expect(session.getFinalResult()).toBe(0.3)
    })

    it('正解と不正解が混ざっても、先に3回正解に達すれば次のレベルに進む（ノイズ耐性）', () => {
      expect(session.getCurrentAcuity()).toBe(0.4)
      session.input(false)
      session.input(true)
      session.input(false)
      session.input(true)
      session.input(true) // 3回目正解 (計5回)
      
      expect(session.isFinished()).toBe(false)
      expect(session.getCurrentAcuity()).toBe(0.5)
    })

    it('確定フェーズで最上位レベルまで到達してパスした場合は、それが最終結果となる', () => {
      // 0.4 から順次上げていく
      while (session.getCurrentAcuity() < 2.0 && !session.isFinished()) {
        session.input(true)
        session.input(true)
        session.input(true)
      }
      
      // 2.0 に到達
      expect(session.getCurrentAcuity()).toBe(2.0)
      
      // 2.0の確定テストもパスさせる
      session.input(true)
      session.input(true)
      session.input(true)
      
      expect(session.isFinished()).toBe(true)
      expect(session.getFinalResult()).toBe(2.0)
    })
  })
})
