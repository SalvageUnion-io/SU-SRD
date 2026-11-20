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
 * Three columns from 80rem, two from 48rem; a phone stacks them under the
 * pinned vitals. Edit keeps the build layout (`MechSheet`).
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { CSSProperties, ReactNode } from 'react'
import { STAT_LABELS, toEntityModel } from 'salvageunion-reference'
import { resolveGauge, resolvePool } from 'salvageunion-reference/rules'
import { Conditions, capsLabel, Mention, Stat } from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import { appPath } from '../../lib/appBase'
import { bandFillFor } from '../../lib/chapters'
import { cn } from '../../lib/cn'
import { chassisArt } from '../../lib/photos/defaultArt'
import { buildMechActions } from '../../lib/rules/actionList'
import {
  partnerDerivedStats,
  partnerTechLevel,
  resolvePartnerStatBlock,
} from '../../lib/rules/partnerStats'
import { buildSheetCopy } from '../../messages/build-sheet'
import { mechVitalRows } from '../sheet/MechVitals'
import type { MechSheetModel } from '../sheet/mechSheet.model'
import type { MechSheetActions } from '../sheet/mechSheetActions.model'
import { partnerDisplayName } from '../sheet/partnerDisplay.model'
import { Cost } from './Cost'
import { Dash, DashColumn, DashGroup, PinnedVitals, Prose } from './Dash'
import { ITEM_COLUMNS, itemRows } from './itemRows'
import type { OpenColumn } from './OpenLedger'
import { OpenLedger, TechLevel } from './OpenLedger'
import { RowRules } from './RowRules'
import { STRIP_ART, Strip, StripFigure } from './Strip'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

const CARGO_COLUMNS: readonly OpenColumn[] = [
  { key: 'tl', label: buildSheetCopy('tl'), title: buildSheetCopy('techLevel') },
  { key: 'units', label: buildSheetCopy('slots'), phone: true },
]

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
        <span className={cn('su-strip__foot-label', CAPS, CAPS)}>
          {buildSheetCopy('conditions')}
        </span>
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
      {/* Tech Level and Salvage Value are the chassis's
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
  // What the chassis itself does (its abilities are records in the actions
  // schema): printed in full in the side column, the chassis named.
  const chassisAbilities = buildMechActions(mech).filter((action) => action.kind === 'chassis')
  // A companion the chassis fields (a drone) is its
  // own cell, in its own colour (a drone wears its tech level), with its
  // numbers; the whole cell opens the companion's own sheet (`CompanionSheet`).
  const companions = (mech.partners ?? []).map((partner) => {
    const block = resolvePartnerStatBlock(partner)
    const max = partnerDerivedStats(partner, partnerTechLevel(partner, undefined))
    const name = partnerDisplayName(partner)
    const blockName = block && 'name' in block ? block.name : undefined
    return (
      <a
        key={partner.id}
        className="su-companion-cell"
        href={`${appPath(`/mechs/${mech.id}/companions/${partner.id}`)}`}
        style={
          {
            '--su-kind': block
              ? (bandFillFor(partner.hostSchema, block) ?? 'var(--color-tl-1)')
              : undefined,
          } as CSSProperties
        }
      >
        <span className={cn('su-companion-cell__kind', CAPS, CAPS)}>
          {buildSheetCopy('companion')}
        </span>
        <span className="su-companion-cell__name">{name}</span>
        {blockName && blockName !== name && (
          <span className="su-companion-cell__block">{blockName}</span>
        )}
        <span className="su-companion-cell__vitals">
          {buildSheetCopy('companionVitals', {
            sp: resolvePool(partner.currentSP, max.structurePoints),
            spMax: max.structurePoints,
            ep: resolvePool(partner.currentEP, max.energyPoints),
            epMax: max.energyPoints,
            heat: resolveGauge(partner.currentHeat),
            heatMax: max.heatCapacity,
          })}
        </span>
      </a>
    )
  })
  // The masthead's right column is About (the
  // description, clamped, with More). Quirk and Appearance are short lines on
  // the figures' rail, beside SYS, MODS and CARGO. The side column keeps only
  // tables.
  const identity = mech.description ? (
    <div className="su-mast-id">
      <div className="su-mast-id__about">
        <p className={cn('su-mast-id__label', CAPS, CAPS)}>{buildSheetCopy('about')}</p>
        <Prose text={mech.description} lines={phone ? 3 : 5} />
      </div>
    </div>
  ) : undefined
  const traitLines =
    mech.quirk || mech.appearance ? (
      <dl className="su-mast-traits">
        {mech.quirk && (
          <div className="su-mast-trait">
            <dt className={cn('su-mast-id__label', CAPS, CAPS)}>{buildSheetCopy('quirk')}</dt>
            <dd>{mech.quirk}</dd>
          </div>
        )}
        {mech.appearance && (
          <div className="su-mast-trait">
            <dt className={cn('su-mast-id__label', CAPS, CAPS)}>{buildSheetCopy('appearance')}</dt>
            <dd>{mech.appearance}</dd>
          </div>
        )}
      </dl>
    ) : undefined
  return (
    <>
      {phone && (
        <PinnedVitals
          label={buildSheetCopy('unitVitals', { name: mech.name })}
          name={mech.name}
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
      />
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
          {/* The chassis leads the side column. Its ability
              is text, never a row: the name and every word, always showing. Then
              its own facts and its description. A companion it fields is its own
              cell below, in the companion's colour, opening the companion. */}
          {/* The side column shows the chassis
              ability only: its strip reads "Chassis ability" with the
              ability's name in it, and its body is the ability's words. */}
          {chassisModel &&
            chassisAbilities.map((action) => {
              const actionModel = toEntityModel(action.action)
              return (
                <DashGroup
                  key={action.key}
                  title={buildSheetCopy('chassisAbility')}
                  tally={
                    <>
                      <Mention entityRef={actionModel.ref}>{action.name}</Mention>
                      {actionModel.cost && <Cost cost={actionModel.cost} />}
                    </>
                  }
                >
                  <div className="su-dash-item su-chassis-ability">
                    <RowRules entity={action.action} chassisName={model.chassisName} />
                  </div>
                </DashGroup>
              )
            })}
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
              {/* No slot cells; the head counts the slots. */}
              {free > 0 && (
                <span className="su-dash-quiet">{buildSheetCopy('free', { free })}</span>
              )}
              {over && <Stat size="mini" label={buildSheetCopy('overCapacity')} state="critical" />}
            </div>
          </div>
          {linkedUnits}
        </DashColumn>
      </Dash>
      {partners}
    </>
  )
}
