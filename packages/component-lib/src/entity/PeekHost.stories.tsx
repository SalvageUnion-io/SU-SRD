import type { CSSProperties } from 'react'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { space } from '../design/tokens'
import type { Story } from '../stories/_harness'
import { Caption } from '../stories/_harness'
import { Entity } from './Entity'
import { EntitySurfaceProvider } from './EntitySurface'
import { Mention } from './forms/Mention'
import { PeekHost } from './Peek'
import { PeekCard } from './PeekCard'
import { PEEK_PLATE } from './peekPlate'

export default {
  title: 'Compositions/Entity/Peek Host',
}

const STACK = { display: 'flex', flexDirection: 'column', gap: space[12] } satisfies CSSProperties

/**
 * The PEEK (E16): hover, focus (Tab) or long-press a Mention or a trait Tag
 * and the page's one PeekHost shows the entity's compact card — read-only and
 * terminal. Escape hides it. The catalog mounts the host once, as each app
 * does; this story's own `PeekHost` stands down beside it.
 *
 * Below, the same plate laid out in flow: the Salvaging Drill's Peek, and a
 * chassis's, whose patterns and abilities print but act on nothing.
 */
export const Default: Story = () => {
  const drill = SalvageUnionReference.Systems.getByName('Salvaging Drill')
  const mule = SalvageUnionReference.Chassis.getByName('Mule')
  const vulnerable = SalvageUnionReference.Traits.getByName('vulnerable')
  if (!drill || !mule || !vulnerable) return null
  return (
    <div style={STACK}>
      <PeekHost />
      <Caption>Mentions and Tags Peek: hover, Tab to, or long-press one</Caption>
      <EntitySurfaceProvider value={{ hrefFor: (ref) => `#${ref.schemaName}-${ref.slug}` }}>
        <p style={{ fontSize: '14px', margin: 0 }}>
          Your Mech shuts down and gains the{' '}
          <Mention entityRef={toEntityModel(vulnerable).ref}>Vulnerable</Mention> Trait.
        </p>
        <Entity form="row" entity={drill} />
      </EntitySurfaceProvider>
      <Caption>The plate, in flow: a system</Caption>
      <div style={{ ...PEEK_PLATE, maxWidth: 'min(500px, 100%)' }}>
        <PeekCard entity={drill} />
      </div>
      <Caption>The plate, in flow: a chassis — nothing on it acts</Caption>
      <div style={{ ...PEEK_PLATE, maxWidth: 'min(500px, 100%)' }}>
        <PeekCard entity={mule} />
      </div>
    </div>
  )
}
