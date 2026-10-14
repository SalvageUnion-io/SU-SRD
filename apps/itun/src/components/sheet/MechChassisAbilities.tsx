import { ReferenceEntityCard, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import type { MechSheetModel } from './mechSheet.model'

/** The chassis ability cards, one under another. */
const ABILITIES = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

/**
 * The chassis's ability on a mech sheet: its Card, as the SRD's chassis page
 * draws it, `[(CHASSIS)]` reading the chassis's name (EDL E19: never a Token
 * or Peek). Spending its EP is the Dashboard's (ADR-021).
 */
export function MechChassisAbilities({
  abilities,
  chassisName,
}: {
  abilities: MechSheetModel['chassisAbilities']
  chassisName: string
}) {
  if (abilities.length === 0) return null
  return (
    <section aria-label="Chassis ability" style={ABILITIES}>
      {abilities.map((ability) => (
        <ReferenceEntityCard
          key={ability.id}
          data={ability}
          size="medium"
          chassisName={chassisName}
        />
      ))}
    </section>
  )
}
