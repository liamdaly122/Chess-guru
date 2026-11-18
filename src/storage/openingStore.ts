import { useEffect, useState } from 'react'
import type { OpeningDrill } from '../openings/drill'
import { getDb } from './db'

export const drillsChanged = new EventTarget()

function notify() {
  drillsChanged.dispatchEvent(new Event('change'))
}

export async function listDrills(): Promise<OpeningDrill[]> {
  return (await getDb()).getAll('openingDrills')
}

export async function saveDrill(d: OpeningDrill): Promise<void> {
  await (await getDb()).put('openingDrills', d)
  notify()
}

/** Add lines to learn. Lines you already have keep their schedule. */
export async function addDrills(drills: OpeningDrill[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('openingDrills', 'readwrite')
  for (const d of drills) if (!(await tx.store.getKey(d.id))) await tx.store.put(d)
  await tx.done
  notify()
}

export async function deleteDrill(id: string): Promise<void> {
  await (await getDb()).delete('openingDrills', id)
  notify()
}

/** The opening lines you are learning. null while loading. */
export function useOpeningDrills(): OpeningDrill[] | null {
  const [drills, setDrills] = useState<OpeningDrill[] | null>(null)
  useEffect(() => {
    let live = true
    const load = () => listDrills().then((d) => live && setDrills(d))
    void load()
    drillsChanged.addEventListener('change', load)
    return () => {
      live = false
      drillsChanged.removeEventListener('change', load)
    }
  }, [])
  return drills
}
