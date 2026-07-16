import type { Story } from '@ladle/react'
import { EntityRow } from './EntityRow'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Entity Row',
}

/**
 * A roster column: three saved builds — a pilot, a mech, and a crawler — each a
 * header-only listing row keyed to its ontology tone. Real Salvage Union data:
 * Ace (HP 16), the Mule chassis on its Hauler pattern (TL 1 · SP 12), and the
 * Hamlet crawler (TL 1 · SP 20).
 */
export const Default: Story = () => (
  <div className="max-w-md bg-paper p-5">
    <ul className="flex list-none flex-col gap-2.5">
      <li>
        <EntityRow
          entityType="pilot"
          name="Ace"
          meta="Corpo-trained Pilot"
          stats={[{ label: 'HP', value: 16 }]}
          sheetHref="#/pilot/ace"
          onDeleteClick={() => {}}
        />
      </li>
      <li>
        <EntityRow
          entityType="mech"
          name="Mule — Hauler Pattern"
          stats={[
            { label: 'TL', value: 1 },
            { label: 'SP', value: 12 },
          ]}
          sheetHref="#/mech/mule"
          onDeleteClick={() => {}}
        />
      </li>
      <li>
        <EntityRow
          entityType="crawler"
          name="Hamlet"
          stats={[
            { label: 'TL', value: 1 },
            { label: 'SP', value: 20 },
          ]}
          sheetHref="#/crawler/hamlet"
          onDeleteClick={() => {}}
        />
      </li>
    </ul>
  </div>
)
