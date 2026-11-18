import { useEffect, useState, useSyncExternalStore } from 'react'

/**
 * Installable app support: service worker registration, the "update ready" signal,
 * persistent storage, and the install prompt.
 */

let waitingWorker: ServiceWorker | null = null
const updateListeners = new Set<() => void>()
/** Set when the user asks for the new version; only then does a change of worker reload the page. */
let updateRequested = false

function setWaiting(w: ServiceWorker | null) {
  waitingWorker = w
  updateListeners.forEach((l) => l())
}

/** Register the service worker (production builds only; it would get in the way of dev reloads). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const w = reg.installing
        w?.addEventListener('statechange', () => {
          // A new version is ready, and an older one is running this page.
          if (w.state === 'installed' && navigator.serviceWorker.controller) setWaiting(w)
        })
      })
      // Check for a new version when the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => {})
      })
    } catch {
      // No offline support this time; the app still works online.
    }
  })
  // On a first visit the new worker also takes control of the page; that must not reload it
  // (it would lose a game in progress). Reload only when the user pressed "Reload".
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!updateRequested) return
    updateRequested = false
    window.location.reload()
  })
}

/** True when a new version of the app is downloaded and waiting. */
export function useUpdateReady(): boolean {
  return useSyncExternalStore(
    (fn) => {
      updateListeners.add(fn)
      return () => updateListeners.delete(fn)
    },
    () => waitingWorker !== null,
  )
}

/** Switch to the waiting version (the page reloads when it takes over). */
export function applyUpdate(): void {
  if (!waitingWorker) return
  updateRequested = true
  waitingWorker.postMessage('SKIP_WAITING')
}

/**
 * Ask the browser not to clear our data when space is short. Browsers usually grant this to
 * installed apps and sites used often. Returns whether storage is now protected.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return null
  }
}

/** Whether data is protected from being cleared: true, false, or null if unknown. */
export function usePersistentStorage(): boolean | null {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    requestPersistentStorage().then((p) => live && setPersisted(p))
    return () => {
      live = false
    }
  }, [])
  return persisted
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let installEvent: InstallPromptEvent | null = null
const installListeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep it so Settings can offer an "Install" button (Chrome, Edge, Android).
    e.preventDefault()
    installEvent = e as InstallPromptEvent
    installListeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    installEvent = null
    installListeners.forEach((l) => l())
  })
}

export type InstallState = 'installed' | 'can-prompt' | 'ios' | 'unavailable'

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** How the app can be installed on this device. */
export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (fn) => {
      installListeners.add(fn)
      return () => installListeners.delete(fn)
    },
    () => (isStandalone() ? 'installed' : installEvent ? 'can-prompt' : isIos() ? 'ios' : 'unavailable'),
  )
}

/** Show the browser's install dialog (only when useInstallState() is 'can-prompt'). */
export async function promptInstall(): Promise<void> {
  if (!installEvent) return
  await installEvent.prompt()
  await installEvent.userChoice.catch(() => undefined)
  installEvent = null
  installListeners.forEach((l) => l())
}
