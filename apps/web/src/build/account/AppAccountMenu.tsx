import { useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useState } from 'react'
import { AccountMenu as SharedAccountMenu } from '../../components/index'
import { useMe } from '../../lib/account/accountApi'
import { DOC_PAGES } from '../../lib/docPages'
import { useOpenedOnce } from '../../lib/useOpenedOnce'
import { useSync } from '../../replica/syncContext'
import { useSignOut } from './useSignOut'

/** Suggest or report, a chunk of its own: fetched when it first opens. */
const FeedbackDialog = lazy(() =>
  import('./FeedbackDialog').then((m) => ({ default: m.FeedbackDialog }))
)

/**
 * The app's account menu: the UI library's `AccountMenu`, the one the SRD's
 * bar shows too, over this session. The name and avatar come from
 * `useMe`; Settings routes in place, Sign out ends the session
 * here, and Suggest or report opens `FeedbackDialog`.
 *
 * ## When it renders
 *
 * Only for a signed-in session — Connected **or Disconnected**. Offline, the
 * player is still signed in, so the identity stays on screen and Sign out still
 * works (it clears the local session; it needs no server). `useMe`
 * has no answer on a cold start offline, so the trigger then reads "Account".
 *
 * Signed out it renders nothing; the sign-in button is the header's job
 * (`HeaderAccount.tsx`).
 */

type AppAccountMenuProps = {
  /** Avatar only — the mobile header row. */
  compact?: boolean
}

function SignedInAccountMenu({ compact = false }: AppAccountMenuProps) {
  const me = useMe()
  const signOut = useSignOut()
  const navigate = useNavigate()
  const [feedback, setFeedback] = useState(false)
  const feedbackMounted = useOpenedOnce(feedback)

  return (
    <>
      <SharedAccountMenu
        name={me?.displayName ?? null}
        avatarUrl={me?.avatarUrl ?? null}
        compact={compact}
        onGames={() => void navigate({ to: '/games' })}
        onTrainingBay={() => void navigate({ to: '/' })}
        onSettings={() => void navigate({ to: '/settings' })}
        onSignOut={signOut}
        aboutHref={DOC_PAGES.about.href}
        changelogHref={DOC_PAGES.changelog.href}
        onFeedback={() => setFeedback(true)}
      />
      {feedbackMounted && (
        <Suspense fallback={null}>
          <FeedbackDialog open={feedback} onOpenChange={setFeedback} />
        </Suspense>
      )}
    </>
  )
}

export function AppAccountMenu({ compact }: AppAccountMenuProps) {
  const { status } = useSync()
  if (status !== 'live' && status !== 'offline') return null
  return <SignedInAccountMenu compact={compact} />
}
