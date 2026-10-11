import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * `/join/$code` — the retired join-code page (issue 1255). Invite links replaced
 * typed codes, but links to this address sit in Discord history.
 *
 * Decided: an old link resolves rather than dead-ending. It redirects to
 * `/invite/$code`, whose token is the same `code` column, so a code that maps to
 * a live invite joins like any invite link, and a dead or unknown one lands on
 * the invite page's explanation of how invite links work. One page answers
 * both, so the two can never disagree.
 */
export const Route = createFileRoute('/join/$code')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/invite/$token', params: { token: params.code }, replace: true })
  },
})
