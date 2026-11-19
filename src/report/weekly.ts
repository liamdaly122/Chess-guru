import type { ThreatResult } from '../coach/threatQuizStore'
import { dayKey } from '../goal/streak'
import { LESSONS } from '../lessons/lessons'
import { progressStats } from '../progress/stats'
import { isPattern, PATTERNS, patternFromCategory, type MistakePattern } from '../puzzles/patterns'
import { ratingSummary } from '../rating/estimate'
import type { GamePhase } from '../review/gamePhase'
import type { LessonCategory } from '../review/types'
import { outcomeOf } from '../storage/gameInfo'
import type { GameRecord, PuzzleAttempt } from '../storage/types'

/** A calendar week, Monday 00:00 to the next Monday 00:00 (local time). `key` is the Monday, "2026-11-16". */
export interface Week {
  key: string
  start: number
  end: number
}

export function weekOf(ms: number): Week {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // back to Monday
  const start = d.getTime()
  const next = new Date(d)
  next.setDate(d.getDate() + 7)
  return { key: dayKey(start), start, end: next.getTime() }
}

/** The week with the given Monday key, or null for a malformed key. */
export function weekFromKey(key: string): Week | null {
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const w = weekOf(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime())
  return w.key === key ? w : null
}

export const previousWeek = (w: Week): Week => weekOf(w.start - 12 * 3600_000)
export const nextWeek = (w: Week): Week => weekOf(w.end + 12 * 3600_000)

/** "16 to 22 Nov" */
export function weekLabel(w: Week): string {
  const first = new Date(w.start)
  const last = new Date(w.end - 1)
  const month = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short' })
  return first.getMonth() === last.getMonth()
    ? `${first.getDate()} to ${last.getDate()} ${month(last)}`
    : `${first.getDate()} ${month(first)} to ${last.getDate()} ${month(last)}`
}

export interface OpeningResult {
  /** The opening family ("Italian Game") and your colour. */
  name: string
  color: 'w' | 'b'
  games: number
  win: number
  draw: number
  loss: number
  /** Points per game, 0 to 1. */
  score: number
}

/** The one thing to work on next week, and where to do it. */
export interface Focus {
  kind: 'play' | 'review' | 'lesson' | 'endgames' | 'openings' | 'puzzles'
  title: string
  text: string
  /** Train page to open, for the drills. */
  page?: string
  category?: LessonCategory
}

export interface WeeklyReport {
  week: Week
  games: { total: number; bot: number; lichess: number; win: number; draw: number; loss: number; reviewed: number; unreviewed: string[] }
  /** Puzzles of every kind (puzzles, your mistakes, opening lines, Play it out), from the daily goal's count. */
  puzzles: number
  rated: { tried: number; solved: number; from: number; to: number } | null
  goalDays: number
  accuracy: number | null
  /** Average accuracy the week before, or null if no reviewed games then. */
  accuracyBefore: number | null
  mistakes: number
  blunders: number
  topPattern: { pattern: MistakePattern; label: string; count: number } | null
  /** The kind of mistake that cost the most this week. */
  costliest: { category: LessonCategory; count: number; winLost: number } | null
  weakestPhase: { phase: GamePhase; perMove: number } | null
  /** Most played first. */
  openings: OpeningResult[]
  best: OpeningResult | null
  worst: OpeningResult | null
  threats: { asked: number; right: number } | null
  rating: { now: number; change: number | null } | null
  summary: string
  focus: Focus
}

