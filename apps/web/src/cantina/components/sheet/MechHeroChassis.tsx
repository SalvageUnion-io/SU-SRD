/**
 * MechHeroChassis — the mech hero's right column (owner's call, 2026-10-14:
 * the hero is image | text | stats + ability): the mech's chassis stats in
 * the hero's top-right corner, the chassis ability as a library Row (its
 * cut-out head and lead, Peeking its whole card) under them.
 */

import type { CSSProperties } from 'react'
import { Entity, StatColumn, tokens } from '../../../ui/index'
import type { MechSheetModel } from './mechSheet.model'

const ABILITY = {
  display: 'grid',
  gap: tokens.space[8],
  listStyle: 'none',
  margin: 0,
  minWidth: 0,
  padding: 0,
} satisfies CSSProperties

type MechHeroChassisProps = {
  stats: MechSheetModel['chassisStats']
  abilities: MechSheetModel['chassisAbilities']
}

export function MechHeroChassis({ stats, abilities }: MechHeroChassisProps) {
  return (
    <div className="su-sheet-mech-hero-chassis">
      <StatColumn stats={stats} label="Chassis stats" compact />
      {abilities.length > 0 && (
        <ul aria-label="Chassis ability" style={ABILITY}>
          {abilities.map((ability) => (
            <li key={ability.id}>
              <Entity form="row" entity={ability} lead peek />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
