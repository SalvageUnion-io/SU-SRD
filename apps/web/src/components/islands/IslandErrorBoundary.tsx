import type { CSSProperties, ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'
import { captureException } from '../../lib/observability'
import { space } from '../../ui/design/tokens'
import { RecoveryPanel } from '../../ui/index'

/** Centres the recovery panel in the island's place. */
const RECOVERY = {
  display: 'flex',
  justifyContent: 'center',
  marginInline: 'auto',
  maxWidth: '72rem',
  padding: space[16],
  width: '100%',
} satisfies CSSProperties

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
 * The recovery UI is the shared src/ui `RecoveryPanel` (also used by
 * cantina's root error component); the island-specific action here is a full
 * page reload.
 */
export class IslandErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  /**
   * Report, don't just render. Catching an error is precisely what stops it
   * reaching the window's `error` event, which the reporter hears, so a boundary is
   * the ONLY place a render crash can still be seen. Without this report, an
   * island crash blanks a surface, shows the recovery panel, and produces no
   * production signal at all.
   */
  override componentDidCatch(error: Error, info: ErrorInfo): void {
    captureException(error, { componentStack: info.componentStack })
  }

  override render() {
    if (this.state.error) {
      return (
        <div style={RECOVERY}>
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
