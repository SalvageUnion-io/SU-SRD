import type { Story } from '@ladle/react'
import { ReferenceEntityDisplay } from './ReferenceEntityDisplay/index'
import { SalvageUnionReference, getChoices } from 'salvageunion-reference'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/ReferenceEntityDisplay',
}

const system = SalvageUnionReference.Systems.all()[0]
const module = SalvageUnionReference.Modules.all()[0]
const chassis = SalvageUnionReference.Chassis.all()[0]
const ability = SalvageUnionReference.Abilities.all()[0]
const trait = SalvageUnionReference.Traits.all()[0]

const rainmakerEntity =
  SalvageUnionReference.Systems.all().find((s) => s.source === 'Rainmaker') ?? system
const wwhfEntity =
  SalvageUnionReference.Systems.all().find((s) => s.source === 'We Were Here First!') ?? system
const falseFlagEntity =
  SalvageUnionReference.Systems.all().find((s) => s.source === 'False Flag') ?? system

// Fixtures for the choice-card / grants-collapse coverage below (same fixtures
// used by the ReferenceEntityGrants / grantedEquipmentDisplay test suites).
const grantingAbility = SalvageUnionReference.Abilities.all().find((a) => a.name === 'Auto-Turret')
const choiceBearingEquipment = SalvageUnionReference.Equipment.all().find(
  (e) => e.name === 'Custom Sniper Rifle'
)

export const DefaultSystem: Story = () => (
  <div className="w-[600px]">
    <ReferenceEntityDisplay data={system} />
  </div>
)

export const CompactMode: Story = () => (
  <div className="w-[400px]">
    <ReferenceEntityDisplay data={system} compact />
  </div>
)

export const Listing: Story = () => (
  <div className="w-[600px]">
    <ReferenceEntityDisplay data={system} listing />
  </div>
)

export const Disabled: Story = () => (
  <div className="w-[600px]">
    <ReferenceEntityDisplay data={system} disabled />
  </div>
)

export const Damaged: Story = () => (
  <div className="w-[600px]">
    <ReferenceEntityDisplay data={system} damaged />
  </div>
)

export const CustomHeaderColor: Story = () => (
  <div className="w-[600px]">
    <ReferenceEntityDisplay data={system} headerColor="bg-su-pink" />
  </div>
)

export const HiddenActions: Story = () => (
  <div className="w-[600px]">
    <ReferenceEntityDisplay data={system} hide={{ actions: true }} />
  </div>
)

export const WithFooter: Story = () => (
  <div className="w-[600px]">
    <ReferenceEntityDisplay data={system} />
  </div>
)

export const DifferentSchemas: Story = () => (
  <div className="flex flex-col gap-4 w-[600px]">
    <ReferenceEntityDisplay data={system} />
    <ReferenceEntityDisplay data={module} />
    <ReferenceEntityDisplay data={chassis} />
    <ReferenceEntityDisplay data={ability} />
    <ReferenceEntityDisplay data={trait} />
  </div>
)

export const DimHeader: Story = () => (
  <div className="w-[600px]">
    <ReferenceEntityDisplay data={ability} dimHeader />
  </div>
)

export const CompactDamaged: Story = () => (
  <div className="w-[400px]">
    <ReferenceEntityDisplay data={system} compact damaged />
  </div>
)

export const ListingDisabled: Story = () => (
  <div className="w-[600px]">
    <ReferenceEntityDisplay data={system} listing disabled />
  </div>
)

/** Grants-collapse, expanded: the ability's own content/Actions are suppressed
 * in favor of a "Grants" block with a nested, fully-expanded equipment card. */
export const GrantingAbilityExpanded: Story = () => (
  <div className="w-[600px]">
    <ReferenceEntityDisplay data={grantingAbility} />
  </div>
)

/** Grants-collapse, collapsed: in compact mode the nested granted entity
 * itself collapses to a header-only listing card. */
export const GrantingAbilityCompactCollapsed: Story = () => (
  <div className="w-[420px]">
    <ReferenceEntityDisplay data={grantingAbility} compact />
  </div>
)

/** Choice-bearing equipment: interactive ChoiceGroups render in the card body
 * (Not Chosen state, unresolved "Choose:" prompt in the header row). */
export const ChoiceBearingEquipment: Story = () => (
  <div className="w-[600px]">
    <ReferenceEntityDisplay data={choiceBearingEquipment} compact />
  </div>
)

/** Same choice-bearing equipment with a controlled selection pre-seeded
 * (Chosen state), as ITUN's persistence layer would render it. */
export const ChoiceBearingEquipmentSelected: Story = () => {
  const weaponTypeChoice = choiceBearingEquipment
    ? getChoices(choiceBearingEquipment)?.find((c) => c.name === 'Weapon Type')
    : undefined
  return (
    <div className="w-[600px]">
      <ReferenceEntityDisplay
        data={choiceBearingEquipment}
        compact
        selections={weaponTypeChoice ? { [weaponTypeChoice.id]: ['Ballistic'] } : undefined}
      />
    </div>
  )
}

export const ExpansionRainmaker: Story = () => (
  <div className="w-[600px] py-6">
    <ReferenceEntityDisplay data={rainmakerEntity} />
  </div>
)

export const ExpansionWeWereHereFirst: Story = () => (
  <div className="w-[600px] py-6">
    <ReferenceEntityDisplay data={wwhfEntity} />
  </div>
)

export const ExpansionFalseFlag: Story = () => (
  <div className="w-[600px]">
    <ReferenceEntityDisplay data={falseFlagEntity} />
  </div>
)

export const AllExpansions: Story = () => (
  <div className="flex w-[600px] flex-col gap-8 py-6">
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-su-grey-dark">Rainmaker</p>
      <ReferenceEntityDisplay data={rainmakerEntity} />
    </div>
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-su-grey-dark">
        We Were Here First!
      </p>
      <ReferenceEntityDisplay data={wwhfEntity} />
    </div>
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-su-grey-dark">False Flag</p>
      <ReferenceEntityDisplay data={falseFlagEntity} />
    </div>
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-su-grey-dark">
        No Expansion (Core)
      </p>
      <ReferenceEntityDisplay data={system} />
    </div>
  </div>
)
