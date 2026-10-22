/**
 * MechHeroChassis — the mech hero's right column (the hero is image | text |
 * stats + ability): the mech's chassis stats in
 * the hero's top-right corner, the chassis ability under them as a
 * contentful Mini, its head and then its text, Peeking its whole card
 * (EDL E19 allows a contentful Mini anywhere).
 */

import type { CSSProperties } from 'react'
import { Entity, StatColumn, tokens } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { MechSheetModel } from './mechSheet.model'

/** One track the column's width: an `auto` track would take the Mini's widest chips. */
const ABILITY = {
  display: 'grid',
  gap: tokens.space[8],
  gridTemplateColumns: 'minmax(0, 1fr)',
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
      <StatColumn stats={stats} label={buildSheetCopy('chassisStats')} compact />
      {abilities.length > 0 && (
        <ul aria-label={buildSheetCopy('chassisAbility')} style={ABILITY}>
          {abilities.map((ability) => (
            <li key={ability.id}>
              <Entity size="mini" context="play" entity={ability} mode={LINK} body={{}} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
