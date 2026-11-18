import { applyUpdate, useUpdateReady } from '../../app/pwa'

/** Shown when a new version of the app has downloaded. Reloading mid-game would lose the game, so it asks. */
export function UpdateBanner() {
  const ready = useUpdateReady()
  if (!ready) return null
  return (
    <div className="update-banner" role="status" data-testid="update-banner">
      <span>A new version of Chess Guru is ready.</span>
      <button type="button" className="primary" onClick={applyUpdate}>
        Reload
      </button>
    </div>
  )
}
