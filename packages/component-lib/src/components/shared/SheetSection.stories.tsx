import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { Slab } from '../chrome/Slab'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { CardRemoveButton, HButton, SectionManageButton, SheetPickerModal } from './SheetSection'

export default {
  title: 'Compositions/Sheet Section',
}

// Real SRD entities — a live sheet's collection sections are lists of these.
const system = SalvageUnionReference.Systems.all()[0]
const ability = SalvageUnionReference.Abilities.all()[0]

/**
 * The live sheets' edit language, in the arrangement the sheets actually use: a
 * solid `Slab` section header whose `actions` slot carries an always-live Add
 * (COLLECTION sections).
 *
 * The FIELD archetype's per-section Edit/Done toggle used to be demonstrated
 * here too. `SectionEditButton` was built and exported but adopted by no sheet,
 * so it was deleted and this story lost that panel with it.
 */
export const Default: Story = () => {
  const [open, setOpen] = useState(false)

  return (
    <div className="sheet--mech flex max-w-3xl flex-col gap-8 bg-paper p-4">
      <div>
        <Caption>COLLECTION section — always-live Add + per-card remove</Caption>
        <Slab
          variant="solid"
          label="Systems"
          count={1}
          actions={<SectionManageButton label="systems" onClick={() => setOpen(true)} />}
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
