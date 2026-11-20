/**
 * MechLoadout — a mech's Systems and Modules on its Live Sheet. KEPT as two
 * sections: different collections with different pickers and slot budgets.
 *
 *  - `MechLoadout`: from 40rem and in Edit, each its own `SlabSection`, side
 *    by side once there is room (`.su-sheet-mech-loadout`), one contentful
 *    Mini a line (`MechItemMini`) with its condition, Uses and repair. Read
 *    leaves an empty section out (R11).
 */

import type { Mech } from 'game-domain/schemas/mech'
import { Button, EmptyState, MiniGrid, SlabSection } from '../../components/index'
import { occurrenceKeys } from '../../lib/occurrenceKeys'
import { resolveModule, resolveSystem } from '../../lib/rules/mechItems'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { UnitsStore } from '../../replica/units'
import { MechItemMini } from './MechItemMini'
import type { MechSheetModel } from './mechSheet.model'
import type { ItemKind, MechSheetActions } from './mechSheetActions.model'
import { slotCount } from './mechSlots.model'

type LoadoutProps = {
  mech: Mech
  model: MechSheetModel
  actions: MechSheetActions
  readOnly: boolean
  /** Where an item's chosen options are saved (`Mech.itemChoices`). */
  store: UnitsStore
}

function Items({ kind, mech, model, actions, readOnly, store }: LoadoutProps & { kind: ItemKind }) {
  const slugs = kind === 'system' ? mech.systems : mech.modules
  const { cargo } = model
  const conditions = (kind === 'system' ? mech.systemConditions : mech.moduleConditions) ?? {}
  if (slugs.length === 0) {
    return (
      <EmptyState
        variant="quiet"
        body={
          kind === 'system'
            ? buildSheetCopy('noSystemsInstalled')
            : buildSheetCopy('noModulesInstalled')
        }
      />
    )
  }
  // Keyed by occurrence, not index: removing one item must not remount (and
  // hand local state to) the items after it. See occurrenceKeys.
  const keys = occurrenceKeys(slugs)
  // Contentful Minis in a masonry grid, each its head and then its text,
  // Peeking its whole card.
  return (
    <MiniGrid
      label={
        kind === 'system' ? buildSheetCopy('systemsInstalled') : buildSheetCopy('modulesInstalled')
      }
      edit={!readOnly}
    >
      {slugs.map((slug, index) => (
        <li key={keys[index]}>
          <MechItemMini
            slug={slug}
            entity={kind === 'system' ? resolveSystem(slug) : resolveModule(slug)}
            condition={conditions[slug] ?? 'intact'}
            usesRemaining={mech.itemUses?.[slug]}
            scrapPool={model.scrapPool}
            scrapPoolLocked={cargo.crawlerLocked}
            readOnly={readOnly}
            onStatusCycle={() => runWrite(() => actions.cycleItemCondition(kind, slug))}
            onUsesChange={(next) => runWrite(() => actions.setItemUses(slug, next))}
            onRepair={(deductTl, cost) => {
              runWrite(() => actions.repairItem(kind, slug, deductTl, cost))
            }}
            choices={{ mechId: mech.id, seed: mech.itemChoices?.[slug], store }}
            onRemove={
              readOnly
                ? undefined
                : () => {
                    actions.removeItem(kind, index)
                  }
            }
          />
        </li>
      ))}
    </MiniGrid>
  )
}

export function MechLoadout({
  onManage,
  ...props
}: LoadoutProps & {
  /** Open a collection's picker (Edit's "Manage"). */
  onManage: (kind: ItemKind) => void
}) {
  const { mech, model, readOnly } = props
  const { capacity } = model
  const showSystems = !readOnly || mech.systems.length > 0
  const showModules = !readOnly || mech.modules.length > 0
  if (!showSystems && !showModules) return null
  return (
    <div className="su-sheet-mech-loadout">
      {showSystems && (
        <SlabSection
          fold="open"
          title={buildSheetCopy('systems')}
          count={slotCount(capacity.systemSlotsUsed, capacity.systemSlotsMax, capacity.asPrinted)}
          actions={
            readOnly ? undefined : (
              <Button size="compact" onClick={() => onManage('system')}>
                {buildSheetCopy('manageSystems')}
              </Button>
            )
          }
        >
          <Items {...props} kind="system" />
        </SlabSection>
      )}

      {showModules && (
        <SlabSection
          fold="open"
          title={buildSheetCopy('modules')}
          count={slotCount(capacity.moduleSlotsUsed, capacity.moduleSlotsMax, capacity.asPrinted)}
          actions={
            readOnly ? undefined : (
              <Button size="compact" onClick={() => onManage('module')}>
                {buildSheetCopy('manageModules')}
              </Button>
            )
          }
        >
          <Items {...props} kind="module" />
        </SlabSection>
      )}
    </div>
  )
}
