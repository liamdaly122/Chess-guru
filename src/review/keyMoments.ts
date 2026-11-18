import type { Color } from 'chess.js'
import { Chess } from 'chess.js'
import type { MoveRating } from '../chess/classify'
import { gameAccuracy } from '../chess/accuracy'
import { outcomeOf, opponentOf } from '../storage/gameInfo'
import type { GameRecord } from '../storage/types'
import { gamePhase, type GamePhase } from './gamePhase'
import type { GameReview, PlyReview } from './types'

/**
 * Key moments of a game, for the review's "Start review" walk-through (like Chess.com's Game
 * Review): your best and worst moves, your opponent's mistakes, chances you missed to punish
 * them, and checkmate. All from the stored ratings; nothing new is worked out here.
 */
export type MomentKind = 'brilliant' | 'great' | 'blunder' | 'mistake' | 'miss' | 'opponent-mistake' | 'checkmate'

export interface KeyMoment {
  ply: number
  kind: MomentKind
  /** Used to choose the moments when there are too many: roughly the winning chances at stake. */
  importance: number
}

export const MAX_MOMENTS = 8

const BAD: readonly MoveRating[] = ['mistake', 'blunder']

function drop(p: PlyReview): number {
  return p.judgement ? Math.max(0, p.judgement.winBefore - p.judgement.winAfter) : 0
}

/** Your move right after your opponent's mistake, that lost a lot instead of punishing it. */
export function isMissedChance(review: GameReview, ply: number, userColor: Color): boolean {
  const p = review.plies[ply]
  const prev = review.plies[ply - 1]
  const r = p?.judgement?.rating
  if (!p || p.color !== userColor || !r || !prev?.judgement || prev.color === userColor) return false
  if (!BAD.includes(prev.judgement.rating)) return false
  return BAD.includes(r) || (r === 'inaccuracy' && drop(p) >= 8)
}

export function keyMoments(review: GameReview, userColor: Color, max = MAX_MOMENTS): KeyMoment[] {
  const out: KeyMoment[] = []
  review.plies.forEach((p, ply) => {
    const r = p.judgement?.rating
    if (!r || r === 'book') return
    if (p.color === userColor) {
      if (r === 'brilliant') out.push({ ply, kind: 'brilliant', importance: 40 })
      else if (r === 'great') out.push({ ply, kind: 'great', importance: 25 })
      else if (isMissedChance(review, ply, userColor)) out.push({ ply, kind: 'miss', importance: drop(p) })
      else if (BAD.includes(r)) out.push({ ply, kind: r === 'blunder' ? 'blunder' : 'mistake', importance: drop(p) })
    } else if (BAD.includes(r)) {
      out.push({ ply, kind: 'opponent-mistake', importance: drop(p) * 0.8 })
    }
  })
  const last = review.plies.length - 1
  if (last >= 0 && review.plies[last].fenAfter && new Chess(review.plies[last].fenAfter).isCheckmate()) {
    const i = out.findIndex((m) => m.ply === last)
    if (i >= 0) out.splice(i, 1)
    out.push({ ply: last, kind: 'checkmate', importance: 30 })
  }
  return out
    .sort((a, b) => b.importance - a.importance || a.ply - b.ply)
    .slice(0, max)
    .sort((a, b) => a.ply - b.ply)
}

export interface PhaseScore {
  phase: GamePhase
  /** Your accuracy in that phase, or null if you made no rated moves in it. */
  accuracy: number | null
  moves: number
}

/** Your accuracy in the opening, middlegame and endgame (book moves left out). */
export function phaseScores(review: GameReview, userColor: Color): PhaseScore[] {
  return (['opening', 'middlegame', 'endgame'] as const).map((phase) => {
    const moves = review.plies.flatMap((p, i) =>
      p.color === userColor && p.judgement && p.judgement.rating !== 'book' && (p.phase ?? gamePhase(p.fenBefore, i)) === phase ? [p.judgement] : [],
    )
    return { phase, accuracy: gameAccuracy(moves), moves: moves.length }
  })
}

export function phaseGrade(accuracy: number | null): string {
  if (accuracy == null) return '–'
  if (accuracy >= 90) return 'Excellent'
  if (accuracy >= 80) return 'Good'
  if (accuracy >= 65) return 'OK'
  return 'Needs work'
}

/** "12. Nxe5" or "12... Nxe5" */
export function moveName(review: GameReview, ply: number): string {
  const p = review.plies[ply]
  return `${Math.floor(ply / 2) + 1}${p.color === 'w' ? '.' : '...'} ${p.san}`
}

/**
 * The coach's verdict on the whole game, from the result, both accuracies and the key moments:
 * the turning point (your costliest mistake) and your best moment.
 */
export function gameVerdict(game: GameRecord, review: GameReview, moments: KeyMoment[]): string {
  const opp = opponentOf(game).name
  const o = outcomeOf(game)
  const how = game.termination === 'checkmate' ? ' by checkmate' : game.termination && o !== 'draw' ? ` by ${game.termination}` : ''
  const parts: string[] = [
    o === 'win' ? `You beat ${opp}${how}.` : o === 'loss' ? `You lost to ${opp}${how}.` : o === 'draw' ? `A draw with ${opp}.` : `An unfinished game against ${opp}.`,
  ]
  if (review.accuracy != null) {
    parts.push(
      review.opponentAccuracy != null
        ? `Your accuracy was ${Math.round(review.accuracy)}%, ${opp}'s ${Math.round(review.opponentAccuracy)}%.`
        : `Your accuracy was ${Math.round(review.accuracy)}%.`,
    )
  }
  const own = moments.filter((m) => m.kind === 'blunder' || m.kind === 'mistake' || m.kind === 'miss')
  const worst = own.sort((a, b) => b.importance - a.importance)[0]
  if (worst) {
    const what = worst.kind === 'miss' ? 'a missed chance' : `a ${worst.kind}`
    parts.push(`The turning point was ${moveName(review, worst.ply)}, ${what}.`)
  } else if (review.plies.some((p) => p.color === game.userColor && p.judgement)) {
    parts.push('No mistakes or blunders from you. Well played.')
  }
  const best = moments.find((m) => m.kind === 'brilliant') ?? moments.find((m) => m.kind === 'great')
  if (best) parts.push(`Your best moment: ${moveName(review, best.ply)}, ${best.kind === 'brilliant' ? 'a brilliant move' : 'a great move'}.`)
  return parts.join(' ')
}
