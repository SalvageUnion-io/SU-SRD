import { createFileRoute, useParams } from '@tanstack/react-router'
import { LinkPreviewSurface } from '../components/shared/LinkPreviewSurface'
import { pageTitle } from '../lib/pageTitle'

/**
 * `/og/$kind/$id` — the render surface of a player thing's link preview
 * (issue 1280): `OgCard` at 1200 × 630, for Browser Rendering to screenshot.
 * `kind` is `pilot`, `mech`, `crawler`, `pattern` or `invite` (with the code
 * as the id). The root draws it without the app's chrome.
 */
export const Route = createFileRoute('/og/$kind/$id')({
  head: () => ({ meta: [{ title: pageTitle('Link preview') }] }),
  component: LinkPreviewRoute,
})

function LinkPreviewRoute() {
  const { kind, id } = useParams({ from: '/og/$kind/$id' })
  return <LinkPreviewSurface kind={kind} id={id} />
}
