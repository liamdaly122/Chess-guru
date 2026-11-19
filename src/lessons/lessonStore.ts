import { useEffect, useState } from 'react'
import type { LessonCategory } from '../review/types'
import { getDb } from '../storage/db'

/** Your progress on each lesson (meta key `lessons`). */
export interface LessonRecord {
  /** Practice sets finished, and the best score (puzzles solved first time out of the set). */
  sets: number
  best: number
  last: number
  lastAt: number
}

export type LessonRecords = Partial<Record<LessonCategory, LessonRecord>>

const KEY = 'lessons'
export const lessonsChanged = new EventTarget()

export async function getLessonRecords(): Promise<LessonRecords> {
  const row = await (await getDb()).get('meta', KEY)
  return (row?.value as LessonRecords | undefined) ?? {}
}

/** Record a finished practice set. Read and written in one transaction. */
export async function recordLessonSet(category: LessonCategory, solved: number, at = Date.now()): Promise<void> {
  const tx = (await getDb()).transaction('meta', 'readwrite')
  const row = await tx.store.get(KEY)
  const all = ((row?.value as LessonRecords | undefined) ?? {}) as LessonRecords
  const prev = all[category]
  all[category] = { sets: (prev?.sets ?? 0) + 1, best: Math.max(prev?.best ?? 0, solved), last: solved, lastAt: at }
  await tx.store.put({ key: KEY, value: all })
  await tx.done
  lessonsChanged.dispatchEvent(new Event('change'))
}

/** Merge records from a backup (more sets wins). */
export async function restoreLessonRecords(records: LessonRecords): Promise<void> {
  const tx = (await getDb()).transaction('meta', 'readwrite')
  const row = await tx.store.get(KEY)
  const all = ((row?.value as LessonRecords | undefined) ?? {}) as LessonRecords
  for (const [c, r] of Object.entries(records) as [LessonCategory, LessonRecord][]) if (!all[c] || all[c]!.sets < r.sets) all[c] = r
  await tx.store.put({ key: KEY, value: all })
  await tx.done
  lessonsChanged.dispatchEvent(new Event('change'))
}

export function useLessonRecords(): LessonRecords | null {
  const [records, setRecords] = useState<LessonRecords | null>(null)
  useEffect(() => {
    let live = true
    const load = () => getLessonRecords().then((r) => live && setRecords(r))
    void load()
    lessonsChanged.addEventListener('change', load)
    return () => {
      live = false
      lessonsChanged.removeEventListener('change', load)
    }
  }, [])
  return records
}
