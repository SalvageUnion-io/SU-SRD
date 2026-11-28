/**
 * PlayRefusal — the shell a play screen renders when it cannot open: the
 * page's name on the band, what is missing as the heading under it, and the
 * one way on. Play's gates (`PlayGate`, `PlayMediatorGate`) answer with it;
 * while the session or the Game has not answered yet, they wait on
 * `RoutePending`.
 *
 * It draws the site's header, as a Play screen does not: a refused screen
 * has no Play bar to leave by (r8 C6).
 *
 * Signed out, the way on is Sign in (`signInTo`), whose round trip comes back
 * to the screen that refused, so a Play link tapped in Discord still opens
 * once you have signed in.
 */

import { PRODUCT } from 'game-domain/product'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect } from 'react'
import { SignInControl } from '../build/account/SignInControl'
import { PageShell } from '../components/app'
import { Button, ChapterBand, Text, TitledBox, tokens } from '../components/index'
import { pageShowsBar } from '../shell/unionSlots'

/** The prompt's panel: the not-found panel's measure, on the page's gutters. */
const PANEL = { maxWidth: '36rem', width: '100%' } satisfies CSSProperties

/** Its body: a column, the way on at its head's edge. */
const PANEL_BODY = { alignItems: 'flex-start', gap: tokens.space[16] } satisfies CSSProperties

type PlayRefusalProps = {
  /** Whose band it wears: a pilot's Play is a mode of its Training Bay page
   *  (ADR-066); a Game's screens are the Games'. */
  area?: 'build' | 'play'
  /** What is missing, as the heading under the band. */
  title: string
  body: string
  /** What the screen shows under the way on (the hub's "At the table" steps). */
  children?: ReactNode
} & (
  | {
      /** The way on: back to a place (its name), or on to an act (`back: false`). */
      link: { href: string; label: string; back?: boolean }
      signInTo?: never
    }
  | {
      /** Signed out: Sign in, coming back to this Play route afterwards. */
      signInTo: string
      link?: never
    }
)

export function PlayRefusal({
  area = 'play',
  title,
  body,
  link,
  signInTo,
  children,
}: PlayRefusalProps) {
  // No Play bar here, so the site's header is the way out (r8 C6, LG8-12).
  useEffect(() => pageShowsBar.hold(), [])
  return (
    <PageShell>
      <ChapterBand tone={area}>{PRODUCT[area]}</ChapterBand>
      {/* What is missing, as a titled panel with its own padding, never flush
          on the column's edge (the signed-out and refused screens alike). */}
      <div style={PANEL}>
        <TitledBox
          title={title}
          titleAs="h2"
          tone={area === 'build' ? 'pilot' : 'crawler-band'}
          bodyStyle={PANEL_BODY}
        >
          <Text variant="note">{body}</Text>
          {link ? (
            <Button href={link.href} back={link.back ?? true} size="compact">
              {link.label}
            </Button>
          ) : (
            <SignInControl redirectTo={signInTo} />
          )}
        </TitledBox>
      </div>
      {children}
    </PageShell>
  )
}
