import type { MoveRating } from '../../chess/classify'
import { winPercent, type Score } from '../../chess/score'

interface Props {
  /** Evaluations from White's point of view: the start position, then after each half-move. */
  evals: (Score | null)[]
  /** Rated user moves to mark on the graph (half-move index and rating). */
  marks: { ply: number; rating: MoveRating }[]
  /** Half-move being shown (-1 = start). */
  current: number
  onSelect: (ply: number) => void
}

const W = 600
const H = 100

/**
 * White's winning chances across the game. The light area is White's share.
 * Dots mark the user's mistakes and blunders. Tap anywhere to jump to that move.
 */
export function EvalGraph({ evals, marks, current, onSelect }: Props) {
  const n = evals.length - 1
  if (n < 1) return null

  // Missing evals carry the previous value so the line stays continuous.
  const ys: number[] = []
  for (const e of evals) ys.push(e ? winPercent(e) : (ys[ys.length - 1] ?? 50))
  const x = (i: number) => (i / n) * W
  const y = (pct: number) => H - (pct / 100) * H
  const line = ys.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`

  function pick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - rect.left) / rect.width) * n)
    onSelect(Math.max(-1, Math.min(n - 1, i - 1)))
  }

  const shown = marks.filter((m) => m.rating === 'mistake' || m.rating === 'blunder' || m.rating === 'brilliant')

  return (
    <div className="eval-graph" onClick={pick} role="img" aria-label="Evaluation graph. Tap to jump to a move." data-testid="eval-graph">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <path d={area} className="eval-graph-area" />
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} className="eval-graph-mid" />
        <path d={line} className="eval-graph-line" />
        <line x1={x(current + 1)} x2={x(current + 1)} y1={0} y2={H} className="eval-graph-cursor" />
      </svg>
      {shown.map((m) => (
        <span
          key={m.ply}
          className={`eval-graph-dot dot-${m.rating}`}
          style={{ left: `${((m.ply + 1) / n) * 100}%`, top: `${100 - ys[m.ply + 1]}%` }}
        />
      ))}
    </div>
  )
}
