import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Error boundary for React islands. Class component is required here —
 * React error boundaries have no hooks equivalent.
 *
 * Without this, a render error inside an island leaves the page blank
 * (the static fallback is removed once data is ready, and the island is
 * the only remaining content).
 */
export class IslandErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto w-full max-w-6xl p-4 text-sm">
          <p className="mb-2 font-bold">Something went wrong rendering this entry.</p>
          <button
            type="button"
            className="btn btn-inactive"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
