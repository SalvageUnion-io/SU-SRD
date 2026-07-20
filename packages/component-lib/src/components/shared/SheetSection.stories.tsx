import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import {
  CardRemoveButton,
  HButton,
  SectionAddButton,
  SectionChead,
  SectionEditButton,
  SheetPickerModal,
} from './SheetSection'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Sheet Section',
}

// Real SRD entities — a live sheet's collection sections are lists of these.
const system = SalvageUnionReference.Systems.all()[0]
const ability = SalvageUnionReference.Abilities.all()[0]

/**
 * The three interaction archetypes of the live sheets' edit language, in the
 * arrangement the sheets actually use: a `SectionChead` whose `actions` slot
 * carries either a per-section Edit toggle (FIELD sections) or an always-live
 * Add (COLLECTION sections).
 */
export const Default: Story = () => {
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)

  return (
    <div className="sheet--mech flex max-w-3xl flex-col gap-8 bg-paper p-4">
      <div>
        <Caption>FIELD section — per-section Edit/Done toggle</Caption>
        <SectionChead
          title="Identity"
          actions={
            <SectionEditButton
              section="Identity"
              editing={editing}
              onToggle={() => setEditing((v) => !v)}
            />
          }
        />
        <p className="mt-2 font-body text-caption text-ink-2">
          {editing ? 'Editing — fields show the dashed cue.' : 'Read-only.'}
        </p>
      </div>

      <div>
        <Caption>COLLECTION section — always-live Add + per-card remove</Caption>
        <SectionChead
          title="Systems"
          count={1}
          actions={<SectionAddButton label="system" onClick={() => setOpen(true)} />}
        />
        <div className="mt-2 flex flex-col gap-2">
          {system ? <ReferenceEntityCard data={system} size="medium" /> : null}
          <div>
            <CardRemoveButton name={system?.name ?? 'System'} onRemove={() => {}} />
          </div>
        </div>
      </div>

      <div>
        <Caption>HButton — the bare section control</Caption>
        <HButton onClick={() => {}}>Edit</HButton>
      </div>

      <SheetPickerModal open={open} onClose={() => setOpen(false)} title="Add a System">
        <div className="flex flex-col gap-2 p-2">
          {ability ? <ReferenceEntityCard data={ability} size="medium" extent="catalog" /> : null}
        </div>
      </SheetPickerModal>
    </div>
  )
}
