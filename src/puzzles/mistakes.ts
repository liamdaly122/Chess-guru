import { Chess } from 'chess.js'
import { parseUci } from '../chess/moves'
import { negate, winPercent } from '../chess/score'
import { MISTAKE_PUZZLES } from '../config/mistakes'
import type { PositionAnalysis } from '../engine/uciInfo'
import type { GamePhase } from '../review/gamePhase'
import type { LessonCategory } from '../review/types'
import { opponentOf } from '../storage/gameInfo'
import type { GameRecord } from '../storage/types'

/** A "find the better move" puzzle made from one of your own mistakes, with its review schedule. */
export interface MistakePuzzle {
  /** "<game id>:<half-move index>" */
  id: string
  gameId: string
  ply: number
  /** Position before your move; you are to move. */
  fen: string
  /** Engine's best move, UCI, and in standard notation. */
  solution: string
  solutionSan: string
  /** The move you played in the game. */
  playedSan: string
  rating: 'mistake' | 'blunder'
  category: LessonCategory
  phase?: GamePhase
  /** The coach's note and tip from the game. */
  note: string
  tip: string
  /** Your winning chances with the best move, used to judge other moves. */
  winBest: number
  opponent: string
  gameDate: number
  createdAt: number
  /** Spaced repetition: 0 = new or being relearnt; the last box + 1 = mastered. */
  box: number
  dueAt: number
  attempts: number
  cleanSolves: number
  lastResult?: PuzzleResult
  lastAt?: number
}

/** solved: first try, no help. helped: solved with a hint or after wrong tries. failed: solution shown. */
export type PuzzleResult = 'solved' | 'helped' | 'failed'

const DAY = 24 * 60 * 60 * 1000
const MINUTE = 60 * 1000
export const MASTERED_BOX = MISTAKE_PUZZLES.intervalsDays.length + 1
/** "Due" time for mastered puzzles. A big ordinary number, not Infinity, so it survives JSON backups. */
export const NEVER = Number.MAX_SAFE_INTEGER

const RATINGS: readonly string[] = MISTAKE_PUZZLES.ratings

/** The puzzles one reviewed game provides (empty if it isn't fully reviewed). */
export function mistakePuzzlesFromGame(game: GameRecord, now = Date.now()): MistakePuzzle[] {
  const review = game.review
  if (!review?.complete) return []
  const out: MistakePuzzle[] = []
  review.plies.forEach((p, ply) => {
    const j = p.judgement
    if (!j || p.color !== game.userColor || !RATINGS.includes(j.rating)) return
    if (!j.bestUci || !j.bestSan || !p.note) return
    out.push({
      id: `${game.id}:${ply}`,
      gameId: game.id,
      ply,
      fen: p.fenBefore,
      solution: j.bestUci,
      solutionSan: j.bestSan,
      playedSan: p.san,
      rating: j.rating as 'mistake' | 'blunder',
      category: p.note.category,
      phase: p.phase,
      note: p.note.text,
      tip: p.note.tip,
      winBest: j.winBefore,
      opponent: opponentOf(game).name,
      gameDate: game.endedAt,
      createdAt: now,
      box: 0,
      // Due from when the game was played, so a new puzzle is always ready straight away
      // (a screen that read the clock a moment earlier still counts it as due).
      dueAt: Math.min(now, game.endedAt),
      attempts: 0,
      cleanSolves: 0,
    })
  })
  return out
}

/** Update a puzzle's schedule after an attempt. */
export function schedule(p: MistakePuzzle, result: PuzzleResult, now = Date.now()): MistakePuzzle {
  const base = { ...p, attempts: p.attempts + 1, lastResult: result, lastAt: now }
  if (result === 'solved') {
    const box = Math.min(p.box + 1, MASTERED_BOX)
    const days = MISTAKE_PUZZLES.intervalsDays[box - 1]
    return { ...base, box, cleanSolves: p.cleanSolves + 1, dueAt: box >= MASTERED_BOX ? NEVER : now + days * DAY }
  }
  if (result === 'helped') return { ...base, dueAt: now + MISTAKE_PUZZLES.helpedDays * DAY }
  return { ...base, box: 0, dueAt: now + MISTAKE_PUZZLES.retryMinutes * MINUTE }
}

export function isMastered(p: MistakePuzzle): boolean {
  return p.box >= MASTERED_BOX
}

/** Oldest due first; ties (e.g. new puzzles from one game) in game and move order, so the order is stable. */
export function byDue(a: MistakePuzzle, b: MistakePuzzle): number {
  return a.dueAt - b.dueAt || a.gameDate - b.gameDate || a.id.localeCompare(b.id, undefined, { numeric: true })
}

/** Puzzles to do now, the longest-waiting first. */
export function duePuzzles(all: MistakePuzzle[], now = Date.now()): MistakePuzzle[] {
  return all.filter((p) => !isMastered(p) && p.dueAt <= now).sort(byDue)
}

export interface MistakeStats {
  total: number
  due: number
  learning: number
  mastered: number
  /** When the next one is due, if none are due now. */
  nextDueAt: number | null
}

export function mistakeStats(all: MistakePuzzle[], now = Date.now()): MistakeStats {
  const mastered = all.filter(isMastered).length
  const due = duePuzzles(all, now).length
  const waiting = all.filter((p) => !isMastered(p) && p.dueAt > now).map((p) => p.dueAt)
  return {
    total: all.length,
    due,
    learning: all.length - mastered,
    mastered,
    nextDueAt: due === 0 && waiting.length ? Math.min(...waiting) : null,
  }
}

/** "in 10 minutes", "tomorrow", "in 3 days" */
export function whenText(dueAt: number, now = Date.now()): string {
  if (dueAt >= NEVER) return 'never (mastered)'
  const ms = dueAt - now
  if (ms <= 0) return 'now'
  if (ms < 60 * MINUTE) {
    const m = Math.max(1, Math.round(ms / MINUTE))
    return `in ${m} minute${m === 1 ? '' : 's'}`
  }
  if (ms < 20 * 60 * MINUTE) {
    const h = Math.round(ms / (60 * MINUTE))
    return `in ${h} hour${h === 1 ? '' : 's'}`
  }
  const days = Math.round(ms / DAY)
  return days === 1 ? 'tomorrow' : `in ${days} days`
}

export type AttemptCheck =
  | { verdict: 'correct' }
  | { verdict: 'illegal' }
  | { verdict: 'needs-engine'; fenAfter: string }

/** First check of a move: the engine's move or any checkmate is correct; anything else needs the engine. */
export function checkAttempt(p: MistakePuzzle, uci: string): AttemptCheck {
  if (uci === p.solution) return { verdict: 'correct' }
  const chess = new Chess(p.fen)
  try {
    chess.move(parseUci(uci))
  } catch {
    return { verdict: 'illegal' }
  }
  if (chess.isCheckmate()) return { verdict: 'correct' }
  return { verdict: 'needs-engine', fenAfter: chess.fen() }
}

/**
 * Is a different move just as good? Compare your winning chances after it (from the engine's
 * analysis of the position after your move, where the opponent is to move) with the best move's.
 */
export function isGoodAlternative(p: MistakePuzzle, after: PositionAnalysis, tolerance = MISTAKE_PUZZLES.alternativeTolerance): boolean {
  const top = after.lines[0]
  if (!top) return false
  const yourWin = winPercent(negate(top.score))
  return p.winBest - yourWin < tolerance
}
