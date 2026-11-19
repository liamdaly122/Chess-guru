import { drillPosition } from '../../practice/positions'
import { drillRecordId, ENDGAME_DRILLS, type EndgameGoal } from '../../practice/endgames'
import { usePracticeRecords } from '../../practice/practiceStore'
import { requestPractice } from '../../practice/startRequest'
import { CheckIcon } from '../../ui/icons'

const GOAL_LABEL: Record<EndgameGoal, string> = { mate: 'Checkmate', win: 'Win', hold: 'Hold the draw' }

/**
 * Endgame drills: classic endgames to play out against full-strength Stockfish. Each Play takes
 * the drill's next starting position; tries are recorded like Play it out positions.
 */
export function EndgamesPage() {
  const records = usePracticeRecords()
  const groups = [...new Set(ENDGAME_DRILLS.map((d) => d.group))]
  return (
    <div className="mistakes-home endgames" data-testid="endgames">
      <p className="muted small practice-about">
        Classic endgames against the engine at full strength. Read how it's done, then play it out. Each time you play, you
        get the next starting position.
      </p>
      {groups.map((group) => (
        <section key={group} className="card" aria-label={group}>
          <h2 className="card-title">{group}</h2>
          <ul className="line-list">
            {ENDGAME_DRILLS.filter((d) => d.group === group).map((d) => {
              const r = records?.[drillRecordId(d.id)]
              return (
                <li key={d.id} className="drill-row" data-testid="drill-row" data-id={d.id}>
                  <div className="line-row">
                    <div className="line-info">
                      <p className="line-name">
                        <span className={`kind-chip kind-${d.goal === 'hold' ? 'hold' : 'win'}`}>{GOAL_LABEL[d.goal]}</span>
                        {d.name}
                      </p>
                      <p className="muted small">
                        {!r
                          ? 'Not tried yet'
                          : r.successes > 0
                            ? `Done ${r.successes} of ${r.tries} ${r.tries === 1 ? 'try' : 'tries'}`
                            : `${r.tries} ${r.tries === 1 ? 'try' : 'tries'} so far`}
                        {r?.successes ? (
                          <>
                            {' '}
                            <CheckIcon width={13} height={13} />
                          </>
                        ) : null}
                      </p>
                    </div>
                    <button type="button" className="primary solve-button" onClick={() => requestPractice(drillPosition(d, r?.tries ?? 0))}>
                      Play
                    </button>
                  </div>
                  <details className="drill-lesson">
                    <summary>How it's done</summary>
                    <p>{d.lesson}</p>
                  </details>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
