import { useCallback, useState } from 'react'

export interface Preferences {
  /** Show the evaluation bar during games. */
  showEval: boolean
  /** Show move ratings and coaching notes while playing. Off: held until the game ends. */
  liveCoaching: boolean
  /** Show the hint button. */
  hintMode: boolean
  /** Bot games: stop me once when my move is a blunder, without saying why. */
  blunderCheck: boolean
}

const KEY = 'chess-guru:preferences'
const DEFAULTS: Preferences = { showEval: true, liveCoaching: true, hintMode: true, blunderCheck: false }

function load(): Preferences {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    // Storage unavailable (private mode, or blocked). Defaults are fine.
  }
  return DEFAULTS
}

/** Display preferences, remembered in this browser. */
export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(load)
  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // Only a convenience; ignore.
      }
      return next
    })
  }, [])
  return [prefs, update] as const
}
