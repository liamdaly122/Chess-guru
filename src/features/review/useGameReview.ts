import { Chess, type Move } from 'chess.js'
import { useEffect, useMemo } from 'react'
import { useGameAnalysis } from '../../analysis/useGameAnalysis'
import { parseUci } from '../../chess/moves'
import { useOpeningBook } from '../../openings/useOpeningBook'
import { buildReview } from '../../review/buildReview'
import type { GameReview } from '../../review/types'
import { saveGame } from '../../storage/games'
import type { GameRecord } from '../../storage/types'

function replayHistory(g: GameRecord): Move[] {
  const chess = g.startFen ? new Chess(g.startFen) : new Chess()
  for (const m of g.moves) chess.move(parseUci(m))
  return chess.history({ verbose: true })
}

/**
 * The review of a saved game. If it was fully analysed before, it comes straight from storage;
 * otherwise the engine runs now and the finished review (with the annotated PGN) is saved.
 * Used by the review screen and by the background reviewer on the progress page.
 */
export function useGameReview(game: GameRecord) {
  const history = useMemo(() => replayHistory(game), [game])
  const positions = useMemo(
    () => (history.length ? [history[0].before, ...history.map((m) => m.after)] : [new Chess(game.startFen).fen()]),
    [history, game.startFen],
  )

  const stored = game.review?.complete ? game.review : null
  const openingInfo = useOpeningBook(positions)
  const analysis = useGameAnalysis(positions, history, game.userColor, {
    enabled: !stored,
    bookPlies: openingInfo?.status.inBook,
  })
  const live = useMemo<GameReview | null>(
    () =>
      stored
        ? null
        : buildReview(history, positions[0], analysis.snapshot.results, analysis.ratings, analysis.notes, game.userColor),
    [stored, history, positions, analysis.snapshot.results, analysis.ratings, analysis.notes, game.userColor],
  )

  // Save once the engine has finished. Wait for the opening book too, so book moves are stored as such.
  useEffect(() => {
    if (!live?.complete || !openingInfo) return
    const opening = openingInfo.status.opening
    void saveGame({
      ...game,
      review: live,
      // Lichess games already have Lichess's own opening name; bot games get the book's.
      opening: game.opening ?? opening?.name,
      eco: game.eco ?? opening?.eco,
    })
  }, [live, game, openingInfo])

  const done = stored ? positions.length : positions.filter((f) => analysis.snapshot.results.has(f)).length
  return { history, positions, review: (stored ?? live)!, openingInfo, progress: { done, total: positions.length } }
}
