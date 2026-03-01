export class VisionTestSession {
  private levels: number[];
  private currentLevelIdx: number;
  private phase: 'warmup' | 'screening' | 'determination' | 'finished';
  private finalResult: number;

  // 確定フェーズ用のカウント状態
  private currentPassCount: number = 0;
  private currentFailCount: number = 0;

  constructor(levels: number[]) {
    if (levels.length === 0) {
      throw new Error('Levels array cannot be empty');
    }
    // ソートされている前提
    this.levels = levels;
    this.currentLevelIdx = 0;
    this.phase = 'warmup';
    this.finalResult = 0.1;
  }

  getCurrentAcuity(): number {
    return this.levels[this.currentLevelIdx]!;
  }

  getPhase(): 'warmup' | 'screening' | 'determination' | 'finished' {
    return this.phase;
  }

  getCurrentPassCount(): number {
    return this.currentPassCount;
  }

  getCurrentFailCount(): number {
    return this.currentFailCount;
  }

  isFinished(): boolean {
    return this.phase === 'finished';
  }

  getFinalResult(): number {
    if (!this.isFinished()) {
      throw new Error('Test is not finished yet');
    }
    return this.finalResult;
  }

  private resetCounts() {
    this.currentPassCount = 0;
    this.currentFailCount = 0;
  }

  input(isCorrect: boolean): void {
    if (this.phase === 'finished') return;

    if (this.phase === 'warmup') {
      if (isCorrect) {
        // Warmup通過、次はScreeningフェーズへ
        this.phase = 'screening';
        this.currentLevelIdx = Math.min(2, this.levels.length - 1);
        this.resetCounts();
      } else {
        // 失敗したら即終了
        this.phase = 'finished';
        this.finalResult = this.levels[0]!;
      }
      return;
    }

    if (this.phase === 'screening') {
      if (isCorrect) {
        // スクリーニング：2段階ずつ飛ばす
        this.currentLevelIdx += 2;
        if (this.currentLevelIdx >= this.levels.length) {
          // 最上位レベルを超えた場合は最上位レベルでの確定フェーズへ
          this.phase = 'determination';
          this.currentLevelIdx = this.levels.length - 1;
          this.resetCounts();
        }
      } else {
        // 間違えたら：確定フェーズへ移行し、1段階戻る
        this.phase = 'determination';
        this.currentLevelIdx = Math.max(0, this.currentLevelIdx - 1);
        this.resetCounts();
      }
      return;
    }

    if (this.phase === 'determination') {
      if (isCorrect) {
        this.currentPassCount++;
      } else {
        this.currentFailCount++;
      }

      // 3回正解でそのレベルは「パス」
      if (this.currentPassCount >= 3) {
        if (this.currentLevelIdx >= this.levels.length - 1) {
          // すでに最上位ならここで検査終了、最高視力を結果とする
          this.phase = 'finished';
          this.finalResult = this.levels[this.levels.length - 1]!;
        } else {
          // まだ上がある場合は1段階上げてリセット
          this.currentLevelIdx++;
          this.resetCounts();
        }
      } 
      // 3回不正解でそのレベルは「フェイル」
      else if (this.currentFailCount >= 3) {
        this.phase = 'finished';
        // 最後にパスしたレベル（現在の1つ下）を最終結果とする。
        // （index 0でいきなり落ちた場合は最低視力でフォールバック）
        this.finalResult = this.levels[Math.max(0, this.currentLevelIdx - 1)]!;
      }
      return;
    }
  }
}
