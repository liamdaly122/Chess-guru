import { useCallback, useEffect, useRef } from 'react'
import type { PositionAnalysis } from './uciInfo'
import { Analyser } from './Analyser'

/**
 * An on-demand full-strength engine, created the first time it's needed and closed when the
 * screen goes away. Used to check alternative answers in mistake puzzles.
 */
export function useAnalyser(): (fen: string, limits: { depth: number; maxTimeMs: number }) => Promise<PositionAnalysis | null> {
  const ref = useRef<Analyser | null>(null)
  useEffect(
    () => () => {
      ref.current?.dispose()
      ref.current = null
    },
    [],
  )
  return useCallback((fen, limits) => {
    ref.current ??= new Analyser()
    return ref.current.analyse(fen, undefined, limits)
  }, [])
}
