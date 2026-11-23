/**
 * PilotSheetPickers — the pilot sheet's ONE shared picker modal: abilities and
 * equipment "Manage" both open it (the multi-select grids write through on
 * toggle; no Save button). Always available in Edit: Free Edit, not
 * rule-gated (ADR-021).
 */

import type { Pilot } from 'game-domain/schemas/pilot'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefAbility, RefMetaEntity } from 'salvageunion-reference'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { EntitySearcher } from '../../components/index'
import { isPartnerEquipment } from '../../lib/rules/partnerGrants'
import { resolveEquipment } from '../../lib/rules/pilotInventory'
import type { NotYet } from '../../lib/rules/training'
import {
  abilityNotYet,
  abilityRequirementsUnmet,
  abilityTrainingCost,
} from '../../lib/rules/training'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { UnitsStore } from '../../replica/units'
import type { PilotSheetModel } from './pilotSheet.model'
import type { PilotSheetActions } from './pilotSheetActions.model'
import { EquipmentChoiceDialog } from './rowControls'
import { SheetPickerModal } from './SheetPickerModal'

export type PilotPicker = 'abilities' | 'equipment'

/** Abilities by tree, then up each tree by level, as the book lays them out (r5 C1). */
const levelOf = (item: unknown) => {
  const level = Number((item as RefAbility).level)
  return Number.isFinite(level) ? level : Number.POSITIVE_INFINITY
}
const BY_TREE = (a: { name: string }, b: { name: string }) =>
  ((a as RefAbility).tree ?? '').localeCompare((b as RefAbility).tree ?? '') ||
  levelOf(a) - levelOf(b) ||
  a.name.localeCompare(b.name)

/** Why an ability waits under Not yet, said on its row beside its price (r7 D5). */
const NOT_YET_LABEL: Record<NotYet['why'], () => string> = {
  'tree-order': () => buildSheetCopy('notYetTreeOrder'),
  advanced: () => buildSheetCopy('notYetAdvanced'),
  legendary: () => buildSheetCopy('notYetLegendary'),
  'one-legendary': () => buildSheetCopy('notYetOneLegendary'),
  cap: () => buildSheetCopy('notYetCap'),
  tp: () => buildSheetCopy('notYetTp'),
}

