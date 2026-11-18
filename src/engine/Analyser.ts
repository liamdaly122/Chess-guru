import { ANALYSIS } from '../config/analysis'
import { UciEngine } from './uciEngine'
import { parseInfoLine, type PositionAnalysis, type PvLine } from './uciInfo'

/**
 * A second Stockfish instance at full strength, used only for analysis.
 * Never send it a position chess.js hasn't validated: an illegal position crashes the engine.
 */
export class Analyser {
  private engine: UciEngine
  private configured: Promise<void>
  private stopRequested = false

  constructor(engine: UciEngine = new UciEngine()) {
    this.engine = engine
    this.configured = (async () => {
      await engine.setOption('UCI_LimitStrength', false)
      await engine.setOption('Skill Level', 20)
      await engine.setOption('MultiPV', ANALYSIS.multiPv)
    })()
  }

  whenReady(): Promise<void> {
    return this.engine.whenReady().then(() => this.configured)
  }

  /**
   * Analyse one position to the configured depth (or time limit).
   * `onProgress` gets the current best line each time the engine goes a ply deeper.
   * Returns null if the search was stopped with stop().
   */
  async analyse(fen: string, onProgress?: (line: PvLine) => void): Promise<PositionAnalysis | null> {
    await this.configured
    this.stopRequested = false
    const byPv = new Map<number, PvLine>()
    const { bestMove } = await this.engine.search(
      fen,
      `depth ${ANALYSIS.depth} movetime ${ANALYSIS.maxTimeMs}`,
      (raw) => {
        const line = parseInfoLine(raw)
        if (!line) return
        byPv.set(line.multipv, line)
        if (line.multipv === 1) onProgress?.(line)
      },
    )
    if (this.stopRequested) return null

    // Only keep lines searched as deep as the main line, so they compare fairly.
    const main = byPv.get(1)
    const lines = [...byPv.values()]
      .filter((l) => !main || l.depth >= main.depth)
      .sort((a, b) => a.multipv - b.multipv)

    return {
      fen,
      depth: main?.depth ?? 0,
      lines,
      bestMove: bestMove && bestMove !== '(none)' ? bestMove : null,
    }
  }

  /** Stop the current search. Its analyse() call resolves to null. */
  stop(): void {
    this.stopRequested = true
    this.engine.stop()
  }

  dispose(): void {
    this.engine.dispose()
  }
}
