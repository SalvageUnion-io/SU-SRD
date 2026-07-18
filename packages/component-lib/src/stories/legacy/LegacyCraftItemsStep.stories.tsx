import type { Story } from '@ladle/react'
import { useMemo, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import {
  isLegalCreationModule,
  isLegalCreationSystem,
  matchesRef,
  MECH_CREATION_SCRAP_CAP,
} from 'salvageunion-reference/rules'
import { Badge } from '../../components/chrome/Badge'
import { CountStepper } from '../../components/chrome/CountStepper'
import { TreeSep } from '../../components/chrome/TreeSep'
import { MasonryColumns } from '../../components/shared/MasonryColumns'
import { ReferenceEntityDisplay } from '../../components/referenceEntity/card/referenceEntityDisplayShim'
import { Caption } from '../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Mech Craft Items Step' }

/**
 * Verbatim reproduction of the presentational body of
 * apps/in-the-union-now/src/components/mech/CraftItemsStep.tsx (lines 33-120):
 * a TreeSep, then a 2-col MasonryColumns of compact entity cards, each with a
 * CountStepper in its footActions, a "Costs N scrap" footMeta, and a SUGGESTED
 * Pill on `recommended` items. The `+` disables the moment one more copy would
 * overspend either the 20-Scrap pool or the slot budget; a card whose first
 * copy no longer fits dims with the reason chip. Real Tech-1 fixtures via the
 * package `isLegalCreationSystem`/`isLegalCreationModule` predicates; the local
 * state below owns the copy-count form array the wizard normally holds.
 */
function LegacyCraftItemsStep({ kind }: { kind: 'systems' | 'modules' }) {
  const [selected, setSelected] = useState<string[]>([])

  const items = useMemo(() => {
    const pool =
      kind === 'systems'
        ? SalvageUnionReference.Systems.all().filter((s) => isLegalCreationSystem(s.techLevel))
        : SalvageUnionReference.Modules.all().filter((m) => isLegalCreationModule(m.techLevel))
    return [...pool].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [kind])

  const noun = kind === 'systems' ? 'System' : 'Module'

  // The wizard threads scrapRemaining/slotsRemaining in from the form; here we
  // derive them from the fixed 20-Scrap cap and a representative slot budget so
  // the same budget arithmetic drives the `+`-disable + card-dim.
  const scrapSpent = selected.reduce((sum, ref) => {
    const found = items.find((i) => matchesRef(i, ref))
    return sum + (found?.salvageValue ?? 0)
  }, 0)
  const slotsUsed = selected.reduce((sum, ref) => {
    const found = items.find((i) => matchesRef(i, ref))
    return sum + (found?.slotsRequired ?? 0)
  }, 0)
  const scrapRemaining = MECH_CREATION_SCRAP_CAP - scrapSpent
  const slotsRemaining = 6 - slotsUsed

  function onCountChange(itemName: string, next: number) {
    setSelected((prev) => {
      const others = prev.filter((ref) => {
        const found = items.find((i) => matchesRef(i, ref))
        return (found?.name ?? '') !== itemName
      })
      return [...others, ...Array.from({ length: Math.max(0, next) }, () => itemName)]
    })
  }

  return (
    <div className="w-full space-y-5">
      <TreeSep name={`Tech 1 ${noun}s`} suffix="Duplicates allowed" />
      <MasonryColumns maxColumns={2}>
        {items.map((item) => {
          const name = item.name ?? item.id
          const count = selected.filter((ref) => matchesRef(item, ref)).length
          const sv = item.salvageValue
          const slotsRequired = item.slotsRequired

          const byScrap = sv > 0 ? Math.floor(scrapRemaining / sv) : Number.POSITIVE_INFINITY
          const bySlots =
            slotsRequired > 0
              ? Math.floor(slotsRemaining / slotsRequired)
              : Number.POSITIVE_INFINITY
          const maxAdd = Math.max(0, Math.min(byScrap, bySlots))

          const disabledReason =
            count === 0 && maxAdd === 0
              ? slotsRequired > slotsRemaining
                ? `Needs ${slotsRequired} slot${slotsRequired === 1 ? '' : 's'} · ${slotsRemaining} left`
                : `Needs ${sv} scrap · ${scrapRemaining} left`
              : undefined

          return (
            <ReferenceEntityDisplay
              key={item.id}
              data={item as unknown as SURefEntity}
              compact
              selected={count >= 1}
              selectionRole="toggle"
              cardClickLabel={name}
              selectable={!disabledReason}
              onCardClick={
                disabledReason
                  ? undefined
                  : () => {
                      if (maxAdd > 0) onCountChange(name, count + 1)
                    }
              }
              hide={{ actions: true, choices: true }}
              footActions={
                <CountStepper
                  subject={name}
                  count={count}
                  max={count + maxAdd}
                  onChange={(next) => onCountChange(name, next)}
                />
              }
              footMeta={[
                { label: 'Costs', value: `${sv} scrap` },
                ...(disabledReason ? [{ label: disabledReason, value: '' }] : []),
              ]}
              subtitleExtra={
                'recommended' in item && item.recommended === true ? (
                  <Badge surface="outline">Suggested</Badge>
                ) : undefined
              }
            />
          )
        })}
      </MasonryColumns>
      {items.length === 0 && (
        <p className="font-body text-sm text-current">No Tech 1 {kind} found.</p>
      )}
    </div>
  )
}

export const Systems: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Legacy · Craft Systems step (ITUN CraftItemsStep kind="systems", lines 33-120)
    </Caption>
    <LegacyCraftItemsStep kind="systems" />
  </div>
)

export const Modules: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Legacy · Craft Modules step (ITUN CraftItemsStep kind="modules", lines 33-120)
    </Caption>
    <LegacyCraftItemsStep kind="modules" />
  </div>
)
