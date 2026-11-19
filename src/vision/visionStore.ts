import { useEffect, useState } from 'react'
import { getDb } from '../storage/db'
import type { VisionType } from './drills'

export type VisionDrill = VisionType | 'mixed'

/** Your sets for one drill (meta key `vision`: { [drill]: record }). Best = most right, then fastest. */
export interface VisionRecord {
  sets: number
  best: number
  bestMs: number
  last: number
  lastAt: number
}

export type VisionRecords = Partial<Record<VisionDrill, VisionRecord>>

const KEY = 'vision'
export const visionChanged = new EventTarget()

export async function getVisionRecords(): Promise<VisionRecords> {
  const row = await (await getDb()).get('meta', KEY)
  return (row?.value as VisionRecords | undefined) ?? {}
}

/** Record a finished set. Read and written in one transaction. Returns whether it was a new best. */
export async function recordVisionSet(drill: VisionDrill, right: number, ms: number, at = Date.now()): Promise<boolean> {
  const tx = (await getDb()).transaction('meta', 'readwrite')
  const row = await tx.store.get(KEY)
  const all = ((row?.value as VisionRecords | undefined) ?? {}) as VisionRecords
  const prev = all[drill]
  const better = !prev || right > prev.best || (right === prev.best && ms < prev.bestMs)
  all[drill] = {
    sets: (prev?.sets ?? 0) + 1,
    best: better ? right : prev!.best,
    bestMs: better ? ms : prev!.bestMs,
    last: right,
    lastAt: at,
  }
  await tx.store.put({ key: KEY, value: all })
  await tx.done
  visionChanged.dispatchEvent(new Event('change'))
  return better
}

/** Merge records from a backup (more sets wins). */
export async function restoreVisionRecords(records: VisionRecords): Promise<void> {
  const tx = (await getDb()).transaction('meta', 'readwrite')
  const row = await tx.store.get(KEY)
  const all = ((row?.value as VisionRecords | undefined) ?? {}) as VisionRecords
  for (const [k, r] of Object.entries(records) as [VisionDrill, VisionRecord][]) if (!all[k] || all[k]!.sets < r.sets) all[k] = r
  await tx.store.put({ key: KEY, value: all })
  await tx.done
  visionChanged.dispatchEvent(new Event('change'))
}

export function useVisionRecords(): VisionRecords | null {
  const [records, setRecords] = useState<VisionRecords | null>(null)
  useEffect(() => {
    let live = true
    const load = () => getVisionRecords().then((r) => live && setRecords(r))
    void load()
    visionChanged.addEventListener('change', load)
    return () => {
      live = false
      visionChanged.removeEventListener('change', load)
    }
  }, [])
  return records
}

/** "1:42" */
export function formatTime(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
