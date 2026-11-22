/**
 * MechDash — A mech's Read sheet as a
 * dashboard, in the order the game uses it at the table.
 *
 *   The strip: the art, SP · EP · Heat live, then what the chassis fixes:
 *     System Slots, Module Slots, Cargo, Tech Level, Salvage Value.
 *   What it has: Systems, then Modules, a line an item under its slot budget.
 *   What it carries and who it is: Cargo, the Chassis, what was written
 *     about it, and the units it is assigned to.
 *
 * Three columns from 80rem, two from 48rem; a phone stacks them. Edit is the
 * same dashboard with its controls in place (R11): the identity's fields
 * under the board, the photo, the maxima, the conditions, each item's
 * condition, Uses, Repair, Details and remove, Manage, the chassis's swap
 * and Chassis Modder pick, the Hold's moves and its intake, and the drones'
 * cards under the columns, where their loadouts are fitted.
 */

import type { CargoLot } from 'game-domain/schemas/cargoLot'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { CSSProperties, ReactNode } from 'react'
import {
  entityRef,
  nameToSlug,
  SalvageUnionReference,
  STAT_LABELS,
  toEntityModel,
} from 'salvageunion-reference'
import { pinFor } from 'salvageunion-reference/rules'
import {
  Conditions,
  Facts,
  heatDangerFrom,
  Prose,
  STRIP_ART,
  Strip,
  StripFigure,
} from '../../components/app'
import type { LedgerColumn, LedgerRow, PhoneVital } from '../../components/index'
import {
  Button,
  capsLabel,
  Field,
  Ledger,
  Mention,
  TechLevel,
  tokens,
} from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import { perUnitCost } from '../../lib/cargo/cargoTransfer'
import { reportCargo } from '../../lib/cargo/reportCargo'
import type { UseCargoResult } from '../../lib/cargo/useCargo'
import { changeUndoToast } from '../../lib/changeUndoToast'
import { cn } from '../../lib/cn'
import { chassisArt } from '../../lib/photos/defaultArt'
import { CHASSIS_MODDER } from '../../lib/rules/chassisModder'
import { resolveModule, resolveSystem } from '../../lib/rules/mechItems'
import { mechScrap } from '../../lib/rules/mechScrap'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import type { UnitsStore } from '../../replica/units'
import { CargoLotControls } from '../sheet/CargoLotItem'
import { ChangeChassis, ChassisModderControl } from '../sheet/chassisControls'
import { HoldAdder } from '../sheet/HoldAdder'
import { MechConditionsEditor } from '../sheet/MechConditionsEditor'
import { MechAppearanceField, MechDescriptionField, MechIdentityPanel } from '../sheet/MechIdentity'
import { MechItemControls } from '../sheet/MechItemMini'
import type { MechSheetModel } from '../sheet/mechSheet.model'
import type { ItemKind, MechSheetActions } from '../sheet/mechSheetActions.model'
import { overSlots, slotCount } from '../sheet/mechSlots.model'
import { cargoBreakToast } from '../sheet/ruleBreakToast.model'
import { SHEET_VITALS } from '../sheet/sheetVitals.model'
import { undoToast } from '../sheet/undoToast.model'
import { Cost } from './Cost'
import { Dash, DashColumn, DashGroup } from './Dash'
import { ITEM_COLUMNS, itemRows } from './itemRows'
import { RowRules } from './RowRules'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

/** Edit's identity: the player's fields, a step apart. */
const FIELDS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  minWidth: 0,
} satisfies CSSProperties

/** The Uses column, which Edit leaves to its steppers. */
const USES_AT = ITEM_COLUMNS.findIndex((column) => column.key === 'uses')

const CARGO_COLUMNS: readonly LedgerColumn[] = [
  { key: 'tl', label: buildSheetCopy('tl'), title: buildSheetCopy('techLevel') },
  { key: 'units', label: buildSheetCopy('slots'), phone: true },
]

