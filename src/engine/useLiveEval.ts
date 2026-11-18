import { useEffect, useRef, useState } from 'react'
import { Analyser } from './Analyser'
import type { PvLine } from './uciInfo'

export interface LiveEval {
  fen: string
  /** The engine's main line so far (score from the side to move). */
  line: PvLine | null
  done: boolean
}

/**
 * Evaluates one position at a time with a full-strength engine, updating as the search deepens.
 * When the position changes, the old search is stopped straight away, so moving pieces around
 * quickly (Explore in the review) never queues up searches. Pass null to stop.
 */
export function useLiveEval(fen: string | null, limits = { depth: 18, maxTimeMs: 5000 }): LiveEval | null {
  const ref = useRef<Analyser | null>(null)
  const [state, setState] = useState<LiveEval | null>(null)
  const { depth, maxTimeMs } = limits

  useEffect(
    () => () => {
      ref.current?.dispose()
      ref.current = null
    },
    [],
  )

  useEffect(() => {
    if (!fen) return
    ref.current ??= new Analyser()
    const a = ref.current
    let live = true
    void a
      .analyse(fen, (line) => live && setState({ fen, line, done: false }), { depth, maxTimeMs })
      .then((r) => {
        if (live && r) setState({ fen, line: r.lines[0] ?? null, done: true })
      })
    return () => {
      live = false
      a.stop()
    }
  }, [fen, depth, maxTimeMs])

  return state && state.fen === fen ? state : null
}
