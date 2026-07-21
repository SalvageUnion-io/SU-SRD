import type { Story } from '@ladle/react'
import { type ReactNode, useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { getChoices, SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../../stories/_harness'
import type { EntityStatus } from '../../shared/entityStatus'
import type { StatItem } from '../../shared/statsBarTypes'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { ReferenceEntityCard } from './ReferenceEntityCard'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Entity/Reference Entity Card',
}

/**
 * Real SRD entity lookup with a first-entry fallback (data drift safety) —
 * throws instead of silently rendering `undefined` if a schema is ever empty.
 */
function pick<T>(list: T[], predicate: (item: T) => boolean, schemaName: string): T {
  const found = list.find(predicate) ?? list[0]
  if (!found) throw new Error(`Reference Entity Card story: no ${schemaName} entities loaded`)
  return found
}

// Real SRD entities — one per schema in the brief. Each falls back to the
// schema's first entry if the named lookup ever comes up empty (data drift), so
// the story never renders blank.
const ability = pick(
  SalvageUnionReference.Abilities.all(),
  (a) => a.name === 'Auto-Turret',
  'ability'
)
const system = pick(
  SalvageUnionReference.Systems.all(),
  (s) => s.name === 'Salvaging Drill',
  'system'
)
const chassis = pick(
  SalvageUnionReference.Chassis.all(),
  (c) => c.name === 'Little Sestra',
  'chassis'
)
const bioTitan = pick(
  SalvageUnionReference.BioTitans.all(),
  (b) => b.name === 'Scylla',
  'bio-titan'
)
const crawler = pick(
  SalvageUnionReference.Crawlers.all(),
  (c) => c.name === 'Engineering',
  'crawler'
)
const equipment = pick(
  SalvageUnionReference.Equipment.all(),
  (e) => e.name === 'Grenade',
  'equipment'
)
// One real class per KIND, for the class-kind stamp story: a plain base class,
// a hybrid (which also carries the "Requires <tree> or <tree>" sub-header line),
// and the Salvager — the dataset's only non-advanceable class.
const baseClass = pick(SalvageUnionReference.Classes.all(), (c) => c.name === 'Soldier', 'class')
const hybridClass = pick(SalvageUnionReference.Classes.all(), (c) => c.name === 'Cyborg', 'class')
const nonAdvanceableClass = pick(
  SalvageUnionReference.Classes.all(),
  (c) => c.name === 'Salvager',
  'class'
)
// A real crawler bay (schema `crawler-bays`) — Command Bay has content + a crew NPC.
const crawlerBay = pick(
  SalvageUnionReference.CrawlerBays.all(),
  (b) => b.name === 'Command Bay',
  'crawler bay'
)
// Custom Sniper Rifle carries the Weapon Type + Modification choices AND a
// `perTechLevel` Damage datavalue — the choice + TL-scaling subject.
const choiceEquip = pick(
  SalvageUnionReference.Equipment.all(),
  (e) => e.name === 'Custom Sniper Rifle',
  'choice equipment'
)
// Auto-Turret (the equipment, distinct from the ability above) carries BOTH a
// freeform choice (Name) and a table choice (A.I. Personality, a rollTable) —
// both now render INLINE in the body (Stage 7).
const freeformEquip = pick(
  SalvageUnionReference.Equipment.all(),
  (e) => e.name === 'Auto-Turret',
  'freeform choice equipment'
)

// One of Little Sestra's patterns — drives the PATTERN rendering (chassis-name
// stampseal + the systems/modules loadout).
const surveyorPattern = pick(
  chassis.patterns ?? [],
  (pat) => pat.name === 'Surveyor',
  'Little Sestra pattern'
)

const nameOf = (e: SURefEntity): string => String((e as { name?: unknown }).name ?? '')
const idOf = (e: SURefEntity): string => String((e as { id?: unknown }).id ?? nameOf(e))

/** One entity rendered as the canonical card. */
function One({ entity }: { entity: SURefEntity }): ReactNode {
  return (
    <div className="flex flex-col gap-4 p-4">
      <ReferenceEntityCard data={entity} />
    </div>
  )
}

/**
 * Comparison frame: the canonical card read-only (the baseline) and the same
 * card with the write layer engaged. Each block is captioned so the diff is
 * obvious at a glance. Stacked by default; `sideBySide` grids the pair for
 * wide multi-entity sweeps.
 */
function Compare({
  label,
  sideBySide,
  readOnly,
  editable,
}: {
  label?: string
  sideBySide?: boolean
  readOnly: ReactNode
  editable: ReactNode
}): ReactNode {
  return (
    <div className="flex flex-col gap-2 p-4">
      {label && (
        <div className="font-cond text-sm font-bold uppercase tracking-caps-tight text-rust">
          {label}
        </div>
      )}
      <div className={sideBySide ? 'grid grid-cols-1 gap-4 lg:grid-cols-2' : 'flex flex-col gap-6'}>
        <div className="flex flex-col gap-1">
          <Caption>read-only</Caption>
          {readOnly}
        </div>
        <div className="flex flex-col gap-1">
          <Caption>editable</Caption>
          {editable}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- *
 * READ-ONLY / APPEARANCE — the canonical card per schema, plus the gallery,
 * catalog-tile, pattern and badge renderings.
 * ------------------------------------------------------------------------- */

export const AbilityCard: Story = () => <One entity={ability} />
export const SystemCard: Story = () => <One entity={system} />
export const ChassisCard: Story = () => <One entity={chassis} />
export const BioTitanCard: Story = () => <One entity={bioTitan} />
export const CrawlerCard: Story = () => <One entity={crawler} />
export const EquipmentCard: Story = () => <One entity={equipment} />
export const CrawlerBayCard: Story = () => <One entity={crawlerBay} />

export const Gallery: Story = () => (
  <div className="flex flex-col gap-10 p-4">
    {[ability, system, chassis, bioTitan, crawler, equipment, crawlerBay].map((entity) => (
      <ReferenceEntityCard key={idOf(entity)} data={entity} />
    ))}
  </div>
)

/**
 * CATALOG — the SRD index tile. Compact, artwork + description ONLY: no nested
 * entities, actions, choices, patterns or roll tables, so a listing page reads
 * uniformly whatever each entity happens to carry. Compare against Gallery
 * above: the chassis drops its pattern list, the crawler bay drops its choice.
 */
export const Catalog: Story = () => (
  <div className="grid gap-4 p-4 md:grid-cols-2">
    {[ability, system, chassis, bioTitan, crawler, equipment, crawlerBay].map((entity) => (
      <ReferenceEntityCard key={idOf(entity)} data={entity} size="medium" extent="catalog" />
    ))}
  </div>
)

/**
 * CLASS KIND — every pilot class stamps WHICH KIND it is in the seam, derived
 * from the flags already in the data (`hybrid`, `advanceable`): BASE, HYBRID, or
 * NON-ADVANCEABLE (the Salvager, alone — it advances into nothing). A HYBRID
 * additionally names the two ability trees it advances from in the sub-header
 * row, joined by **"or"**: a pilot qualifies through ONE of them, not both.
 *
 * The second grid is the same three at `extent="catalog"`. The kind stamp is the
 * one piece of chrome that DELIBERATELY survives the catalog suppression — a
 * reader scanning the class index needs to know a hybrid is unavailable at
 * creation before they open anything.
 */
export const ClassKinds: Story = () => (
  <div className="flex flex-col gap-6 p-4">
    <Caption>full cards — base / hybrid / non-advanceable</Caption>
    <div className="flex flex-col gap-10">
      {[baseClass, hybridClass, nonAdvanceableClass].map((entity) => (
        <ReferenceEntityCard key={idOf(entity)} data={entity} />
      ))}
    </div>
    <Caption>catalog tiles — the kind stamp survives</Caption>
    <div className="grid gap-4 md:grid-cols-3">
      {[baseClass, hybridClass, nonAdvanceableClass].map((entity) => (
        <ReferenceEntityCard key={idOf(entity)} data={entity} size="medium" extent="catalog" />
      ))}
    </div>
  </div>
)

/**
 * PATTERN rendering — the pattern is the subject: the chassis name ("Little
 * Sestra") rides the seam as a stampseal, and the pattern's systems + modules
 * render as nested compact cards. Distinct from the basic ChassisCard above,
 * which shows the overview (ability + a pattern LIST).
 */
export const PatternCard: Story = () => (
  <div className="flex flex-col gap-4 p-4">
    <code className="font-body text-nano text-ink-2">
      {chassis.name} · {surveyorPattern.name}
    </code>
    <ReferenceEntityCard data={chassis} pattern={surveyorPattern} />
  </div>
)

/**
 * BADGE MODE (`size="small" extent="head"`) — the shortform token: a single tone-filled pill
 * with the type stamp, the name, and the classification tail. Gear/chassis show
 * `TL <n>`, abilities show `<Tree> · L<n>`, actions carry the "Action" stamp and
 * no tail. The whole entity collapses to one line, tone-coloured like the card.
 */
export const BadgeMode: Story = () => (
  <div className="flex flex-wrap items-start gap-3 p-4">
    <ReferenceEntityCard data={chassis} size="small" extent="head" />
    <ReferenceEntityCard data={system} size="small" extent="head" />
    <ReferenceEntityCard data={ability} size="small" extent="head" />
  </div>
)

/* ------------------------------------------------------------------------- *
 * WRITE LAYER — the same card with interactivity engaged (selection, status,
 * stat steppers, suggestion, multi-select, TL scaling). Read-only baseline on
 * top of each comparison.
 * ------------------------------------------------------------------------- */

/**
 * A SELECTABLE wizard chassis: the poster double-halo + a `Select` control +
 * whole-card click. The editable column adds the halo (box-shadow,
 * non-layout-shifting) and card-click affordance via a typed control.
 */
export const SelectableChassis: Story = () => {
  const [selected, setSelected] = useState(false)
  const toggle = () => setSelected((s) => !s)
  return (
    <Compare
      readOnly={<ReferenceEntityCard data={chassis} />}
      editable={
        <ReferenceEntityCard
          data={chassis}
          selected={selected}
          onCardClick={toggle}
          controls={[
            {
              key: 'select',
              label: selected ? 'Selected' : 'Select',
              onClick: toggle,
              ariaLabel: selected ? 'Deselect' : 'Select',
              variant: 'primary',
            },
          ]}
        />
      }
    />
  )
}

/**
 * A SHEET ITEM with a status cycle: the Intact → Damaged → Destroyed chip in the
 * header stat axis. A damaged/destroyed status greys the whole tone.
 */
export const StatusCycleItem: Story = () => {
  const [status, setStatus] = useState<EntityStatus>('intact')
  const cycle = () =>
    setStatus((s) => (s === 'intact' ? 'damaged' : s === 'damaged' ? 'destroyed' : 'intact'))
  return (
    <Compare
      readOnly={<ReferenceEntityCard data={system} />}
      editable={<ReferenceEntityCard data={system} status={status} onStatusClick={cycle} />}
    />
  )
}

/**
 * EDITABLE SP/EP steppers: a live mech sheet card. The header stat axis carries
 * SP + EP `StatItem`s with `onChange`, which render the `Stat` edit-mode
 * +/- stepper column. Legacy has no multi-stat editable path, so its column is
 * the plain reference card.
 */
export const EditableStats: Story = () => {
  const [sp, setSp] = useState(15)
  const [ep, setEp] = useState(8)
  const stats: StatItem[] = [
    { key: 'sp', label: 'SP', value: sp, outOfMax: 15, onChange: setSp },
    { key: 'ep', label: 'EP', value: ep, outOfMax: 8, onChange: setEp },
  ]
  return (
    <Compare
      readOnly={<ReferenceEntityCard data={chassis} />}
      editable={<ReferenceEntityCard data={chassis} statsOverride={stats} />}
    />
  )
}

/**
 * SUGGESTED — a rust "Suggested" stamp leading the sub-header, marking a
 * recommended pick (replaces the old `subtitleExtra` Pill).
 */
export const SuggestedItem: Story = () => (
  <Compare
    readOnly={<ReferenceEntityCard data={system} size="medium" />}
    editable={<ReferenceEntityCard data={system} size="medium" suggested />}
  />
)

/**
 * MULTI-SELECT — a duplicate-allowed picker cell. `onCountChange` renders a
 * "Chosen" seal + `[− n +]` CountStepper riding the top-right frame; `count ≥ 1`
 * lights the rust selection ring. The step buttons never trigger a card click.
 */
export const MultiSelectCard: Story = () => {
  const [count, setCount] = useState(0)
  return (
    <Compare
      readOnly={<ReferenceEntityCard data={system} size="medium" />}
      editable={
        <ReferenceEntityCard
          data={system}
          size="medium"
          count={count}
          onCountChange={setCount}
          cardClickLabel={system.name ?? undefined}
        />
      }
    />
  )
}

/**
 * TL-SCALING equipment (Custom Sniper Rifle): the host's tech level — supplied
 * from without via `scalingParent` (the crawler level in ITUN) — drives the
 * Modification cap AND the `perTechLevel` Damage datavalue. The header TL shows
 * the effective level with a rust `modified` border when above base.
 */
export const TechLevelScaling: Story = () => {
  const [selections, setSelections] = useState<ChoiceSelections>({})
  return (
    <Compare
      readOnly={
        // Controlled from without: TL3 supplied, Damage 2→4 (rust border).
        <ReferenceEntityCard data={choiceEquip} scalingParent={{ techLevel: 3 }} />
      }
      editable={
        // The same host TL with the choice write layer engaged: the Modification
        // cap follows the scaled level.
        <ReferenceEntityCard
          data={choiceEquip}
          selections={selections}
          onSelectionChange={setSelections}
          scalingParent={{ techLevel: 3 }}
        />
      }
    />
  )
}

/* ------------------------------------------------------------------------- *
 * CHOICE RENDERING — how player choices render inline in the body (Stage 7)
 * and how the self-action folds (Stage 6). The single-entity stories show the
 * mechanics; the data-driven sweeps below cover EVERY affected entity in the
 * live dataset, so nothing is hand-listed and new affected entities appear
 * automatically.
 * ------------------------------------------------------------------------- */

/**
 * CHOICE-GRANTING equipment (Custom Sniper Rifle): the Weapon Type and
 * Modification choices render inline in the body in BOTH modes — read-only shows
 * every option solid (readable), editable makes them selectable (dim-until-chosen
 * + a "Chosen" stampseal, with the Modification cap counter).
 */
export const ChoiceEquipment: Story = () => {
  const [selections, setSelections] = useState<ChoiceSelections>({})
  return (
    <Compare
      readOnly={<ReferenceEntityCard data={choiceEquip} />}
      editable={
        <ReferenceEntityCard
          data={choiceEquip}
          selections={selections}
          onSelectionChange={setSelections}
        />
      }
    />
  )
}

/**
 * EVERYTHING INLINE (Auto-Turret, Stage 7). Both choices render in the body, at
 * their prose, in BOTH modes — nothing is hoisted to the sub-header:
 *  · Name (source.kind 'text') → a free-text field (read-only shows the value).
 *  · A.I. Personality (source.kind 'table') → its prose + an expandable
 *    "A.I. Personality Table" (a real RollTable with a Roll control), NOT the old
 *    bare text box that cited a table it never showed.
 * The sub-header keeps only the facet hoist (traits) — no "Choose | Name" cell.
 */
export const InlineChoices: Story = () => {
  const [selections, setSelections] = useState<ChoiceSelections>({})
  return (
    <Compare
      readOnly={<ReferenceEntityCard data={freeformEquip} />}
      editable={
        <ReferenceEntityCard
          data={freeformEquip}
          selections={selections}
          onSelectionChange={setSelections}
        />
      }
    />
  )
}

const hasChoices = (e: SURefEntity): boolean => (getChoices(e) ?? []).length > 0

const isSelfActionMulti = (e: SURefEntity): boolean => {
  const actions = (e as { actions?: unknown }).actions
  const name = (e as { name?: unknown }).name
  return (
    Array.isArray(actions) &&
    actions.length > 1 &&
    typeof name === 'string' &&
    actions.includes(name)
  )
}

/** read-only vs editable, side-by-side, for one choice-bearing entity. */
function ChoiceCompare({ entity }: { entity: SURefEntity }): ReactNode {
  const [selections, setSelections] = useState<ChoiceSelections>({})
  return (
    <div className="border-b border-ink/10 pb-6">
      <Compare
        label={nameOf(entity)}
        sideBySide
        readOnly={<ReferenceEntityCard data={entity} />}
        editable={
          <ReferenceEntityCard
            data={entity}
            selections={selections}
            onSelectionChange={setSelections}
          />
        }
      />
    </div>
  )
}

/** Every entity that renders player choices (Stage 7), read-only vs editable. */
export const ChoiceEntities: Story = () => {
  const entities = [
    ...SalvageUnionReference.Equipment.all(),
    ...SalvageUnionReference.Drones.all(),
    ...SalvageUnionReference.CrawlerBays.all(),
  ].filter((e) => hasChoices(e as SURefEntity)) as SURefEntity[]
  return (
    <div className="flex flex-col gap-6 p-4">
      <p className="max-w-prose font-body text-xs text-ink-2">
        {entities.length} choice-bearing entities. Stage 7 — choices render inline (no sub-header
        hoist); a table choice (A.I. Personality) shows its prose + an expandable RollTable, a text
        choice a field, options/catalog as cards. read-only shows every option solid; editable is
        choosable.
      </p>
      {entities.map((e) => (
        <ChoiceCompare key={idOf(e)} entity={e} />
      ))}
    </div>
  )
}

/** Every multi-action entity whose self-action now folds (Stage 6). */
export const CollapseEntities: Story = () => {
  const entities = [
    ...SalvageUnionReference.Systems.all(),
    ...SalvageUnionReference.Modules.all(),
    ...SalvageUnionReference.Abilities.all(),
    ...SalvageUnionReference.Equipment.all(),
  ].filter((e) => isSelfActionMulti(e as SURefEntity)) as SURefEntity[]
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="max-w-prose font-body text-xs text-ink-2">
        {entities.length} multi-action entities carrying a same-named action. Stage 6 — the
        self-action now folds into the card body regardless of count; every other action (Patch,
        System Repair, Project…) renders as its own card below.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {entities.map((e) => (
          <div key={idOf(e)} className="flex flex-col gap-1">
            <Caption>{nameOf(e)}</Caption>
            <ReferenceEntityCard data={e} />
          </div>
        ))}
      </div>
    </div>
  )
}
