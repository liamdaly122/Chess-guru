import { useEffect, useState } from 'react'
import { THREAT_QUIZ } from '../config/threatQuiz'
import { getDb } from '../storage/db'
import type { ThreatVerdict } from './threatQuiz'

/** One answered threat question (meta key `threatQuiz`, newest last). */
export interface ThreatResult {
  at: number
  kind: 'threat' | 'quiet'
  verdict: ThreatVerdict
}

const KEY = 'threatQuiz'
export const threatQuizChanged = new EventTarget()

export async function getThreatResults(): Promise<ThreatResult[]> {
  const row = await (await getDb()).get('meta', KEY)
  return Array.isArray(row?.value) ? (row.value as ThreatResult[]) : []
}

/** Record one answer. Read and written in one transaction; keeps the latest `THREAT_QUIZ.keep`. */
export async function recordThreatResult(result: ThreatResult): Promise<void> {
  const tx = (await getDb()).transaction('meta', 'readwrite')
  const row = await tx.store.get(KEY)
  const all = Array.isArray(row?.value) ? (row.value as ThreatResult[]) : []
  await tx.store.put({ key: KEY, value: [...all, result].slice(-THREAT_QUIZ.keep) })
  await tx.done
  threatQuizChanged.dispatchEvent(new Event('change'))
}

/** Merge results from a backup (by time, no duplicates). */
export async function restoreThreatResults(results: ThreatResult[]): Promise<void> {
  const tx = (await getDb()).transaction('meta', 'readwrite')
  const row = await tx.store.get(KEY)
  const all = Array.isArray(row?.value) ? (row.value as ThreatResult[]) : []
  const seen = new Set(all.map((r) => r.at))
  const merged = [...all, ...results.filter((r) => !seen.has(r.at))].sort((a, b) => a.at - b.at)
  await tx.store.put({ key: KEY, value: merged.slice(-THREAT_QUIZ.keep) })
  await tx.done
  threatQuizChanged.dispatchEvent(new Event('change'))
}

/** Your score over the last `n` questions. */
export function threatScore(results: ThreatResult[], n = 20): { asked: number; right: number } {
  const recent = results.slice(-n)
  return { asked: recent.length, right: recent.filter((r) => r.verdict === 'right').length }
}

export function useThreatResults(): ThreatResult[] | null {
  const [results, setResults] = useState<ThreatResult[] | null>(null)
  useEffect(() => {
    let live = true
    const load = () => getThreatResults().then((r) => live && setResults(r))
    void load()
    threatQuizChanged.addEventListener('change', load)
    return () => {
      live = false
      threatQuizChanged.removeEventListener('change', load)
    }
  }, [])
  return results
}
