import { useCallback } from 'react'
import { clearReviewQueue, useReviewQueue } from '../../review/reviewQueue'
import { BatchReviewer } from '../progress/BatchReviewer'

/**
 * Works through the review queue one game at a time, with a small status bar. Paused (not
 * mounted) while you play or look at a review, so it never competes with those for the engine;
 * it carries on from the next unreviewed game when you leave them.
 */
export function BackgroundReviewer({ paused }: { paused: boolean }) {
  const ids = useReviewQueue()
  const done = useCallback(() => clearReviewQueue(), [])
  if (paused || ids.length === 0) return null
  return (
    <div className="review-status-bar" role="status">
      <BatchReviewer ids={[...ids]} onFinished={done} />
    </div>
  )
}
