/**
 * PilotDash — A pilot's Read sheet as a
 * dashboard, in the order the printed sheet is used at the table.
 *
 *   The strip: the portrait, HP and AP live, Training Points, then the
 *     inventory's slots.
 *   What they know: the class's trees whole, a line an ability on its level,
 *     the taken ones in ink and the rest greyed, then any Generic abilities
 *     taken.
 *   What they carry and who they are: the Inventory, the three once-a-
 *     Downtime traits (Motto, Keepsake, Background, each with its Used mark),
 *     what was written about them, and their assigned units.
 */

import type { Pilot } from 'game-domain/schemas/pilot'
import type { ReactNode } from 'react'
import { CONDITION_LABELS, toEntityModel } from 'salvageunion-reference'
import type { OpenColumn, OpenRow } from '../../components/index'
import {
  Conditions,
  capsLabel,
  Facts,
  OpenLedger,
  Prose,
  STRIP_ART,
  Stat,
  Strip,
  StripFigure,
  TechLevel,
} from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import { cn } from '../../lib/cn'
import { classArt } from '../../lib/photos/defaultArt'
import { resolveEquipment } from '../../lib/rules/pilotInventory'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { UsedTraitKey } from '../sheet/PilotIdentity'
import { UsedChip } from '../sheet/PilotIdentity'
import { pilotVitalRows } from '../sheet/PilotVitals'
import type { AbilityEntry, PilotSheetModel } from '../sheet/pilotSheet.model'
import { inventoryEmpty } from '../sheet/pilotSheet.model'
import type { PilotSheetActions } from '../sheet/pilotSheetActions.model'
import { Cost } from './Cost'
import { Dash, DashColumn, DashGroup, PinnedVitals } from './Dash'
import { RowRules } from './RowRules'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

const ABILITY_COLUMNS: readonly OpenColumn[] = [
  { key: 'action', label: buildSheetCopy('action'), kind: 'text' },
  {
    key: 'cost',
    label: buildSheetCopy('cost'),
    title: buildSheetCopy('activationCost'),
    phone: true,
    // A cost badge says what it is; no head label.
    quiet: true,
  },
]

const GEAR_COLUMNS: readonly OpenColumn[] = [
  { key: 'tl', label: buildSheetCopy('tl'), title: buildSheetCopy('techLevel'), phone: true },
  { key: 'slots', label: buildSheetCopy('slots'), phone: true },
]

/** A tree's column is a third of the page: its one figure is the cost. */
const TREE_COLUMNS: readonly OpenColumn[] = ABILITY_COLUMNS.filter(
  (column) => column.key === 'cost'
)

function abilityRow(entry: AbilityEntry, used: readonly string[], inTree = false): OpenRow {
  const model = toEntityModel(entry.ability)
  const taken = !entry.unlearned
  const action = model.actionType === 'DownTime' ? 'Downtime' : (model.actionType ?? '')
  return {
    id: entry.slug,
    name: model.title,
    entityRef: model.ref,
    // The Action column gives way to the name on a phone, so the row keeps
    // what it said beside the name (nothing is dropped, EDL/R11).
    meta:
      action === '' || inTree ? undefined : <span className="su-open__phone-only">{action}</span>,
    // A tree's taken ability reads in full without a press: it is the pilot's own.
    defaultOpen: inTree && taken,
    lead: model.tier ? (
      <span className="su-open-level" data-on={taken ? '' : undefined}>
        {model.tier}
      </span>
    ) : undefined,
    state:
      taken && used.includes(entry.slug) ? (
        <Stat size="mini" label={buildSheetCopy('used')} />
      ) : undefined,
    cells: inTree
      ? [model.cost ? <Cost key="cost" cost={model.cost} /> : '']
      : [action, model.cost ? <Cost key="cost" cost={model.cost} /> : ''],
    // What it is in a line (the class page's own summary), its rules a press away.
    // In a tree's narrow column the action type leads that line.
    under:
      model.lead || (inTree && action !== '') ? (
        <p className="su-open__clamp">
          {inTree && action !== '' && (
            <span className={cn('su-open__meta', CAPS, CAPS)}>{action} · </span>
          )}
          {model.lead}
        </p>
      ) : undefined,
    detail: <RowRules entity={entry.ability} />,
    dim: !taken,
  }
}

