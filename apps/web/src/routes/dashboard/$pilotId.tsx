/**
 * The retired Dashboard route — /dashboard/:pilotId
 *
 * Play replaced the Dashboard: the address now redirects to the pilot's Play
 * screen (`/play/:pilotId`), keeping its id, so a bookmark, an old Discord
 * link or an old mech-keyed URL lands where play happens now (`PlayGate`
 * resolves a mech's id to its pilot there).
 */

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/$pilotId')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/play/$pilotId', params: { pilotId: params.pilotId }, replace: true })
  },
})
