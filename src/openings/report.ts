import { Chess, type Color } from 'chess.js'
import { parseUci } from '../chess/moves'
import { phaseScores } from '../review/keyMoments'
import { outcomeOf } from '../storage/gameInfo'
import { STANDARD_START, type GameRecord } from '../storage/types'
import { bookStatus, type BookData } from './book'
import { family } from './lines'

/** One game, as the opening report sees it. */
export interface OpeningGame {
  id: string
  endedAt: number
  outcome: 'win' | 'draw' | 'loss'
  /** Half-moves played in book. */
  bookPlies: number
  /** Who played the first move out of book: you, them, or null if the game never left it. */
  leftBy: 'you' | 'them' | null
  /** Your move out of book, "4.d3" or "4...d6", when you left first. */
  exit: string | null
  /** Your Win% after your 10th move, from the review. */
  winAt10: number | null
  /** Your accuracy in the opening phase (book moves excluded), from the review. */
  accuracy: number | null
  /** The full opening name, e.g. "Italian Game: Two Knights Defense". */
  fullName: string
}

export interface OpeningStat {
  /** The opening family ("Italian Game") and your colour. */
  name: string
  color: Color
  games: number
  win: number
  draw: number
  loss: number
  /** Points per game, 0 to 1. */
  score: number
  /** Points above (or below) an even score: points minus half the games. */
  net: number
  /** Average full moves in book. */
  bookMoves: number
  youLeft: number
  theyLeft: number
  /** Your most common move out of book. */
  exit: { move: string; count: number } | null
  /** At move 10 (reviewed games that got that far). */
  at10: { games: number; average: number; ahead: number; level: number; behind: number } | null
  accuracy: number | null
  /** The variations you reached, most played first. */
  variations: { name: string; games: number }[]
  /** Newest first. */
  gameIds: string[]
}

/** Win% at or above this after move 10 counts as ahead, at or below 100 minus it as behind. */
export const AHEAD_AT = 60
/** An opening needs this many games before it is called costly or good for you. */
export const MIN_GAMES_TO_JUDGE = 3

/** How one finished game from the normal start went in the opening, or null if it doesn't count. */
export function openingGame(g: GameRecord, book: BookData): OpeningGame | null {
  const outcome = outcomeOf(g)
  if (outcome === 'unfinished') return null
  if (g.startFen && g.startFen !== STANDARD_START) return null
  const chess = new Chess()
  const positions = [chess.fen()]
  const sans: string[] = []
  try {
    for (const m of g.moves) {
      sans.push(chess.move(parseUci(m)).san)
      positions.push(chess.fen())
    }
  } catch {
    return null
  }
  if (!sans.length) return null
  const status = bookStatus(book, positions)
  const at = status.leftBookAt
  const leaver: Color | null = at === null ? null : at % 2 === 0 ? 'w' : 'b'
  const leftBy = leaver === null ? null : leaver === g.userColor ? 'you' : 'them'
  const exit = at !== null && leftBy === 'you' ? `${Math.floor(at / 2) + 1}${leaver === 'w' ? '.' : '...'}${sans[at]}` : null

  let winAt10: number | null = null
  let accuracy: number | null = null
  if (g.review?.complete) {
    const tenth = g.review.plies[g.userColor === 'w' ? 18 : 19]
    if (tenth?.color === g.userColor && tenth.judgement) winAt10 = tenth.judgement.winAfter
    accuracy = phaseScores(g.review, g.userColor).find((p) => p.phase === 'opening')?.accuracy ?? null
  }
  return {
    id: g.id,
    endedAt: g.endedAt,
    outcome,
    bookPlies: at ?? sans.length,
    leftBy,
    exit,
    winAt10,
    accuracy,
    fullName: g.opening ?? status.opening?.name ?? 'Unnamed opening',
  }
}

