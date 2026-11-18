import type { GameRecord, PlayerInfo } from './types'

export type Outcome = 'win' | 'loss' | 'draw' | 'unfinished'

/** The result from the user's point of view. */
export function outcomeOf(g: GameRecord): Outcome {
  if (g.result === '1/2-1/2') return 'draw'
  if (g.result === '*') return 'unfinished'
  const whiteWon = g.result === '1-0'
  return whiteWon === (g.userColor === 'w') ? 'win' : 'loss'
}

export function opponentOf(g: GameRecord): PlayerInfo {
  return g.userColor === 'w' ? g.black : g.white
}

export const OUTCOME_WORD: Record<Outcome, string> = { win: 'Won', loss: 'Lost', draw: 'Draw', unfinished: 'Unfinished' }

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** How many of the user's moves got each rating in a reviewed game. */
export function ratingCounts(g: GameRecord): Partial<Record<string, number>> {
  const counts: Partial<Record<string, number>> = {}
  for (const p of g.review?.plies ?? []) {
    if (p.judgement && p.color === g.userColor) counts[p.judgement.rating] = (counts[p.judgement.rating] ?? 0) + 1
  }
  return counts
}
