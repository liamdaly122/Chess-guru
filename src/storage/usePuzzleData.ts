import { useEffect, useState } from 'react'
import { getPuzzleRating, listAttempts, puzzlesChanged } from './puzzleStore'
import type { PuzzleAttempt } from './types'

/** Puzzle rating and every attempt, kept up to date. null while loading. */
export function usePuzzleData(): { rating: number; attempts: PuzzleAttempt[] } | null {
  const [data, setData] = useState<{ rating: number; attempts: PuzzleAttempt[] } | null>(null)
  useEffect(() => {
    let live = true
    const load = () =>
      Promise.all([getPuzzleRating(), listAttempts()]).then(([rating, attempts]) => live && setData({ rating, attempts }))
    void load()
    puzzlesChanged.addEventListener('change', load)
    return () => {
      live = false
      puzzlesChanged.removeEventListener('change', load)
    }
  }, [])
  return data
}
