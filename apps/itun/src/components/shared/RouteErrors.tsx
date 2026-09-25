/**
 * The two error screens the router renders when something below it throws.
 *
 * - **`RootErrorComponent`** is the last resort, on the root route. It replaces
 *   the whole app — header included — because what failed may be the chrome
 *   itself (a rejected game-data preload behind the root gate, a blocked
 *   IndexedDB upgrade), so the only honest recovery is a reload.
 * - **`RouteErrorComponent`** is the router's `defaultErrorComponent`, so every
 *   other route gets its own boundary. A throw inside the Dashboard, a sheet or
 *   a Game used to fall straight through to the root and blank the app,
 *   header and navigation with it; now it replaces only that route's content,
 *   leaves the header in place to navigate away with, and offers a retry.
 *
 * Neither reports anything. Reporting happens once, for every error boundary
 * in the tree, in the `createRoot` hooks `main.tsx` installs
 * (`reactRootErrorHandlers` in `lib/observability.ts`) — React calls them for
 * each error a boundary catches, so reporting here as well would send each
 * crash twice.
 */

import type { ErrorComponentProps } from '@tanstack/react-router'
import { useRouter } from '@tanstack/react-router'
import { RecoveryPanel } from 'component-lib'
import type { ReactNode } from 'react'
import { isBlockedUpgrade, savedWorkCopy } from '../../lib/routeErrorCopy'
import type { BackendKind } from '../../stores/entityBackend'
import { selectBackend } from '../../stores/entityBackend'

/** The current backend, or null if even that cannot be read in this state. */
function currentBackend(): BackendKind | null {
  try {
    return selectBackend()
  } catch {
    return null
  }
}

const BLOCKED_UPGRADE_MESSAGE =
  'In the Union Now is open in another browser tab running an older version, which is blocking this one from loading. Close every other In the Union Now tab, then reload. Your saved data is safe.'

/** The error text itself — development builds only. */
function DevErrorDump({ error }: { error: unknown }): ReactNode {
  if (!import.meta.env.DEV) return null
  return (
    <pre className="max-w-full overflow-auto rounded-card border-chrome border-ink/20 bg-wk-bg p-3 text-left text-xs text-ink">
      {error instanceof Error ? error.message : String(error)}
    </pre>
  )
}

/** Top-level error boundary: replaces the whole app and offers a reload. */
export function RootErrorComponent({ error }: ErrorComponentProps) {
  const blocked = isBlockedUpgrade(error)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-wk-bg p-6">
      <RecoveryPanel
        title={blocked ? 'Close the other tab' : 'Something went wrong'}
        message={
          blocked
            ? BLOCKED_UPGRADE_MESSAGE
            : `The app hit an unexpected error. ${savedWorkCopy(currentBackend())}`
        }
        action={{
          label: blocked ? 'Reload' : 'Reload app',
          onClick: () => window.location.reload(),
        }}
      >
        <DevErrorDump error={error} />
      </RecoveryPanel>
    </main>
  )
}

/**
 * Per-route error boundary: replaces one route's content, keeps the header.
 *
 * "Try again" re-renders the route and re-runs its loader — `reset` clears
 * this boundary, `invalidate` discards the failed match — without a reload, so
 * an anonymous visitor's in-memory work survives the attempt.
 */
export function RouteErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter()

  if (isBlockedUpgrade(error)) {
    return (
      <div className="flex justify-center p-6">
        <RecoveryPanel
          title="Close the other tab"
          message={BLOCKED_UPGRADE_MESSAGE}
          action={{ label: 'Reload', onClick: () => window.location.reload() }}
        />
      </div>
    )
  }

  return (
    <div className="flex justify-center p-6">
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
