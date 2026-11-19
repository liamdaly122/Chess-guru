import { useEffect, useState } from 'react'
import { getDb } from '../storage/db'

/** Your tries at each position (meta key `practice`): { [position id]: record }. */
export interface PracticeRecord {
  tries: number
  successes: number
  lastAt: number
  lastSuccess: boolean
}

export type PracticeRecords = Record<string, PracticeRecord>

const KEY = 'practice'
export const practiceChanged = new EventTarget()

export async function getPracticeRecords(): Promise<PracticeRecords> {
  const row = await (await getDb()).get('meta', KEY)
  return (row?.value as PracticeRecords | undefined) ?? {}
}

/** Record one finished try. Read and written in one transaction. */
export async function recordPracticeTry(id: string, success: boolean, at = Date.now()): Promise<void> {
  const tx = (await getDb()).transaction('meta', 'readwrite')
  const row = await tx.store.get(KEY)
  const all = ((row?.value as PracticeRecords | undefined) ?? {}) as PracticeRecords
  const prev = all[id] ?? { tries: 0, successes: 0, lastAt: 0, lastSuccess: false }
  all[id] = { tries: prev.tries + 1, successes: prev.successes + (success ? 1 : 0), lastAt: at, lastSuccess: success }
  await tx.store.put({ key: KEY, value: all })
  await tx.done
  practiceChanged.dispatchEvent(new Event('change'))
}

/** Merge records from a backup (more tries wins). */
export async function restorePracticeRecords(records: PracticeRecords): Promise<void> {
  const tx = (await getDb()).transaction('meta', 'readwrite')
  const row = await tx.store.get(KEY)
  const all = ((row?.value as PracticeRecords | undefined) ?? {}) as PracticeRecords
  for (const [id, r] of Object.entries(records)) if (!all[id] || all[id].tries < r.tries) all[id] = r
  await tx.store.put({ key: KEY, value: all })
  await tx.done
  practiceChanged.dispatchEvent(new Event('change'))
}

export function usePracticeRecords(): PracticeRecords | null {
  const [records, setRecords] = useState<PracticeRecords | null>(null)
  useEffect(() => {
    let live = true
    const load = () => getPracticeRecords().then((r) => live && setRecords(r))
    void load()
    practiceChanged.addEventListener('change', load)
    return () => {
      live = false
      practiceChanged.removeEventListener('change', load)
    }
  }, [])
  return records
}
