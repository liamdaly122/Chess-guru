import { MATE_RULES, RATING_THRESHOLDS } from '../config/analysis'
import { BRILLIANT, GREAT_MOVE_GAP } from '../config/coach'
import type { PositionAnalysis } from '../engine/uciInfo'
import { negate, winPercent, type Score } from './score'

/** 'book' is never returned by classifyMove; it is set when the move is known opening theory. */
export type MoveRating = 'book' | 'brilliant' | 'great' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

const SEVERITY: Record<MoveRating, number> = {
  book: 0,
  brilliant: 0,
  great: 0,
  best: 0,
  good: 1,
  inaccuracy: 2,
  mistake: 3,
  blunder: 4,
}

export interface MoveJudgement {
  rating: MoveRating
  /** Move that was played, UCI. */
  played: string
  /** Engine's best move in the position before, UCI. */
  bestMove: string | null
  /** Evaluation before and after the move, both from the mover's point of view. */
  scoreBefore: Score
  scoreAfter: Score
  /** Mover's winning chances (0 to 100) before and after. */
  winBefore: number
  winAfter: number
  /** How many Win% points the move lost (never negative). */
  drop: number
  /** Set when the move allowed a forced mate, or let one slip. */
  mateRule?: 'allowed-mate' | 'missed-mate'
}

export interface Thresholds {
  inaccuracy: number
  mistake: number
  blunder: number
}

export interface ClassifyOptions {
  /** Material the move gives away, in pawns (from patterns/sacrifice.ts). Needed for "brilliant". */
  sacrifice?: number
  thresholds?: Thresholds
  mateRules?: typeof MATE_RULES
  greatGap?: number
  brilliant?: typeof BRILLIANT
}

/**
 * Rate a move by comparing the engine's analysis of the position before it and after it.
 * Based on the drop in the mover's winning chances, the way Lichess does it, plus Lichess's
 * extra rules for allowing or missing a forced mate. Returns null if either analysis is missing.
 *
 * The engine's top move is "best", upgraded to:
 * - "great" when the engine's second choice was much worse (it was the only good move);
 * - "brilliant" when it also gives up material and you weren't already completely winning.
 */
export function classifyMove(
  before: PositionAnalysis | undefined,
  after: PositionAnalysis | undefined,
  played: string,
  options: ClassifyOptions = {},
): MoveJudgement | null {
  const {
    sacrifice = 0,
    thresholds = RATING_THRESHOLDS,
    mateRules = MATE_RULES,
    greatGap = GREAT_MOVE_GAP,
    brilliant = BRILLIANT,
  } = options
  const top = before?.lines[0]
  const reply = after?.lines[0]
  if (!before || !top || !reply) return null

  // Before: the mover is the side to move. After: the opponent is, so flip the score.
  const scoreBefore = top.score
  const scoreAfter = negate(reply.score)
  const winBefore = winPercent(scoreBefore)
  const winAfter = winPercent(scoreAfter)
  const drop = Math.max(0, winBefore - winAfter)
  const bestMove = before.bestMove

  let rating: MoveRating = ratingFromDrop(drop, thresholds)
  let mateRule: MoveJudgement['mateRule']

  // Keep the more severe of the two ratings. Record the mate rule either way, as coaching uses it.
  const mate = mateRating(scoreBefore, scoreAfter, mateRules)
  if (mate) {
    mateRule = mate.rule
    if (SEVERITY[mate.rating] > SEVERITY[rating]) rating = mate.rating
  }

  if (played === bestMove) {
    rating = 'best'
    const second = before.lines[1]
    if (second && winPercent(top.score) - winPercent(second.score) >= greatGap) rating = 'great'
  }
  // Checkmating the opponent is always the best move, whatever the engine's preferred mate was.
  if (scoreAfter.kind === 'mate' && scoreAfter.forUs && scoreAfter.moves === 0) rating = 'best'

  if (
    (rating === 'best' || rating === 'great') &&
    sacrifice >= brilliant.minSacrifice &&
    winBefore < brilliant.maxWinBefore &&
    winAfter >= brilliant.minWinAfter
  ) {
    rating = 'brilliant'
  }

  return { rating, played, bestMove, scoreBefore, scoreAfter, winBefore, winAfter, drop, mateRule }
}

function ratingFromDrop(drop: number, t: Thresholds): MoveRating {
  if (drop >= t.blunder) return 'blunder'
  if (drop >= t.mistake) return 'mistake'
  if (drop >= t.inaccuracy) return 'inaccuracy'
  return 'good'
}

function mateRating(
  before: Score,
  after: Score,
  rules: typeof MATE_RULES,
): { rating: MoveRating; rule: 'allowed-mate' | 'missed-mate' } | null {
  const opponentMatesAfter = after.kind === 'mate' && !after.forUs
  const opponentMatedBefore = before.kind === 'mate' && !before.forUs
  const weMatedBefore = before.kind === 'mate' && before.forUs
  const weMateAfter = after.kind === 'mate' && after.forUs

  // You allowed a forced mate that wasn't there before.
  if (opponentMatesAfter && !opponentMatedBefore) {
    if (before.kind === 'cp' && before.cp < -rules.inaccuracyCp) return { rating: 'inaccuracy', rule: 'allowed-mate' }
    if (before.kind === 'cp' && before.cp < -rules.mistakeCp) return { rating: 'mistake', rule: 'allowed-mate' }
    return { rating: 'blunder', rule: 'allowed-mate' }
  }

  // You had a forced mate and let it slip.
  if (weMatedBefore && !weMateAfter) {
    if (after.kind === 'cp' && after.cp > rules.inaccuracyCp) return { rating: 'inaccuracy', rule: 'missed-mate' }
    if (after.kind === 'cp' && after.cp > rules.mistakeCp) return { rating: 'mistake', rule: 'missed-mate' }
    return { rating: 'blunder', rule: 'missed-mate' }
  }

  return null
}
