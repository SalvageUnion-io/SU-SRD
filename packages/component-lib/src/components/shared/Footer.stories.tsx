import type { Story } from '@ladle/react'
import { Footer } from './Footer'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Shell/Footer',
}

/**
 * The site footer — Leyline Press copyright + Salvage Union OGL 1.0b attribution
 * + the "Powered by Salvage" logo, with an optional legal-links row. (Still on
 * pre-canon `the ink ramp`/`ink` tokens — pending refresh + approval. The
 * `poweredBySalvageUrl` asset lives in each app's public dir, so the logo shows
 * broken here in the shared library.)
 */
export const Default: Story = () => (
  <Footer
    poweredBySalvageUrl="/Powered_by_Salvage_Black.webp"
    legalLinks={[
      { label: 'About', href: '/about' },
      { label: 'Discord', href: '/discord' },
    ]}
  />
)
