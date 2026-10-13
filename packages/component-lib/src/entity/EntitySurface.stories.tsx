import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { space } from '../design/tokens'
import type { Story } from '../stories/_harness'
import { Caption } from '../stories/_harness'
import { Entity } from './Entity'
import { EntitySurfaceProvider } from './EntitySurface'

export default {
  title: 'Compositions/Entity/Surface Provider',
}

const STACK = { display: 'flex', flexDirection: 'column', gap: space[12] } satisfies CSSProperties

/**
 * The SURFACE supplies context once (E13): the Dashboard turns the speckle
 * off for everything inside it, and `hrefFor` decides where each Row links.
 */
export const Default: Story = () => {
  const drill = SalvageUnionReference.Systems.getByName('Salvaging Drill')
  if (!drill) return null
  return (
    <div style={STACK}>
      <Caption>Textured (the default)</Caption>
      <Entity form="row" entity={drill} />
      <Caption>Inside a flat surface: texture off</Caption>
      <EntitySurfaceProvider value={{ texture: false }}>
        <Entity form="row" entity={drill} />
      </EntitySurfaceProvider>
      <Caption>A surface linking every Row</Caption>
      <EntitySurfaceProvider value={{ hrefFor: () => '#' }}>
        <Entity form="row" entity={drill} mode={{ kind: 'link' }} />
      </EntitySurfaceProvider>
    </div>
  )
}
