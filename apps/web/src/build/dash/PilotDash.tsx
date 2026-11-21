/**
 * PilotDash — a pilot's sheet as a dashboard, in the order the printed sheet
 * is used at the table. Read and Edit are this one layout (R11): Edit adds
 * its controls in place, never a second form.
 *
 *   The strip: the portrait, HP, AP and Training Points, then the
 *     inventory's slots; the once-a-Downtime traits beside them and About.
 *     Edit: the portrait takes a new one, each max is a field (Free Edit),
 *     Conditions are written, and the identity fields stand where Read
 *     typesets them.
 *   What they know: the class's trees as the class page draws them (R48),
 *     the taken abilities in ink with their rules, the rest greyed, a
 *     header line each. Edit: Manage Abilities, and each taken ability's
 *     Spend AP and Used.
 *   What they carry: the Inventory, then any Generic abilities taken, then
 *     their assigned units. Edit: Manage Equipment, each item's condition,
 *     Uses, Details and ✕, and the adder for a carried thing of the table's.
 */

import type { Pilot } from 'game-domain/schemas/pilot'
import type { ReactNode } from 'react'
import type { RefAbility, RefMetaEntity } from 'salvageunion-reference'
import { CONDITION_LABELS, toEntityModel } from 'salvageunion-reference'
import {
  Conditions,
  Facts,
  Prose,
  SlotGrid,
  STRIP_ART,
  Strip,
  StripFigure,
} from '../../components/app'
import type { LedgerColumn, LedgerRow } from '../../components/index'
import {
  AbilityTrack,
  Button,
  capsLabel,
  Ledger,
  SlabSection,
  Stat,
  TechLevel,
} from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import { cn } from '../../lib/cn'
import { classArt } from '../../lib/photos/defaultArt'
import { cycleCondition } from '../../lib/rules/mechItems'
import {
  equipmentMaxUses,
  equipmentSlotCost,
  genericEntrySlots,
  resolveEquipment,
} from '../../lib/rules/pilotInventory'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import type { UnitsStore } from '../../replica/units'
import { ChipListEditor } from '../sheet/ChipListEditor'
import { CONDITION_DRAFT } from '../sheet/chipWell.model'
import type { UsedTraitKey } from '../sheet/PilotIdentity'
import { PilotIdentityPanel, UsedChip } from '../sheet/PilotIdentity'
import { AbilityMenu, GenericEntryAdder, PilotAbilityItem } from '../sheet/PilotSheetItems'
import type { PilotPicker } from '../sheet/PilotSheetPickers'
import type { AbilityEntry, AbilityTreeGroup, PilotSheetModel } from '../sheet/pilotSheet.model'
import { inventoryEmpty } from '../sheet/pilotSheet.model'
import type { PilotSheetActions } from '../sheet/pilotSheetActions.model'
import { ConditionStep, EquipmentDetails, SheetRemoveButton, UsesStep } from '../sheet/rowControls'
import { Cost } from './Cost'
import { Dash, DashColumn, DashGroup } from './Dash'
import { pilotVitalRows } from './pilotVitalRows.model'
import { RowRules } from './RowRules'

/** A caps label: the condensed face in capitals (ruleset §3.12). */
const CAPS = capsLabel({ weight: 'inherit', tracking: 'inherit' })

const ABILITY_COLUMNS: readonly LedgerColumn[] = [
  { key: 'action', label: buildSheetCopy('action'), kind: 'text' },
  {
    key: 'cost',
    label: buildSheetCopy('cost'),
    title: buildSheetCopy('activationCost'),
    phone: true,
  },
]

/** An item's slots as cargo chips, one a slot (a Heavy item's two). */
const slotChips = (slots: number) => (
  <SlotGrid
    size="mini"
    used={slots}
    cap={slots}
    label={slots === 1 ? buildSheetCopy('oneSlot') : buildSheetCopy('slotCount', { count: slots })}
  />
)

const GEAR_COLUMNS: readonly LedgerColumn[] = [
  { key: 'tl', label: buildSheetCopy('tl'), title: buildSheetCopy('techLevel'), phone: true },
  { key: 'slots', label: buildSheetCopy('slots'), phone: true },
  // A Uses count is a column, not a chip on the name (L4); Edit steps it in place.
  { key: 'uses', label: buildSheetCopy('uses'), phone: true },
]

