/**
 * The two error screens the router renders when something below it throws.
 *
 * - **`RootErrorComponent`** is the last resort, on the root route. It replaces
 *   the whole app — header included — because what failed may be the chrome
 *   itself (a rejected game-data preload behind the root gate), so the only
 *   honest recovery is a reload.
 * - **`RouteErrorComponent`** is the router's `defaultErrorComponent`, so every
 *   other route gets its own boundary. A throw inside Play, a sheet or
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
import { color, fontSize, space } from '../../design/tokens'
import { savedWorkCopy } from '../../lib/routeErrorCopy'
import { sharedCopy } from '../../messages/components-shared'
import type { SyncStatus } from '../../replica/sync'
import { syncStatus } from '../../replica/sync'
import { Box, RecoveryPanel } from '../index'
import { FullPageShell } from './RouteFallbacks'

/** The sync status, or null if even that cannot be read in this state. */
function currentStatus(): SyncStatus | null {
  try {
    return syncStatus()
  } catch {
    // This runs inside the error screen: the error that put us here is what
    // gets reported, and a second throw would only replace it with this one.
    return null
  }
}

/** The error text in the Box's body: small, scrolling sideways when long. */
const ERROR_DUMP = {
  color: color.ink,
  fontSize: fontSize.chip,
  lineHeight: '1rem',
  margin: 0,
  maxWidth: '100%',
  overflow: 'auto',
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
  return (
    <Box>
      <pre style={ERROR_DUMP}>{error instanceof Error ? error.message : String(error)}</pre>
    </Box>
  )
}

/** Top-level error boundary: replaces the whole app and offers a reload. */
export function RootErrorComponent({ error }: ErrorComponentProps) {
  return (
    <FullPageShell>
      <RecoveryPanel
        title={sharedCopy('somethingWentWrong')}
        message={sharedCopy('theAppHitAnUnexpected', {
          savedWorkCopy: savedWorkCopy(currentStatus()),
        })}
        action={{ label: sharedCopy('tryAgain'), onClick: () => window.location.reload() }}
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
        title={sharedCopy('thisPageHitAnError')}
        message={sharedCopy('somethingOnThisPageDid', {
          savedWorkCopy: savedWorkCopy(currentStatus()),
        })}
        action={{
          label: sharedCopy('tryAgain'),
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
