import { useEffect, useState } from 'react'
import type { GameRecord } from '../../storage/types'
import { useGame } from '../../storage/useGames'
import { useGameReview } from '../review/useGameReview'
import { isCurrentReview } from '../../review/types'

/**
 * Reviews several games one after another in the background, using the same engine pipeline
 * as the review screen. Each finished review is saved, so the progress page updates as it goes.
 */
export function BatchReviewer({ ids, onFinished }: { ids: string[]; onFinished: () => void }) {
  const [index, setIndex] = useState(0)
  const id = ids[index]
  const game = useGame(id ?? '')

  useEffect(() => {
    if (index >= ids.length) onFinished()
  }, [index, ids.length, onFinished])

  // A game deleted while it waited: move on (state adjusted during render, React's pattern for this).
  if (id && game === null) setIndex(index + 1)

  if (!id) return null
  return (
    <div className="batch-review" data-testid="batch-review">
      <p>
        Reviewing game {index + 1} of {ids.length}…
      </p>
      {game && <OneReview key={game.id} game={game} onDone={() => setIndex((i) => i + 1)} />}
    </div>
  )
}

function OneReview({ game, onDone }: { game: GameRecord; onDone: () => void }) {
  const { progress } = useGameReview(game)
  const complete = isCurrentReview(game.review)
  useEffect(() => {
    if (complete) onDone()
    // onDone changes identity every render; only react to completion.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [complete])
  return (
    <div className="progress">
      <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
    </div>
  )
}
