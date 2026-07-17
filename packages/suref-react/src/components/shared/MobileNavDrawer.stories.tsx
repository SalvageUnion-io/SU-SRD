import type { Story } from '@ladle/react'
import { MobileNavDrawer } from './MobileNavDrawer'
import { SearchField } from './SearchField'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/Site/Mobile Nav Drawer',
}

const CATEGORIES = [
  {
    label: 'Mechs',
    schemas: [
      { id: 'chassis', displayName: 'Chassis', catalogBg: 'var(--color-mech)' },
      { id: 'systems', displayName: 'Systems', catalogBg: 'var(--color-su-green-dark)' },
      { id: 'modules', displayName: 'Modules', catalogBg: 'var(--color-su-green)' },
    ],
  },
  {
    label: 'Pilots',
    schemas: [
      { id: 'classes', displayName: 'Classes', catalogBg: 'var(--color-pilot)' },
      { id: 'equipment', displayName: 'Equipment', catalogBg: 'var(--color-su-orange-dark)' },
    ],
  },
  {
    label: 'Reference',
    schemas: [
      {
        id: 'traits',
        displayName: 'Traits',
        catalogBg: 'var(--color-su-black)',
        catalogLabel: 'var(--color-su-orange-dark)',
      },
    ],
  },
]

/**
 * The SRD reference site's mobile nav drawer (extracted from suref-web, pending
 * review). Shown opened, on the Chassis route (Reference tab active). The search
 * slot hosts the shared SearchField (the site passes its live SearchIsland).
 */
export const Default: Story = () => (
  <MobileNavDrawer
    categories={CATEGORIES}
    currentPath="/schema/chassis/"
    itunUrl="https://intheunionnow.com"
    search={<SearchField placeholder="Search…" aria-label="Search the SRD" />}
    defaultOpen
  />
)
