import { useMemo } from 'react'
import { routeHref } from '../../app/route'
import { practicePositions, type PracticePosition } from '../../practice/positions'
import { usePracticeRecords, type PracticeRecord } from '../../practice/practiceStore'
import { requestPractice } from '../../practice/startRequest'
import { ratingSummary } from '../../rating/estimate'
import { formatDate } from '../../storage/gameInfo'
import { useGames } from '../../storage/useGames'
import { CheckIcon } from '../../ui/icons'
import { MISTAKES, MISTAKES_POSITIONS } from '../puzzles/mistakeRoutes'

const KIND_LABEL = { win: 'Win it', hold: 'Hold it' } as const

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

/** A card for the Mistakes page: the newest few positions, untried first. */
export function PracticeCard() {
  const positions = usePositions()
  const records = usePracticeRecords()
  if (!positions || !records || positions.length === 0) return null
  const shown = [...positions].sort((a, b) => Number(!!records[a.id]) - Number(!!records[b.id])).slice(0, 3)
  return (
    <section className="card practice-card" aria-label="Play it out" data-testid="practice-card">
      <h2 className="card-title">Play it out</h2>
      <p className="muted small practice-about">{ABOUT}</p>
      <ul className="line-list">
        {shown.map((p) => (
          <PracticeRow key={p.id} position={p} record={records[p.id]} />
        ))}
      </ul>
      {positions.length > shown.length && (
        <a className="small see-all" href={routeHref({ name: 'puzzles', theme: MISTAKES_POSITIONS })}>
          See all {positions.length}
        </a>
      )}
    </section>
  )
}

/** All positions, newest games first. */
export function PracticePage() {
  const positions = usePositions()
  const records = usePracticeRecords()
  return (
    <div className="mistakes-home">
      <a className="back-link small" href={routeHref({ name: 'puzzles', theme: MISTAKES })}>
        ← Your mistakes
      </a>
      <section className="card" aria-label="Play it out" data-testid="practice-page">
        <h2 className="card-title">Play it out</h2>
        <p className="muted small practice-about">{ABOUT}</p>
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
