import { createFileRoute } from '@tanstack/react-router'
import { SignOutHandoff } from '../build/account/AccountHandoff'
import { pageTitle } from '../lib/pageTitle'
import { routesCopy } from '../messages/routes'

/** The SRD account menu's Sign out, then back to the page it was on (`AccountHandoff.tsx`). */
export const Route = createFileRoute('/sign-out')({
  head: () => ({ meta: [{ title: pageTitle(routesCopy('signOut')) }] }),
  validateSearch: (search: Record<string, unknown>): { to?: string } =>
    typeof search.to === 'string' ? { to: search.to } : {},
  component: SignOutRoute,
})

function SignOutRoute() {
  const { to } = Route.useSearch()
  return <SignOutHandoff to={to} />
}
