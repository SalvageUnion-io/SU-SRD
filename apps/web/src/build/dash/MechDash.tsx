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
import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import { CONDITION_LABELS, STAT_LABELS, toEntityModel } from 'salvageunion-reference'
import { resolveGauge, resolvePool } from 'salvageunion-reference/rules'
import { Conditions, Content, Mention, Stat } from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import { bandFillFor } from '../../lib/chapters'
import { occurrenceKeys } from '../../lib/occurrenceKeys'
import { chassisArt } from '../../lib/photos/defaultArt'
import { buildCompanionActions, buildMechActions } from '../../lib/rules/actionList'
import {
  itemEconomy,
  itemUsesRemaining,
  resolveModule,
  resolveSystem,
} from '../../lib/rules/mechItems'
import {
  partnerDerivedStats,
  partnerTechLevel,
  resolvePartnerStatBlock,
} from '../../lib/rules/partnerStats'
import { buildSheetCopy } from '../../messages/build-sheet'
import { mechVitalRows } from '../sheet/MechVitals'
import type { MechSheetModel } from '../sheet/mechSheet.model'
import type { ItemKind, MechSheetActions } from '../sheet/mechSheetActions.model'
import { partnerDisplayName } from '../sheet/partnerDisplay.model'
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
      {/* MOCK (best, revision 5): Tech Level and Salvage Value are the chassis's
          own facts, so they sit with the Chassis in the side column. */}
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
  // schema): printed in full in the side column, the chassis named.
  const chassisAbilities = allActions.filter((action) => action.kind === 'chassis')
  // MOCK (best, revision 6): a companion the chassis fields (a drone) is its
  // own cell, in its own colour (a drone wears its tech level), with its
  // numbers; it opens the companion where it lives, under the columns (a
  // partner has no sheet of its own, ADR-028).
  const companions = (mech.partners ?? []).map((partner) => {
    const block = resolvePartnerStatBlock(partner)
    const max = partnerDerivedStats(partner, partnerTechLevel(partner, undefined))
    const name = partnerDisplayName(partner)
    const blockName = block && 'name' in block ? block.name : undefined
    return (
      <a
        key={partner.id}
        className="su-companion-cell"
        href={`#partner-${partner.id}`}
        style={
          {
            '--su-kind': block
              ? (bandFillFor(partner.hostSchema, block) ?? 'var(--color-tl-1)')
              : undefined,
          } as CSSProperties
        }
      >
        <span className="su-companion-cell__kind">{buildSheetCopy('companion')}</span>
        <span className="su-companion-cell__name">{name}</span>
        {blockName && blockName !== name && (
          <span className="su-companion-cell__block">{blockName}</span>
        )}
        <span className="su-companion-cell__vitals">
          {`SP ${resolvePool(partner.currentSP, max.structurePoints)}/${max.structurePoints} · EP ${resolvePool(partner.currentEP, max.energyPoints)}/${max.energyPoints} · HEAT ${resolveGauge(partner.currentHeat)}/${max.heatCapacity}`}
        </span>
      </a>
    )
  })
  // MOCK (best, revision 6): the masthead's right column is About (the
  // description, clamped, with More). Quirk and Appearance are short lines on
  // the figures' rail, beside SYS, MODS and CARGO. The side column keeps only
  // tables.
  const identity = mech.description ? (
    <div className="su-mast-id">
      <div className="su-mast-id__about">
        <p className="su-mast-id__label">{buildSheetCopy('about')}</p>
        <Prose text={mech.description} lines={phone ? 3 : 5} />
      </div>
    </div>
  ) : undefined
  const traitLines =
    mech.quirk || mech.appearance ? (
      <dl className="su-mast-traits">
        {mech.quirk && (
          <div className="su-mast-trait">
            <dt className="su-mast-id__label">{buildSheetCopy('quirk')}</dt>
            <dd>{mech.quirk}</dd>
          </div>
        )}
        {mech.appearance && (
          <div className="su-mast-trait">
            <dt className="su-mast-id__label">{buildSheetCopy('appearance')}</dt>
            <dd>{mech.appearance}</dd>
          </div>
        )}
      </dl>
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
        identity={identity}
        traits={traitLines}
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
          </DashColumn>
          <DashColumn label={buildSheetCopy('whatCarries', { name: mech.name })}>
            {/* MOCK (best, revision 6): the chassis leads the side column. Its ability
                is text, never a row: the name and every word, always showing. Then
                its own facts and its description. A companion it fields is its own
                cell below, in the companion's colour, opening the companion. */}
            {chassisModel && (
              <DashGroup
                title={buildSheetCopy('chassis')}
                tally={<Mention entityRef={chassisModel.ref}>{model.chassisName}</Mention>}
              >
                {chassisAbilities.map((action) => {
                  const actionModel = toEntityModel(action.action)
                  return (
                    <div key={action.key} className="su-dash-item su-chassis-ability">
                      <p className="su-dash-entity__name">
                        <Mention entityRef={actionModel.ref}>{action.name}</Mention>
                        {actionModel.cost && <Cost cost={actionModel.cost} />}
                      </p>
                      <RowRules entity={action.action} chassisName={model.chassisName} />
                    </div>
                  )
                })}
                <Facts
                  facts={[
                    typeof chassis?.techLevel === 'number'
                      ? {
                          key: 'tl',
                          label: buildSheetCopy('techLevel'),
                          value: <TechLevel level={chassis.techLevel} />,
                        }
                      : null,
                    typeof chassis?.salvageValue === 'number'
                      ? {
                          key: 'sv',
                          label: STAT_LABELS.salvageValue.label,
                          value: chassis.salvageValue,
                        }
                      : null,
                  ]}
                />
                {chassis?.content && chassis.content.length > 0 && (
                  <Prose lines={4}>
                    <Content
                      body={chassis.content as ComponentProps<typeof Content>['body']}
                      fontSize="sm"
                      chassisName={model.chassisName}
                    />
                  </Prose>
                )}
              </DashGroup>
            )}
            {companions}
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
                {/* MOCK (best, revision 4): no slot cells; the head counts the slots. */}
                {free > 0 && (
                  <span className="su-dash-quiet">{buildSheetCopy('free', { free })}</span>
                )}
                {over && (
                  <Stat size="mini" label={buildSheetCopy('overCapacity')} state="critical" />
                )}
              </div>
            </div>
            {linkedUnits}
          </DashColumn>
        </Dash>
      )}
      {partners}
    </>
  )
}
