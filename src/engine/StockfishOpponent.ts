import { Chess } from 'chess.js'
import type { EngineSettings, Level } from '../config/levels'
import type { OpponentEngine } from './OpponentEngine'
import { UciEngine } from './uciEngine'

/** Plays against the user using Stockfish with limited strength. */
export class StockfishOpponent implements OpponentEngine {
  readonly name = 'Stockfish'
  private engine: UciEngine
  /** Settings last sent to the engine, so we only send setoption when they change. */
  private appliedKey = ''
  private random: () => number

  constructor(engine: UciEngine = new UciEngine(), random: () => number = Math.random) {
    this.engine = engine
    this.random = random
  }

  whenReady(): Promise<void> {
    return this.engine.whenReady()
  }

  async newGame(level: Level): Promise<void> {
    await this.engine.newGame()
    await this.apply(level.engine)
  }

  async chooseMove(fen: string, level: Level, signal?: AbortSignal): Promise<string | null> {
    if (signal?.aborted) return null
    const settings = level.engine

    if (settings.kind === 'skill' && this.random() < settings.randomMoveChance) {
      const move = randomLegalMove(fen, this.random)
      if (move) return move
    }

    await this.apply(settings)
    if (signal?.aborted) return null

    const go = settings.kind === 'elo' ? `movetime ${settings.moveTimeMs}` : `depth ${settings.depth}`
    const onAbort = () => this.engine.stop()
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const { bestMove } = await this.engine.search(fen, go)
      if (signal?.aborted || !bestMove || bestMove === '(none)') return null
      return bestMove
    } finally {
      signal?.removeEventListener('abort', onAbort)
    }
  }

  dispose(): void {
    this.engine.dispose()
  }

  private async apply(settings: EngineSettings): Promise<void> {
    const key = JSON.stringify(settings)
    if (key === this.appliedKey) return
    if (settings.kind === 'elo') {
      await this.engine.setOption('UCI_LimitStrength', true)
      await this.engine.setOption('UCI_Elo', settings.elo)
    } else {
      // UCI_LimitStrength overrides Skill Level, so it must be off here.
      await this.engine.setOption('UCI_LimitStrength', false)
      await this.engine.setOption('Skill Level', settings.skill)
    }
    this.appliedKey = key
  }
}

/** Pick a uniformly random legal move, returned in UCI notation. */
export function randomLegalMove(fen: string, random: () => number = Math.random): string | null {
  const moves = new Chess(fen).moves({ verbose: true })
  if (moves.length === 0) return null
  const m = moves[Math.floor(random() * moves.length)]
  return m.from + m.to + (m.promotion ?? '')
}
