import { useMemo } from 'react'
import { practicePositions, type PracticePosition } from '../../practice/positions'
import { usePracticeRecords, type PracticeRecord } from '../../practice/practiceStore'
import { requestPractice } from '../../practice/startRequest'
import { ratingSummary } from '../../rating/estimate'
import { formatDate } from '../../storage/gameInfo'
import { useGames } from '../../storage/useGames'
import { CheckIcon } from '../../ui/icons'

const KIND_LABEL = { win: 'Win it', hold: 'Hold it', mate: 'Mate it' } as const

function usePositions(): PracticePosition[] | null {
  const games = useGames()
  return useMemo(() => {
    if (!games) return null
    const estimate = ratingSummary(games).estimate
    return practicePositions(games, estimate?.rating)
  }, [games])
}

function recordText(r: PracticeRecord | undefined): string {
  if (!r) return 'Not tried yet'
  return r.successes > 0 ? `Done ${r.successes} of ${r.tries} ${r.tries === 1 ? 'try' : 'tries'}` : `${r.tries} ${r.tries === 1 ? 'try' : 'tries'} so far`
}

/** One position: what it asks, where it came from, your tries, and Play. */
export function PracticeRow({ position: p, record }: { position: PracticePosition; record?: PracticeRecord }) {
  return (
    <li className="line-row practice-row" data-testid="practice-row" data-id={p.id}>
      <div className="line-info">
        <p className="line-name">
          <span className={`kind-chip kind-${p.kind}`}>{KIND_LABEL[p.kind]}</span>
          vs {p.opponent}
        </p>
        <p className="muted small">
          {formatDate(p.gameDate)} · {p.evalText.startsWith('mate') ? `you had ${p.evalText}` : `you were ${p.evalText}`} before {p.played} · {recordText(record)}
          {record?.successes ? (
            <>
              {' '}
              <CheckIcon width={13} height={13} />
            </>
          ) : null}
        </p>
      </div>
      <button type="button" className="primary solve-button" onClick={() => requestPractice(p)}>
        Play
      </button>
    </li>
  )
}

const ABOUT =
  'Positions from your games where you were winning and let it slip ("Win it"), or were worse but could have saved it ("Hold it"). Play them out against the bot.'

/** All positions, newest games first. */
export function PracticePage() {
  const positions = usePositions()
  const records = usePracticeRecords()
  return (
    <div className="mistakes-home">
      <p className="muted small practice-about">{ABOUT}</p>
      <section className="card" aria-label="Play it out" data-testid="practice-page">
        {!positions || !records ? (
          <p className="muted">Loading…</p>
        ) : positions.length === 0 ? (
          <p className="muted">No positions yet. They come from reviewed games where you were winning and didn't win, or lost a position that could be saved.</p>
        ) : (
          <ul className="line-list">
            {positions.map((p) => (
              <PracticeRow key={p.id} position={p} record={records[p.id]} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
