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
import type { CSSProperties } from 'react'
import { SignInControl } from '../build/account/SignInControl'
import { Button, ChapterBand, PageShell, Text, tokens } from '../components/index'

const BODY = { maxWidth: '36rem', textAlign: 'left' } satisfies CSSProperties

const REASON = { fontSize: tokens.fontSize.title, margin: 0 } satisfies CSSProperties

type PlayRefusalProps = {
  /** What is missing, as the heading under the band. */
  title: string
  body: string
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

export function PlayRefusal({ title, body, link, signInTo }: PlayRefusalProps) {
  return (
    <PageShell>
      <ChapterBand tone="play">{PRODUCT.play}</ChapterBand>
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
    </PageShell>
  )
}
