import { useMemo } from 'react'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { isLegalCreationModule, isLegalCreationSystem } from 'salvageunion-reference/rules'
import { EmptyState, MasonryColumns, ReferenceEntityCard, Slab } from '../../components/index'
import { maxAddableCopies } from '../../lib/rules/creation'
import '../../styles/build/wizard.css'
import { mechCopy } from '../../messages/build-mech'
import { fullWidthStyle } from '../wizard/wizardStyles.model'

type CraftItemsStepProps = {
  /** Which dataset this step crafts from (against its own slot budget). */
  kind: 'systems' | 'modules'
  /** Installed slug refs, one entry per copy (duplicates allowed). */
  selected: string[]
  /** Set the copy count for the named item (parent owns the form array). */
  onCountChange: (itemName: string, next: number) => void
  /** Tech 1 Scrap left in the shared 20-Scrap pool. */
  scrapRemaining: number
  /** Slots left in THIS step's slot budget (system or module). */
  slotsRemaining: number
}

/**
 * Steps 4–5 · Craft your Systems / Modules (Mech Workshop p.95) — create
 * mode, HARD: only Tech 1 items render (package
 * `isLegalCreationSystem`/`isLegalCreationModule`); each copy costs its SV
 * from the shared 20-Scrap pool and its `slotsRequired` from this step's
 * slot budget. Duplicates are allowed via the card's Qty stepper (`Stat`); a `+`
 * disables the moment one more copy would overspend either budget, and a
 * card whose FIRST copy no longer fits dims with the reason chip
 * (`NEEDS 6 SLOTS · 2 LEFT`) — visible, never hidden, so the
 * player sees what they can't yet afford. `recommended` items carry the card's
 * rust SUGGESTED sub-header stamp. Zero picks never blocks Next — installs are optional.
 */
export function CraftItemsStep({
  kind,
  selected,
  onCountChange,
  scrapRemaining,
  slotsRemaining,
}: CraftItemsStepProps) {
  const items = useMemo(() => {
    const pool =
      kind === 'systems'
        ? SalvageUnionReference.Systems.all().filter((s) => isLegalCreationSystem(s.techLevel))
        : SalvageUnionReference.Modules.all().filter((m) => isLegalCreationModule(m.techLevel))
    return [...pool].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [kind])

  const noun = kind === 'systems' ? 'System' : 'Module'

  return (
    <div className="su-wiz-stack su-wiz-stack--20" style={fullWidthStyle}>
      <Slab label={mechCopy('tech1S', { noun })} count="Duplicates allowed" countInk="inherit" />
      <MasonryColumns maxColumns={2}>
        {items.map((item) => {
          const name = item.name ?? item.id
          const slug = getEntitySlug(item)
          const count = selected.filter((ref) => ref === slug).length
          const sv = item.salvageValue
          const slotsRequired = item.slotsRequired

          // One more copy fits iff BOTH budgets take it (§5 single source of
          // truth: the same arithmetic disables the `+`, dims the card, and
          // is re-checked by the Review gate).
          const maxAdd = maxAddableCopies(item, { scrapRemaining, slotsRemaining })

          const disabledReason =
            count === 0 && maxAdd === 0
              ? slotsRequired > slotsRemaining
                ? `Needs ${slotsRequired} slot${slotsRequired === 1 ? '' : 's'} · ${slotsRemaining} left`
                : `Needs ${sv} scrap · ${scrapRemaining} left`
              : undefined

          return (
            <ReferenceEntityCard
              key={item.id}
              data={item}
              size="compact"
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
              controls={[
                {
                  key: 'qty',
                  stepper: {
                    label: mechCopy('qty'),
                    subject: `${name} count`,
                    value: count,
                    ceiling: count + maxAdd,
                    onChange: (next) => onCountChange(name, next),
                  },
                },
              ]}
              footMeta={[
                { label: mechCopy('costs'), value: `${sv} scrap` },
                ...(disabledReason ? [{ label: disabledReason, value: '' }] : []),
              ]}
              suggested={'recommended' in item && item.recommended === true}
            />
          )
        })}
      </MasonryColumns>
      {items.length === 0 && (
        <EmptyState variant="inline" body={mechCopy('noTech1Found', { kind })} bodyInk="inherit" />
      )}
    </div>
  )
}
