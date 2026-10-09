/**
 * SignInToBuild — what a signed-out visitor sees where building would be.
 *
 * Signed out, ITUN is read-only
 * ([ADR-034](../../../../../docs/ARCHITECTURE.md#adr-034) decision 1, as
 * amended): every pilot, mech and crawler lives in an account, so there is
 * nothing to build into without one. The Roster and the three `/…/new` routes
 * render this in place of their create affordances, so a visitor meets the
 * sign-in rather than a wizard whose last step would be refused.
 */

import { PageHeading, Text, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { SignInControl } from './SignInControl'

const PANEL = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: tokens.space[16],
  maxWidth: '36rem',
} satisfies CSSProperties

type SignInToBuildProps = {
  /** The heading: what the visitor came here to do. */
  title: string
}

export function SignInToBuild({ title }: SignInToBuildProps) {
  return (
    <section style={PANEL} aria-label={title}>
      <PageHeading>{title}</PageHeading>
      <Text variant="body">
        Build and run your Salvage Union crew — pilots, mechs and Union Crawlers. Everything you
        build is kept in your account, saved as you go, and ready to share with a Game, so building
        needs you signed in.
      </Text>
      <SignInControl />
    </section>
  )
}