/**
 * A mech's three vitals as rows (SP, EP, Heat), named from the one vitals map
 * (R11) and written with one Undo toast a change (K5). In Edit each max is a
 * field with its provenance and its revert.
 */
function mechVitalRows({
  mech,
  model,
  actions,
  writes,
  edit = false,
}: {
  mech: Mech
  model: MechSheetModel
  actions: MechSheetActions
  writes: boolean
  edit?: boolean
}): PhoneVital[] {
  const change = (field: 'currentSP' | 'currentEP' | 'currentHeat', label: string, from: number) =>
    writes
      ? (next: number) => {
          actions.patchMech({ [field]: next })
          changeUndoToast({
            id: `mech:${mech.id}:${field}`,
            label,
            from,
            to: next,
            undo: (value) => actions.patchMech({ [field]: value }),
          })
        }
      : undefined
  const { maxSP, maxEP, heatCap } = model
  const row = (
    key: 'sp' | 'ep' | 'heat',
    field: 'currentSP' | 'currentEP' | 'currentHeat',
    override: 'maxSpOverride' | 'maxEpOverride' | 'maxHeatOverride',
    value: number,
    max: number,
    parts: MechSheetModel['spParts'],
    lines: MechSheetModel['spLines']
  ): PhoneVital => {
    const onChange = change(field, SHEET_VITALS[key].short, value)
    return {
      key,
      label: SHEET_VITALS[key].short,
      name: SHEET_VITALS[key].label,
      value,
      max,
      ...(key === 'heat' && max > 0 ? { danger: heatDangerFrom(max) } : {}),
      ...(onChange ? { onChange } : {}),
      ...(edit
        ? {
            maxEdit: {
              onMaxChange: (next: number) =>
                actions.overrideMechMax({ [override]: pinFor(next, parts) }),
              breakdown: parts,
              provenance: lines,
              onRevertOverride: () => actions.overrideMechMax({ [override]: undefined }),
            },
          }
        : {}),
    }
  }
  return [
    row('sp', 'currentSP', 'maxSpOverride', model.currentSP, maxSP, model.spParts, model.spLines),
    row('ep', 'currentEP', 'maxEpOverride', model.currentEP, maxEP, model.epParts, model.epLines),
    row(
      'heat',
      'currentHeat',
      'maxHeatOverride',
      model.currentHeat,
      heatCap,
      model.heatParts,
      model.heatLines
    ),
  ]
}

type MechDashProps = {
  mech: Mech
  model: MechSheetModel
  actions: MechSheetActions
  /** The viewer may write it, so the vitals step in Read (R11). */
  live: boolean
  /** Edit: the same dashboard with its controls in place. */
  edit?: boolean
  /** Opens a collection's picker (Edit's Manage). */
  onManage?: (kind: ItemKind) => void
  /** Where an item's choices and the conditions are saved. */
  store: UnitsStore
  crawler: Crawler | null
  linkedUnits?: ReactNode
  /** The drones its chassis fields, in Edit: their cards under the columns. */
  partners?: ReactNode
  /** A phone: the groups stacked. */
  phone: boolean
}

/**
 * Unload a lot, or `qty` of a stack, and leave the way back (r4 E10): the
 * same count rejoins the lot, or the lot returns whole.
 */
function unloadLot(cargo: UseCargoResult, lot: CargoLot, qty: number | undefined, mechId: string) {
  const part = qty !== undefined && lot.qty !== undefined && qty < lot.qty
  const done = cargo.removeMechLot(lot.id, part ? qty : undefined)
  reportCargo(done)
  void done.then((result) => {
    if (!result.ok) return
    const back: CargoLot = part ? { ...lot, qty, units: qty * perUnitCost(lot) } : lot
    undoToast(
      part
        ? buildSheetCopy('unloadedCount', { count: qty, name: lot.name })
        : buildSheetCopy('unloadedName', { name: lot.name }),
      () => reportCargo(cargo.addMechLot(back)),
      mechId,
      { stack: true }
    )
  })
}

