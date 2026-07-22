import { Component, type ReactNode } from 'react'
import { RecoveryPanel } from 'component-lib'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Error boundary for React islands. Class component is required here —
 * React error boundaries have no hooks equivalent.
 *
 * Without this, a render error inside an island leaves the page blank
 * (the static fallback is removed once data is ready, and the island is
 * the only remaining content).
 *
 * The recovery UI is the shared component-lib `RecoveryPanel` (also used by
 * itun's root error component); the island-specific action here is a full
 * page reload.
 */
export class IslandErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex w-full max-w-6xl justify-center p-4">
          <RecoveryPanel
            title="Something went wrong"
            message="Something went wrong rendering this entry."
            action={{ label: 'Reload page', onClick: () => window.location.reload() }}
          />
        </div>
      )
    }
    return this.props.children
  }
}
