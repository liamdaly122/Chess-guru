import { useEffect, useMemo, useState } from 'react'
import { useThreatResults } from '../coach/threatQuizStore'
import { goalChanged, loadGoalData } from '../goal/goalStore'
import { getDb } from '../storage/db'
import { useGames } from '../storage/useGames'
import { usePuzzleData } from '../storage/usePuzzleData'
import { hasActivity, previousWeek, weeklyReport, weekOf, type ReportInput, type Week, type WeeklyReport } from './weekly'

/** The newest week whose report you have opened (meta key `reportSeen`, a Monday key). Not backed up. */
const KEY = 'reportSeen'
export const reportSeenChanged = new EventTarget()

export async function getReportSeen(): Promise<string | null> {
  const row = await (await getDb()).get('meta', KEY)
  return typeof row?.value === 'string' ? row.value : null
}

/** Remember that you opened this week's report (only moves forward). */
export async function markReportSeen(key: string): Promise<void> {
  const tx = (await getDb()).transaction('meta', 'readwrite')
  const row = await tx.store.get(KEY)
  if (typeof row?.value !== 'string' || row.value < key) await tx.store.put({ key: KEY, value: key })
  await tx.done
  reportSeenChanged.dispatchEvent(new Event('change'))
}

/** Everything a report is built from, or null while loading. */
export function useReportInput(): ReportInput | null {
  const games = useGames()
  const puzzles = usePuzzleData()
  const threats = useThreatResults()
  const [goal, setGoal] = useState<{ puzzleDays: Record<string, number>; goalDays: string[] } | null>(null)
  useEffect(() => {
    let live = true
    const load = () => loadGoalData().then((d) => live && setGoal({ puzzleDays: d.puzzleDays, goalDays: d.goalDays }))
    void load()
    goalChanged.addEventListener('change', load)
    return () => {
      live = false
      goalChanged.removeEventListener('change', load)
    }
  }, [])
  return useMemo(
    () => (games && puzzles && threats && goal ? { games, attempts: puzzles.attempts, threats, ...goal } : null),
    [games, puzzles, threats, goal],
  )
}

/** Last week's report, and whether it is new (it has something in it and you haven't opened it yet). */
export function useLastWeekReport(): { report: WeeklyReport; isNew: boolean } | null {
  const input = useReportInput()
  const [seen, setSeen] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    const load = () => getReportSeen().then((s) => live && setSeen(s))
    void load()
    reportSeenChanged.addEventListener('change', load)
    return () => {
      live = false
      reportSeenChanged.removeEventListener('change', load)
    }
  }, [])
  const [week] = useState<Week>(() => previousWeek(weekOf(Date.now())))
  const report = useMemo(() => (input ? weeklyReport(week, input) : null), [input, week])
  if (!report || seen === undefined) return null
  return { report, isNew: hasActivity(report) && (seen ?? '') < week.key }
}
