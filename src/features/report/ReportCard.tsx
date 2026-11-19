import { routeHref } from '../../app/route'
import { useLastWeekReport } from '../../report/reportStore'
import { weekLabel } from '../../report/weekly'

/** The weekly report on Progress: last week's summary, marked New until you open it. */
export function ReportCard() {
  const last = useLastWeekReport()
  if (!last) return null
  const { report, isNew } = last
  const empty = report.games.total === 0 && report.puzzles === 0
  return (
    <section className={`card report-card ${isNew ? 'is-new' : ''}`} aria-label="Weekly report" data-testid="report-card">
      <div className="report-card-text">
        <h2 className="card-title">
          Weekly report {isNew && <span className="new-chip">New</span>}
        </h2>
        <p className="small">
          <strong>Last week</strong> <span className="muted">({weekLabel(report.week)})</span>
        </p>
        <p className="muted small">{empty ? 'Nothing played last week. This week so far is in the report.' : report.summary}</p>
      </div>
      <a className={`button-link ${isNew ? 'primary' : ''}`} href={routeHref({ name: 'report' })} data-testid="report-open">
        {isNew ? 'Read it' : 'Open'}
      </a>
    </section>
  )
}
