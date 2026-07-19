/**
 * /pilots/$id — legacy detail route, now a redirect.
 *
 * The per-entity detail page has been collapsed into the live sheet, which is
 * the only surface. This route redirects to /sheet/pilot/$id before load.
 */

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/pilots/$id')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/sheet/$kind/$id', params: { kind: 'pilot', id: params.id } })
  },
})
