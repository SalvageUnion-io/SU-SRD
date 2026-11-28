/**
 * What a saved pattern uses and costs, on one line (r2 G4): its chassis, the
 * slots it fills of the chassis's, and its Scrap. A count over its chassis
 * wears the one rule-breaking mark (R71), as the mech sheet's figure does; a
 * loadout the book prints over its slots wears none.
 */

import type { MechPattern } from 'game-domain/schemas/pattern'
import type { CSSProperties } from 'react'
import { RuleBreakMark } from '../../../components/app'
import { Stat, tokens } from '../../../components/index'
import { loadoutSlots, patternChassis } from '../../../lib/patterns/patterns'
import { mechScrap } from '../../../lib/rules/mechScrap'
import { mechCopy } from '../../../messages/build-mech'

const ROW = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

/** A count and, over its cap, the mark: kept together where the line wraps. */
const COUNT = {
  alignItems: 'center',
  display: 'inline-flex',
  gap: tokens.space[4],
} satisfies CSSProperties

export function PatternTotals({
  unit,
}: {
  unit: Pick<MechPattern, 'chassisRef' | 'systems' | 'modules'>
}) {
  const chassis = patternChassis(unit)
  if (!chassis) return null
  const slots = loadoutSlots(unit)
  const count = (label: string, used: number, max: number, line: 'systems' | 'modules') => (
    <span style={COUNT}>
      <Stat size="mini" label={label} value={`${used}/${max}`} />
      {!slots.asPrinted?.[line] && used > max && <RuleBreakMark />}
    </span>
  )
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled group of figures, not a form's fieldset
    <div role="group" aria-label={mechCopy('usesAndCosts')} style={ROW}>
      <Stat size="mini" label={mechCopy('bookChassis')} value={chassis.name} />
      {count(mechCopy('systemSlots'), slots.systemSlotsUsed, slots.systemSlotsMax, 'systems')}
      {count(mechCopy('moduleSlots'), slots.moduleSlotsUsed, slots.moduleSlotsMax, 'modules')}
      {/* Scrap by Tech Level, as the sheet's tiles say it (r4 E11). */}
      {mechScrap(unit).byTechLevel.map(({ techLevel, scrap }) => (
        <Stat
          key={techLevel}
          size="mini"
          label={mechCopy('tScrap', { tl: techLevel })}
          value={scrap}
        />
      ))}
    </div>
  )
}
