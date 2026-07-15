import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityGrants } from './ReferenceEntityGrants'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/ReferenceEntityGrants',
}

// Real granting abilities from the SRD.
const singleGrant = SalvageUnionReference.Abilities.find(
  (a) => a.name === 'Auto-Turret'
) as SURefEntity
const doubleGrant = SalvageUnionReference.Abilities.find(
  (a) => a.name === 'Mecha Packmaster'
) as SURefEntity
const choiceGrant = SalvageUnionReference.Abilities.find(
  (a) => a.name === 'Custom Sniper Rifle'
) as SURefEntity

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

/** Granted-entity blocks: single, double, choice-bearing, and the compact collapse. */
export const Variants: Story = () => (
  <div className="flex flex-col gap-6 bg-paper p-5 text-ink">
    <p className="max-w-2xl font-mono text-xs leading-relaxed text-ink-2">
      An ability's Grants section — one nested card per granted entity. Choice-bearing grants render
      their choice cards inline; compact collapses grants to header-only listings.
    </p>
    <Row label="single grant">
      {singleGrant ? <ReferenceEntityGrants data={singleGrant} /> : null}
    </Row>
    <Row label="double grant">
      {doubleGrant ? <ReferenceEntityGrants data={doubleGrant} /> : null}
    </Row>
    <Row label="grant with choices">
      {choiceGrant ? <ReferenceEntityGrants data={choiceGrant} /> : null}
    </Row>
    <Row label="compact (collapsed)" width="w-[420px]">
      {choiceGrant ? <ReferenceEntityGrants data={choiceGrant} compact /> : null}
    </Row>
  </div>
)
