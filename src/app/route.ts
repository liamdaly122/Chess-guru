import { useEffect, useState } from 'react'

/**
 * Tiny hash-based router: #/ (play), #/games, #/review/<id>.
 * Hash URLs work on any static host (Vercel) and in an iPhone app wrapper, with no server config.
 */
export type Route = { name: 'play' } | { name: 'games' } | { name: 'review'; id: string }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  if (path === 'games') return { name: 'games' }
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
