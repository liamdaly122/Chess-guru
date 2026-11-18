import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * Catches a crash while drawing one page, so the rest of the app keeps working and the user
 * sees what happened instead of a blank screen. Give it a `key` per page so moving to another
 * page starts afresh.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Page crashed:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="card empty-state crash-card" role="alert" data-testid="crash">
        <p>
          <strong>Something went wrong on this page.</strong>
        </p>
        <p className="muted">Your games and progress are safe. Reloading usually fixes it.</p>
        <p className="muted small crash-detail">{this.state.error.message}</p>
        <div className="puzzle-actions">
          <button type="button" className="primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <a className="button-link" href="#/">
            Go to Play
          </a>
        </div>
      </div>
    )
  }
}
