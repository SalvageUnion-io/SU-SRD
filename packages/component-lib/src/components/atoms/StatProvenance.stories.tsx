import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { mechMaxSPParts } from 'salvageunion-reference/rules'
import { font, fontSize, space } from '../../design/tokens'
import { Caption } from '../../stories/_harness'
import type { ProvenanceLine } from './StatProvenance'
import { StatProvenance } from './StatProvenance'

export default {
  title: 'Atoms/Stat Provenance',
}

const PAGE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[32],
  padding: space[16],
} satisfies CSSProperties

/** `mt-2 font-cond text-2xl` — `text-2xl` carries its paired line-height. */
const NUMERAL = {
  fontFamily: font.cond,
  fontSize: fontSize['2xl'],
  lineHeight: 'calc(2 / 1.5)',
  marginTop: space[8],
} satisfies CSSProperties

/**
 * Every ledger below is built from the real derivation
 * (`mechMaxSPParts`) over real reference data, not hand-written numbers — so a
 * change to Composite Armour's `contributions` or the Atlas chassis moves these
 * stories the same way it moves the sheet.
 */
function atlasLedger(overrideValue?: number) {
  const atlas = SalvageUnionReference.Chassis.getByName('Atlas')
  const parts = mechMaxSPParts(
    {
      chassisRef: 'atlas',
      systems: ['composite-armour', 'composite-armour'],
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
    <div style={PAGE}>
      <div>
        <Caption>
          Derived — hover, focus (Tab) or tap the numeral. Hover alone is never the only way in.
        </Caption>
        <div style={NUMERAL}>
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
    <div style={PAGE}>
      <div>
        <Caption>
          Pinned on the Live Sheet. The override appends as the final line — it never replaces the
          derivation, so the revert target stays visible and explained.
        </Caption>
        <div style={NUMERAL}>
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
    <div style={PAGE}>
      <Caption>
        A negative contribution is still a contribution. A manual adjustment is shown as its own
        line, so a hand-entered bonus duplicating a real one is visible rather than silently
        doubled.
      </Caption>
      <div style={NUMERAL}>
        <StatProvenance statLabel="Max HP" lines={lines} total={10}>
          10
        </StatProvenance>
      </div>
    </div>
  )
}
