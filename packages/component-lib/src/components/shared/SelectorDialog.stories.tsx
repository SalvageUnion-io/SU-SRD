import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { RosterSkeleton } from './RosterSkeleton'
import { SelectorDialog } from './SelectorDialog'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Containers/Selector Dialog',
}

const pilots = SalvageUnionReference.Classes.all().slice(0, 3)

/** The shared single-select dialog behind the roster + sheet pickers. */
export const Default: Story = () => {
  const [open, setOpen] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  return (
    <div className="bg-paper p-4">
      <Caption>SelectorDialog — single-select with confirm</Caption>
      <SelectorDialog
        open={open}
        title="Assign a Pilot"
        radioGroupName="pilot"
        options={pilots.map((c) => ({ id: c.id, label: c.name }))}
        emptyMessage="No pilots available."
        selectedId={selectedId}
        onSelect={setSelectedId}
        onClose={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </div>
  )
}

/** Roster loading placeholder — shown while IndexedDB hydrates. */
export const Skeleton: Story = () => (
  <div className="bg-paper p-4">
    <Caption>RosterSkeleton</Caption>
    <RosterSkeleton />
  </div>
)
