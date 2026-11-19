/**
 * MechDash — MOCK (density mock, sheet variant): a mech's Read sheet as a
 * dashboard, in the order the game uses it at the table.
 *
 *   The strip: the art, SP · EP · Heat live, then what the chassis fixes:
 *     System Slots, Module Slots, Cargo, Tech Level, Salvage Value.
 *   What it does: every action by type (`ActionsLedger`, R65).
 *   What it has: Systems, then Modules, a line an item under its slot budget.
 *   What it carries and who it is: Cargo, the Chassis, what was written
 *     about it, and the units it is assigned to.
 *
 * Three columns from 80rem, two from 48rem; a phone stacks them under the
 * pinned vitals. Edit keeps the build layout (`MechSheet`).
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { ComponentProps, ReactNode } from 'react'
import { CONDITION_LABELS, STAT_LABELS, toEntityModel } from 'salvageunion-reference'
import { Conditions, Content, Mention, SlotGrid, Stat } from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import { occurrenceKeys } from '../../lib/occurrenceKeys'
import { chassisArt } from '../../lib/photos/defaultArt'
import { buildCompanionActions, buildMechActions } from '../../lib/rules/actionList'
import {
  itemEconomy,
  itemUsesRemaining,
  resolveModule,
  resolveSystem,
} from '../../lib/rules/mechItems'
import { buildSheetCopy } from '../../messages/build-sheet'
import { mechVitalRows } from '../sheet/MechVitals'
import type { MechSheetModel } from '../sheet/mechSheet.model'
import type { ItemKind, MechSheetActions } from '../sheet/mechSheetActions.model'
import { ActionsLedger, Cost } from './ActionsLedger'
import { Dash, DashColumn, DashGroup, Facts, PinnedVitals, Prose } from './Dash'
import type { OpenColumn, OpenRow } from './OpenLedger'
import { OpenLedger, TechLevel } from './OpenLedger'
import { RowRules } from './RowRules'
import { SheetViewSwitch, useSheetView } from './SheetView'
import { STRIP_ART, Strip, StripFigure } from './Strip'

// THE stat order (ledger.md, `ledgerOrder.ts`): where it comes from (TL,
// Slots, SV), then what its action does (type, Range, Damage), the cost last
// on the row's edge, where a player hunts for it mid-turn.
const ITEM_COLUMNS: readonly OpenColumn[] = [
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

const CHASSIS_COLUMNS: readonly OpenColumn[] = [
  { key: 'action', label: buildSheetCopy('action'), kind: 'text', phone: true },
  {
    key: 'cost',
    label: buildSheetCopy('cost'),
    title: buildSheetCopy('activationCost'),
    phone: true,
  },
]

const CARGO_COLUMNS: readonly OpenColumn[] = [
  { key: 'tl', label: buildSheetCopy('tl'), title: buildSheetCopy('techLevel') },
  { key: 'units', label: buildSheetCopy('slots'), phone: true },
]

const typeWord = (type: string | undefined) => (type === 'DownTime' ? 'Downtime' : (type ?? ''))

function itemRows(mech: Mech, kind: ItemKind): OpenRow[] {
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
    // Uses is live on the row (its stamp), so the trait line leaves it out.
    const traits = (model?.traits ?? [])
      .filter((trait) => trait.name !== 'Uses')
      .map((trait) => (trait.param ? `${trait.name} ${trait.param}` : trait.name))
    const action = typeWord(model?.actionType)
    return {
      id: keys[index] ?? slug,
      // An item the data no longer holds keeps its slug.
      name: entity?.name ?? slug,
      entityRef: model?.ref,
      meta:
        traits.length > 0 || action !== '' ? (
          <>
            {action !== '' && (
              <span className="su-open__phone-only">
                {[action, fact('range') && `RNG ${fact('range')}`, fact('damage')]
                  .filter(Boolean)
                  .join(' · ')}
                {traits.length > 0 ? ' · ' : ''}
              </span>
            )}
            {traits.join(' · ')}
          </>
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

type MechDashProps = {
  mech: Mech
  model: MechSheetModel
  actions: MechSheetActions
  /** The viewer may write it, so the vitals step in Read (R11). */
  live: boolean
  crawler: Crawler | null
  linkedUnits?: ReactNode
  /** The drones its chassis fields: their own region under the columns. */
  partners?: ReactNode
  /** A phone: the vitals pinned, the groups stacked. */
  phone: boolean
}

