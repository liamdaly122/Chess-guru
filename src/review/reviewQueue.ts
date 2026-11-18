import { useSyncExternalStore } from 'react'

/**
 * Games waiting to be reviewed in the background, in order. One reviewer works through the
 * list (features/review/BackgroundReviewer.tsx), so a manual "Review them now" and the
 * automatic Lichess import never run the engine on two games at once. Kept in memory only:
 * after a reload, unreviewed games are simply queued again when needed.
 */
let queue: readonly string[] = []
const listeners = new Set<() => void>()

function set(next: readonly string[]) {
  queue = next
  listeners.forEach((l) => l())
}

/** Add games to the end of the queue (ones already queued keep their place). */
export function queueReviews(ids: string[]): void {
  const fresh = ids.filter((id, i) => !queue.includes(id) && ids.indexOf(id) === i)
  if (fresh.length) set([...queue, ...fresh])
}

export function clearReviewQueue(): void {
  if (queue.length) set([])
}

export function reviewQueue(): readonly string[] {
  return queue
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The queued game ids. */
export function useReviewQueue(): readonly string[] {
  return useSyncExternalStore(subscribe, reviewQueue, reviewQueue)
}
