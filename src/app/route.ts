import { useEffect, useState } from 'react'

/**
 * Tiny hash-based router: #/ (play), #/games, #/review/<id>, #/progress, #/report[/<monday>],
 * #/train[/<page>].
 * Old #/puzzles links still open Train.
 * Hash URLs work on any static host (Vercel) and in an iPhone app wrapper, with no server config.
 */
export type Route =
  | { name: 'play' }
  | { name: 'games' }
  | { name: 'review'; id: string }
  | { name: 'progress' }
  | { name: 'train'; theme?: string }
  | { name: 'report'; week?: string }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  if (path === 'games') return { name: 'games' }
  if (path === 'progress') return { name: 'progress' }
  if (path === 'report') return { name: 'report' }
  const report = path.match(/^report\/(\d{4}-\d{2}-\d{2})$/)
  if (report) return { name: 'report', week: report[1] }
  if (path === 'train' || path === 'puzzles') return { name: 'train' }
  const train = path.match(/^(?:train|puzzles)\/([A-Za-z0-9-]+)$/)
  if (train) return { name: 'train', theme: train[1] }
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
    case 'train':
      return route.theme ? `#/train/${route.theme}` : '#/train'
    case 'report':
      return route.week ? `#/report/${route.week}` : '#/report'
  }
}

let keepScroll = false

/** Go to a route. `keepScroll` leaves the page where it is (for a switch within the same page). */
export function navigate(route: Route, options: { keepScroll?: boolean } = {}): void {
  keepScroll = !!options.keepScroll
  window.location.hash = routeHref(route)
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash))
      if (!keepScroll) window.scrollTo({ top: 0 })
      keepScroll = false
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
