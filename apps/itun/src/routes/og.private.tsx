import { createFileRoute } from '@tanstack/react-router'
import { LinkPreviewSurface } from '../components/shared/LinkPreviewSurface'
import { pageTitle } from '../lib/pageTitle'

/**
 * `/og/private` — the plain Private card (issue 1280), the one picture every
 * player thing set to Only me unfurls as. The root draws it without chrome.
 */
export const Route = createFileRoute('/og/private')({
  head: () => ({ meta: [{ title: pageTitle('Link preview') }] }),
  component: PrivatePreviewRoute,
})

function PrivatePreviewRoute() {
  return <LinkPreviewSurface kind="private" />
}
