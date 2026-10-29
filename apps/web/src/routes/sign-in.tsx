import { createFileRoute } from '@tanstack/react-router'
import { SignInHandoff } from '../build/account/AccountHandoff'
import { pageTitle } from '../lib/pageTitle'
import { routesCopy } from '../messages/routes'

/** The SRD's Sign in: Discord's round trip, from the app (`AccountHandoff.tsx`). */
export const Route = createFileRoute('/sign-in')({
  head: () => ({ meta: [{ title: pageTitle(routesCopy('signIn')) }] }),
  component: SignInHandoff,
})
