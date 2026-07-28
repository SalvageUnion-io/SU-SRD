import { SalvageUnionReference } from 'salvageunion-reference'
import { mechMaxSPParts } from 'salvageunion-reference/rules'

import { StatProvenance } from './StatProvenance'
import type { ProvenanceLine } from './StatProvenance'
import { Caption } from '../../stories/_harness'

export default {
  title: 'Atoms/Stat Provenance',
}

/**
 * Every ledger below is built from the real derivation
 * (`mechMaxSPParts`) over real reference data, not hand-written numbers — so a
 * change to Composite Armour's `statBonus` or the Atlas chassis moves these
 * stories the same way it moves the sheet.
 */
function atlasLedger(overrideValue?: number) {
  const atlas = SalvageUnionReference.Chassis.all().find((c) => c.name === 'Atlas')
  const parts = mechMaxSPParts(
    {
      chassisRef: atlas?.name ?? 'Atlas',
      systems: ['Composite Armour', 'Composite Armour'],
      ...(overrideValue === undefined ? {} : { maxSpOverride: overrideValue }),
    },
    atlas
  )
  const lines: ProvenanceLine[] = [
    {
      kind: 'base',
      label: `${atlas?.name ?? 'Atlas'} chassis`,
      detail: 'base',
      amount: parts.base,
    },
    {
      kind: 'contribution',
      label: 'Composite Armour',
      detail: '×2 installed',
      amount: parts.installed,
    },
  ]
  if (parts.overridden) {
    lines.push({ kind: 'derived', label: 'Derived', amount: parts.derived })
    lines.push({
      kind: 'override',
      label: 'Override',
      detail: 'pinned by hand',
      amount: parts.override ?? 0,
    })
  }
  return { lines, parts }
}

export const Default = () => {
  const { lines, parts } = atlasLedger()
  return (
    <div className="flex flex-col gap-8 p-4">
      <div>
        <Caption>
          Derived — hover, focus (Tab) or tap the numeral. Hover alone is never the only way in.
        </Caption>
        <div className="mt-2 font-cond text-2xl">
          <StatProvenance statLabel="Max SP" lines={lines} total={parts.total}>
            {parts.total}
          </StatProvenance>
        </div>
      </div>
    </div>
  )
}

export const Overridden = () => {
  const { lines, parts } = atlasLedger(60)
  return (
    <div className="flex flex-col gap-8 p-4">
      <div>
        <Caption>
          Pinned on the Live Sheet. The override appends as the final line — it never replaces the
          derivation, so the revert target stays visible and explained.
        </Caption>
        <div className="mt-2 font-cond text-2xl">
          <StatProvenance
            statLabel="Max SP"
            lines={lines}
            total={parts.total}
            overridden={parts.overridden}
          >
            {parts.total}
          </StatProvenance>
        </div>
      </div>
    </div>
  )
}

export const WithPenalty = () => {
  const lines: ProvenanceLine[] = [
    { kind: 'base', label: 'Pilot', detail: 'base', amount: 10 },
    { kind: 'contribution', label: 'Major Injury', detail: 'rules A11', amount: -2 },
    { kind: 'adjustment', label: 'Manual adjustment', amount: 2 },
  ]
  return (
    <div className="flex flex-col gap-8 p-4">
      <Caption>
        A negative contribution is still a contribution. A manual adjustment is shown as its own
        line, so a hand-entered bonus duplicating a real one is visible rather than silently
        doubled.
      </Caption>
      <div className="mt-2 font-cond text-2xl">
        <StatProvenance statLabel="Max HP" lines={lines} total={10}>
          10
        </StatProvenance>
      </div>
    </div>
  )
}
