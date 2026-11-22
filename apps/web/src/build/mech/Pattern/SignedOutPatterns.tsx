/**
 * SignedOutPatterns — the Patterns page with nobody signed in (r3 E3).
 *
 * A pattern is kept on an account, so signed out the page holds none and never
 * will: it says so, offers the sign-in that comes back here, and points at the
 * patterns the book prints, which need no account and live on each chassis's
 * page in the Reference.
 */

import type { CSSProperties } from 'react'
import { Button, EmptyState, tokens } from '../../../components/index'
import { hereInApp } from '../../../lib/hereInApp'
import { mechCopy } from '../../../messages/build-mech'
import { SignInControl } from '../../account/SignInControl'

/** The Reference's chassis listing: every book pattern is on its chassis's page. */
const BOOK_PATTERNS_HREF = '/chassis/'

const ACTIONS = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

export function SignedOutPatterns() {
  return (
    <EmptyState
      headline={mechCopy('noPatternsYet')}
      body={mechCopy('signInToKeepPatterns')}
      action={
        <div style={ACTIONS}>
          <SignInControl redirectTo={hereInApp()} />
          {/* A plain link: the Reference is outside the app's router. */}
          <Button href={BOOK_PATTERNS_HREF} linkAs="a" variant="default" size="compact">
            {mechCopy('seeTheBooksPatterns')}
          </Button>
        </div>
      }
    />
  )
}
