import { formatScore, winPercent, type Score } from '../../chess/score'

interface Props {
  /** Evaluation from White's point of view, or null before the first result. */
  score: Score | null
  orientation: 'white' | 'black'
}

/**
 * Vertical evaluation bar. The white part's height is White's winning chances,
 * the same scale Lichess uses, so +1 looks like a real edge and +8 vs +12 look almost the same.
 */
export function EvalBar({ score, orientation }: Props) {
  const whitePct = score ? winPercent(score) : 50
  const label = score ? formatScore(score) : '…'
  const whiteBetter = whitePct >= 50
  // White's share grows from the bottom when White is at the bottom of the board.
  const fromBottom = orientation === 'white'

  return (
    <div
      className="eval-bar"
      role="meter"
      aria-label="Evaluation"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(whitePct)}
      aria-valuetext={label}
      data-testid="eval-bar"
    >
      <div
        className="eval-white"
        style={{ height: `${whitePct}%`, [fromBottom ? 'bottom' : 'top']: 0 }}
      />
      <span
        className={`eval-label ${whiteBetter ? 'on-white' : 'on-black'}`}
        style={{ [whiteBetter === fromBottom ? 'bottom' : 'top']: 2 }}
      >
        {label.replace(/^[+-]/, '')}
      </span>
    </div>
  )
}
