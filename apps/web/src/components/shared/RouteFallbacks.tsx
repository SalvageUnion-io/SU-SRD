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
import { color, font, fontSize, space } from '../../design/tokens'
import { Button, Pending, TitledBox } from '../index'
import { DidYouMeanIsland } from '../islands/DidYouMeanIsland'
import { SearchIsland } from '../islands/SearchIsland'
import { NotFound } from '../NotFound'

const SHELL = {
  alignItems: 'center',
  backgroundColor: color.wkBg,
  display: 'flex',
  justifyContent: 'center',
  minHeight: '100dvh',
  padding: space[24],
} satisfies CSSProperties

/** The 404 card's width; its body's padding opens up from `sm` (routeStates.css). */
const PANEL = { maxWidth: '36rem', width: '100%' } satisfies CSSProperties

/** Its body: a column, the exit at its head's edge. */
const PANEL_BODY = { alignItems: 'flex-start', gap: space[16] } satisfies CSSProperties

const PANEL_MESSAGE = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  lineHeight: '1.25rem',
} satisfies CSSProperties

/** The 404's exit, at the head of its column (a flex column that would stretch it). */
const HANGAR_LINK = { alignSelf: 'flex-start' } satisfies CSSProperties

/** Full-viewport centering shell every standalone panel screen sits in. */
export function FullPageShell({ children, ...rest }: ComponentPropsWithoutRef<'main'>) {
  return (
    <main style={SHELL} {...rest}>
      {children}
    </main>
  )
}

type NotFoundPanelProps = {
  /** The title on the cut-out, e.g. 'Page not found' / 'Pilot not found'. */
  title: string
  /** What is missing and why it might be. */
  message: ReactNode
  /** The exit path. Defaults to the Shelves, which are always somewhere to go. */
  back?: { href: string; label: string }
}

/**
 * The app's 404 card: a `TitledBox` with the title on its cut-out, a muted
 * explanation, and one ghost-button exit link.
 */
export function NotFoundPanel({
  title,
  message,
  back = { href: '/', label: 'Hangar' },
}: NotFoundPanelProps) {
  return (
    <FullPageShell>
      <div style={PANEL}>
        <TitledBox
          title={title}
          titleAs="h1"
          bodyClassName="su-not-found-panel"
          bodyStyle={PANEL_BODY}
        >
          <p style={PANEL_MESSAGE}>{message}</p>
          <Button href={back.href} back variant="ghost" size="compact">
            {back.label}
          </Button>
        </TitledBox>
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
          <Button href="/" back variant="ghost" size="compact" style={HANGAR_LINK}>
            Hangar
          </Button>
        }
      />
    </main>
  )
}

/**
 * A route's wait (chrome.md K6): `Pending`'s line, centred in the page shell.
 * The router's default pending component (no subject: "Loading the page…"),
 * and the app's wait on the reference data (`GameDataReady`) and on a Play
 * gate's session or Game.
 */
export function RoutePending({ label = 'the page' }: { label?: string }) {
  return (
    <FullPageShell aria-busy="true">
      <Pending label={label} />
    </FullPageShell>
  )
}
