import { navigate } from '../app/route'
import type { PracticePosition } from './positions'

/**
 * Asking the Play screen (which stays mounted) to start a Play it out position: the list calls
 * requestPractice, which hands the position to the Play screen's listener and goes to Play.
 */
type Listener = (position: PracticePosition) => void
const listeners = new Set<Listener>()

export function requestPractice(position: PracticePosition): void {
  navigate({ name: 'play' })
  listeners.forEach((l) => l(position))
}

/** Listen for requests. Returns a function that stops listening. */
export function onPracticeRequest(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
