import type { Color } from 'chess.js'
import type { MoveRating } from '../chess/classify'
import type { Score } from '../chess/score'
import type { GamePhase } from './gamePhase'

/** Broad groups of mistakes, used for the end-of-game lessons (and Phase 5 tracking). */
export type LessonCategory =
  | 'loose-pieces'
  | 'forks'
  | 'pins-skewers'
  | 'threats'
  | 'king-safety'
  | 'missed-tactics'
  | 'missed-mates'
  | 'general'

export interface PlyJudgement {
  rating: MoveRating
  bestUci: string | null
  bestSan: string | null
  winBefore: number
  winAfter: number
  /** Both from the mover's point of view. */
  scoreBefore: Score
  scoreAfter: Score
  /** Engine's best line from the position before the move. */
  bestLineSan: string[]
}

/** Everything the review screen needs about one half-move. */
export interface PlyReview {
  san: string
  uci: string
  color: Color
  fenBefore: string
  fenAfter: string
  /** Engine evaluation of the position after the move, from White's point of view. */
  evalAfter: Score | null
  /** Both players' moves (version 2 reviews); only the user's in older reviews. */
  judgement?: PlyJudgement
  /** Only for the user's mistakes and blunders. `pattern` is a MistakePattern (puzzles/patterns.ts); older reviews lack it. */
  note?: { text: string; tip: string; category: LessonCategory; pattern?: string }
  /** The user's brilliant, great and best moves: why the move was good. */
  why?: string
  /** The opponent's mistakes and blunders: what the move allowed, told from the user's side. */
  opponentNote?: string
  /** Opening, middlegame or endgame (from the position before the move). Older reviews may lack it. */
  phase?: GamePhase
}

export interface Lesson {
  category: LessonCategory
  title: string
  text: string
  tip: string
  /** Half-move indexes where this came up. */
  plies: number[]
  /** Total winning chances lost, in Win% points. */
  winLost: number
}

/** A finished (or in-progress) analysis of a whole game. */
export interface GameReview {
  /** Evaluation of the starting position, White's point of view. */
  startEval: Score | null
  plies: PlyReview[]
  /** Average move accuracy of the user's moves (0 to 100), Lichess formula. */
  accuracy: number | null
  /** The same for the opponent's moves (version 2). */
  opponentAccuracy?: number | null
  /** 2: both sides rated, with reasons for good moves and the opponent's mistakes. Older reviews are 1 (unset). */
  version?: number
  /** The two or three biggest lessons from the user's mistakes. */
  lessons: Lesson[]
  /** True once every position and note is done. */
  complete: boolean
}

/** Reviews older than this are analysed again when opened (and in the background). */
export const REVIEW_VERSION = 2

/** A finished review in the current format. */
export function isCurrentReview(r: GameReview | undefined | null): r is GameReview {
  return !!r?.complete && (r.version ?? 1) >= REVIEW_VERSION
}
