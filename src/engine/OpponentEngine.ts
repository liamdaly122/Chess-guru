import type { Level } from '../config/levels'

/**
 * Anything that can play moves against the user. StockfishOpponent implements it, and
 * BotOpponent (Maia for human-like levels, Stockfish otherwise) wraps it, so the play screen
 * never needs to know which engine it is talking to.
 */
export interface OpponentEngine {
  /** Resolves when the engine has loaded and is ready to play. */
  whenReady(): Promise<void>

  /** Called at the start of every game. */
  newGame(level: Level): Promise<void>

  /**
   * Choose a move for the side to move in `fen`.
   * `priorFens` are the game's earlier positions, oldest first (Maia uses them; Stockfish doesn't).
   * Returns the move in UCI notation (e.g. "e2e4", "e7e8q"), or null if the
   * request was cancelled through `signal` or there is no legal move.
   */
  chooseMove(fen: string, level: Level, signal?: AbortSignal, priorFens?: string[]): Promise<string | null>

  /** Release the engine (terminate workers). */
  dispose(): void
}
