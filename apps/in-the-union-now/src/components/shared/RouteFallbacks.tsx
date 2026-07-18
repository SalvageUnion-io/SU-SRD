/**
 * Router-level default fallbacks (audit item 7).
 *
 * The router previously shipped with NO defaultNotFoundComponent /
 * defaultPendingComponent, so unmatched URLs hit TanStack's unstyled default
 * and slow loaders flashed a blank page. These mirror the styled
 * SheetKindNotFound treatment (routes/sheet/$kind/$id.tsx) so every route
 * degrades into the app's visual language.
 */

import { buttonVariants } from 'component-lib'

import { cn } from '../../lib/utils'
import { AppLink } from './AppLink'

/** Styled 404 for any unmatched URL (router defaultNotFoundComponent). */
export function RouteNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-wk-bg p-6">
      <div className="flex w-full max-w-xl flex-col items-start gap-4 rounded-[6px] border-chrome border-ink bg-paper p-6 sm:p-8">
        <h1 className="font-cond text-xl font-bold uppercase tracking-caps-tight text-ink">
          Page not found
        </h1>
        <p className="font-body text-sm text-wk-muted">
          Nothing lives at this address. It may have been deleted, or the link may be mistyped.
        </p>
        <AppLink
          href="/"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}
        >
          &larr; Back to Roster
        </AppLink>
      </div>
    </main>
  )
}

/** Minimal pending state for any route loader (defaultPendingComponent). */
export function RoutePending() {
  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-wk-bg p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="animate-pulse font-cond text-sm font-bold uppercase tracking-caps text-wk-muted">
        Loading…
      </p>
    </main>
  )
}
