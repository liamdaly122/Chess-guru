import { useEffect, useState } from 'react'
import { LICHESS_SYNC } from '../config/lichess'
import { queueReviews } from '../review/reviewQueue'
import { getDb } from '../storage/db'
import { listGames, saveGames } from '../storage/games'
import { fetchLichessGames, LichessError } from './importGames'

/**
 * Automatic Lichess import: remembers your username and fetches new finished games when the
 * app opens or comes back on screen (at most every few minutes). Like the manual import it only
 * asks for finished games, so it never helps during a live game.
 */
export interface LichessSync {
  username: string
  /** Check for new games automatically. */
  auto: boolean
  /** Queue new (unreviewed) Lichess games for review. */
  autoReview: boolean
  lastCheckAt?: number
  /** Start time of the newest game seen, so the next check asks only for newer games. */
  lastCreatedAt?: number
  /** Games added by the last check. */
  lastAdded?: number
  /** New games not yet looked at (shown in a banner until dismissed or the Games page is opened). */
  unseen?: number
  lastError?: string
}

const KEY = 'lichessSync'
const DAY = 24 * 60 * 60 * 1000
export const syncChanged = new EventTarget()

export async function getSync(): Promise<LichessSync | null> {
  const row = await (await getDb()).get('meta', KEY)
  return (row?.value as LichessSync | undefined) ?? null
}

async function putSync(s: LichessSync): Promise<void> {
  await (await getDb()).put('meta', { key: KEY, value: s })
  syncChanged.dispatchEvent(new Event('change'))
}

/** Change the settings. A different username starts afresh. */
export async function updateSync(patch: Partial<LichessSync>): Promise<LichessSync> {
  const prev = await getSync()
  const username = (patch.username ?? prev?.username ?? '').trim()
  const sameUser = prev && prev.username.toLowerCase() === username.toLowerCase()
  const base: LichessSync = sameUser ? prev : { username, auto: false, autoReview: false }
  const next = { ...base, ...patch, username }
  await putSync(next)
  return next
}

export interface CheckResult {
  added: number
  error?: string
}

let running: Promise<CheckResult | null> | null = null

/**
 * Fetch new finished games if automatic import is on and the last check was long enough ago
 * (`force` skips both, for "Check now"). Returns null when no check was made.
 */
export function checkForNewGames(options: { force?: boolean; now?: number; fetchImpl?: typeof fetch } = {}) {
  running ??= runCheck(options).finally(() => {
    running = null
  })
  return running
}

async function runCheck({ force = false, now = Date.now(), fetchImpl = fetch }: { force?: boolean; now?: number; fetchImpl?: typeof fetch }) {
  const s = await getSync()
  if (!s?.username) return null
  if (!force) {
    if (!s.auto) return null
    if (s.lastCheckAt && now - s.lastCheckAt < LICHESS_SYNC.minMinutesBetweenChecks * 60 * 1000) return null
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null
  }

  const since = s.lastCreatedAt != null ? s.lastCreatedAt - LICHESS_SYNC.overlapDays * DAY : undefined
  const max = since === undefined ? LICHESS_SYNC.firstImport : LICHESS_SYNC.maxPerCheck
  try {
    const { games, newestCreatedAt } = await fetchLichessGames(s.username, max, fetchImpl, undefined, since)
    const have = new Set(await (await getDb()).getAllKeys('games'))
    const fresh = games.filter((g) => !have.has(g.id))
    if (fresh.length) await saveGames(fresh)
    await putSync({
      ...s,
      lastCheckAt: now,
      lastCreatedAt: Math.max(s.lastCreatedAt ?? 0, newestCreatedAt ?? 0) || s.lastCreatedAt,
      lastAdded: fresh.length,
      unseen: (s.unseen ?? 0) + fresh.length,
      lastError: undefined,
    })
    if (s.autoReview) await queueUnreviewed()
    return { added: fresh.length }
  } catch (e) {
    const error = e instanceof LichessError ? e.message : 'Something went wrong. Try again later.'
    await putSync({ ...s, lastCheckAt: now, lastError: error })
    return { added: 0, error }
  }
}

/** Queue unreviewed Lichess games for review, newest first. */
export async function queueUnreviewed(): Promise<void> {
  const games = await listGames()
  queueReviews(
    games
      .filter((g) => g.source === 'lichess' && !g.review?.complete)
      .slice(0, LICHESS_SYNC.maxAutoReviews)
      .map((g) => g.id),
  )
}

export function markSeen(): Promise<unknown> {
  return getSync().then((s) => (s?.unseen ? putSync({ ...s, unseen: 0 }) : undefined))
}

/** The automatic import settings and status. undefined while loading, null if never set up. */
export function useLichessSync(): LichessSync | null | undefined {
  const [s, setS] = useState<LichessSync | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    const load = () => getSync().then((v) => live && setS(v))
    void load()
    syncChanged.addEventListener('change', load)
    return () => {
      live = false
      syncChanged.removeEventListener('change', load)
    }
  }, [])
  return s
}

/** Check when the app starts, comes back on screen or goes back online. Mounted once, in App. */
export function useAutoLichessCheck(): void {
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'visible') void checkForNewGames()
    }
    check()
    // Automatic review also picks up games left unreviewed from an earlier session.
    void getSync().then((s) => {
      if (s?.autoReview) void queueUnreviewed()
    })
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('online', check)
    }
  }, [])
}