/**
 * One tree on its track under a slab naming it, as the class page draws it
 * (`ClassAbilityTree`, R48): each ability its Mini, the taken ones in ink with
 * their rules, the rest greyed, header-only, in Read and Edit alike.
 */
function TreeTrack({
  group,
  render,
}: {
  group: AbilityTreeGroup
  render: (entry: AbilityEntry) => ReactNode
}) {
  const byId = new Map(group.abilities.map((entry) => [entry.ability.id, entry]))
  const track = group.track ?? 'core'
  return (
    // A tree's name is a heading under its group's (`DashGroup`'s h2); the
    // Minis on its track hold none (N3).
    <SlabSection
      as="h3"
      title={group.tree}
      count={track === 'legendary' ? buildSheetCopy('chooseOne') : undefined}
      size="mini"
      className="su-ability-tree__group"
      bodyClassName="su-ability-tree__track"
    >
      <AbilityTrack
        abilities={group.abilities.map((entry) => entry.ability)}
        track={track}
        renderAbility={(ability: RefAbility) => {
          const entry = byId.get(ability.id)
          return entry ? render(entry) : null
        }}
      />
    </SlabSection>
  )
}

type PilotDashProps = {
  pilot: Pilot
  model: PilotSheetModel
  actions: PilotSheetActions
  /** The viewer may write it, so HP, AP, Training Points and the Used marks step in Read (R11). */
  live: boolean
  /** Edit: the same dashboard with its controls in place. */
  edit?: boolean
  /** Opens a collection's picker (Edit's Manage). */
  onManage?: (picker: PilotPicker) => void
  /** Where an item's choices are saved (Edit's Details). */
  store: UnitsStore
  /** Related units, companions included (R70): under the strip on a phone, else heading the side column. */
  linkedUnits?: ReactNode
  /** A phone: the groups stacked, the About clamped shorter. */
  phone: boolean
}