export interface ReportInput {
  games: GameRecord[]
  puzzleDays: Record<string, number>
  goalDays: string[]
  attempts: PuzzleAttempt[]
  threats: ThreatResult[]
}

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`
const inWeek = (w: Week, t: number) => t >= w.start && t < w.end
const PHASE_WORD: Record<GamePhase, string> = { opening: 'opening', middlegame: 'middlegame', endgame: 'endgame' }

/** The report for one week, from your own games, puzzles and answers. Templates only. */
export function weeklyReport(week: Week, input: ReportInput): WeeklyReport {
  const games = input.games.filter((g) => inWeek(week, g.endedAt))
  const before = previousWeek(week)
  const stats = progressStats(games)
  const statsBefore = progressStats(input.games.filter((g) => inWeek(before, g.endedAt)))
  const reviewed = games.filter((g) => g.review?.complete)

  const record = { win: 0, draw: 0, loss: 0 }
  for (const g of games) {
    const o = outcomeOf(g)
    if (o !== 'unfinished') record[o]++
  }

  // Mistakes and their patterns, your moves only.
  let mistakes = 0
  let blunders = 0
  const patterns = new Map<MistakePattern, number>()
  for (const g of reviewed) {
    for (const p of g.review!.plies) {
      if (p.color !== g.userColor || !p.judgement) continue
      if (p.judgement.rating === 'mistake') mistakes++
      if (p.judgement.rating === 'blunder') blunders++
      if (p.note) {
        const pattern = p.note.pattern && isPattern(p.note.pattern) ? p.note.pattern : patternFromCategory(p.note.category)
        patterns.set(pattern, (patterns.get(pattern) ?? 0) + 1)
      }
    }
  }
  const top = [...patterns.entries()].sort((a, b) => b[1] - a[1])[0]
  const topPattern = top ? { pattern: top[0], label: PATTERNS[top[0]].label, count: top[1] } : null
  const costliest = stats.patterns[0] ? { category: stats.patterns[0].category, count: stats.patterns[0].count, winLost: stats.patterns[0].winLost } : null
  const weak = stats.weakestPhase ? stats.phases.find((p) => p.phase === stats.weakestPhase)! : null

  const openings = openingResults(games)
  const ranked = openings.length >= 2 ? [...openings].sort((a, b) => b.score - a.score || b.games - a.games) : []
  const best = ranked[0] && ranked[0].score > ranked[ranked.length - 1].score ? ranked[0] : null
  const worst = best ? [...openings].sort((a, b) => a.score - b.score || b.games - a.games)[0] : null

  const attempts = input.attempts.filter((a) => inWeek(week, a.at)).sort((a, b) => a.at - b.at)
  const rated = attempts.length
    ? { tried: attempts.length, solved: attempts.filter((a) => a.solved).length, from: attempts[0].ratingBefore, to: attempts[attempts.length - 1].ratingAfter }
    : null
  const threatList = input.threats.filter((t) => inWeek(week, t.at))
  const threats = threatList.length ? { asked: threatList.length, right: threatList.filter((t) => t.verdict === 'right').length } : null
  const puzzles = Object.entries(input.puzzleDays)
    .filter(([day]) => day >= week.key && day < dayKey(week.end))
    .reduce((n, [, c]) => n + c, 0)
  const goalDays = input.goalDays.filter((day) => day >= week.key && day < dayKey(week.end)).length

  const upTo = (t: number) => ratingSummary(input.games.filter((g) => g.endedAt < t)).estimate
  const ratingNow = upTo(week.end)
  const ratingThen = upTo(week.start)
  const rating = ratingNow && games.some((g) => g.source === 'bot')
    ? { now: Math.round(ratingNow.rating), change: ratingThen ? Math.round(ratingNow.rating - ratingThen.rating) : null }
    : null

  const report: Omit<WeeklyReport, 'summary' | 'focus'> = {
    week,
    games: {
      total: games.length,
      bot: games.filter((g) => g.source === 'bot').length,
      lichess: games.filter((g) => g.source === 'lichess').length,
      ...record,
      reviewed: reviewed.length,
      unreviewed: games.filter((g) => !g.review?.complete).map((g) => g.id),
    },
    puzzles,
    rated,
    goalDays,
    accuracy: stats.avgAccuracy,
    accuracyBefore: statsBefore.avgAccuracy,
    mistakes,
    blunders,
    topPattern,
    costliest,
    weakestPhase: weak ? { phase: weak.phase, perMove: weak.perMove } : null,
    openings,
    best,
    worst,
    threats,
    rating,
  }
  return { ...report, summary: summaryText(report), focus: focusFor(report) }
}

/** Results per opening family and colour, most played first. */
export function openingResults(games: GameRecord[]): OpeningResult[] {
  const map = new Map<string, OpeningResult>()
  for (const g of games) {
    const o = outcomeOf(g)
    if (!g.opening || o === 'unfinished') continue
    const name = g.opening.split(':')[0].trim()
    const key = `${g.userColor}:${name}`
    const r = map.get(key) ?? { name, color: g.userColor, games: 0, win: 0, draw: 0, loss: 0, score: 0 }
    r.games++
    r[o]++
    r.score = (r.win + r.draw / 2) / r.games
    map.set(key, r)
  }
  return [...map.values()].sort((a, b) => b.games - a.games || b.score - a.score)
}

function summaryText(r: Omit<WeeklyReport, 'summary' | 'focus'>): string {
  const g = r.games
  const parts: string[] = []
  if (g.total === 0) {
    parts.push(r.puzzles > 0 ? `No games this week, but you did ${plural(r.puzzles, 'puzzle')}.` : 'Nothing played this week.')
  } else {
    const results = [g.win && plural(g.win, 'win'), g.draw && plural(g.draw, 'draw'), g.loss && plural(g.loss, 'loss', 'losses')]
      .filter(Boolean)
      .join(', ')
    parts.push(`You played ${plural(g.total, 'game')}${results ? ` (${results})` : ''}${r.puzzles ? ` and did ${plural(r.puzzles, 'puzzle')}` : ''}.`)
  }
  if (r.accuracy != null) {
    const acc = Math.round(r.accuracy)
    if (r.accuracyBefore == null) parts.push(`Your accuracy was ${acc}%.`)
    else {
      const diff = Math.round(r.accuracy - r.accuracyBefore)
      parts.push(
        diff === 0
          ? `Your accuracy was ${acc}%, the same as the week before.`
          : `Your accuracy was ${acc}%, ${diff > 0 ? 'up' : 'down'} ${plural(Math.abs(diff), 'point')} on the week before.`,
      )
    }
  }
  return parts.join(' ')
}

function focusFor(r: Omit<WeeklyReport, 'summary' | 'focus'>): Focus {
  if (r.games.total === 0) {
    return { kind: 'play', title: 'Play a few games', text: 'Play some games this week, so the next report has something to go on.' }
  }
  if (r.games.reviewed === 0) {
    return {
      kind: 'review',
      title: "Review this week's games",
      text: `${r.games.total === 1 ? 'This game hasn\'t' : `None of these ${r.games.total} games have`} been reviewed yet, so there are no mistakes to learn from.`,
    }
  }
  if (r.costliest && r.costliest.count >= 2) {
    return {
      kind: 'lesson',
      title: LESSONS[r.costliest.category].title,
      text: `This cost you the most: ${plural(r.costliest.count, 'mistake')} of this kind. Read the lesson, then practise it.`,
      category: r.costliest.category,
    }
  }
  if (r.weakestPhase?.phase === 'endgame') {
    return { kind: 'endgames', title: 'Endgames', text: 'You lost the most per move in the endgame. The endgame drills train the basic techniques.' }
  }
  if (r.weakestPhase?.phase === 'opening') {
    return { kind: 'openings', title: 'Your openings', text: 'You lost the most per move in the opening. Learn your main lines by heart.' }
  }
  return {
    kind: 'puzzles',
    title: 'Puzzles from your weak spots',
    text: r.weakestPhase
      ? `You lost the most per move in the ${PHASE_WORD[r.weakestPhase.phase]}. Tactics puzzles help most there.`
      : 'A few puzzles a day keep your tactics sharp.',
  }
}

/** Whether a week has anything to report. */
export function hasActivity(r: WeeklyReport): boolean {
  return r.games.total > 0 || r.puzzles > 0
}
