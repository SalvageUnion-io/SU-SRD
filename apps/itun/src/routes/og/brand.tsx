import { createFileRoute } from '@tanstack/react-router'
import { BrandCard } from 'component-lib'
import { PRODUCT } from 'component-lib/product'
import { pageTitle } from '../../lib/pageTitle'

/**
 * `/og/brand` — the render surface of ITUN's own link preview,
 * `public/og-image.png`: the picture every route but a shared sheet or
 * invite unfurls with. It wears the Discord banner's kicker, word for word.
 * The root draws it without chrome; nothing requests it at runtime.
 */
export const Route = createFileRoute('/og/brand')({
  head: () => ({ meta: [{ title: pageTitle('Link preview') }] }),
  component: BrandPreviewRoute,
})

function BrandPreviewRoute() {
  // Set in caps, so it reads as the banner's "YOU'RE IN THE UNION NOW!".
  return <BrandCard kicker={`You're ${PRODUCT.name}!`} />
}