export function PilotDash({
  pilot,
  model,
  actions,
  live,
  edit = false,
  onManage,
  store,
  linkedUnits,
  phone,
}: PilotDashProps) {
  const writes = live || edit
  const vitals = pilotVitalRows({ pilot, model, actions, writes, edit })
  const used = pilot.usedAbilities ?? []
  const foot = edit ? (
    <>
      <span className={cn('su-strip__foot-label', CAPS)}>{buildSheetCopy('conditions')}</span>
      <ChipListEditor
        items={pilot.conditions}
        onChange={actions.handleConditionsChange}
        noun="condition"
        draftWidth={CONDITION_DRAFT}
        unique
      />
    </>
  ) : pilot.conditions.length > 0 ? (
    <>
      <span className={cn('su-strip__foot-label', CAPS)}>{buildSheetCopy('conditions')}</span>
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
      perRow={3}
    />
  )
  const art = (
    <EntityPhoto
      photo={pilot.photo}
      fallback={classArt(pilot.classRef)}
      name={pilot.callsign || pilot.name}
      frame={STRIP_ART}
      onChange={
        edit
          ? (photo) => store.getState().update('pilot', pilot.id, { photo }, LIVE_SHEET_MANUAL)
          : undefined
      }
    />
  )

  /** A taken ability, in ink with its rules; an untaken one greyed, no controls (R48). */
  const renderAbility = ({ slug, ability, unlearned }: AbilityEntry) => (
    <div key={slug} className={unlearned ? 'su-pilot-ability--unlearned' : undefined}>
      <PilotAbilityItem
        ability={ability}
        currentAP={model.ap}
        used={used.includes(slug)}
        onSpend={actions.handleSpendAP}
        onToggleUsed={(next) => actions.handleAbilityUsedChange(slug, next)}
        readOnly={!edit || !!unlearned}
        full={!unlearned}
      />
    </div>
  )
  const takenAny =
    model.classTrees.some((group) => group.abilities.some((entry) => !entry.unlearned)) ||
    model.unresolvedAbilities.length > 0

  const generic = model.genericAbilities.filter((entry) => !entry.unlearned)
  const genericRows: LedgerRow[] = generic.map((entry) => {
    const ability = toEntityModel(entry.ability)
    const action = ability.actionType === 'DownTime' ? 'Downtime' : (ability.actionType ?? '')
    const isUsed = used.includes(entry.slug)
    return {
      id: entry.slug,
      name: ability.title,
      entityRef: ability.ref,
      meta: action === '' ? undefined : <span className="su-open__phone-only">{action}</span>,
      stamp: isUsed && !edit ? <Stat size="mini" label={buildSheetCopy('used')} /> : undefined,
      controls: edit ? (
        <AbilityMenu
          ability={entry.ability}
          currentAP={model.ap}
          used={isUsed}
          onSpend={actions.handleSpendAP}
          onToggleUsed={(next) => actions.handleAbilityUsedChange(entry.slug, next)}
        />
      ) : undefined,
      cells: [action, ability.cost ? <Cost key="cost" cost={ability.cost} /> : ''],
      detail: <RowRules entity={entry.ability} />,
    }
  })

  const gear: LedgerRow[] = [
    ...model.ordinaryEquipment.map((slug): LedgerRow => {
      const entity = resolveEquipment(slug)
      const condition = pilot.equipmentConditions?.[slug] ?? 'intact'
      const usesLeft = pilot.equipmentUses?.[slug]
      const maxUses = equipmentMaxUses(entity)
      const selections = pilot.equipmentChoices?.[slug]
      // The player's item: its picks and the crawler's Tech Level change its
      // Range, Damage and traits, as its card does (R60).
      const instance = {
        condition,
        ...(selections ? { selections } : {}),
        ...(typeof model.scalingParent?.techLevel === 'number'
          ? { techLevel: model.scalingParent.techLevel }
          : {}),
      }
      const chosen = Object.values(selections ?? {})
        .flat()
        .filter((value): value is string => typeof value === 'string')
      // R59: gear an ability grants prints its rules under the ability alone.
      const granted = model.granted.has(slug) || (pilot.abilities ?? []).includes(slug)
      const item = entity ? toEntityModel(entity, instance) : undefined
      const level = item?.facts.find((fact) => fact.key === 'tech-level')?.value
      const name = entity?.name ?? slug
      const hasChoices = Array.isArray(entity?.choices) && (entity?.choices.length ?? 0) > 0
      const chips = chosen.map((picked) => (
        <Stat key={picked} size="mini" label={buildSheetCopy('chosen')} value={picked} />
      ))
      return {
        id: slug,
        name,
        entityRef: item?.ref,
        meta: entity ? undefined : buildSheetCopy('unknown'),
        stamp: edit ? (
          chips.length > 0 ? (
            chips
          ) : undefined
        ) : condition !== 'intact' || chips.length > 0 ? (
          <>
            {condition !== 'intact' && (
              <Stat size="mini" label={CONDITION_LABELS[condition]} state="critical" />
            )}
            {chips}
          </>
        ) : undefined,
        controls: edit ? (
          <>
            <ConditionStep
              name={name}
              condition={condition}
              onCycle={() =>
                runWrite(() =>
                  actions.handleEquipmentConditionChange(slug, cycleCondition(condition))
                )
              }
            />
            {maxUses !== null && (
              <UsesStep
                name={name}
                remaining={usesLeft ?? maxUses}
                max={maxUses}
                onChange={(next) => actions.handleUsesChange(slug, next)}
              />
            )}
            {entity && hasChoices && (
              <EquipmentDetails
                slug={slug}
                equipment={entity as RefMetaEntity & { name: string }}
                pilotId={pilot.id}
                seed={selections}
                scalingParent={model.scalingParent}
                store={store}
              />
            )}
            {!model.granted.has(slug) && (
              <SheetRemoveButton name={name} onRemove={() => actions.toggleEquipment(slug)} />
            )}
          </>
        ) : undefined,
        cells: [
          entity ? <TechLevel key="tl" level={level ?? entity.techLevel} /> : '',
          slotChips(equipmentSlotCost(entity)),
          !edit && maxUses !== null ? `${usesLeft ?? maxUses}/${maxUses}` : '',
        ],
        dim: condition === 'destroyed',
        detail: entity && !granted ? <RowRules entity={entity} instance={instance} /> : undefined,
      }
    }),
    ...model.genericInventory.map(
      (entry, index): LedgerRow => ({
        id: entry.id,
        name: entry.qty && entry.qty > 1 ? `${entry.name} ×${entry.qty}` : entry.name,
        meta: entry.note,
        cells: ['', slotChips(genericEntrySlots(entry)), ''],
        controls: edit ? (
          <SheetRemoveButton
            name={entry.name}
            onRemove={() =>
              actions.handleGenericInventoryChange(
                model.genericInventory.filter((_, i) => i !== index)
              )
            }
          />
        ) : undefined,
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
  // The masthead's right column is About (the Bio, clamped, with More;
  // Appearance under it). Motto, Keepsake and Background, each with its
  // once-a-Downtime Used mark, are short lines on the figures' rail. Edit
  // writes all of them in the same place: the identity fields.
  const identity = edit ? (
    <PilotIdentityPanel
      pilot={pilot}
      onToggleUsed={actions.toggleUsed}
      patch={actions.patchPilot}
    />
  ) : pilot.description || pilot.appearance.trim() !== '' ? (
    <div className="su-mast-id">
      {pilot.description && (
        <div className="su-mast-id__about">
          <p className={cn('su-mast-id__label', CAPS)}>{buildSheetCopy('about')}</p>
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
  const traitLines =
    !edit && traits.some(Boolean) ? (
      <Facts
        className="su-mast-traits"
        itemClassName="su-mast-trait"
        labelClassName="su-mast-id__label"
        facts={traits}
      />
    ) : undefined
  const manage = (picker: PilotPicker, label: string) =>
    edit && onManage ? (
      <Button size="compact" onClick={() => onManage(picker)}>
        {label}
      </Button>
    ) : undefined
  const empty = inventoryEmpty(pilot, model)
  return (
    <>
      <Strip
        label={buildSheetCopy('unitVitals', { name: pilot.name })}
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
        <DashColumn wide label={buildSheetCopy('abilities')}>
          {(takenAny || edit) && (
            <DashGroup
              title={buildSheetCopy('abilities')}
              actions={manage('abilities', buildSheetCopy('manageAbilities'))}
            >
              {!takenAny && (
                <p className="su-dash-quiet">{buildSheetCopy('noAbilitiesLearnedYet')}</p>
              )}
              {/* The class's trees side by side, as the class page prints them (R48). */}
              {model.classTrees.length > 0 && (
                <div className="su-pilot-trees" data-form="track">
                  {model.classTrees.map((group) => (
                    <TreeTrack key={group.tree} group={group} render={renderAbility} />
                  ))}
                </div>
              )}
              {model.unresolvedAbilities.length > 0 && (
                <Ledger
                  open
                  className="su-open--sub su-open--generic"
                  as="h3"
                  title={buildSheetCopy('unknownAbilities')}
                  columns={ABILITY_COLUMNS}
                  groups={[
                    {
                      key: 'unknown',
                      rows: model.unresolvedAbilities.map((slug) => ({
                        id: slug,
                        name: slug,
                        meta: buildSheetCopy('unknown'),
                        cells: ['', ''],
                        controls: edit ? (
                          <SheetRemoveButton
                            name={slug}
                            onRemove={() => actions.toggleAbility(slug)}
                          />
                        ) : undefined,
                      })),
                    },
                  ]}
                />
              )}
            </DashGroup>
          )}
        </DashColumn>
        <DashColumn label={buildSheetCopy('whatCarries', { name: pilot.name })}>
          {!phone && linkedUnits}
          {(!empty || edit) && (
            <div className="su-dash-group" data-sheet-carried="">
              <Ledger
                open
                as="h2"
                title={buildSheetCopy('inventory')}
                note={
                  <SlotGrid
                    size="mini"
                    perRow={3}
                    used={model.slotsUsed}
                    cap={model.slotsCap}
                    readOnly={!edit}
                    label={buildSheetCopy('inventorySlotsFilled', {
                      used: model.slotsUsed,
                      cap: model.slotsCap,
                    })}
                  />
                }
                actions={manage('equipment', buildSheetCopy('manageEquipment'))}
                columns={GEAR_COLUMNS}
                groups={[{ key: 'gear', rows: gear }]}
                empty={buildSheetCopy('nothingCarried')}
              />
              {edit && (
                <GenericEntryAdder
                  onAdd={(entry) =>
                    actions.handleGenericInventoryChange([...model.genericInventory, entry])
                  }
                />
              )}
            </div>
          )}
          {generic.length > 0 && (
            // Every pilot's Generic Abilities are a table of the side column,
            // under Inventory: a row each, header only, opening its rules in place.
            <div className="su-dash-group">
              <Ledger
                open
                as="h2"
                title={buildSheetCopy('genericAbilities')}
                columns={ABILITY_COLUMNS}
                groups={[{ key: 'generic', rows: genericRows }]}
              />
            </div>
          )}
        </DashColumn>
      </Dash>
    </>
  )
}
