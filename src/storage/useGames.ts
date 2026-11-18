import { useEffect, useState } from 'react'
import { gamesChanged, getGame, listGames } from './games'
import type { GameRecord } from './types'

/** All saved games, newest first. null while loading. Refreshes after any save or delete. */
export function useGames(): GameRecord[] | null {
  const [games, setGames] = useState<GameRecord[] | null>(null)
  useEffect(() => {
    let live = true
    const load = () => listGames().then((g) => live && setGames(g))
    void load()
    gamesChanged.addEventListener('change', load)
    return () => {
      live = false
      gamesChanged.removeEventListener('change', load)
    }
  }, [])
  return games
}

/** One saved game. undefined while loading, null if it doesn't exist. */
export function useGame(id: string): GameRecord | null | undefined {
  const [state, setState] = useState<{ id: string; game: GameRecord | null | undefined }>({ id, game: undefined })
  useEffect(() => {
    let live = true
    const load = () => getGame(id).then((g) => live && setState({ id, game: g ?? null }))
    void load()
    gamesChanged.addEventListener('change', load)
    return () => {
      live = false
      gamesChanged.removeEventListener('change', load)
    }
  }, [id])
  return state.id === id ? state.game : undefined
}
