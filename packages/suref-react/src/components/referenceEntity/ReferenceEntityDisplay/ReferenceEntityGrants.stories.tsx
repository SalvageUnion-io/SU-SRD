import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityGrants } from './ReferenceEntityGrants'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'ReferenceEntity/ReferenceEntityGrants',
}

const singleGrant = SalvageUnionReference.Abilities.find(
  (a) => a.name === 'Auto-Turret'
) as SURefEntity
const doubleGrant = SalvageUnionReference.Abilities.find(
  (a) => a.name === 'Mecha Packmaster'
) as SURefEntity
const choiceBearingGrant = SalvageUnionReference.Abilities.find(
  (a) => a.name === 'Custom Sniper Rifle'
) as SURefEntity

/** A single granted entity, expanded (full nested card). */
export const SingleGrant: Story = () => (
  <div className="w-[600px]">
    <ReferenceEntityGrants data={singleGrant} />
  </div>
)

/** Two entities granted by one ability — one nested card per grant. */
export const DoubleGrant: Story = () => (
  <div className="w-[600px]">
    <ReferenceEntityGrants data={doubleGrant} />
  </div>
)

/** Granted equipment that itself carries choices — nested choice cards render
 * inside the granted entity's own expanded card. */
export const GrantWithChoices: Story = () => (
  <div className="w-[600px]">
    <ReferenceEntityGrants data={choiceBearingGrant} />
  </div>
)

/** Collapsed: when the parent ability renders compact, granted entities
 * collapse to header-only listing cards (no body/choices). */
export const CompactCollapsed: Story = () => (
  <div className="w-[420px]">
    <ReferenceEntityGrants data={choiceBearingGrant} compact />
  </div>
)
