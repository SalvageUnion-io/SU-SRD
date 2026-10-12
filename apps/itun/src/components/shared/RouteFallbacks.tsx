/**
 * Router-level default fallbacks (audit item 7) and the "not found" panel they
 * share with the sheet surfaces.
 *
 * Without them an unmatched URL hits TanStack's unstyled default and a slow
 * loader flashes a blank page.
 *
 * `NotFoundPanel` is the single implementation of that treatment: this one,
 * `Sheet`'s missing-entity state and `routes/sheet/$kind/$id`'s unknown-kind
 * state compose it. It is deliberately NOT component-lib's `RecoveryPanel`: that
 * panel carries `role="alert"` and centres its content, which is right for a
 * crash and wrong for a mistyped URL — announcing every 404 as an alert is an
 * accessibility regression, not a consolidation.
 */

import { buttonVariants } from 'component-lib'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from 'component-lib/design/tokens'
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react'
import { AppLink } from './AppLink'

const SHELL = {
  alignItems: 'center',
  backgroundColor: color.wkBg,
  display: 'flex',
  justifyContent: 'center',
  minHeight: '100dvh',
  padding: space[24],
} satisfies CSSProperties

/** The 404 card; its padding opens up from `sm` (routeStates.css). */
const PANEL = {
  alignItems: 'flex-start',
  backgroundColor: color.paper,
  borderColor: color.ink,
  borderRadius: radius.panel,
  borderStyle: 'solid',
  borderWidth: borderWidth.chrome,
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  maxWidth: '36rem',
  width: '100%',
} satisfies CSSProperties

const PANEL_TITLE = {
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.xl,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: '1.75rem',
  textTransform: 'uppercase',
} satisfies CSSProperties

const PANEL_MESSAGE = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  lineHeight: '1.25rem',
} satisfies CSSProperties

const BACK_LINK = { textDecorationLine: 'none' } satisfies CSSProperties

/** The pending line; it breathes with the shared skeleton pulse (`su-pulse`). */
const PENDING = {
  color: color.wkMuted,
  fontFamily: font.cond,
  fontSize: fontSize.sm,
  fontWeight: weight.bold,
  letterSpacing: tracking.caps,
  lineHeight: '1.25rem',
  textTransform: 'uppercase',
} satisfies CSSProperties

/** Full-viewport centering shell every standalone panel screen sits in. */
function FullPageShell({ children, ...rest }: ComponentPropsWithoutRef<'main'>) {
  return (
    <main style={SHELL} {...rest}>
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
      <div className="not-found-panel" style={PANEL}>
        <h1 style={PANEL_TITLE}>{title}</h1>
        <p style={PANEL_MESSAGE}>{message}</p>
        <AppLink
          href={back.href}
          className={buttonVariants({ variant: 'ghost', size: 'compact' })}
          style={BACK_LINK}
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
      <p className="su-pulse" style={PENDING}>
        Loading…
      </p>
    </FullPageShell>
  )
}
