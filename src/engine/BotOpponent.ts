import { Chess } from 'chess.js'
import type { Level } from '../config/levels'
import { parseUci } from '../chess/moves'
import { MaiaEngine, type MaiaStatus } from './MaiaEngine'
import type { OpponentEngine } from './OpponentEngine'
import { StockfishOpponent } from './StockfishOpponent'

/**
 * The bot the user plays against. Maia levels are played by Maia-3 (human-like); the rest by
 * limited Stockfish. If Maia can't load or returns something unusable, Stockfish plays the
 * level's fallback settings so the game never gets stuck.
 */
export class BotOpponent implements OpponentEngine {
  private stockfish: OpponentEngine
  private maia: MaiaEngine | null = null
  private makeMaia: () => MaiaEngine
  private statusListeners = new Set<(s: MaiaStatus) => void>()

  constructor(stockfish: OpponentEngine = new StockfishOpponent(), makeMaia: () => MaiaEngine = () => new MaiaEngine()) {
    this.stockfish = stockfish
    this.makeMaia = makeMaia
  }

  whenReady(): Promise<void> {
    return this.stockfish.whenReady()
  }

  async newGame(level: Level): Promise<void> {
    if (level.engine.kind === 'maia') void this.getMaia().load().catch(() => undefined)
    await this.stockfish.newGame(level)
  }

  async chooseMove(fen: string, level: Level, signal?: AbortSignal, priorFens?: string[]): Promise<string | null> {
    if (level.engine.kind === 'maia') {
      const maia = this.getMaia()
      if (maia.getStatus().state !== 'failed') {
        try {
          const uci = await maia.move(fen, level.engine.elo, priorFens)
          if (signal?.aborted) return null
          if (isLegal(fen, uci)) return uci
        } catch {
          // Fall back to Stockfish below.
        }
      }
    }
    return this.stockfish.chooseMove(fen, level, signal)
  }

  /** Loading state of the Maia model, for the "downloading" message. */
  maiaStatus(): MaiaStatus {
    return this.maia?.getStatus() ?? { state: 'idle' }
  }

  onMaiaStatus(fn: (s: MaiaStatus) => void): () => void {
    this.statusListeners.add(fn)
    return () => this.statusListeners.delete(fn)
  }

  dispose(): void {
    this.stockfish.dispose()
    this.maia?.dispose()
    this.statusListeners.clear()
  }

  private getMaia(): MaiaEngine {
    if (!this.maia) {
      this.maia = this.makeMaia()
      this.maia.onStatus((s) => this.statusListeners.forEach((l) => l(s)))
    }
    return this.maia
  }
}

function isLegal(fen: string, uci: string): boolean {
  try {
    new Chess(fen).move(parseUci(uci))
    return true
  } catch {
    return false
  }
}
