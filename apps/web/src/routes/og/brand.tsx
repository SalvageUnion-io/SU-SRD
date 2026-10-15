import { createFileRoute } from '@tanstack/react-router'
import { PRODUCT } from 'cantina-domain/product'
import { BrandCard } from '../../components/index'
import { pageTitle } from '../../lib/pageTitle'
import { SCRIPT_FONT } from '../../lib/scriptFont'

/**
 * `/og/brand` — the render surface of the Cantina's own link preview,
 * `public/build/og-image.png`: the picture every route but a shared sheet or
 * invite unfurls with: "THE CANTINA" on its Legendary-pink band, under the legacy
 * tagline quoted in Caveat with Stumpy's credit, and the address it lives at.
 * The root draws it without chrome; nothing requests it at runtime.
 */
export const Route = createFileRoute('/og/brand')({
  head: () => ({ meta: [{ title: pageTitle('Link preview') }] }),
  component: BrandPreviewRoute,
})

function BrandPreviewRoute() {
  // The legacy tagline, quoted as on the front door, over the name.
  return (
    <BrandCard
      quote={{ text: PRODUCT.tagline, by: PRODUCT.taglineBy, font: SCRIPT_FONT }}
      title={['The', 'Cantina']}
      tone="cantina"
      address="salvageunion.io/build"
    />
  )
}
