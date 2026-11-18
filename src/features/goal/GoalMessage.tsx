import { useEffect } from 'react'
import { GOAL } from '../../config/goal'
import { markCelebrated, useDailyGoal } from '../../goal/goalStore'
import { CloseIcon, FlameIcon } from '../../ui/icons'

/** A short message the first time each day that the goal is met. */
export function GoalMessage() {
  const g = useDailyGoal()
  const show = !!g?.celebrate
  const today = g?.today
  useEffect(() => {
    if (!show || !today) return
    const t = setTimeout(() => void markCelebrated(today), GOAL.messageMs)
    return () => clearTimeout(t)
  }, [show, today])
  if (!g || !show) return null
  return (
    <div className="update-banner goal-message" role="status" data-testid="goal-message">
      <span>
        <FlameIcon width={18} height={18} /> Daily goal done!{' '}
        {g.streak > 1 ? `${g.streak} days in a row.` : 'Come back tomorrow to start a streak.'}
      </span>
      <button type="button" className="icon-button" aria-label="Dismiss" onClick={() => void markCelebrated(g.today)}>
        <CloseIcon />
      </button>
    </div>
  )
}
