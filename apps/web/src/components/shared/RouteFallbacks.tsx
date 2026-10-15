/**
 * Router-level default fallbacks, and the panel the sheet surfaces show for a
 * record that is missing.
 *
 * Without them an unmatched URL hits TanStack's unstyled default and a slow
 * loader flashes a blank page.
 *
 * An unmatched URL is the site's own 404 (`NotFound`, as the static `/404`
 * draws it) with a way back to the Hangar. `NotFoundPanel` is the missing
 * record's: `Sheet`'s missing-entity state and `routes/sheet/$kind/$id`'s
 * unknown-kind state compose it. Neither is the UI library's `RecoveryPanel`:
 * that panel carries `role="alert"` and centres its content, which is right for
 * a crash and wrong for a mistyped URL — announcing every 404 as an alert is an
 * accessibility regression, not a consolidation.
 */

import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from '../../design/tokens'
import { buttonVariants } from '../index'
import { DidYouMeanIsland } from '../islands/DidYouMeanIsland'
import { SearchIsland } from '../islands/SearchIsland'
import { NotFound } from '../NotFound'
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

/** The 404's exit, at the head of its column (a flex column that would stretch it). */
const HANGAR_LINK = { ...BACK_LINK, alignSelf: 'flex-start' } satisfies CSSProperties

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
export function FullPageShell({ children, ...rest }: ComponentPropsWithoutRef<'main'>) {
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
  /** The exit path. Defaults to the Shelves, which are always somewhere to go. */
  back?: { href: string; label: string }
}

/**
 * The app's 404 card: a bordered paper panel with a condensed-caps title, a
 * muted explanation, and one ghost-button exit link.
 */
export function NotFoundPanel({
  title,
  message,
  back = { href: '/', label: 'Hangar' },
}: NotFoundPanelProps) {
  return (
    <FullPageShell>
      <div className="su-not-found-panel" style={PANEL}>
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

/**
 * Any unmatched URL (router defaultNotFoundComponent): the site's 404, its
 * search and "did you mean" rendered live, and the way back to the Hangar.
 */
export function RouteNotFound() {
  return (
    <main>
      <NotFound
        search={<SearchIsland variant="hero" />}
        didYouMean={<DidYouMeanIsland />}
        back={
          <AppLink
            href="/"
            className={buttonVariants({ variant: 'ghost', size: 'compact' })}
            style={HANGAR_LINK}
          >
            &larr; Back to Hangar
          </AppLink>
        }
      />
    </main>
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
