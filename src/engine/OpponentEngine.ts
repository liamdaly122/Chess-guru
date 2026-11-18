import type { Level } from '../config/levels'

/**
 * Anything that can play moves against the user.
 * Stockfish implements this now. Maia (Phase 6) will implement the same interface,
 * so the play screen never needs to know which engine it is talking to.
 */
export interface OpponentEngine {
  /** Short name for display, e.g. "Stockfish". */
  readonly name: string

  /** Resolves when the engine has loaded and is ready to play. */
  whenReady(): Promise<void>

  /** Called at the start of every game. */
  newGame(level: Level): Promise<void>

  /**
   * Choose a move for the side to move in `fen`.
   * Returns the move in UCI notation (e.g. "e2e4", "e7e8q"), or null if the
   * request was cancelled through `signal` or there is no legal move.
   */
  chooseMove(fen: string, level: Level, signal?: AbortSignal): Promise<string | null>

  /** Release the engine (terminate workers). */
  dispose(): void
}
