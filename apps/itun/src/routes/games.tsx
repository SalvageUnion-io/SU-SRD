import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * `/games` was the Games page — choose a table, start one, join one. All of
 * that lives on the hub at `/` now: Games are entries in its "Showing" select,
 * and "+ New game" starts or joins one. The old address redirects, replacing
 * the history entry, so bookmarks and old links land on the hub.
 */
export const Route = createFileRoute('/games')({
  beforeLoad: () => {
    throw redirect({ to: '/', replace: true })
  },
})
