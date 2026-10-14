import { createFileRoute } from '@tanstack/react-router'
import { BrandCard } from 'component-lib'
import { PRODUCT } from 'component-lib/product'
import { pageTitle } from '../../lib/pageTitle'

/**
 * `/og/brand` — the render surface of ITUN's own link preview,
 * `public/og-image.png`: the picture every route but a shared sheet or
 * invite unfurls with: "THE CANTINA" on its Legendary-pink band, under the legacy
 * tagline.
 * The root draws it without chrome; nothing requests it at runtime.
 */
export const Route = createFileRoute('/og/brand')({
  head: () => ({ meta: [{ title: pageTitle('Link preview') }] }),
  component: BrandPreviewRoute,
})

function BrandPreviewRoute() {
  // The legacy tagline over the name, on The Cantina's own band.
  return <BrandCard kicker={PRODUCT.tagline} title={['The', 'Cantina']} tone="cantina" />
}
