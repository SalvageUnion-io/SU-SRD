import '../../styles/sheet.css'
import { ReferenceEntityCard, Slab, tokens } from 'component-lib'
import type { Story } from 'component-lib/stories/harness'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { CardRemoveButton, SectionManageButton, SheetPickerModal } from './SheetSection'

export default {
  title: 'Compositions/Sheet Section',
}

// Real SRD entities — a live sheet's collection sections are lists of these.
const system = SalvageUnionReference.Systems.all()[0]
const ability = SalvageUnionReference.Abilities.all()[0]

const FRAME = {
  display: 'flex',
  maxWidth: '48rem',
  flexDirection: 'column',
  gap: tokens.space[32],
  backgroundColor: tokens.color.paper,
  padding: tokens.space[16],
} satisfies CSSProperties

const CARDS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

/**
 * The live sheets' edit language, in the arrangement the sheets actually use: a
 * solid `Slab` section header whose `actions` slot carries an always-live Add
 * (COLLECTION sections).
 */
export const Default: Story = () => {
  const [open, setOpen] = useState(false)

  return (
    <div className="sheet--mech" style={FRAME}>
      <div>
        <Caption>COLLECTION section — always-live Add + per-card remove</Caption>
        <Slab
          variant="solid"
          label="Systems"
          count={1}
          actions={<SectionManageButton label="systems" onClick={() => setOpen(true)} />}
        />
        <div style={{ ...CARDS, marginTop: tokens.space[8] }}>
          {system ? <ReferenceEntityCard data={system} size="medium" /> : null}
          <div>
            <CardRemoveButton name={system?.name ?? 'System'} onRemove={() => {}} />
          </div>
        </div>
      </div>

      <SheetPickerModal open={open} onClose={() => setOpen(false)} title="Add a System">
        <div style={{ ...CARDS, padding: tokens.space[8] }}>
          {ability ? <ReferenceEntityCard data={ability} size="medium" extent="catalog" /> : null}
        </div>
      </SheetPickerModal>
    </div>
  )
}
