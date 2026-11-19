/**
 * PilotDash — MOCK (density mock, sheet variant): a pilot's Read sheet as a
 * dashboard, in the order the printed sheet is used at the table.
 *
 *   The strip: the portrait, HP and AP live, Training Points, then the
 *     inventory's slots.
 *   What they do: every action by type (`ActionsLedger`, R65).
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
import { Conditions, SlotGrid, Stat } from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import { classArt } from '../../lib/photos/defaultArt'
import { buildCompanionActions, buildPilotActions } from '../../lib/rules/actionList'
import { resolveEquipment } from '../../lib/rules/pilotInventory'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { UsedTraitKey } from '../sheet/PilotIdentity'
import { UsedChip } from '../sheet/PilotIdentity'
import { pilotVitalRows } from '../sheet/PilotVitals'
import type { AbilityEntry, PilotSheetModel } from '../sheet/pilotSheet.model'
import { inventoryEmpty } from '../sheet/pilotSheet.model'
import type { PilotSheetActions } from '../sheet/pilotSheetActions.model'
import { ActionsLedger, Cost } from './ActionsLedger'
import { Dash, DashColumn, DashGroup, Facts, PinnedVitals, Prose } from './Dash'
import type { OpenColumn, OpenRow } from './OpenLedger'
import { OpenLedger, TechLevel } from './OpenLedger'
import { RowRules } from './RowRules'
import { SheetViewSwitch, useSheetView } from './SheetView'
import { STRIP_ART, Strip, StripFigure } from './Strip'

const ABILITY_COLUMNS: readonly OpenColumn[] = [
  { key: 'action', label: buildSheetCopy('action'), kind: 'text' },
  {
    key: 'cost',
    label: buildSheetCopy('cost'),
    title: buildSheetCopy('activationCost'),
    phone: true,
  },
]

const GEAR_COLUMNS: readonly OpenColumn[] = [
  { key: 'tl', label: buildSheetCopy('tl'), title: buildSheetCopy('techLevel'), phone: true },
  { key: 'slots', label: buildSheetCopy('slots'), phone: true },
]

/** A tree's track, in the words the class page prints. */
const TRACK_NOTE: Record<string, string> = {
  core: 'Core tree',
  advanced: 'Advanced tree',
  hybrid: 'Hybrid tree',
  legendary: 'Legendary · choose 1',
}

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
          {inTree && action !== '' && <span className="su-open__meta">{action} · </span>}
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
        <span className="su-strip__foot-label">{buildSheetCopy('conditions')}</span>
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
  const [view, setView] = useSheetView()
  const allActions = [
    ...buildPilotActions(pilot),
    ...buildCompanionActions({ kind: 'pilot', id: pilot.id }, pilot.partners),
  ]
  const traits = [
    trait('motto', buildSheetCopy('motto'), pilot.motto),
    trait('keepsake', buildSheetCopy('keepsake'), pilot.keepsake),
    trait('background', buildSheetCopy('background'), pilot.background),
  ]
  // The printed sheet opens with who the pilot is: the Motto as the line you
  // say at the table, Keepsake and Background under it, each with its
  // once-a-Downtime Used mark.
  const identity = traits.some(Boolean) ? (
    <div className="su-mast-id">
      {pilot.motto.trim() !== '' && (
        <div className="su-mast-id__motto">
          <p className="su-mast-id__label">
            {buildSheetCopy('motto')}
            {usedChip('motto', 'motto')}
          </p>
          <p className="su-mast-id__quote">{`\u201c${pilot.motto.trim()}\u201d`}</p>
        </div>
      )}
      <Facts
        facts={[traits[1], traits[2]].map((fact) => (fact ? { ...fact, wide: false } : fact))}
      />
    </div>
  ) : undefined
  return (
    <>
      {phone && (
        <PinnedVitals
          label={buildSheetCopy('unitVitals', { name: pilot.name })}
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
        identity={phone ? undefined : identity}
        view={<SheetViewSwitch view={view} onChange={setView} count={allActions.length} />}
      />
      {view === 'actions' ? (
        <ActionsLedger actions={allActions} />
      ) : (
        <Dash>
          <DashColumn wide label={buildSheetCopy('abilities')}>
            <DashGroup title={buildSheetCopy('abilities')}>
              {/* The class's trees side by side, as the class page prints them (R48). */}
              <div className="su-trees">
                {model.classTrees.map((group) => (
                  <OpenLedger
                    key={group.tree}
                    className="su-open--sub"
                    as="h4"
                    title={group.tree}
                    note={group.track ? TRACK_NOTE[group.track] : undefined}
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
              {(generic.length > 0 || model.unresolvedAbilities.length > 0) && (
                <OpenLedger
                  className="su-open--sub su-open--generic"
                  as="h4"
                  title={buildSheetCopy('generic')}
                  columns={ABILITY_COLUMNS}
                  groups={[
                    {
                      key: 'generic',
                      // MOCK: the fold's words belong in the message catalogue.
                      label: 'All Generic Abilities',
                      // Every pilot's: a line until it is asked for.
                      fold: 'closed' as const,
                      rows: generic.map((entry) => abilityRow(entry, used)),
                    },
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
                <div className="su-dash-slots">
                  <SlotGrid
                    used={model.slotsUsed}
                    cap={model.slotsCap}
                    label={buildSheetCopy(
                      model.overCapacity ? 'inventoryOverCapacity' : 'inventorySlotsFilled',
                      { used: model.slotsUsed, cap: model.slotsCap }
                    )}
                    readOnly
                  />
                </div>
              </div>
            )}
            <DashGroup title={buildSheetCopy('about')}>
              <Facts
                facts={[
                  // On a page the masthead carries these three (R59).
                  ...(phone ? traits : []),
                  {
                    key: 'appearance',
                    label: buildSheetCopy('appearance'),
                    value: pilot.appearance,
                    wide: true,
                  },
                  pilot.description
                    ? {
                        key: 'bio',
                        label: buildSheetCopy('bio'),
                        value: <Prose text={pilot.description} lines={5} />,
                        wide: true,
                      }
                    : null,
                ]}
              />
            </DashGroup>
            {linkedUnits}
          </DashColumn>
        </Dash>
      )}
      {companions}
    </>
  )
}
