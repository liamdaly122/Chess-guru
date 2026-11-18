import { RATING } from '../config/rating'
import { LEVELS, type Level } from '../config/levels'
import { outcomeOf } from '../storage/gameInfo'
import type { GameRecord } from '../storage/types'

/**
 * An estimate of your playing rating from results against the bot: the rating at which your
 * expected score (Elo formula) equals your actual score, over your recent games, plus one
 * imaginary draw against the average level so all-win or all-loss runs stay sensible. The bot
 * levels are Maia's Lichess-style ratings (Stockfish above 1800), so the estimate is on roughly
 * the same scale. Accuracy isn't used: at any rating it varies too much from game to game.
 */
export interface RatingEstimate {
  rating: number
  /** About one standard error either side. */
  plusMinus: number
  games: number
  wins: number
  draws: number
  losses: number
}

/** Games that count: against the bot, from the normal start, finished, with no takebacks, hints or blunder check. */
export function countsForRating(g: GameRecord): boolean {
  return (
    g.source === 'bot' &&
    typeof g.botLevel === 'number' &&
    !g.startFen &&
    g.result !== '*' &&
    !(g.takebacks ?? 0) &&
    !(g.hintedPlies?.length ?? 0) &&
    !g.blunderCheck
  )
}

const expected = (r: number, opp: number) => 1 / (1 + 10 ** ((opp - r) / 400))

/** Rating whose expected score against these opponents matches the score. */
export function performanceRating(results: { opp: number; score: number }[], priorDraws = RATING.priorDraws): RatingEstimate | null {
  if (results.length === 0) return null
  const avgOpp = results.reduce((s, r) => s + r.opp, 0) / results.length
  const all = [...results, ...Array.from({ length: priorDraws }, () => ({ opp: avgOpp, score: 0.5 }))]
  const total = all.reduce((s, r) => s + r.score, 0)
  // Expected score rises with rating, so a bisection finds the match.
  let lo = -1000
  let hi = 5000
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const e = all.reduce((s, r) => s + expected(mid, r.opp), 0)
    if (e < total) lo = mid
    else hi = mid
  }
  const rating = (lo + hi) / 2
  const info = all.reduce((s, r) => s + expected(rating, r.opp) * (1 - expected(rating, r.opp)), 0)
  const plusMinus = 400 / Math.LN10 / Math.sqrt(info)
  return {
    rating: Math.round(rating / 10) * 10,
    plusMinus: Math.round(plusMinus / 10) * 10,
    games: results.length,
    wins: results.filter((r) => r.score === 1).length,
    draws: results.filter((r) => r.score === 0.5).length,
    losses: results.filter((r) => r.score === 0).length,
  }
}

function resultsOf(games: GameRecord[]) {
  return games.map((g) => {
    const o = outcomeOf(g)
    return { opp: g.botLevel!, score: o === 'win' ? 1 : o === 'draw' ? 0.5 : 0 }
  })
}

export interface RatingSummary {
  /** null until there are enough games. */
  estimate: RatingEstimate | null
  /** Games that count so far (all time). */
  counted: number
  /** Change since `RATING.trendGames` games ago, when both estimates exist. */
  trend: number | null
}

/** The estimate from your recent bot games (newest first or in any order). */
export function ratingSummary(all: GameRecord[]): RatingSummary {
  const games = all.filter(countsForRating).sort((a, b) => b.endedAt - a.endedAt)
  const est = (list: GameRecord[]) =>
    list.length >= RATING.minGames ? performanceRating(resultsOf(list.slice(0, RATING.window))) : null
  const estimate = est(games)
  const before = est(games.slice(RATING.trendGames))
  return { estimate, counted: games.length, trend: estimate && before ? estimate.rating - before.rating : null }
}

/** The bot level nearest your estimate (the higher one on a tie, for a fair challenge). */
export function suggestedLevel(rating: number): Level {
  return LEVELS.reduce((best, l) =>
    Math.abs(l.rating - rating) < Math.abs(best.rating - rating) ||
    (Math.abs(l.rating - rating) === Math.abs(best.rating - rating) && l.rating > best.rating)
      ? l
      : best,
  )
}

/** Your latest Lichess rating per speed (blitz, rapid, ...), from imported games. */
export function lichessRatings(all: GameRecord[]): { speed: string; rating: number }[] {
  const latest = new Map<string, { rating: number; at: number }>()
  for (const g of all) {
    if (g.source !== 'lichess' || !g.speed) continue
    const rating = (g.userColor === 'w' ? g.white : g.black).rating
    if (typeof rating !== 'number') continue
    const prev = latest.get(g.speed)
    if (!prev || g.endedAt > prev.at) latest.set(g.speed, { rating, at: g.endedAt })
  }
  const order = ['bullet', 'blitz', 'rapid', 'classical', 'correspondence']
  return [...latest.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([speed, v]) => ({ speed, rating: v.rating }))
}

/** Starting puzzle rating: your estimate once you have one and haven't tried a puzzle yet. */
export function puzzleStartRating(stored: number, attempts: number, estimate: RatingEstimate | null): number {
  if (attempts > 0 || !estimate) return stored
  return Math.min(RATING.puzzleStartMax, Math.max(RATING.puzzleStartMin, estimate.rating))
}
