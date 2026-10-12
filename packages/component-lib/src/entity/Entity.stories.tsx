import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { space } from '../design/tokens'
import type { Story } from '../stories/_harness'
import { Caption } from '../stories/_harness'
import { Entity } from './Entity'

export default {
  title: 'Compositions/Entity/Entity',
}

const STACK = { display: 'flex', flexDirection: 'column', gap: space[16] } satisfies CSSProperties
const ROWS = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
} satisfies CSSProperties
const GRID = {
  display: 'grid',
  gap: space[8],
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 19rem), 1fr))',
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties
const LINE = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[6],
} satisfies CSSProperties

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}

/**
 * The ROW in LINK mode, as an SRD listing draws it (E2, E11): the art column
 * by room, the head, the facts and traits, the lead while browsing. A system
 * without art wears its censor mark (E10).
 */
export const RowLink: Story = () => (
  <div style={STACK}>
    <Caption>Listing rows: link mode, with the lead</Caption>
    <div style={ROWS}>
      {['Mazona', 'Little Sestra'].map((name) => (
        <Entity
          key={name}
          form="row"
          entity={need(SalvageUnionReference.Chassis.getByName(name), name)}
          mode={{ kind: 'link', href: '#' }}
          lead
        />
      ))}
      <Entity
        form="row"
        entity={need(SalvageUnionReference.Systems.getByName('Salvaging Drill'), 'drill')}
        mode={{ kind: 'link', href: '#' }}
        lead
      />
    </div>
  </div>
)

/**
 * E17 in a Row: an action's type is a head stamp, its range and damage are
 * Stat cells, its traits Tags with a parameter cell. "Do" entities wear their
 * tier tone (an ability) or ink (an action).
 */
export const RowDo: Story = () => (
  <div style={ROWS}>
    <Entity form="row" entity={need(SalvageUnionReference.Actions.getByName('Auger'), 'auger')} />
    <Entity
      form="row"
      entity={need(SalvageUnionReference.Actions.getByName('Beta Fission Gun'), 'gun')}
    />
    <Entity form="row" entity={need(SalvageUnionReference.Abilities.getByName('Scrap'), 'scrap')} />
  </div>
)

/** SELECT mode (a picker): the whole Row toggles; an ink ring and a "Selected" seal. */
export const RowSelect: Story = () => {
  const options = ['Salvaging Drill', 'Loudspeakers', 'Comms Module'].flatMap((name) => {
    const found =
      SalvageUnionReference.Systems.getByName(name) ?? SalvageUnionReference.Modules.getByName(name)
    return found ? [found] : []
  })
  const [picked, setPicked] = useState<string>(options[0]?.id ?? '')
  return (
    <div style={ROWS}>
      {options.map((entity) => (
        <Entity
          key={entity.id}
          form="row"
          entity={entity}
          mode={{
            kind: 'select',
            role: 'toggle',
            selected: picked === entity.id,
            onSelect: () => setPicked(entity.id),
          }}
        />
      ))}
    </div>
  )
}

/**
 * An ENTITY GRID (`data-entity-grid`): every Row the same height, the heads
 * ending on one line even where a name wraps.
 */
export const RowGrid: Story = () => (
  <ul data-entity-grid="" style={GRID}>
    {SalvageUnionReference.BioTitans.all()
      .slice(0, 6)
      .map((entity) => (
        <li key={entity.id}>
          <Entity
            form="row"
            entity={entity}
            mode={{ kind: 'link', href: '#' }}
            omit={['kind']}
            lead
          />
        </li>
      ))}
  </ul>
)

/** The TOKEN (E3): `[kind] name [fact]`, many to a line, as a pattern's loadout. */
export const TokenLoadout: Story = () => {
  const mule = need(SalvageUnionReference.Chassis.getByName('Mule'), 'mule')
  const systems = ['Salvaging Drill', 'Loudspeakers'].flatMap((name) => {
    const found = SalvageUnionReference.Systems.getByName(name)
    return found ? [found] : []
  })
  return (
    <div style={STACK}>
      <Caption>Tokens on one line</Caption>
      <div style={LINE}>
        <Entity form="token" entity={mule} mode={{ kind: 'link', href: '#' }} />
        {systems.map((entity) => (
          <Entity key={entity.id} form="token" entity={entity} />
        ))}
        <Entity
          form="token"
          entity={need(SalvageUnionReference.Abilities.getByName('Jury Rig'), 'jury rig')}
        />
      </div>
    </div>
  )
}
