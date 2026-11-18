import { Chess } from 'chess.js'
import { parseUci } from '../chess/moves'
import { negate, winPercent } from '../chess/score'
import { MISTAKE_PUZZLES } from '../config/mistakes'
import type { PositionAnalysis } from '../engine/uciInfo'
import type { GamePhase } from '../review/gamePhase'
import type { LessonCategory } from '../review/types'
import { opponentOf } from '../storage/gameInfo'
import { positionKey } from '../openings/book'
import { dayKey } from '../goal/streak'
import { isBroadPattern, isPattern, patternFromCategory, PATTERNS, type MistakePattern } from './patterns'
import type { GameRecord } from '../storage/types'
import { masteredBox, nextSchedule, type PuzzleResult } from '../training/srs'

/** One time you made the mistake in this position. */
export interface MistakeOccurrence {
  gameId: string
  ply: number
  playedSan: string
  rating: 'mistake' | 'blunder'
  opponent: string
  gameDate: number
  /** Winning chances lost by the move, in Win% points. */
  winLost: number
}

/**
 * A "find the better move" puzzle made from your own mistakes, with its review schedule.
 * One puzzle per position: making the same mistake in the same position in another game
 * adds an occurrence instead of a new puzzle.
 */
export interface MistakePuzzle {
  /** The position key (FEN without move counters). */
  id: string
  /** Position before your move; you are to move. */
  fen: string
  /** Engine's best move, UCI, and in standard notation. */
  solution: string
  solutionSan: string
  pattern: MistakePattern
  category: LessonCategory
  phase?: GamePhase
  /** The coach's note and tip from the latest game. */
  note: string
  tip: string
  /** Your winning chances with the best move, used to judge other moves. */
  winBest: number
  /** Every time you made a mistake here, oldest first. */
  occurrences: MistakeOccurrence[]
  // The latest occurrence, for display.
  gameId: string
  ply: number
  playedSan: string
  rating: 'mistake' | 'blunder'
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

export type { PuzzleResult } from '../training/srs'
export { NEVER, whenText } from '../training/srs'

export const MASTERED_BOX = masteredBox(MISTAKE_PUZZLES)

const RATINGS: readonly string[] = MISTAKE_PUZZLES.ratings

/**
 * The puzzles one reviewed game provides (empty if it isn't fully reviewed). Only mistakes that
 * mattered: not when you were already clearly lost, not when you were still clearly winning
 * afterwards, and at most the few costliest per game.
 */
export function mistakePuzzlesFromGame(game: GameRecord, now = Date.now()): MistakePuzzle[] {
  const review = game.review
  if (!review?.complete) return []
  const out: MistakePuzzle[] = []
  review.plies.forEach((p, ply) => {
    const j = p.judgement
    if (!j || p.color !== game.userColor || !RATINGS.includes(j.rating)) return
    if (!j.bestUci || !j.bestSan || !p.note) return
    if (j.winBefore <= MISTAKE_PUZZLES.minWinBefore || j.winAfter >= MISTAKE_PUZZLES.maxWinAfter) return
    const rating = j.rating as 'mistake' | 'blunder'
    const pattern = p.note.pattern && isPattern(p.note.pattern) ? p.note.pattern : patternFromCategory(p.note.category)
    const occurrence: MistakeOccurrence = {
      gameId: game.id,
      ply,
      playedSan: p.san,
      rating,
      opponent: opponentOf(game).name,
      gameDate: game.endedAt,
      winLost: j.winBefore - j.winAfter,
    }
    out.push({
      id: positionKey(p.fenBefore),
      fen: p.fenBefore,
      solution: j.bestUci,
      solutionSan: j.bestSan,
      pattern,
      category: p.note.category,
      phase: p.phase,
      note: p.note.text,
      tip: p.note.tip,
      winBest: j.winBefore,
      occurrences: [occurrence],
      ...latest(occurrence),
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
    .sort((a, b) => b.occurrences[0].winLost - a.occurrences[0].winLost)
    .slice(0, MISTAKE_PUZZLES.perGame)
    .sort((a, b) => a.ply - b.ply)
}

function latest(o: MistakeOccurrence) {
  return { gameId: o.gameId, ply: o.ply, playedSan: o.playedSan, rating: o.rating, opponent: o.opponent, gameDate: o.gameDate }
}

const occKey = (o: MistakeOccurrence) => `${o.gameId}:${o.ply}`

/**
 * Merge new candidates for a position into the stored puzzle. Occurrences are added once;
 * making the mistake again after you last practised it starts the puzzle again (box 0, due now).
 */
export function mergePuzzle(stored: MistakePuzzle | undefined, fresh: MistakePuzzle, now = Date.now()): MistakePuzzle {
  if (!stored) return fresh
  const have = new Set(stored.occurrences.map(occKey))
  const added = fresh.occurrences.filter((o) => !have.has(occKey(o)))
  if (added.length === 0) {
    // A re-analysed game can name the pattern more precisely (a fork becomes a knight fork).
    return isBroadPattern(stored.pattern) && fresh.pattern !== stored.pattern && !isBroadPattern(fresh.pattern)
      ? { ...stored, pattern: fresh.pattern, note: fresh.note, tip: fresh.tip }
      : stored
  }
  const occurrences = [...stored.occurrences, ...added].sort((a, b) => a.gameDate - b.gameDate || a.ply - b.ply)
  const newest = occurrences[occurrences.length - 1]
  const madeAgain = added.some((o) => o.gameDate > (stored.lastAt ?? stored.createdAt))
  return {
    ...stored,
    occurrences,
    ...latest(newest),
    // The latest game's note and pattern describe the latest mistake.
    ...(newest === added[added.length - 1] ? { note: fresh.note, tip: fresh.tip, pattern: fresh.pattern, category: fresh.category } : {}),
    ...(madeAgain && stored.attempts > 0 ? { box: 0, dueAt: Math.min(now, newest.gameDate) } : {}),
  }
}

/** Merge candidates from several games that share a position. */
export function groupByPosition(candidates: MistakePuzzle[], now = Date.now()): Map<string, MistakePuzzle> {
  const out = new Map<string, MistakePuzzle>()
  for (const c of candidates) out.set(c.id, mergePuzzle(out.get(c.id), c, now))
  return out
}

/** Update a puzzle's schedule after an attempt. */
export function schedule(p: MistakePuzzle, result: PuzzleResult, now = Date.now()): MistakePuzzle {
  return nextSchedule(p, result, MISTAKE_PUZZLES, now)
}

export function isMastered(p: MistakePuzzle): boolean {
  return p.box >= MASTERED_BOX
}

/** Oldest due first; ties in game and move order, so the order is stable. */
export function byDue(a: MistakePuzzle, b: MistakePuzzle): number {
  return a.dueAt - b.dueAt || a.gameDate - b.gameDate || a.ply - b.ply || a.id.localeCompare(b.id)
}

/** Puzzles to do now, the longest-waiting first. */
export function duePuzzles(all: MistakePuzzle[], now = Date.now()): MistakePuzzle[] {
  return all.filter((p) => !isMastered(p) && p.dueAt <= now).sort(byDue)
}

export interface PatternStat {
  pattern: MistakePattern
  label: string
  tip: string
  /** Times you made it in the last `patternWindowDays` days, and in how many games. */
  times: number
  games: number
  /** All time. */
  timesEver: number
  winLost: number
  puzzles: number
  due: number
  mastered: number
  improving: boolean
}

/** Your mistake patterns, most common (recently) first. */
export function patternStats(all: MistakePuzzle[], now = Date.now()): PatternStat[] {
  const since = now - MISTAKE_PUZZLES.patternWindowDays * DAY
  const groups = new Map<MistakePattern, MistakePuzzle[]>()
  for (const p of all) groups.set(p.pattern, [...(groups.get(p.pattern) ?? []), p])
  return [...groups.entries()]
    .map(([pattern, list]) => {
      const occ = list.flatMap((p) => p.occurrences)
      const recent = occ.filter((o) => o.gameDate >= since)
      const settled = list.filter((p) => p.box >= 2).length
      return {
        pattern,
        label: PATTERNS[pattern].label,
        tip: PATTERNS[pattern].tip,
        times: recent.length,
        games: new Set(recent.map((o) => o.gameId)).size,
        timesEver: occ.length,
        winLost: occ.reduce((s, o) => s + o.winLost, 0),
        puzzles: list.length,
        due: list.filter((p) => !isMastered(p) && p.dueAt <= now).length,
        mastered: list.filter(isMastered).length,
        improving: settled / list.length >= MISTAKE_PUZZLES.improvingShare,
      }
    })
    .sort((a, b) => b.times - a.times || b.timesEver - a.timesEver || b.winLost - a.winLost || a.pattern.localeCompare(b.pattern))
}

const DAY = 24 * 60 * 60 * 1000

export interface TodaysSet {
  /** Positions left for today, from your most common patterns first. */
  queue: MistakePuzzle[]
  doneToday: number
  limit: number
  /** Due positions beyond today's set. */
  waiting: number
}

/** Today's set: up to `dailyLimit` positions a day, most common patterns first. */
export function todaysSet(all: MistakePuzzle[], now = Date.now()): TodaysSet {
  const today = dayKey(now)
  const doneToday = all.filter((p) => p.lastAt && dayKey(p.lastAt) === today).length
  const rank = new Map(patternStats(all, now).map((s, i) => [s.pattern, i]))
  const due = duePuzzles(all, now).sort((a, b) => (rank.get(a.pattern) ?? 99) - (rank.get(b.pattern) ?? 99) || byDue(a, b))
  const left = Math.max(0, MISTAKE_PUZZLES.dailyLimit - doneToday)
  return { queue: due.slice(0, left), doneToday, limit: MISTAKE_PUZZLES.dailyLimit, waiting: Math.max(0, due.length - left) }
}

/** After today's set: the next due positions, most common patterns first (no daily limit). */
export function moreDue(all: MistakePuzzle[], now = Date.now()): MistakePuzzle[] {
  const rank = new Map(patternStats(all, now).map((s, i) => [s.pattern, i]))
  return duePuzzles(all, now)
    .sort((a, b) => (rank.get(a.pattern) ?? 99) - (rank.get(b.pattern) ?? 99) || byDue(a, b))
    .slice(0, MISTAKE_PUZZLES.dailyLimit)
}

/** A "Solve" set for one pattern: positions still being learnt first (due, then lowest box, then most recent). */
export function patternSet(all: MistakePuzzle[], pattern: string, now = Date.now()): MistakePuzzle[] {
  const list = all.filter((p) => p.pattern === pattern)
  const order = (a: MistakePuzzle, b: MistakePuzzle) =>
    Number(isMastered(a)) - Number(isMastered(b)) ||
    Number(a.dueAt > now) - Number(b.dueAt > now) ||
    a.box - b.box ||
    b.gameDate - a.gameDate ||
    a.id.localeCompare(b.id)
  return [...list].sort(order).slice(0, MISTAKE_PUZZLES.patternSet)
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

export type AttemptCheck =
  | { verdict: 'correct' }
  | { verdict: 'illegal' }
  | { verdict: 'needs-engine'; fenAfter: string }

/** First check of a move: the engine's move or any checkmate is correct; anything else needs the engine. */
export function checkAttempt(p: Pick<MistakePuzzle, 'fen' | 'solution'>, uci: string): AttemptCheck {
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
export function isGoodAlternative(p: Pick<MistakePuzzle, 'winBest'>, after: PositionAnalysis, tolerance = MISTAKE_PUZZLES.alternativeTolerance): boolean {
  const top = after.lines[0]
  if (!top) return false
  const yourWin = winPercent(negate(top.score))
  return p.winBest - yourWin < tolerance
}