type PilotDashProps = {
  pilot: Pilot
  model: PilotSheetModel
  actions: PilotSheetActions
  /** The viewer may write it, so HP, AP, Training Points and the Used marks step in Read (R11). */
  live: boolean
  linkedUnits?: ReactNode
  /** The pilot's companions: their own region under the columns. */
  companions?: ReactNode
  /** A phone: the vitals pinned, the groups stacked. */
  phone: boolean
}

export function PilotDash({
  pilot,
  model,
  actions,
  live,
  linkedUnits,
  companions,
  phone,
}: PilotDashProps) {
  const vitals = pilotVitalRows({ pilot, model, actions, writes: live })
  const used = pilot.usedAbilities ?? []
  const foot =
    pilot.conditions.length > 0 ? (
      <>
        <span className={cn('su-strip__foot-label', CAPS, CAPS)}>
          {buildSheetCopy('conditions')}
        </span>
        <Conditions conditions={[...pilot.conditions]} />
      </>
    ) : undefined
  const figures = (
    <StripFigure
      label={buildSheetCopy('inventory')}
      name={buildSheetCopy('inventorySlotsFilled', {
        used: model.slotsUsed,
        cap: model.slotsCap,
      })}
      value={model.slotsUsed}
      max={model.slotsCap}
      meter="pips"
      tint="cargo"
      over={model.overCapacity}
    />
  )
  const art = (
    <EntityPhoto
      photo={pilot.photo}
      fallback={classArt(pilot.classRef)}
      name={pilot.callsign || pilot.name}
      frame={STRIP_ART}
    />
  )
  const generic = model.genericAbilities.filter((entry) => !entry.unlearned)
  const gear: OpenRow[] = [
    ...model.ordinaryEquipment.map((slug): OpenRow => {
      const entity = resolveEquipment(slug)
      const condition = pilot.equipmentConditions?.[slug] ?? 'intact'
      const uses = pilot.equipmentUses?.[slug]
      return {
        id: slug,
        name: entity?.name ?? slug,
        entityRef: entity ? toEntityModel(entity).ref : undefined,
        state:
          condition !== 'intact' || uses !== undefined ? (
            <>
              {condition !== 'intact' && (
                <Stat size="mini" label={CONDITION_LABELS[condition]} state="critical" />
              )}
              {uses !== undefined && (
                <Stat size="mini" label={buildSheetCopy('uses')} value={uses} />
              )}
            </>
          ) : undefined,
        cells: [entity ? <TechLevel key="tl" level={entity.techLevel} /> : '', 1],
        dim: condition === 'destroyed',
        detail: entity ? <RowRules entity={entity} /> : undefined,
      }
    }),
    ...model.genericInventory.map(
      (entry): OpenRow => ({
        id: entry.id,
        name: entry.qty && entry.qty > 1 ? `${entry.name} ×${entry.qty}` : entry.name,
        meta: entry.note,
        cells: ['', entry.slotCost],
      })
    ),
  ]
  const usedChip = (key: UsedTraitKey, label: string) => (
    <UsedChip
      label={label}
      used={pilot.usedToggles?.[key] ?? false}
      onToggle={live ? (next) => actions.toggleUsed(key, next) : undefined}
    />
  )
  const trait = (key: UsedTraitKey, label: string, value: string) =>
    value.trim() === ''
      ? null
      : {
          key,
          label: (
            <>
              {label}
              {usedChip(key, label.toLowerCase())}
            </>
          ),
          value,
          wide: true,
        }
  const traits = [
    trait('motto', buildSheetCopy('motto'), pilot.motto),
    trait('keepsake', buildSheetCopy('keepsake'), pilot.keepsake),
    trait('background', buildSheetCopy('background'), pilot.background),
  ]
  // The printed sheet opens with who the pilot is: the Motto as the line you
  // say at the table, Keepsake and Background under it, each with its
  // once-a-Downtime Used mark.
  // The masthead's right column is About (the Bio,
  // clamped, with More; Appearance under it). Motto, Keepsake and Background,
  // each with its once-a-Downtime Used mark, are short lines on the figures'
  // rail, beside Inventory. The side column keeps only tables.
  const identity =
    pilot.description || pilot.appearance.trim() !== '' ? (
      <div className="su-mast-id">
        {pilot.description && (
          <div className="su-mast-id__about">
            <p className={cn('su-mast-id__label', CAPS, CAPS)}>{buildSheetCopy('about')}</p>
            <Prose text={pilot.description} lines={phone ? 3 : 5} />
          </div>
        )}
        {pilot.appearance.trim() !== '' && (
          <Facts
            facts={[
              {
                key: 'appearance',
                label: buildSheetCopy('appearance'),
                value: pilot.appearance,
                wide: true,
              },
            ]}
          />
        )}
      </div>
    ) : undefined
  const traitLines = traits.some(Boolean) ? (
    <Facts
      className="su-mast-traits"
      itemClassName="su-mast-trait"
      labelClassName="su-mast-id__label"
      facts={traits}
    />
  ) : undefined
  return (
    <>
      {phone && (
        <PinnedVitals
          label={buildSheetCopy('unitVitals', { name: pilot.name })}
          name={pilot.name}
          vitals={vitals}
          foot={foot}
        />
      )}
      <Strip
        label={buildSheetCopy('unitVitals', { name: pilot.name })}
        art={phone ? undefined : art}
        vitals={phone ? [] : vitals}
        figures={figures}
        foot={phone ? undefined : foot}
        identity={identity}
        traits={traitLines}
      />
      <Dash>
        <DashColumn wide label={buildSheetCopy('abilities')}>
          <DashGroup title={buildSheetCopy('abilities')}>
            {/* The class's trees side by side, as the class page prints them (R48). */}
            <div className="su-grid su-trees">
              {model.classTrees.map((group) => (
                <OpenLedger
                  key={group.tree}
                  className="su-open--sub"
                  as="h4"
                  title={group.tree}
                  columns={TREE_COLUMNS}
                  groups={[
                    {
                      key: group.tree,
                      rows: group.abilities.map((entry) => abilityRow(entry, used, true)),
                    },
                  ]}
                />
              ))}
            </div>
            {model.unresolvedAbilities.length > 0 && (
              <OpenLedger
                className="su-open--sub su-open--generic"
                as="h4"
                title={buildSheetCopy('generic')}
                columns={ABILITY_COLUMNS}
                groups={[
                  {
                    key: 'unknown',
                    rows: model.unresolvedAbilities.map((slug) => ({
                      id: slug,
                      name: slug,
                      cells: ['', ''],
                    })),
                  },
                ]}
              />
            )}
          </DashGroup>
        </DashColumn>
        <DashColumn label={buildSheetCopy('whatCarries', { name: pilot.name })}>
          {!inventoryEmpty(pilot, model) && (
            <div className="su-dash-group">
              <OpenLedger
                title={buildSheetCopy('inventory')}
                tally={{
                  label: buildSheetCopy('slots'),
                  value: model.slotsUsed,
                  max: model.slotsCap,
                  ...(model.overCapacity ? { state: 'critical' as const } : {}),
                }}
                columns={GEAR_COLUMNS}
                groups={[{ key: 'gear', rows: gear }]}
              />
              {/* The slot cells are gone; the head's count says it. */}
            </div>
          )}
          {generic.length > 0 && (
            // Every pilot's Generic Abilities are a
            // table of the side column, under Inventory: a row each, header
            // only, opening its rules in place.
            <div className="su-dash-group">
              <OpenLedger
                title={buildSheetCopy('genericAbilities')}
                columns={ABILITY_COLUMNS}
                groups={[
                  {
                    key: 'generic',
                    rows: generic.map((entry) => ({
                      ...abilityRow(entry, used),
                      under: undefined,
                    })),
                  },
                ]}
              />
            </div>
          )}
          {linkedUnits}
        </DashColumn>
      </Dash>
      {companions}
    </>
  )
}
