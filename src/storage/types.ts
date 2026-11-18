import type { Color } from 'chess.js'
import type { GameResult } from '../chess/gameStatus'
import type { GameReview } from '../review/types'

export interface PlayerInfo {
  name: string
  rating?: number
}

/** One saved game, as stored in IndexedDB. */
export interface GameRecord {
  /** Bot games: a random id. Lichess games: "lichess:<game id>". */
  id: string
  source: 'bot' | 'lichess'
  /** When the game ended (ms since 1970). Used for sorting. */
  endedAt: number
  white: PlayerInfo
  black: PlayerInfo
  userColor: Color
  result: GameResult | '*'
  /** How the game ended, in words: "checkmate", "resignation", "time", ... */
  termination: string
  /** Set when the game didn't start from the normal position. */
  startFen?: string
  /** Moves in UCI notation. */
  moves: string[]
  /** Bot games: the bot's rating level. */
  botLevel?: number
  takebacks?: number
  hintedPlies?: number[]
  /** Lichess games: link to the game. */
  url?: string
  speed?: string
  /** Opening name (from the book for bot games, from Lichess for imported games). */
  opening?: string
  /** ECO code of the opening, when known. */
  eco?: string
  /** Engine review, once analysed. */
  review?: GameReview
  /** PGN with ratings and coaching notes as comments. Rebuilt whenever the review changes. */
  pgn?: string
}

/** One try at a puzzle. */
export interface PuzzleAttempt {
  /** "<puzzle id>:<time>" */
  id: string
  puzzleId: string
  at: number
  /** Solved with no wrong moves and without showing the solution. */
  solved: boolean
  themes: string[]
  puzzleRating: number
  ratingBefore: number
  ratingAfter: number
}

export const STANDARD_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
