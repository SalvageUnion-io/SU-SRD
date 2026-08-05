import type { Story } from '@ladle/react'
import { useState } from 'react'
import { MobileSearchDialog } from './MobileSearchDialog'
import { SearchField } from './SearchField'

export default {
  title: 'Containers/Mobile Search Dialog',
}

/**
 * The mobile top-nav search trigger + full-screen sheet. Tap the magnifier to
 * open the sheet; the injected search content mounts only while open. Here the
 * content is the shared `SearchField` (srd injects its full `SearchIsland`
 * combobox instead).
 */
export const Default: Story = () => {
  const [q, setQ] = useState('Iron Mongrel')
  return (
    <div className="flex items-center gap-3 rounded bg-ink px-4 py-2">
      <span className="font-cond text-sm font-bold uppercase text-paper">Salvage Union</span>
      <div className="ml-auto">
        <MobileSearchDialog triggerAriaLabel="Search the SRD">
          <div className="[&_input]:w-full">
            <SearchField
              type="search"
              aria-label="Search the SRD"
              placeholder="Search the SRD…"
              glyphSize={16}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </MobileSearchDialog>
      </div>
    </div>
  )
}
