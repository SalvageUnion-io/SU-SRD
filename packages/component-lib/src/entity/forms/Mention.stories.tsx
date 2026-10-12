import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { EntityRef } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { EntitySurfaceProvider } from '../EntitySurface'
import { Mention } from './Mention'

export default {
  title: 'Compositions/Entity/Mention',
}

const STACK = { display: 'flex', flexDirection: 'column', gap: space[12] } satisfies CSSProperties
const PROSE = { fontSize: '14px', margin: 0, maxWidth: '40rem' } satisfies CSSProperties

function traitRef(name: string): EntityRef | undefined {
  const trait = SalvageUnionReference.Traits.getByName(name)
  return trait ? toEntityModel(trait).ref : undefined
}

/**
 * A MENTION (E4) in the three states the surface gives it, in a real
 * Mechapult band: a link where the surface has a route (the SRD), a button
 * that opens the Page where it has an opener (ITUN), and an inert word for a
 * name that resolves to nothing. Hover, focus or long-press a resolved one:
 * the catalog's PeekHost shows its Peek.
 */
export const Default: Story = () => {
  const [opened, setOpened] = useState<string | null>(null)
  const burn = traitRef('burn')
  const explosive = traitRef('explosive')
  const band = (
    <>
      The attack has the <Mention entityRef={explosive}>Explosive (X)</Mention> and{' '}
      <Mention entityRef={burn}>Burn (X)</Mention> Traits, where X is the Tech Level of the Scrap.
    </>
  )
  return (
    <div style={STACK}>
      <Caption>Linked (the SRD): the surface routes each ref to its page</Caption>
      <EntitySurfaceProvider value={{ hrefFor: (ref) => `#${ref.schemaName}-${ref.slug}` }}>
        <p style={PROSE}>{band}</p>
      </EntitySurfaceProvider>
      <Caption>Opens the Page (ITUN): the surface's opener</Caption>
      <EntitySurfaceProvider value={{ openPage: (ref) => setOpened(ref.name) }}>
        <p style={PROSE}>{band}</p>
      </EntitySurfaceProvider>
      <Caption>{opened ? `Opened: ${opened}` : 'Click one above to open it'}</Caption>
      <Caption>Inert: a word the glossaries do not carry, with no Peek</Caption>
      <p style={PROSE}>
        Roll on the <Mention entityRef={undefined}>Salvage</Mention> table.
      </p>
    </div>
  )
}
