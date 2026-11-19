import type { Color } from 'chess.js'
import { PLAY_IT_OUT } from '../config/playItOut'
import { formatScore } from '../chess/score'
import { suggestedLevel } from '../rating/estimate'
import { opponentOf, outcomeOf } from '../storage/gameInfo'
import type { GameRecord } from '../storage/types'

/**
 * Play it out: positions from your own reviewed games to play on against the bot.
 *  - "win": you were clearly winning but didn't win the game. Convert it.
 *  - "hold": you were worse but not lost, and lost. Hold it (draw or better).
 * From each game, the last such position (your move), so you start where it was still there to
 * win or save. Only positions from saved, finished games, so this can't help in a live game.
 */
export type PracticeKind = 'win' | 'hold'

export interface PracticePosition {
  /** "<game id>:<half-move>:<kind>" */
  id: string
  kind: PracticeKind
  gameId: string
  ply: number
  /** The position, with you to move. */
  fen: string
  userColor: Color
  /** Your winning chances there, and the evaluation from your side ("+3.4", or "mate in 2"). */
  win: number
  evalText: string
  /** The move you played there, and its move number ("23. Qd2"). */
  played: string
  opponent: string
  gameDate: number
  /** Bot level to play against: the nearest to the opponent you faced. */
  levelRating: number
}

/** Positions from one game (at most one of each kind). */
export function practiceFromGame(game: GameRecord, fallbackRating = 1200): PracticePosition[] {
  const review = game.review
  if (!review?.complete) return []
  const outcome = outcomeOf(game)
  if (outcome === 'unfinished') return []
  const opp = opponentOf(game)
  const levelRating = suggestedLevel(game.botLevel ?? opp.rating ?? fallbackRating).rating
  const out: PracticePosition[] = []

  const pick = (kind: PracticeKind, ok: (win: number) => boolean) => {
    let found = -1
    review.plies.forEach((p, i) => {
      const j = p.judgement
      if (p.color !== game.userColor || !j || i < PLAY_IT_OUT.minPly) return
      if (ok(j.winBefore)) found = i
    })
    if (found < 0) return
    const p = review.plies[found]
    const j = p.judgement!
    out.push({
      id: `${game.id}:${found}:${kind}`,
      kind,
      gameId: game.id,
      ply: found,
      fen: p.fenBefore,
      userColor: game.userColor,
      win: j.winBefore,
      evalText: j.scoreBefore.kind === 'mate' && j.scoreBefore.forUs ? `mate in ${j.scoreBefore.moves}` : formatScore(j.scoreBefore),
      played: `${Math.floor(found / 2) + 1}${p.color === 'w' ? '.' : '...'} ${p.san}`,
      opponent: opp.name,
      gameDate: game.endedAt,
      levelRating,
    })
  }

  if (outcome !== 'win') pick('win', (w) => w >= PLAY_IT_OUT.winningFrom)
  if (outcome === 'loss') pick('hold', (w) => w >= PLAY_IT_OUT.holdFrom && w <= PLAY_IT_OUT.holdTo)
  return out
}

/** Positions from all your reviewed games, newest games first. */
export function practicePositions(games: GameRecord[], fallbackRating?: number): PracticePosition[] {
  return [...games]
    .sort((a, b) => b.endedAt - a.endedAt)
    .flatMap((g) => practiceFromGame(g, fallbackRating))
    .slice(0, PLAY_IT_OUT.maxPositions)
}

/** Did the result count? Win it: you won. Hold it: you didn't lose. */
export function practiceSucceeded(kind: PracticeKind, winner: Color | null, userColor: Color): boolean {
  return kind === 'win' ? winner === userColor : winner === null || winner === userColor
}
