import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * `/account` was the settings page's old address. It redirects, replacing the
 * history entry, so bookmarks, old links and the Discord bot's account link
 * keep working without leaving a dead stop on the back stack.
 */
export const Route = createFileRoute('/account')({
  beforeLoad: () => {
    throw redirect({ to: '/settings', replace: true })
  },
})
