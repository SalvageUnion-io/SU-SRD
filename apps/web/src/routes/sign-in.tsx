import { createFileRoute } from '@tanstack/react-router'
import { SignInHandoff } from '../build/account/AccountHandoff'
import { pageTitle } from '../lib/pageTitle'

/** The SRD's Sign in: Discord's round trip, from the app (`AccountHandoff.tsx`). */
export const Route = createFileRoute('/sign-in')({
  head: () => ({ meta: [{ title: pageTitle('Sign in') }] }),
  component: SignInHandoff,
})
