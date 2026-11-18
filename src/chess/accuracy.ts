/**
 * Lichess's accuracy for a single move, from the drop in the mover's winning chances.
 * A move that loses nothing scores 100%. Includes Lichess's +1 "uncertainty bonus".
 * Source: lichess-org/lila, modules/analyse/src/main/AccuracyPercent.scala
 */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  if (winAfter >= winBefore) return 100
  const drop = winBefore - winAfter
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * drop) - 3.166924740191411
  return Math.min(100, Math.max(0, raw + 1))
}

/**
 * Accuracy for a whole game: the average of the move accuracies.
 * (Lichess also weights moves by how sharp the position was. A plain average is simpler and
 * still tracks improvement over time.) Returns null when there are no rated moves.
 */
export function gameAccuracy(moves: { winBefore: number; winAfter: number }[]): number | null {
  if (moves.length === 0) return null
  const sum = moves.reduce((s, m) => s + moveAccuracy(m.winBefore, m.winAfter), 0)
  return sum / moves.length
}
