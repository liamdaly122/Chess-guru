import type { GameStatus } from '../../chess/gameStatus'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { useGameAnalysis } from '../../analysis/useGameAnalysis'
import { buildReview } from '../../review/buildReview'
import type { GameReview } from '../../review/types'
import { saveGame } from '../../storage/games'
import type { GameRecord } from '../../storage/types'
import type { usePlayGame } from './usePlayGame'
import type { Opening } from '../../openings/book'

type Play = ReturnType<typeof usePlayGame>
type Analysis = ReturnType<typeof useGameAnalysis>
type Finished = Extract<GameStatus, { over: true }>

function botRecord(play: Play, status: Finished, review: GameReview, endedAt: number, opening: Opening | null): GameRecord {
  const you = { name: 'You' }
  const bot = { name: `${play.engineName} ${play.level.rating}`, rating: play.level.rating }
  return {
    id: play.uid,
    source: 'bot',
    endedAt,
    white: play.userColor === 'w' ? you : bot,
    black: play.userColor === 'w' ? bot : you,
    userColor: play.userColor,
    result: status.result,
    termination: status.reason,
    startFen: play.startFen,
    moves: play.moves,
    botLevel: play.level.rating,
    takebacks: play.takebacks,
    hintedPlies: play.hintedPlies,
    opening: opening?.name,
    eco: opening?.eco,
    review,
  }
}

/**
 * Saves bot games to the local database: once when the game ends, and again when the engine
 * has finished reviewing it (so the stored PGN has every rating and note). Games where the
 * user never moved aren't saved. Returns a function that saves the current game as resigned,
 * for when a new game is started in the middle of one.
 */
export function useSaveBotGame(play: Play, analysis: Analysis, opening: Opening | null) {
  const userMoved = play.history.some((m) => m.color === play.userColor)
  const startFen = play.positions[0]

  const makeReview = useCallback(
    () =>
      buildReview(play.history, startFen, analysis.snapshot.results, analysis.ratings, analysis.notes, play.userColor),
    [play.history, startFen, analysis.snapshot.results, analysis.ratings, analysis.notes, play.userColor],
  )

  const review = useMemo(
    () => (play.status.over && userMoved ? makeReview() : null),
    [play.status.over, userMoved, makeReview],
  )

  // When each game ended, so re-saving it after the review keeps the same time.
  const endedAt = useRef(new Map<string, number>())
  const lastSaved = useRef('')

  useEffect(() => {
    if (!review || !play.status.over) return
    const key = `${play.uid}:${play.moves.length}:${play.status.reason}:${review.complete}`
    if (key === lastSaved.current) return
    lastSaved.current = key
    if (!endedAt.current.has(play.uid)) endedAt.current.set(play.uid, Date.now())
    void saveGame(botRecord(play, play.status, review, endedAt.current.get(play.uid)!, opening))
  }, [review, play, opening])

  /** Save the game in progress as a loss by resignation (used before starting a new game). */
  const saveAsResigned = useCallback(() => {
    if (play.status.over || !userMoved) return
    const winner = play.userColor === 'w' ? 'b' : 'w'
    const status: Finished = { over: true, result: winner === 'w' ? '1-0' : '0-1', reason: 'resignation', winner }
    void saveGame(botRecord(play, status, makeReview(), Date.now(), opening))
  }, [play, userMoved, makeReview, opening])

  return { saveAsResigned, inProgress: !play.status.over && userMoved }
}
