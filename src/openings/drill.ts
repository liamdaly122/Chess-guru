import { Chess, type Color } from 'chess.js'
import { parseUci } from '../chess/moves'
import { OPENING_TRAINER } from '../config/openingTrainer'
import { masteredBox, nextSchedule, NEVER, type PuzzleResult, type Scheduled } from '../training/srs'
import { positionKey, type BookData } from './book'
import { toUci, type OpeningLine } from './lines'

/** One opening line you are learning, from one side, with its review schedule. */
export interface OpeningDrill extends Scheduled {
  /** "<w|b>:<line id>" */
  id: string
  lineId: string
  eco: string
  name: string
  /** The line's moves, kept with the drill so a later update of the opening list can't change it. */
  san: string[]
  uci: string[]
  /** The side you play. */
  side: Color
  /** Played through once with the moves shown. */
  learned: boolean
  addedAt: number
}

export const MASTERED_BOX = masteredBox(OPENING_TRAINER)

export function drillId(lineId: string, side: Color): string {
  return `${side}:${lineId}`
}

export function newDrill(line: OpeningLine, side: Color, now = Date.now()): OpeningDrill {
  return {
    id: drillId(line.id, side),
    lineId: line.id,
    eco: line.eco,
    name: line.name,
    san: line.san,
    uci: toUci(line.san),
    side,
    learned: false,
    addedAt: now,
    box: 0,
    dueAt: now,
    attempts: 0,
    cleanSolves: 0,
  }
}

export function isMastered(d: OpeningDrill): boolean {
  return d.box >= MASTERED_BOX
}

/** After a run through the line. A first run with the moves shown only marks it as learned. */
export function scheduleDrill(d: OpeningDrill, result: PuzzleResult, now = Date.now()): OpeningDrill {
  if (!d.learned) return { ...d, learned: true, dueAt: now, lastAt: now }
  return nextSchedule(d, result, OPENING_TRAINER, now)
}

/** Reviews that are due (longest waiting first), then new lines in the order you added them. */
export function dueDrills(all: OpeningDrill[], now = Date.now()): OpeningDrill[] {
  const reviews = all.filter((d) => d.learned && !isMastered(d) && d.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id))
  const fresh = all.filter((d) => !d.learned).sort((a, b) => a.addedAt - b.addedAt || a.id.localeCompare(b.id))
  return [...reviews, ...fresh]
}

export interface DrillStats {
  total: number
  due: number
  fresh: number
  learning: number
  mastered: number
  nextDueAt: number | null
}

export function drillStats(all: OpeningDrill[], now = Date.now()): DrillStats {
  const mastered = all.filter(isMastered).length
  const fresh = all.filter((d) => !d.learned).length
  const due = dueDrills(all, now).length - fresh
  const waiting = all.filter((d) => d.learned && !isMastered(d) && d.dueAt > now).map((d) => d.dueAt)
  return {
    total: all.length,
    due,
    fresh,
    learning: all.length - mastered - fresh,
    mastered,
    nextDueAt: due + fresh === 0 && waiting.length ? Math.min(...waiting) : null,
  }
}

/** A run through one line. `ply` = how many of the line's moves have been played. */
export interface DrillRun {
  drill: OpeningDrill
  ply: number
  wrong: number
  /** Hint or "show move" used. */
  helped: boolean
  shown: boolean
}

export function startRun(drill: OpeningDrill): DrillRun {
  return { drill, ply: 0, wrong: 0, helped: false, shown: false }
}

/** Position after the first `ply` moves of the line. */
export function fenAt(drill: OpeningDrill, ply: number): string {
  const chess = new Chess()
  for (const m of drill.uci.slice(0, ply)) chess.move(parseUci(m))
  return chess.fen()
}

export function sideToMove(ply: number): Color {
  return ply % 2 === 0 ? 'w' : 'b'
}

export function isDone(run: DrillRun): boolean {
  return run.ply >= run.drill.uci.length
}

/** True when the next move of the line is the opponent's (the app plays it). */
export function opponentToMove(run: DrillRun): boolean {
  return !isDone(run) && sideToMove(run.ply) !== run.drill.side
}

/** Your next move in the line, if it is your turn. */
export function expectedMove(run: DrillRun): string | null {
  return isDone(run) || opponentToMove(run) ? null : run.drill.uci[run.ply]
}

export type TryResult =
  | { kind: 'correct'; run: DrillRun }
  /** Another book move, just not this line's. No penalty. */
  | { kind: 'other-book'; san: string; run: DrillRun }
  | { kind: 'wrong'; san: string; run: DrillRun }
  | { kind: 'illegal' }

export function tryMove(run: DrillRun, uci: string, book: BookData): TryResult {
  const expected = expectedMove(run)
  if (!expected) return { kind: 'illegal' }
  if (uci === expected) return { kind: 'correct', run: { ...run, ply: run.ply + 1 } }
  const chess = new Chess(fenAt(run.drill, run.ply))
  let san: string
  try {
    san = chess.move(parseUci(uci)).san
  } catch {
    return { kind: 'illegal' }
  }
  if (book[positionKey(chess.fen())] !== undefined) return { kind: 'other-book', san, run }
  // Before the moves are learned they are shown, so a slip there isn't counted.
  const counted = run.drill.learned ? run.wrong + 1 : run.wrong
  return { kind: 'wrong', san, run: { ...run, wrong: counted } }
}

/** Play the opponent's next move of the line. */
export function playReply(run: DrillRun): DrillRun {
  return opponentToMove(run) ? { ...run, ply: run.ply + 1 } : run
}

export function runResult(run: DrillRun): PuzzleResult {
  if (run.shown) return 'failed'
  return run.wrong === 0 && !run.helped ? 'solved' : 'helped'
}

export { NEVER }
