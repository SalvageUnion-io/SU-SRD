/**
 * SignInToBuild — what a signed-out visitor sees where building would be.
 *
 * Signed out, the Cantina is read-only
 * ([ADR-034](../../../../../docs/ARCHITECTURE.md#decisions) decision 1, as
 * amended): every pilot, mech and crawler lives in an account, so there is
 * nothing to build into without one. The Roster and the three `/…/new` routes
 * render this in place of their create affordances, so a visitor meets the
 * sign-in rather than a wizard whose last step would be refused.
 */

import type { CSSProperties } from 'react'
import { ChapterBand, Text, tokens } from '../../components/index'
import { SignInControl } from './SignInControl'

/** The column under the band; the band's notch starts where it does. */
const MEASURE = '36rem'

/** The band runs the full width of the route's `<main>`; the content centres under it. */
const COLUMN = {
  alignItems: 'flex-start',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[20],
  marginInline: 'auto',
  maxWidth: MEASURE,
  padding: `${tokens.space[32]} ${tokens.space[16]}`,
  width: '100%',
} satisfies CSSProperties

type SignInToBuildProps = {
  /** The heading: what the visitor came here to do. */
  title: string
  /** Where Discord's round trip lands (`SignInControl`'s `redirectTo`); unset, the site root. */
  redirectTo?: string
}

export function SignInToBuild({ title, redirectTo }: SignInToBuildProps) {
  return (
    <section aria-label={title}>
      <ChapterBand tone="build" measure={MEASURE}>
        {title}
      </ChapterBand>
      <div style={COLUMN}>
        <Text variant="body">
          Build and run your Salvage Union crew — pilots, mechs and Union Crawlers. Everything you
          build is kept in your account, saved as you go, and ready to share with a Game, so
          building needs you signed in.
        </Text>
        <SignInControl size="full" redirectTo={redirectTo} />
      </div>
    </section>
  )
}
