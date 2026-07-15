import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { ReferenceEntityDisplay } from './ReferenceEntityDisplay/index'
import { SalvageUnionReference, getChoices } from 'salvageunion-reference'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/ReferenceEntityDisplay',
}

// Real SRD entities across schemas + expansions drive every gallery.
const system = SalvageUnionReference.Systems.all()[0]
const mod = SalvageUnionReference.Modules.all()[0]
const chassis = SalvageUnionReference.Chassis.all()[0]
const ability = SalvageUnionReference.Abilities.all()[0]
const trait = SalvageUnionReference.Traits.all()[0]

const rainmaker =
  SalvageUnionReference.Systems.all().find((s) => s.source === 'Rainmaker') ?? system
const wwhf =
  SalvageUnionReference.Systems.all().find((s) => s.source === 'We Were Here First!') ?? system
const falseFlag =
  SalvageUnionReference.Systems.all().find((s) => s.source === 'False Flag') ?? system

const grantingAbility = SalvageUnionReference.Abilities.all().find((a) => a.name === 'Auto-Turret')
const choiceEquipment = SalvageUnionReference.Equipment.all().find(
  (e) => e.name === 'Custom Sniper Rifle'
)
const weaponTypeChoice = choiceEquipment
  ? getChoices(choiceEquipment)?.find((c) => c.name === 'Weapon Type')
  : undefined

function Row({
  label,
  width = 'w-[600px]',
  children,
}: {
  label: string
  width?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={width}>{children}</div>
      <code className="font-mono text-nano text-ink-2">{label}</code>
    </div>
  )
}

function Gallery({ rule, children }: { rule: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 bg-paper p-5 text-ink">
      <p className="max-w-2xl font-mono text-xs leading-relaxed text-ink-2">{rule}</p>
      {children}
    </div>
  )
}

/** Density: full card → compact → header-only listing. */
export const Densities: Story = () => (
  <Gallery rule="One entity renderer across densities: full, compact (reduced spacing), listing (header-only clickable row).">
    <Row label="default">
      <ReferenceEntityDisplay data={system} />
    </Row>
    <Row label="compact" width="w-[400px]">
      <ReferenceEntityDisplay data={system} compact />
    </Row>
    <Row label="listing">
      <ReferenceEntityDisplay data={system} listing />
    </Row>
  </Gallery>
)

/** States: disabled, damaged, dimmed header, custom accent, hidden actions. */
export const States: Story = () => (
  <Gallery rule="State treatments — disabled dims; damaged applies the warm brick-red overlay; dimHeader mutes the header; headerColor overrides the accent; hide suppresses sections (actions here).">
    <Row label="disabled">
      <ReferenceEntityDisplay data={system} disabled />
    </Row>
    <Row label="damaged">
      <ReferenceEntityDisplay data={system} damaged />
    </Row>
    <Row label="dimHeader (ability)">
      <ReferenceEntityDisplay data={ability} dimHeader />
    </Row>
    <Row label='headerColor="bg-su-pink"'>
      <ReferenceEntityDisplay data={system} headerColor="bg-su-pink" />
    </Row>
    <Row label="hide={{ actions: true }}">
      <ReferenceEntityDisplay data={system} hide={{ actions: true }} />
    </Row>
  </Gallery>
)

/** Schemas: the same renderer across system, module, chassis, ability, trait. */
export const Schemas: Story = () => (
  <Gallery rule="Schema-agnostic: one component renders every entity type from its data shape.">
    <Row label="system">
      <ReferenceEntityDisplay data={system} />
    </Row>
    <Row label="module">
      <ReferenceEntityDisplay data={mod} />
    </Row>
    <Row label="chassis">
      <ReferenceEntityDisplay data={chassis} />
    </Row>
    <Row label="ability">
      <ReferenceEntityDisplay data={ability} />
    </Row>
    <Row label="trait">
      <ReferenceEntityDisplay data={trait} />
    </Row>
  </Gallery>
)

/** Grants collapse: an ability's content/actions give way to a nested granted card. */
export const Grants: Story = () => (
  <Gallery rule="isGrantingAbility: the ability's own content + Actions are suppressed in favour of a Grants block with a nested equipment card — expanded, or (compact) collapsed to a header-only listing.">
    <Row label="expanded">
      {grantingAbility ? <ReferenceEntityDisplay data={grantingAbility} /> : null}
    </Row>
    <Row label="compact (collapsed)" width="w-[420px]">
      {grantingAbility ? <ReferenceEntityDisplay data={grantingAbility} compact /> : null}
    </Row>
  </Gallery>
)

/** Choice-bearing equipment: interactive choices in the body — unchosen vs pre-seeded. */
export const Choices: Story = () => (
  <Gallery rule="Equipment carrying choices renders interactive ChoiceGroups in the body (unresolved 'Choose:' prompt in the header) — unselected, or with a controlled selection pre-seeded as ITUN would.">
    <Row label="not chosen">
      {choiceEquipment ? <ReferenceEntityDisplay data={choiceEquipment} compact /> : null}
    </Row>
    <Row label="Ballistic chosen">
      {choiceEquipment ? (
        <ReferenceEntityDisplay
          data={choiceEquipment}
          compact
          selections={weaponTypeChoice ? { [weaponTypeChoice.id]: ['Ballistic'] } : undefined}
        />
      ) : null}
    </Row>
  </Gallery>
)

/** Provenance: expansion badges — Rainmaker, We Were Here First!, False Flag, Core. */
export const Provenance: Story = () => (
  <Gallery rule="Source expansion drives the provenance badge; Core (no expansion) shows none.">
    <Row label="Rainmaker">
      <ReferenceEntityDisplay data={rainmaker} />
    </Row>
    <Row label="We Were Here First!">
      <ReferenceEntityDisplay data={wwhf} />
    </Row>
    <Row label="False Flag">
      <ReferenceEntityDisplay data={falseFlag} />
    </Row>
    <Row label="Core (no expansion)">
      <ReferenceEntityDisplay data={system} />
    </Row>
  </Gallery>
)
