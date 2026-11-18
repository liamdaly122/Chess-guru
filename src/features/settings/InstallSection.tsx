import { promptInstall, useInstallState, usePersistentStorage } from '../../app/pwa'

/** How to install the app on this device, and whether its data is protected from clearing. */
export function InstallSection() {
  const install = useInstallState()
  const persisted = usePersistentStorage()

  return (
    <section className="about install" aria-label="Install the app" data-testid="install-section">
      <h3>App and storage</h3>
      {install === 'installed' && <p className="muted small">Installed: you're using Chess Guru as an app.</p>}
      {install === 'can-prompt' && (
        <button type="button" className="primary wide" onClick={() => void promptInstall()}>
          Install Chess Guru
        </button>
      )}
      {install === 'ios' && (
        <p className="muted small">
          To install on iPhone or iPad: open this page in Safari, tap the Share button, then <strong>Add to Home Screen</strong>.
        </p>
      )}
      {install === 'unavailable' && (
        <p className="muted small">
          To install, use your browser's "Install app" or "Add to Home Screen" option. Once installed it works offline.
        </p>
      )}
      <p className="muted small" data-testid="storage-status">
        {persisted === true
          ? 'Storage: protected. Your games and puzzle history won’t be cleared automatically.'
          : persisted === false
            ? 'Storage: not protected yet. Install the app (or keep using it) and the browser usually protects it. Keep a backup from the Games page.'
            : 'Storage: unknown on this browser. Keep a backup from the Games page.'}
      </p>
    </section>
  )
}
