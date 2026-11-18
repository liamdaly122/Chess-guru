import { useState } from 'react'
import { GOAL } from '../../config/goal'
import { setGoal, useDailyGoal } from '../../goal/goalStore'
import { goalStatusText, plural } from '../../goal/goalText'
import { CheckIcon, FlameIcon } from '../../ui/icons'

function Bar({ label, done, target }: { label: string; done: number; target: number }) {
  const complete = done >= target
  return (
    <div className={`goal-bar ${complete ? 'complete' : ''}`}>
      <div className="goal-bar-head">
        <span>{label}</span>
        <span className="goal-count">
          {complete && <CheckIcon width={14} height={14} />} {Math.min(done, target)}/{target}
        </span>
      </div>
      <span className="bar-track">
        <span className="bar-fill goal-fill" style={{ width: `${Math.min(1, done / target) * 100}%` }} />
      </span>
    </div>
  )
}

/** Today's goal, the streak, and a way to change the goal. Puzzles include mistake puzzles and opening lines. */
export function GoalCard() {
  const g = useDailyGoal()
  const [editing, setEditing] = useState(false)
  if (!g) return null

  return (
    <section className="card goal-card" aria-label="Daily goal" data-testid="goal-card">
      <div className="goal-head">
        <h2 className="card-title">Daily goal</h2>
        <button type="button" className="link-button" onClick={() => setEditing((e) => !e)}>
          {editing ? 'Done' : 'Change'}
        </button>
      </div>

      {editing ? (
        <div className="goal-edit">
          <label>
            Games a day
            <select
              value={g.goal.games}
              onChange={(e) => void setGoal({ games: Number(e.target.value) })}
              aria-label="Games a day"
            >
              {GOAL.gameChoices.map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'None' : n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Puzzles a day
            <select
              value={g.goal.puzzles}
              onChange={(e) => void setGoal({ puzzles: Number(e.target.value) })}
              aria-label="Puzzles a day"
            >
              {GOAL.puzzleChoices.map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'None' : n}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small">
            Games count against the bot or on Lichess (once imported). Puzzles count from all three trainers: puzzles,
            your mistakes and opening lines. Days already done keep counting if you change the goal.
          </p>
        </div>
      ) : (
        !g.off && (
          <div className="goal-bars">
            {g.goal.games > 0 && <Bar label="Games" done={g.done.games} target={g.goal.games} />}
            {g.goal.puzzles > 0 && <Bar label="Puzzles" done={g.done.puzzles} target={g.goal.puzzles} />}
          </div>
        )
      )}

      <div className="goal-foot">
        <span className={`streak ${g.streak > 0 ? 'on' : ''}`} data-testid="streak">
          <FlameIcon width={18} height={18} /> {plural(g.streak, 'day')}
        </span>
        <span className="muted small">{g.best > g.streak ? `Best: ${plural(g.best, 'day')}. ` : ''}{goalStatusText(g)}</span>
      </div>
    </section>
  )
}

/** One line for the Train page: today's puzzles and the streak. */
export function GoalLine() {
  const g = useDailyGoal()
  if (!g || g.off) return null
  return (
    <p className="goal-line small" data-testid="goal-line">
      <span className={`streak ${g.streak > 0 ? 'on' : ''}`}>
        <FlameIcon width={15} height={15} /> {g.streak}
      </span>
      <span className="muted">{goalStatusText(g)}</span>
    </p>
  )
}
