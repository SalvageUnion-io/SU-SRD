import type { Story } from '@ladle/react'
import { SiteHeader } from './SiteHeader'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/Site/Site Header',
}

// Stand-ins for the site's hydrated islands (the real SearchIsland / mobile
// drawer live in suref-web and slot in there); here they preview the chrome's
// slot placement.
const SearchTrigger = () => (
  <button
    type="button"
    className="flex cursor-pointer items-center gap-2 rounded border border-su-black bg-paper px-3 py-[7px] font-mono text-[13px] text-su-grey-dark lg:w-64"
  >
    Search…
  </button>
)

/**
 * The SRD reference site's header (converted from suref-web, pending review) —
 * the shared HeaderShell filled with the SRD nav, an outbound Builder
 * cross-link, the desktop search slot, and "Buy the game". Shown on a schema
 * item route so the breadcrumb bar + active nav state render.
 */
export const Default: Story = () => (
  <div className="-mx-4 -mt-4">
    <SiteHeader
      currentPath="/schema/chassis/item/iron-mongrel/"
      itunUrl="https://intheunionnow.com"
      breadcrumbs={[
        { name: 'SRD', url: '/' },
        { name: 'Chassis', url: '/schema/chassis/' },
        { name: 'Iron Mongrel', url: '/schema/chassis/item/iron-mongrel/' },
      ]}
      breadcrumbDescription="Tech Level 1 Mech Chassis"
      search={<SearchTrigger />}
    />
  </div>
)
