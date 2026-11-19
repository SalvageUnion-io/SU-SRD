/**
 * PlayRefusal — the shell a play screen renders when it cannot open: the
 * page's name on the band, what is missing as the heading under it, and the
 * one way on. Play's gates (`PlayGate`, `PlayMediatorGate`) answer with it;
 * while the session or the Game has not answered yet, they wait on
 * `RoutePending`.
 *
 * Signed out, the way on is Sign in (`signInTo`), whose round trip comes back
 * to the screen that refused, so a Play link tapped in Discord still opens
 * once you have signed in.
 */

import { PRODUCT } from 'game-domain/product'
import type { CSSProperties, ReactNode } from 'react'
import { SignInControl } from '../build/account/SignInControl'
import { Button, ChapterBand, PageShell, Text, tokens } from '../components/index'

const BODY = { maxWidth: '36rem' } satisfies CSSProperties

const REASON = { fontSize: tokens.fontSize.title, margin: 0 } satisfies CSSProperties

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
  return (
    <PageShell>
      <ChapterBand tone={area}>{PRODUCT[area]}</ChapterBand>
      <Text as="h2" style={REASON}>
        {title}
      </Text>
      <Text variant="hint" style={BODY}>
        {body}
      </Text>
      <div>
        {link ? (
          <Button href={link.href} back={link.back ?? true} size="compact">
            {link.label}
          </Button>
        ) : (
          <SignInControl redirectTo={signInTo} />
        )}
      </div>
      {children}
    </PageShell>
  )
}
