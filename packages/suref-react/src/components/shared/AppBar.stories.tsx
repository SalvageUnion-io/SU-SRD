import type { Story } from '@ladle/react'
import { AppBar } from './AppBar'
import { SearchField } from './SearchField'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/App Bar',
}

/**
 * The shared masthead both SU surfaces are built from — HeaderShell brand + a
 * config-driven right-side cluster (nav links + search slot + Buy button) and
 * an optional breadcrumb bar. The SRD `SiteHeader` and ITUN `AppHeader` are
 * thin presets over this. Shown in the SRD configuration on a schema item route
 * (active nav + breadcrumbs).
 */
export const Default: Story = () => (
  <div className="-mx-4 -mt-4">
    <AppBar
      wordmark="SalvageUnion"
      wordmarkAccent=".io"
      eyebrow="The Salvage Union SRD"
      navItems={[
        { label: 'SRD', href: '/', active: true },
        { label: 'ABOUT', href: '/about/' },
        { label: 'CHANGELOG', href: '/changelog/' },
        { label: 'API', href: '/api/' },
        { label: 'BUILDER ↗', href: 'https://intheunionnow.com', external: true },
      ]}
      search={<SearchField placeholder="Search…" aria-label="Search the SRD" className="w-52" />}
      buyHref="https://leyline.press/collections/salvage-union"
      breadcrumbs={[
        { name: 'SRD', url: '/' },
        { name: 'Chassis', url: '/schema/chassis/' },
        { name: 'Iron Mongrel', url: '/schema/chassis/item/iron-mongrel/' },
      ]}
      breadcrumbDescription="Tech Level 1 Mech Chassis"
    />
  </div>
)
