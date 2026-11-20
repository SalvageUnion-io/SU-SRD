/**
 * The rows a mech's (or a companion's) Systems and Modules read as, and their
 * columns: Out of `MechDash` so a pattern's Page
 * draws the same lines (`PatternLoadoutRows`).
 */

import type { Mech } from 'game-domain/schemas/mech'
import { CONDITION_LABELS, STAT_LABELS, toEntityModel } from 'salvageunion-reference'
import type { OpenColumn, OpenRow } from '../../components/index'
import { Stat, TechLevel } from '../../components/index'
import { occurrenceKeys } from '../../lib/occurrenceKeys'
import {
  itemEconomy,
  itemUsesRemaining,
  resolveModule,
  resolveSystem,
} from '../../lib/rules/mechItems'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { ItemKind } from '../sheet/mechSheetActions.model'
import { Cost } from './Cost'
import { RowRules } from './RowRules'

// THE stat order (ledger.md, `ledgerOrder.ts`): where it comes from (TL,
// Slots, SV), then what its action does (type, Range, Damage), the cost last
// on the row's edge, where a player hunts for it mid-turn.
export const ITEM_COLUMNS: readonly OpenColumn[] = [
  { key: 'tl', label: buildSheetCopy('tl'), title: buildSheetCopy('techLevel') },
  {
    key: 'slots',
    label: STAT_LABELS.slotsRequired.short,
    title: STAT_LABELS.slotsRequired.label,
    phone: true,
  },
  { key: 'sv', label: STAT_LABELS.salvageValue.short, title: STAT_LABELS.salvageValue.label },
  { key: 'action', label: buildSheetCopy('action'), kind: 'text' },
  { key: 'range', label: buildSheetCopy('rng'), title: buildSheetCopy('range') },
  { key: 'damage', label: buildSheetCopy('dmg'), title: buildSheetCopy('damage') },
  {
    key: 'cost',
    label: buildSheetCopy('cost'),
    title: buildSheetCopy('activationCost'),
    phone: true,
  },
]

const typeWord = (type: string | undefined) => (type === 'DownTime' ? 'Downtime' : (type ?? ''))

/** What a row reads: a mech, or a companion (a mech in all but Push). */
export type Fitted = Pick<
  Mech,
  'systems' | 'modules' | 'systemConditions' | 'moduleConditions' | 'itemUses'
>

export function itemRows(mech: Fitted, kind: ItemKind): OpenRow[] {
  const slugs = kind === 'system' ? mech.systems : mech.modules
  const conditions = (kind === 'system' ? mech.systemConditions : mech.moduleConditions) ?? {}
  const keys = occurrenceKeys(slugs)
  return slugs.map((slug, index) => {
    const entity = kind === 'system' ? resolveSystem(slug) : resolveModule(slug)
    const condition = conditions[slug] ?? 'intact'
    const maxUses = entity ? itemEconomy(entity).maxUses : 0
    const model = entity ? toEntityModel(entity) : undefined
    const fact = (key: string) => {
      const found = model?.facts.find((entry) => entry.key === key)
      return found ? (found.shortValue ?? found.value) : ''
    }
    // Traits stay out of the collapsed row; the row's
    // open view (`RowRules`) lists them.
    const action = typeWord(model?.actionType)
    return {
      id: keys[index] ?? slug,
      // An item the data no longer holds keeps its slug.
      name: entity?.name ?? slug,
      entityRef: model?.ref,
      meta:
        action !== '' ? (
          <span className="su-open__phone-only">
            {[action, fact('range') && `RNG ${fact('range')}`, fact('damage')]
              .filter(Boolean)
              .join(' · ')}
          </span>
        ) : undefined,
      state:
        condition !== 'intact' || maxUses > 0 ? (
          <>
            {condition !== 'intact' && (
              <Stat size="mini" label={CONDITION_LABELS[condition]} state="critical" />
            )}
            {maxUses > 0 && (
              <Stat
                size="mini"
                label={buildSheetCopy('uses')}
                value={itemUsesRemaining(maxUses, mech.itemUses?.[slug])}
                max={maxUses}
              />
            )}
          </>
        ) : undefined,
      cells: [
        entity ? <TechLevel key="tl" level={entity.techLevel} /> : '',
        entity?.slotsRequired ?? '',
        entity?.salvageValue ?? '',
        action,
        fact('range'),
        fact('damage'),
        model?.cost ? <Cost key="cost" cost={model.cost} /> : '',
      ],
      dim: condition === 'destroyed',
      detail: entity ? <RowRules entity={entity} /> : undefined,
    }
  })
}
