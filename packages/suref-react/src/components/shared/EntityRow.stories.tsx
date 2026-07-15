import type { Story } from '@ladle/react'
import { EntityRow } from './EntityRow'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/EntityRow',
}

/**
 * A roster column: three saved builds — a pilot, a mech, and a crawler — each a
 * header-only listing row keyed to its ontology tone. Real Salvage Union data:
 * Ace (HP 16), the Mule chassis on its Hauler pattern (TL 1 · SP 12), and the
 * Hamlet crawler (TL 1 · SP 20).
 */
export const Roster: Story = () => (
  <div className="max-w-md bg-paper p-5">
    <ul className="flex list-none flex-col gap-2.5">
      <li>
        <EntityRow
          entityType="pilot"
          name="Ace"
          meta="Corpo-trained Pilot · HP 16"
          sheetHref="#/pilot/ace"
          onDeleteClick={() => {}}
        />
      </li>
      <li>
        <EntityRow
          entityType="mech"
          name="Mule — Hauler Pattern"
          meta="TL 1 · SP 12"
          sheetHref="#/mech/mule"
          onDeleteClick={() => {}}
        />
      </li>
      <li>
        <EntityRow
          entityType="crawler"
          name="Hamlet"
          meta="TL 1 · SP 20"
          sheetHref="#/crawler/hamlet"
          onDeleteClick={() => {}}
        />
      </li>
    </ul>
  </div>
)
