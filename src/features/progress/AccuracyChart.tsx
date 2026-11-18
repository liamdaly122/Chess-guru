import { routeHref } from '../../app/route'
import type { AccuracyPoint } from '../../progress/stats'
import { formatDate } from '../../storage/gameInfo'

/**
 * Accuracy of each reviewed game (dots) and the rolling average (line). Tap a dot to open the game.
 * The plot stretches to any width; labels and dots are normal HTML so text stays readable on phones.
 */
export function AccuracyChart({ points }: { points: AccuracyPoint[] }) {
  if (points.length === 0) return <p className="muted">Review a game to start your accuracy chart.</p>

  const n = points.length
  // Positions as percentages of the plot area (x from 2% to 98% so edge dots aren't clipped).
  const x = (i: number) => (n === 1 ? 50 : 2 + (i / (n - 1)) * 96)
  const y = (acc: number) => 100 - acc
  const rolling = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.rolling).toFixed(2)}`).join(' ')

  return (
    <div className="accuracy-chart" data-testid="accuracy-chart">
      <div className="chart-body">
        <div className="chart-y" aria-hidden>
          {[100, 75, 50, 25, 0].map((v) => (
            <span key={v} style={{ top: `${y(v)}%` }}>
              {v}
            </span>
          ))}
        </div>
        <div className="chart-plot">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Accuracy over time">
            {[0, 25, 50, 75, 100].map((v) => (
              <line key={v} x1={0} x2={100} y1={y(v)} y2={y(v)} className="grid" />
            ))}
            {n > 1 && <path d={rolling} className="rolling" />}
          </svg>
          {points.map((p, i) => (
            <a
              key={p.id}
              className={`chart-dot dot-${p.source}`}
              style={{ left: `${x(i)}%`, top: `${y(p.accuracy)}%` }}
              href={routeHref({ name: 'review', id: p.id })}
              title={`${formatDate(p.endedAt)}: ${Math.round(p.accuracy)}% accuracy`}
              aria-label={`${formatDate(p.endedAt)}: ${Math.round(p.accuracy)}% accuracy`}
            />
          ))}
        </div>
      </div>
      <div className="chart-x muted small">
        <span>{formatDate(points[0].endedAt)}</span>
        {n > 1 && <span>{formatDate(points[n - 1].endedAt)}</span>}
      </div>
      <p className="chart-legend muted small">
        <span className="legend-dot dot-bot" /> vs bot <span className="legend-dot dot-lichess" /> Lichess{' '}
        <span className="legend-line" /> average of last 5
      </p>
    </div>
  )
}
