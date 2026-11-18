import { useEffect, useState } from 'react'
import type { MistakePuzzle } from '../puzzles/mistakes'
import { listMistakePuzzles, mistakesChanged, syncMistakePuzzles } from './mistakeStore'
import { useGames } from './useGames'

/** Your mistake puzzles, kept in step with your reviewed games. null while loading. */
export function useMistakePuzzles(): MistakePuzzle[] | null {
  const games = useGames()
  const [puzzles, setPuzzles] = useState<MistakePuzzle[] | null>(null)

  useEffect(() => {
    let live = true
    const load = () => listMistakePuzzles().then((p) => live && setPuzzles(p))
    void load()
    mistakesChanged.addEventListener('change', load)
    return () => {
      live = false
      mistakesChanged.removeEventListener('change', load)
    }
  }, [])

  // New reviews add new puzzles.
  useEffect(() => {
    if (games) void syncMistakePuzzles(games)
  }, [games])

  return puzzles
}
