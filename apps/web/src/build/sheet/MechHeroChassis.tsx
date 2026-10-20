/**
 * MechHeroChassis — the mech hero's right column (owner's call, 2026-10-14:
 * the hero is image | text | stats + ability): the mech's chassis stats in
 * the hero's top-right corner, the chassis ability under them as a
 * contentful Token, its head and then its text, Peeking its whole card
 * (owner's call, 2026-10-20; EDL E19 allows a contentful Token anywhere).
 */

import type { CSSProperties } from 'react'
import { Entity, StatColumn, tokens } from '../../components/index'
import type { MechSheetModel } from './mechSheet.model'

const ABILITY = {
  display: 'grid',
  gap: tokens.space[8],
  listStyle: 'none',
  margin: 0,
  minWidth: 0,
  padding: 0,
} satisfies CSSProperties

const LINK = { kind: 'link' } as const

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
              <Entity form="token" context="play" entity={ability} mode={LINK} body={{}} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