export function MechDash({
  mech,
  model,
  actions,
  live,
  edit = false,
  onManage,
  store,
  crawler,
  linkedUnits,
  partners,
  phone,
}: MechDashProps) {
  const { capacity, cargo } = model
  const vitals = mechVitalRows({ mech, model, actions, writes: live || edit, edit })
  const conditions = mech.conditions ?? []
  const foot = edit ? (
    <>
      <span className={cn('su-strip__foot-label', CAPS)}>{buildSheetCopy('conditions')}</span>
      <MechConditionsEditor mech={mech} store={store} />
    </>
  ) : conditions.length > 0 ? (
    <>
      <span className={cn('su-strip__foot-label', CAPS)}>{buildSheetCopy('conditions')}</span>
      <Conditions conditions={[...conditions]} />
    </>
  ) : undefined
  const lots = cargo.state.carrierLots
  const { used, cap, free, over } = cargo.usage
  const figures = (
    <>
      <StripFigure
        label={STAT_LABELS.systemSlots.short}
        name={STAT_LABELS.systemSlots.label}
        value={capacity.systemSlotsUsed}
        max={capacity.systemSlotsMax}
        meter="pips"
        tint="ink"
        over={overSlots(
          capacity.systemSlotsUsed,
          capacity.systemSlotsMax,
          capacity.asPrinted,
          'systems'
        )}
      />
      <StripFigure
        label={STAT_LABELS.moduleSlots.short}
        name={STAT_LABELS.moduleSlots.label}
        value={capacity.moduleSlotsUsed}
        max={capacity.moduleSlotsMax}
        meter="pips"
        tint="ink"
        over={overSlots(
          capacity.moduleSlotsUsed,
          capacity.moduleSlotsMax,
          capacity.asPrinted,
          'modules'
        )}
      />
      <StripFigure
        label={STAT_LABELS.cargoCapacity.short}
        name={STAT_LABELS.cargoCapacity.label}
        value={used}
        max={cap}
        meter="pips"
        tint="cargo"
        over={over}
      />
      {/* What the build is worth, as the Scrap of each Tech Level it takes. */}
      {mechScrap(mech).byTechLevel.map(({ techLevel, scrap }) => (
        <StripFigure
          key={techLevel}
          label={buildSheetCopy('tScrapShort', { tl: techLevel })}
          name={buildSheetCopy('scrapToBuild', { tl: techLevel })}
          value={scrap}
          meter="bar"
          tint={{ tl: techLevel }}
        />
      ))}
    </>
  )
  const art = (
    <EntityPhoto
      photo={mech.photo}
      fallback={chassisArt(mech.chassisRef)}
      name={mech.name}
      frame={STRIP_ART}
      onChange={
        edit
          ? (photo) => store.getState().update('mech', mech.id, { photo }, LIVE_SHEET_MANUAL)
          : undefined
      }
    />
  )
  // What the chassis itself does (its abilities are records in the actions
  // schema, a Chassis Modder's pick among them): printed in full in the side
  // column, the chassis named.
  const chassisAbilities = model.chassisAbilities
  const modder = model.chassisModder
    ? SalvageUnionReference.Abilities.getBySlug(CHASSIS_MODDER)
    : undefined
  const chassisControls = edit && (
    <>
      <ChangeChassis mech={mech} patch={actions.patchMech} />
      {model.chassisModder && (
        <ChassisModderControl
          chassisModder={model.chassisModder}
          onModChassis={(slug) => actions.patchMech({ moddedChassisAbility: slug ?? undefined })}
        />
      )}
    </>
  )
  const manage = (kind: ItemKind, label: string) =>
    edit && onManage ? (
      <Button size="compact" onClick={() => onManage(kind)}>
        {label}
      </Button>
    ) : undefined
  /** A collection's rows; in Edit each item's controls close its line. */
  const loadoutRows = (kind: ItemKind): LedgerRow[] => {
    const rows = itemRows(mech, kind, true)
    if (!edit) return rows
    const slugs = kind === 'system' ? mech.systems : mech.modules
    const held = (kind === 'system' ? mech.systemConditions : mech.moduleConditions) ?? {}
    return rows.map((row, index) => {
      const slug = slugs[index] ?? ''
      return {
        ...row,
        stamp: undefined,
        // Edit steps the Uses in its controls; the column is Read's.
        cells: row.cells.map((cell, at) => (at === USES_AT ? '' : cell)),
        controls: (
          <MechItemControls
            slug={slug}
            entity={kind === 'system' ? resolveSystem(slug) : resolveModule(slug)}
            condition={held[slug] ?? 'intact'}
            usesRemaining={mech.itemUses?.[slug]}
            scrapPool={model.scrapPool}
            scrapPoolLocked={cargo.crawlerLocked}
            onStatusCycle={() => runWrite(() => actions.cycleItemCondition(kind, slug))}
            onUsesChange={(next) => runWrite(() => actions.setItemUses(slug, next))}
            onRepair={(deductTl, cost) =>
              runWrite(() => actions.repairItem(kind, slug, deductTl, cost))
            }
            choices={{ mechId: mech.id, seed: mech.itemChoices?.[slug], store }}
            onRemove={() => actions.removeItem(kind, index)}
          />
        ),
      }
    })
  }
  // The masthead's right column is About (the
  // description, clamped, with More). Quirk and Appearance are short lines on
  // the figures' rail, beside SYS, MODS and CARGO. The side column keeps only
  // tables.
  const identity = edit ? (
    <div style={FIELDS}>
      <MechIdentityPanel
        mech={mech}
        patch={actions.patchMech}
        after={
          <>
            <Field
              label={buildSheetCopy('quirk')}
              value={mech.quirk ?? ''}
              onSave={actions.saveQuirk}
              placeholder={buildSheetCopy('noQuirkRecorded')}
            />
            <MechAppearanceField mech={mech} onSave={actions.saveAppearance} />
          </>
        }
      />
      <MechDescriptionField mech={mech} onSave={actions.saveDescription} />
    </div>
  ) : mech.description ? (
    <div className="su-mast-id">
      <div className="su-mast-id__about">
        <p className={cn('su-mast-id__label', CAPS)}>{buildSheetCopy('about')}</p>
        <Prose text={mech.description} lines={phone ? 3 : 5} />
      </div>
    </div>
  ) : undefined
  const traitLines =
    !edit && (mech.quirk || mech.appearance) ? (
      <Facts
        className="su-mast-traits"
        itemClassName="su-mast-trait"
        labelClassName="su-mast-id__label"
        facts={[
          { key: 'quirk', label: buildSheetCopy('quirk'), value: mech.quirk },
          { key: 'appearance', label: buildSheetCopy('appearance'), value: mech.appearance },
        ]}
      />
    ) : undefined
  return (
    <>
      <Strip
        label={buildSheetCopy('unitVitals', { name: mech.name })}
        art={phone && !edit ? undefined : art}
        vitals={vitals}
        figures={figures}
        foot={foot}
        identity={identity}
        traits={traitLines}
        edit={edit}
      />
      {phone && linkedUnits}
      <Dash>
        <DashColumn wide label={buildSheetCopy('whatHas', { name: mech.name })}>
          {(mech.systems.length > 0 || edit) && (
            <Ledger
              open
              as="h2"
              className="su-open--loadout"
              title={buildSheetCopy('systems')}
              actions={manage('system', buildSheetCopy('manageSystems'))}
              empty={buildSheetCopy('noSystemsInstalled')}
              tally={slotCount(
                capacity.systemSlotsUsed,
                capacity.systemSlotsMax,
                capacity.asPrinted,
                'systems'
              )}
              columns={ITEM_COLUMNS}
              groups={[{ key: 'systems', rows: loadoutRows('system') }]}
            />
          )}
          {(mech.modules.length > 0 || edit) && (
            <Ledger
              open
              as="h2"
              className="su-open--loadout"
              title={buildSheetCopy('modules')}
              actions={manage('module', buildSheetCopy('manageModules'))}
              empty={buildSheetCopy('noModulesInstalled')}
              tally={slotCount(
                capacity.moduleSlotsUsed,
                capacity.moduleSlotsMax,
                capacity.asPrinted,
                'modules'
              )}
              columns={ITEM_COLUMNS}
              groups={[{ key: 'modules', rows: loadoutRows('module') }]}
            />
          )}
        </DashColumn>
        <DashColumn label={buildSheetCopy('whatCarries', { name: mech.name })}>
          {!phone && linkedUnits}
          {/* The chassis leads the side column. Its ability
              is text, never a row: the name and every word, always showing. Then
              its own facts and its description. A companion it fields is in
              Related units, opening the companion. */}
          {/* The side column shows the chassis
              ability only: its strip reads "Chassis ability" with the
              ability's name in it, and its body is the ability's words. */}
          {chassisAbilities.map((ability, index) => {
            const abilityModel = toEntityModel(ability)
            return (
              <DashGroup
                key={ability.id}
                title={buildSheetCopy('chassisAbility')}
                tally={
                  <>
                    <Mention entityRef={abilityModel.ref}>{ability.name}</Mention>
                    {abilityModel.cost && <Cost cost={abilityModel.cost} />}
                    {modder && nameToSlug(ability.name) === model.chassisModder?.current && (
                      // The ability a Chassis Modder added names where it comes from.
                      <Mention entityRef={entityRef(modder)}>{modder.name}</Mention>
                    )}
                  </>
                }
                actions={index === 0 ? chassisControls : undefined}
              >
                <div className="su-dash-item su-chassis-ability">
                  <RowRules entity={ability} chassisName={model.chassisName} />
                </div>
              </DashGroup>
            )
          })}
          {edit && chassisAbilities.length === 0 && (
            <DashGroup
              title={buildSheetCopy('chassis')}
              tally={model.chassisName}
              actions={chassisControls}
            />
          )}
          <div className="su-dash-group" data-storage-side="mech">
            <Ledger
              open
              as="h2"
              title={buildSheetCopy('cargo')}
              tally={{
                label: buildSheetCopy('slots'),
                value: used,
                max: cap,
                ...(over ? { state: 'critical' as const } : {}),
              }}
              columns={CARGO_COLUMNS}
              groups={[
                {
                  key: 'lots',
                  rows: lots.map((lot) => ({
                    id: lot.id,
                    name: lot.name,
                    meta: lot.cat === 'SCRAP' ? undefined : lot.cat,
                    controls: edit ? (
                      <CargoLotControls
                        lot={lot}
                        side="mech"
                        cargo={cargo}
                        linked={crawler !== null}
                        onRemove={(qty) => unloadLot(cargo, lot, qty, mech.id)}
                      />
                    ) : undefined,
                    cells: [
                      lot.tl !== undefined ? <TechLevel key="tl" level={lot.tl} /> : '',
                      lot.units,
                    ],
                  })),
                },
              ]}
              empty={buildSheetCopy('nothingInTheHold')}
            />
            <div className="su-dash-slots">
              {/* No slot cells; the head counts the slots. */}
              {free > 0 && (
                <span className="su-dash-quiet">{buildSheetCopy('free', { free })}</span>
              )}
            </div>
            {/* Said on the page, not only in a tooltip a touch screen never shows. */}
            {edit && cargo.crawlerLocked !== null && (
              <p className="su-dash-quiet">{cargo.crawlerLocked}</p>
            )}
            {edit && (
              <HoldAdder
                verb="Load"
                containerLabel={buildSheetCopy('mechHold')}
                onAdd={(lot) =>
                  reportCargo(
                    cargo.addMechLot(lot).then((result) => {
                      cargoBreakToast(mech.id, cargo.usage, result)
                      return result
                    })
                  )
                }
              />
            )}
          </div>
        </DashColumn>
      </Dash>
      {partners}
    </>
  )
}