export function MechDash({
  mech,
  model,
  actions,
  live,
  linkedUnits,
  partners,
  phone,
}: MechDashProps) {
  const { capacity, cargo } = model
  const chassis = model.chassisEntity
  const vitals = mechVitalRows({ mech, model, actions, writes: live })
  const conditions = mech.conditions ?? []
  const foot =
    conditions.length > 0 ? (
      <>
        <span className="su-strip__foot-label">{buildSheetCopy('conditions')}</span>
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
        over={capacity.systemSlotsUsed > capacity.systemSlotsMax}
      />
      <StripFigure
        label={STAT_LABELS.moduleSlots.short}
        name={STAT_LABELS.moduleSlots.label}
        value={capacity.moduleSlotsUsed}
        max={capacity.moduleSlotsMax}
        meter="pips"
        tint="ink"
        over={capacity.moduleSlotsUsed > capacity.moduleSlotsMax}
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
      {typeof chassis?.techLevel === 'number' && (
        <StripFigure
          label={buildSheetCopy('tl')}
          name={buildSheetCopy('techLevel')}
          value={chassis.techLevel}
          meter="bar"
          tint={{ tl: chassis.techLevel }}
        />
      )}
      {typeof chassis?.salvageValue === 'number' && (
        <StripFigure
          label={STAT_LABELS.salvageValue.short}
          name={STAT_LABELS.salvageValue.label}
          value={chassis.salvageValue}
        />
      )}
    </>
  )
  const art = (
    <EntityPhoto
      photo={mech.photo}
      fallback={chassisArt(mech.chassisRef)}
      name={mech.name}
      frame={STRIP_ART}
    />
  )
  const chassisModel = chassis ? toEntityModel(chassis) : undefined
  const [view, setView] = useSheetView()
  const allActions = [
    ...buildMechActions(mech),
    ...buildCompanionActions({ kind: 'mech', id: mech.id }, mech.partners),
  ]
  // What the chassis itself does (its abilities are records in the actions
  // schema): a line each, opening its text with the chassis named.
  const chassisRows: OpenRow[] = allActions
    .filter((action) => action.kind === 'chassis')
    .map((action) => {
      const actionModel = toEntityModel(action.action)
      return {
        id: action.key,
        name: action.name,
        entityRef: actionModel.ref,
        cells: [
          typeWord(actionModel.actionType),
          actionModel.cost ? <Cost key="cost" cost={actionModel.cost} /> : '',
        ],
        detail: <RowRules entity={action.action} chassisName={model.chassisName} />,
      }
    })
  const identity =
    mech.quirk || mech.appearance ? (
      <Facts
        facts={[
          { key: 'quirk', label: buildSheetCopy('quirk'), value: mech.quirk, wide: true },
          {
            key: 'appearance',
            label: buildSheetCopy('appearance'),
            value: mech.appearance,
            wide: true,
          },
        ]}
      />
    ) : undefined
  const viewSwitch = <SheetViewSwitch view={view} onChange={setView} count={allActions.length} />
  return (
    <>
      {phone && (
        <PinnedVitals
          label={buildSheetCopy('unitVitals', { name: mech.name })}
          vitals={vitals}
          foot={foot}
        />
      )}
      <Strip
        label={buildSheetCopy('unitVitals', { name: mech.name })}
        art={phone ? undefined : art}
        vitals={phone ? [] : vitals}
        figures={figures}
        foot={phone ? undefined : foot}
        identity={phone ? undefined : identity}
        view={viewSwitch}
      />
      {view === 'actions' ? (
        <ActionsLedger actions={allActions} />
      ) : (
        <Dash>
          <DashColumn wide label={buildSheetCopy('whatHas', { name: mech.name })}>
            {mech.systems.length > 0 && (
              <OpenLedger
                className="su-open--loadout"
                title={buildSheetCopy('systems')}
                tally={{
                  label: buildSheetCopy('slots'),
                  value: capacity.systemSlotsUsed,
                  max: capacity.systemSlotsMax,
                  ...(capacity.systemSlotsUsed > capacity.systemSlotsMax
                    ? { state: 'critical' as const }
                    : {}),
                }}
                columns={ITEM_COLUMNS}
                groups={[{ key: 'systems', rows: itemRows(mech, 'system') }]}
              />
            )}
            {mech.modules.length > 0 && (
              <OpenLedger
                className="su-open--loadout"
                title={buildSheetCopy('modules')}
                tally={{
                  label: buildSheetCopy('slots'),
                  value: capacity.moduleSlotsUsed,
                  max: capacity.moduleSlotsMax,
                  ...(capacity.moduleSlotsUsed > capacity.moduleSlotsMax
                    ? { state: 'critical' as const }
                    : {}),
                }}
                columns={ITEM_COLUMNS}
                groups={[{ key: 'modules', rows: itemRows(mech, 'module') }]}
              />
            )}
            {chassisModel && (
              <div className="su-dash-group">
                <OpenLedger
                  title={buildSheetCopy('chassis')}
                  note={<Mention entityRef={chassisModel.ref}>{model.chassisName}</Mention>}
                  columns={CHASSIS_COLUMNS}
                  groups={[{ key: 'chassis', rows: chassisRows }]}
                />
                {chassis?.content && chassis.content.length > 0 && (
                  <Prose lines={2}>
                    <Content
                      body={chassis.content as ComponentProps<typeof Content>['body']}
                      fontSize="sm"
                      chassisName={model.chassisName}
                    />
                  </Prose>
                )}
              </div>
            )}
          </DashColumn>
          <DashColumn label={buildSheetCopy('whatCarries', { name: mech.name })}>
            <div className="su-dash-group">
              <OpenLedger
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
                <SlotGrid
                  used={used}
                  cap={cap}
                  readOnly
                  label={buildSheetCopy('cargoSlotsUsed', { used, cap })}
                />
                {free > 0 && (
                  <span className="su-dash-quiet">{buildSheetCopy('free', { free })}</span>
                )}
                {over && (
                  <Stat size="mini" label={buildSheetCopy('overCapacity')} state="critical" />
                )}
              </div>
            </div>
            {((phone && (mech.quirk || mech.appearance)) || mech.description) && (
              <DashGroup title={buildSheetCopy('about')}>
                <Facts
                  facts={[
                    // On a page the masthead carries Quirk and Appearance (R59).
                    phone
                      ? {
                          key: 'quirk',
                          label: buildSheetCopy('quirk'),
                          value: mech.quirk,
                          wide: true,
                        }
                      : null,
                    phone
                      ? {
                          key: 'appearance',
                          label: buildSheetCopy('appearance'),
                          value: mech.appearance,
                          wide: true,
                        }
                      : null,
                    mech.description
                      ? {
                          key: 'description',
                          label: buildSheetCopy('description'),
                          value: <Prose text={mech.description} lines={4} />,
                          wide: true,
                        }
                      : null,
                  ]}
                />
              </DashGroup>
            )}
            {linkedUnits}
          </DashColumn>
        </Dash>
      )}
      {partners}
    </>
  )
}
