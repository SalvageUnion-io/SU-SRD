/**
 * The two error screens the router renders when something below it throws.
 *
 * - **`RootErrorComponent`** is the last resort, on the root route. It replaces
 *   the whole app — header included — because what failed may be the chrome
 *   itself (a rejected game-data preload behind the root gate), so the only
 *   honest recovery is a reload.
 * - **`RouteErrorComponent`** is the router's `defaultErrorComponent`, so every
 *   other route gets its own boundary. A throw inside the Dashboard, a sheet or
 *   a Game replaces only that route's content, leaves the header in place to
 *   navigate away with, and offers a retry, rather than blanking the app.
 *
 * Neither reports anything. Reporting happens once, for every error boundary
 * in the tree, in the `createRoot` hooks `main.tsx` installs
 * (`reactRootErrorHandlers` in `lib/observability.ts`) — React calls them for
 * each error a boundary catches, so reporting here as well would send each
 * crash twice.
 */

import type { ErrorComponentProps } from '@tanstack/react-router'
import { useRouter } from '@tanstack/react-router'
import type { CSSProperties, ReactNode } from 'react'
import { borderWidth, color, fontSize, radius, space } from '../../../ui/design/tokens'
import { RecoveryPanel } from '../../../ui/index'
import { savedWorkCopy } from '../../lib/routeErrorCopy'
import type { BackendKind } from '../../stores/entityBackend'
import { selectBackend } from '../../stores/entityBackend'
import { FullPageShell } from './RouteFallbacks'

/** The current backend, or null if even that cannot be read in this state. */
function currentBackend(): BackendKind | null {
  try {
    return selectBackend()
  } catch {
    // This runs inside the error screen: the error that put us here is what
    // gets reported, and a second throw would only replace it with this one.
    return null
  }
}

const ERROR_DUMP = {
  backgroundColor: color.wkBg,
  borderColor: color.ink20,
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  color: color.ink,
  fontSize: fontSize.xs,
  lineHeight: '1rem',
  maxWidth: '100%',
  overflow: 'auto',
  padding: space[12],
  textAlign: 'left',
} satisfies CSSProperties

/** A route's error screen: the panel centred in the route's own content. */
const ROUTE_SHELL = {
  display: 'flex',
  justifyContent: 'center',
  padding: space[24],
} satisfies CSSProperties

/** The error text itself — development builds only. */
function DevErrorDump({ error }: { error: unknown }): ReactNode {
  if (!import.meta.env.DEV) return null
  return <pre style={ERROR_DUMP}>{error instanceof Error ? error.message : String(error)}</pre>
}

/** Top-level error boundary: replaces the whole app and offers a reload. */
export function RootErrorComponent({ error }: ErrorComponentProps) {
  return (
    <FullPageShell>
      <RecoveryPanel
        title="Something went wrong"
        message={`The app hit an unexpected error. ${savedWorkCopy(currentBackend())}`}
        action={{ label: 'Reload app', onClick: () => window.location.reload() }}
      >
        <DevErrorDump error={error} />
      </RecoveryPanel>
    </FullPageShell>
  )
}

/**
 * Per-route error boundary: replaces one route's content, keeps the header.
 *
 * "Try again" re-renders the route and re-runs its loader — `reset` clears
 * this boundary, `invalidate` discards the failed match — without a reload.
 */
export function RouteErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter()

  return (
    <div style={ROUTE_SHELL}>
      <RecoveryPanel
        title="This page hit an error"
        message={`Something on this page failed to load. ${savedWorkCopy(currentBackend())}`}
        action={{
          label: 'Try again',
          onClick: () => {
            reset()
            void router.invalidate()
          },
        }}
      >
        <DevErrorDump error={error} />
      </RecoveryPanel>
    </div>
  )
}
