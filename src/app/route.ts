import { useEffect, useState } from 'react'

/**
 * Tiny hash-based router: #/ (play), #/games, #/review/<id>, #/progress, #/puzzles[/<theme>].
 * Hash URLs work on any static host (Vercel) and in an iPhone app wrapper, with no server config.
 */
export type Route =
  | { name: 'play' }
  | { name: 'games' }
  | { name: 'review'; id: string }
  | { name: 'progress' }
  | { name: 'puzzles'; theme?: string }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  if (path === 'games') return { name: 'games' }
  if (path === 'progress') return { name: 'progress' }
  if (path === 'puzzles') return { name: 'puzzles' }
  const puzzles = path.match(/^puzzles\/([A-Za-z0-9]+)$/)
  if (puzzles) return { name: 'puzzles', theme: puzzles[1] }
  const review = path.match(/^review\/(.+)$/)
  if (review) return { name: 'review', id: decodeURIComponent(review[1]) }
  return { name: 'play' }
}

export function routeHref(route: Route): string {
  switch (route.name) {
    case 'play':
      return '#/'
    case 'games':
      return '#/games'
    case 'review':
      return `#/review/${encodeURIComponent(route.id)}`
    case 'progress':
      return '#/progress'
    case 'puzzles':
      return route.theme ? `#/puzzles/${route.theme}` : '#/puzzles'
  }
}

export function navigate(route: Route): void {
  window.location.hash = routeHref(route)
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