export function PilotSheetPickers({
  picker,
  onClose,
  pilot,
  model,
  actions,
  store,
  spendOnly = false,
}: {
  /** Which collection's picker is open. */
  picker: PilotPicker | null
  onClose: () => void
  pilot: Pilot
  model: PilotSheetModel
  actions: PilotSheetActions
  /** Where an added item's choice is saved (`Pilot.equipmentChoices`). */
  store: UnitsStore
  /**
   * Play's Spend TP (r8 D4, `SPEND_TP_REFUSES_SHORT`): an ability the Pilot
   * cannot afford is refused in the list; its Page's rule-breaking add is the
   * house rule. Off, the sheet's Free Edit: every add stays free.
   */
  spendOnly?: boolean
}) {
  // Equipment that asks a choice asks it as it is added, as a mech's Systems
  // do: its Page opens over the picker (hidden meanwhile, so two dialogs never
  // share the focus trap), and closing it returns to the picker.
  const [asking, setAsking] = useState<string | null>(null)
  const askingEntity = asking ? resolveEquipment(asking) : undefined
  // What this visit to Manage Abilities bought, at its price: taking one
  // back here gives its Training Points back (r5 C1).
  const bought = useRef(new Map<string, number>())
  useEffect(() => {
    if (picker === 'abilities') bought.current = new Map()
  }, [picker])
  // What can be learned now comes first, by tier; the rest wait under Not
  // yet with their reason, still addable for house rules (r7 D5, Core Book p.224).
  const notYet = useMemo(() => {
    if (picker !== 'abilities') return new Map<string, NotYet>()
    const pilotNow = {
      abilities: pilot.abilities,
      classRef: pilot.classRef,
      trainingPoints: pilot.trainingPoints ?? 0,
    }
    return new Map(
      SalvageUnionReference.Abilities.all().flatMap((a) => {
        const slug = nameToSlug(a.name)
        const why = abilityNotYet(pilotNow, slug)
        return why === null ? [] : [[slug, why] as const]
      })
    )
  }, [picker, pilot.abilities, pilot.classRef, pilot.trainingPoints])
  const isNotYet = useCallback(
    (item: { name: string }) => notYet.has(nameToSlug(item.name)),
    [notYet]
  )
  const byTierNow = useCallback(
    (a: { name: string }, b: { name: string }) =>
      Number(isNotYet(a)) - Number(isNotYet(b)) ||
      (isNotYet(a)
        ? 0
        : (abilityTrainingCost(nameToSlug(a.name)) ?? 9) -
          (abilityTrainingCost(nameToSlug(b.name)) ?? 9)) ||
      BY_TREE(a, b),
    [isNotYet]
  )
  function toggleAbility(slug: string) {
    const price = bought.current.get(slug)
    if (price !== undefined && pilot.abilities.includes(slug)) {
      bought.current.delete(slug)
      actions.untrainAbility(slug, price)
      return
    }
    actions.toggleAbility(slug)
  }
  function toggleEquipment(slug: string) {
    const adding = !pilot.equipment.includes(slug)
    actions.toggleEquipment(slug)
    if (adding && asksAChoice(slug) && !pilot.equipmentChoices?.[slug]) setAsking(slug)
  }
  return (
    <>
      <SheetPickerModal
        open={picker === 'abilities'}
        onClose={onClose}
        title={buildSheetCopy('manageAbilities')}
        floating
      >
        <EntitySearcher
          schema="abilities"
          selected={pilot.abilities}
          onToggle={toggleAbility}
          idOf={(item) => nameToSlug(item.name)}
          cost={(item) => {
            const slug = nameToSlug(item.name)
            const price = abilityTrainingCost(slug)
            if (price === null) return undefined
            const left = pilot.trainingPoints ?? 0
            const unmet = abilityRequirementsUnmet(pilot, slug)
            const why = notYet.get(slug)
            return {
              label: buildSheetCopy('costsTp', { cost: price, left }),
              payLabel: buildSheetCopy('spendTpAndAdd', { cost: price }),
              // Out of the tree's order, only "Add anyway" adds it (r5 C1).
              canPay: left >= price && unmet.length === 0,
              onPay: () => {
                bought.current.set(slug, price)
                actions.trainAbility(slug)
              },
              unmet,
              // Out of order or unaffordable: the plain add says so first (r4 E12).
              breaks: unmet.length > 0 || price > left,
              row: { label: why ? NOT_YET_LABEL[why.why]() : buildSheetCopy('tp'), value: price },
              ...(spendOnly && price > left
                ? { refused: buildSheetCopy('costsTp', { cost: price, left }) }
                : {}),
            }
          }}
          filter={
            model.abilityTrees
              ? (item) => model.abilityTrees?.has((item as RefAbility).tree) ?? false
              : undefined
          }
          facets={{
            category: { label: buildSheetCopy('tree'), of: (item) => (item as RefAbility).tree },
            order: byTierNow,
            later: { label: buildSheetCopy('notYet'), of: isNotYet },
          }}
          railName={pilot.name}
          chosenLabel={buildSheetCopy('learned')}
          // The balance each cost is weighed against, in the list's own pane (r4 E12).
          budget={{ label: buildSheetCopy('trainingPointsLeft'), used: pilot.trainingPoints ?? 0 }}
          emptyMessage={buildSheetCopy('noAbilitiesMatchThoseFilters')}
        />
      </SheetPickerModal>
      <SheetPickerModal
        open={picker === 'equipment' && !asking}
        onClose={onClose}
        title={buildSheetCopy('manageEquipment')}
        floating
      >
        <EntitySearcher
          schema="equipment"
          selected={pilot.equipment}
          onToggle={toggleEquipment}
          idOf={(item) => nameToSlug(item.name)}
          railName={pilot.name}
          chosenLabel={buildSheetCopy('equipped')}
          emptyMessage={buildSheetCopy('noEquipmentMatchesThoseFilters')}
          budget={{
            label: buildSheetCopy('inventorySlots'),
            used: model.slotsUsed,
            max: model.slotsCap,
          }}
        />
      </SheetPickerModal>
      {asking && askingEntity && (
        <EquipmentChoiceDialog
          open
          onOpenChange={(open) => {
            if (!open) setAsking(null)
          }}
          slug={asking}
          equipment={askingEntity as RefMetaEntity & { name: string }}
          pilotId={pilot.id}
          seed={pilot.equipmentChoices?.[asking]}
          scalingParent={model.scalingParent}
          store={store}
        />
      )}
    </>
  )
}

/**
 * Whether the equipment asks a choice the pilot keeps (its own `choices`). A
 * drone or companion it grants is set up on its own card (ADR-028).
 */
function asksAChoice(slug: string): boolean {
  const entity = resolveEquipment(slug)
  return (entity?.choices?.length ?? 0) > 0 && !isPartnerEquipment(slug)
}