/** The report: one entry per opening family and colour, most played first. */
export function openingReport(games: GameRecord[], book: BookData): OpeningStat[] {
  const groups = new Map<string, { color: Color; name: string; list: OpeningGame[] }>()
  for (const g of games) {
    const og = openingGame(g, book)
    if (!og) continue
    const name = family(og.fullName)
    const key = `${g.userColor}:${name}`
    const group = groups.get(key) ?? { color: g.userColor, name, list: [] }
    group.list.push(og)
    groups.set(key, group)
  }
  return [...groups.values()].map(({ color, name, list }) => stat(name, color, list)).sort((a, b) => b.games - a.games || b.score - a.score)
}

function stat(name: string, color: Color, list: OpeningGame[]): OpeningStat {
  const count = (o: OpeningGame['outcome']) => list.filter((g) => g.outcome === o).length
  const win = count('win')
  const draw = count('draw')
  const loss = count('loss')
  const points = win + draw / 2
  const exits = tally(list.flatMap((g) => (g.exit ? [g.exit] : [])))
  const at10 = list.flatMap((g) => (g.winAt10 == null ? [] : [g.winAt10]))
  const acc = list.flatMap((g) => (g.accuracy == null ? [] : [g.accuracy]))
  return {
    name,
    color,
    games: list.length,
    win,
    draw,
    loss,
    score: points / list.length,
    net: points - list.length / 2,
    bookMoves: average(list.map((g) => g.bookPlies / 2))!,
    youLeft: list.filter((g) => g.leftBy === 'you').length,
    theyLeft: list.filter((g) => g.leftBy === 'them').length,
    exit: exits[0] ? { move: exits[0].name, count: exits[0].games } : null,
    at10: at10.length
      ? {
          games: at10.length,
          average: average(at10)!,
          ahead: at10.filter((w) => w >= AHEAD_AT).length,
          level: at10.filter((w) => w > 100 - AHEAD_AT && w < AHEAD_AT).length,
          behind: at10.filter((w) => w <= 100 - AHEAD_AT).length,
        }
      : null,
    accuracy: average(acc),
    variations: tally(list.map((g) => g.fullName)),
    gameIds: [...list].sort((a, b) => b.endedAt - a.endedAt).map((g) => g.id),
  }
}

/** The openings losing you the most points, and the ones winning you the most (enough games only). */
export function costingAndWorking(stats: OpeningStat[]): { costing: OpeningStat[]; working: OpeningStat[] } {
  const judged = stats.filter((s) => s.games >= MIN_GAMES_TO_JUDGE)
  return {
    costing: judged.filter((s) => s.net < 0).sort((a, b) => a.net - b.net || b.games - a.games),
    working: judged.filter((s) => s.net > 0).sort((a, b) => b.net - a.net || b.games - a.games),
  }
}

const side = (c: Color) => (c === 'w' ? 'White' : 'Black')
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The coach's summary of the report. */
export function openingSummary(stats: OpeningStat[]): string {
  const games = stats.reduce((n, s) => n + s.games, 0)
  if (games === 0) return 'No finished games from the normal starting position yet. Play or import a few and your openings show up here.'
  const { costing, working } = costingAndWorking(stats)
  const parts = [`You've played ${plural(stats.length, 'opening')} in ${plural(games, 'game')}.`]
  const worst = costing[0]
  if (worst) {
    parts.push(
      `${worst.name} as ${side(worst.color)} costs you the most: ${worst.win} won, ${worst.loss} lost${worst.draw ? `, ${worst.draw} drawn` : ''} in ${plural(worst.games, 'game')}.`,
    )
  }
  const best = working[0]
  if (best) parts.push(`${best.name} as ${side(best.color)} works best: ${Math.round(best.score * 100)}% from ${plural(best.games, 'game')}.`)
  if (!worst && !best) parts.push(`An opening needs ${MIN_GAMES_TO_JUDGE} games before it counts as working for you or against you.`)
  return parts.join(' ')
}

function tally(items: string[]): { name: string; games: number }[] {
  const m = new Map<string, number>()
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1)
  return [...m.entries()].map(([name, games]) => ({ name, games })).sort((a, b) => b.games - a.games || a.name.localeCompare(b.name))
}

function average(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}
