/**
 * Router-level default fallbacks (audit item 7) and the "not found" panel they
 * share with the sheet surfaces.
 *
 * The router previously shipped with NO defaultNotFoundComponent /
 * defaultPendingComponent, so unmatched URLs hit TanStack's unstyled default
 * and slow loaders flashed a blank page.
 *
 * `NotFoundPanel` is the single implementation of that treatment. Three screens
 * had hand-copied the same frame character-for-character (this one, `Sheet`'s
 * missing-entity state and `routes/sheet/$kind/$id`'s unknown-kind state); they
 * now compose it. It is deliberately NOT component-lib's `RecoveryPanel`: that
 * panel carries `role="alert"` and centres its content, which is right for a
 * crash and wrong for a mistyped URL — announcing every 404 as an alert is an
 * accessibility regression, not a consolidation.
 */

import { buttonVariants } from 'component-lib'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { AppLink } from './AppLink'

/** Full-viewport centering shell every standalone panel screen sits in. */
function FullPageShell({ className, children, ...rest }: ComponentPropsWithoutRef<'main'>) {
  return (
    <main
      className={cn('flex min-h-dvh items-center justify-center bg-wk-bg p-6', className)}
      {...rest}
    >
      {children}
    </main>
  )
}

type NotFoundPanelProps = {
  /** Stamp heading, e.g. 'Page not found' / 'Pilot not found'. */
  title: ReactNode
  /** What is missing and why it might be. */
  message: ReactNode
  /** The exit path. Defaults to the Roster, which is always somewhere to go. */
  back?: { href: string; label: string }
}

/**
 * The app's 404 card: a bordered paper panel with a condensed-caps title, a
 * muted explanation, and one ghost-button exit link.
 */
export function NotFoundPanel({
  title,
  message,
  back = { href: '/', label: 'Roster' },
}: NotFoundPanelProps) {
  return (
    <FullPageShell>
      <div className="flex w-full max-w-xl flex-col items-start gap-4 rounded-panel border-chrome border-ink bg-paper p-6 sm:p-8">
        <h1 className="font-cond text-xl font-bold uppercase tracking-caps-tight text-ink">
          {title}
        </h1>
        <p className="font-body text-sm text-wk-muted">{message}</p>
        <AppLink
          href={back.href}
          className={cn(buttonVariants({ variant: 'ghost', size: 'compact' }), 'no-underline')}
        >
          &larr; Back to {back.label}
        </AppLink>
      </div>
    </FullPageShell>
  )
}

/** Styled 404 for any unmatched URL (router defaultNotFoundComponent). */
export function RouteNotFound() {
  return (
    <NotFoundPanel
      title="Page not found"
      message="Nothing lives at this address. It may have been deleted, or the link may be mistyped."
    />
  )
}

/** Minimal pending state for any route loader (defaultPendingComponent). */
export function RoutePending() {
  return (
    <FullPageShell aria-busy="true" aria-live="polite">
      <p className="motion-safe:animate-pulse font-cond text-sm font-bold uppercase tracking-caps text-wk-muted">
        Loading…
      </p>
    </FullPageShell>
  )
}
