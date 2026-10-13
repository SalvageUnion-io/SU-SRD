import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { getChoices, SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { borderWidth, color, font, fontSize, space, tracking, weight } from '../../../design/tokens'
import { Mention } from '../../../entity/forms/Mention'
import { PeekCard } from '../../../entity/PeekCard'
import { PEEK_PLATE } from '../../../entity/peekPlate'
import type { Story } from '../../../stories/_harness'
import { Caption } from '../../../stories/_harness'
import type { EntityStatus } from '../../atoms/entityStatus'
import type { StatItem } from '../../containers/statsBarTypes'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { PatternHrefProvider } from '../entityHrefContext'
import { ReferenceEntityCard } from './ReferenceEntityCard'

export default {
  title: 'Compositions/Entity/Reference Entity Card',
}

/** A column of blocks, `gap` apart, optionally padded. */
const stack = (gap: string, padding?: string): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap,
  padding,
})

/** A grid whose columns come from a `.su-story-*` class (they change with width). */
const grid = (gap: string, padding?: string): CSSProperties => ({ display: 'grid', gap, padding })

const LABEL = {
  fontFamily: font.cond,
  fontSize: fontSize.sm,
  lineHeight: '1.25rem',
  fontWeight: weight.bold,
  textTransform: 'uppercase',
  letterSpacing: tracking.capsTight,
  color: color.ink,
} satisfies CSSProperties

const CODE = {
  fontFamily: font.body,
  fontSize: fontSize.badge,
  color: color.wkMuted,
} satisfies CSSProperties

const ROW = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: space[12],
  padding: space[16],
} satisfies CSSProperties

const RULED = {
  borderBottom: `${borderWidth.hairline} solid ${color.ink10}`,
  paddingBottom: space[24],
} satisfies CSSProperties

const NOTE = {
  maxWidth: '65ch',
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: '1rem',
  color: color.wkMuted,
} satisfies CSSProperties

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

// The Mule's Hauler — one of the five patterns the book tags `legalStarting`,
// which stamps "Legal Starting Pattern" in the header beside the chassis marker.
const muleChassis = pick(SalvageUnionReference.Chassis.all(), (c) => c.name === 'Mule', 'chassis')
const haulerPattern = pick(
  muleChassis.patterns ?? [],
  (pat) => pat.name === 'Hauler',
  'Mule legal starting pattern'
)

const nameOf = (e: SURefEntity): string => e.name
const idOf = (e: SURefEntity): string => e.id

/** One entity rendered as the canonical card. */
function One({ entity }: { entity: SURefEntity }): ReactNode {
  return (
    <div style={stack(space[16], space[16])}>
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
    <div style={stack(space[8], space[16])}>
      {label && <div style={LABEL}>{label}</div>}
      <div
        className={sideBySide ? 'su-story-pair' : undefined}
        style={sideBySide ? grid(space[16]) : stack(space[24])}
      >
        <div style={stack(space[4])}>
          <Caption>read-only</Caption>
          {readOnly}
        </div>
        <div style={stack(space[4])}>
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
  <div style={stack(space[40], space[16])}>
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
  <div className="su-story-grid-2" style={grid(space[16], space[16])}>
    {[ability, system, chassis, bioTitan, crawler, equipment, crawlerBay].map((entity) => (
      <ReferenceEntityCard key={idOf(entity)} data={entity} size="medium" extent="catalog" />
    ))}
  </div>
)

/**
 * CLASS KIND — every pilot class stamps WHICH KIND it is in its header labels, derived
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
  <div style={stack(space[24], space[16])}>
    <Caption>full cards — base / hybrid / non-advanceable</Caption>
    <div style={stack(space[40])}>
      {[baseClass, hybridClass, nonAdvanceableClass].map((entity) => (
        <ReferenceEntityCard key={idOf(entity)} data={entity} />
      ))}
    </div>
    <Caption>catalog tiles — the kind stamp survives</Caption>
    <div className="su-story-grid-3" style={grid(space[16])}>
      {[baseClass, hybridClass, nonAdvanceableClass].map((entity) => (
        <ReferenceEntityCard key={idOf(entity)} data={entity} size="medium" extent="catalog" />
      ))}
    </div>
  </div>
)

/**
 * PATTERN rendering — the pattern is the subject: the chassis name ("Little
 * Sestra") leads the header as a stampseal, and the pattern's systems + modules
 * render as nested compact cards. Distinct from the basic ChassisCard above,
 * which shows the overview (ability + a pattern LIST).
 */
export const PatternCard: Story = () => (
  <div style={stack(space[16], space[16])}>
    <code style={CODE}>
      {chassis.name} · {surveyorPattern.name}
    </code>
    <ReferenceEntityCard data={chassis} pattern={surveyorPattern} />
    {/* A `legalStarting`-tagged pattern adds the "Legal Starting Pattern" stamp
        to the header labels, right of the chassis marker — full card and listing row
        alike (the row is what the chassis page's Patterns list renders). */}
    <code style={CODE}>
      {muleChassis.name} · {haulerPattern.name} (legal starting — full + listing)
    </code>
    <ReferenceEntityCard data={muleChassis} pattern={haulerPattern} />
    <ReferenceEntityCard data={muleChassis} pattern={haulerPattern} size="medium" extent="head" />
  </div>
)

/**
 * BADGE MODE (`size="small" extent="head"`) — the shortform token: a single tone-filled pill
 * with the type stamp, the name, and the classification tail. Gear/chassis show
 * `TL <n>`, abilities show `<Tree> · L<n>`, actions carry the "Action" stamp and
 * no tail. The whole entity collapses to one line, tone-coloured like the card.
 */
export const BadgeMode: Story = () => (
  <div style={ROW}>
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
 * +/- stepper column.
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
 * SUGGESTED — an ink "Suggested" stamp leading the sub-header, marking a
 * recommended pick.
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
 * lights the selection ring. The step buttons never trigger a card click.
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
        // Controlled from without: TL3 supplied, Damage 2→4 (modified border).
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
  const actions = 'actions' in e ? e.actions : undefined
  const name = e.name
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
    <div style={RULED}>
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
  ].filter((e) => hasChoices(e))
  return (
    <div style={stack(space[24], space[16])}>
      <p style={NOTE}>
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
  ].filter((e) => isSelfActionMulti(e))
  return (
    <div style={stack(space[16], space[16])}>
      <p style={NOTE}>
        {entities.length} multi-action entities carrying a same-named action. Stage 6 — the
        self-action now folds into the card body regardless of count; every other action (Patch,
        System Repair, Project…) renders as its own card below.
      </p>
      <div className="su-story-pair" style={grid(space[16])}>
        {entities.map((e) => (
          <div key={idOf(e)} style={stack(space[4])}>
            <Caption>{nameOf(e)}</Caption>
            <ReferenceEntityCard data={e} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- *
 * ONE ANATOMY, TWO FILLS (boards E1–E4) — the whole matrix the issue
 * gates on: every size × extent cell, things you have and things you do, a
 * depth-3 stack, every context and the user-made flag. Style objects only.
 * ------------------------------------------------------------------------- */

const juryRig = pick(SalvageUnionReference.Abilities.all(), (a) => a.name === 'Jury Rig', 'ability')
const sestraDrone = pick(
  SalvageUnionReference.Drones.all(),
  (d) => d.name === 'Sestra Drone',
  'drone'
)
const SIZES = ['large', 'medium', 'small'] as const
const EXTENTS = ['full', 'head', 'catalog'] as const

/**
 * One row per size; inside a row the extents sit side by side and stack when
 * narrow. A large cell keeps a page column's measure (32rem) before it stacks,
 * so it is never judged at a medium card's width.
 */
const matrixRow = (size: (typeof SIZES)[number]) =>
  ({
    display: 'grid',
    gap: '16px 24px',
    gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${size === 'large' ? 32 : 20}rem), 1fr))`,
  }) as const

/** One cell per row, at a readable measure: every device can be checked. */
const singleRow = {
  display: 'grid',
  gap: '24px',
  gridTemplateColumns: 'minmax(0, 40rem)',
} as const

/** Every size × extent cell of one entity — the same component, different props. */
function Matrix({
  entity,
  label,
  userMade = false,
  oneCellPerRow = false,
  madeBy,
}: {
  entity: Parameters<typeof ReferenceEntityCard>[0]['data']
  label: string
  userMade?: boolean
  /** Stack every cell on its own row instead of three extents to a row. */
  oneCellPerRow?: boolean
  madeBy?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', padding: '16px' }}>
      <Caption>{label}</Caption>
      {SIZES.map((size) => (
        <div key={size} style={oneCellPerRow ? singleRow : matrixRow(size)}>
          {EXTENTS.map((extent) => (
            <div
              key={extent}
              style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}
            >
              <Caption>
                {size} · {extent}
              </Caption>
              <ReferenceEntityCard
                data={entity}
                size={size}
                extent={extent}
                userMade={userMade}
                madeBy={madeBy ?? (userMade ? 'Rook' : undefined)}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Board E1 — a thing you HAVE: the tone header, ink speckle, value cells. */
export const SizeByExtent: Story = () => <Matrix entity={system} label="Salvaging Drill" />

/** Board E1 — a thing you DO: the ink banner, tier numeral, cost pennant. */
export const SizeByExtentDo: Story = () => <Matrix entity={juryRig} label="Jury Rig" />

/*
 * Each matrix cell on its own, so a phone-width capture shows one card the
 * width of the frame (`?story=…--size-by-extent-medium-head&mode=canvas&width=phone`).
 * Ids: `size-by-extent-<size>-<extent>`, `size-by-extent-do-…`, `user-made-…`.
 */
function cell(
  entity: Parameters<typeof ReferenceEntityCard>[0]['data'],
  size: (typeof SIZES)[number],
  extent: (typeof EXTENTS)[number],
  userMade = false
): Story {
  return () => (
    <div style={{ padding: '16px' }}>
      <ReferenceEntityCard
        data={entity}
        size={size}
        extent={extent}
        userMade={userMade}
        madeBy={userMade ? 'alxjrvs' : undefined}
      />
    </div>
  )
}

export const SizeByExtentLargeFull = cell(system, 'large', 'full')
export const SizeByExtentLargeHead = cell(system, 'large', 'head')
export const SizeByExtentLargeCatalog = cell(system, 'large', 'catalog')
export const SizeByExtentMediumFull = cell(system, 'medium', 'full')
export const SizeByExtentMediumHead = cell(system, 'medium', 'head')
export const SizeByExtentMediumCatalog = cell(system, 'medium', 'catalog')
export const SizeByExtentSmallFull = cell(system, 'small', 'full')
export const SizeByExtentSmallHead = cell(system, 'small', 'head')
export const SizeByExtentSmallCatalog = cell(system, 'small', 'catalog')

export const SizeByExtentDoLargeFull = cell(juryRig, 'large', 'full')
export const SizeByExtentDoLargeHead = cell(juryRig, 'large', 'head')
export const SizeByExtentDoLargeCatalog = cell(juryRig, 'large', 'catalog')
export const SizeByExtentDoMediumFull = cell(juryRig, 'medium', 'full')
export const SizeByExtentDoMediumHead = cell(juryRig, 'medium', 'head')
export const SizeByExtentDoMediumCatalog = cell(juryRig, 'medium', 'catalog')
export const SizeByExtentDoSmallFull = cell(juryRig, 'small', 'full')
export const SizeByExtentDoSmallHead = cell(juryRig, 'small', 'head')
export const SizeByExtentDoSmallCatalog = cell(juryRig, 'small', 'catalog')

/**
 * Board E2 — the depth stack. Little Sestra (depth 0, large) → its drone, no
 * tray (depth 1, medium; its description hidden because the Drone
 * Controller above already says it) → the drone's system as a one-line head
 * row (depth 2) that opens the entity. Then the same drone mounted at depth 2
 * full (its actions behind a "Show N actions" chip) and at depth 3, where
 * MAX_DEPTH stops it expanding.
 */
export const DepthStack: Story = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '16px' }}>
    <Caption>depth 0 → 1 → 2</Caption>
    <ReferenceEntityCard data={chassis} />
    <Caption>depth 2, full — actions fold behind the chip</Caption>
    <ReferenceEntityCard data={system} size="medium" depth={2} />
    <Caption>depth 3 — MAX_DEPTH: renders, never expands</Caption>
    <ReferenceEntityCard data={sestraDrone} size="medium" depth={3} />
  </div>
)

const panel = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  minWidth: 0,
} as const

/** The Dashboard card: flat, the same footer as every context, each inline action's pennant the button. */
function DashboardCard() {
  return (
    <div style={{ backgroundColor: 'var(--color-ink-deep)', padding: '16px' }}>
      <ReferenceEntityCard
        data={system}
        size="medium"
        texture={false}
        actionControls={(action) => [
          {
            key: 'activate',
            pennant: true,
            label: 'Activate',
            onClick: () => {},
            ariaLabel: `Activate ${'name' in action ? action.name : 'action'}`,
          },
        ]}
      />
    </div>
  )
}

/**
 * Outlines the pennant button's invisible hit area for the catalog only: the
 * dashed box is the 44px target (ruleset §4.6) around the pennant it carries.
 */
const HIT_AREA_OUTLINE = `.story-hit-areas .su-ec-pennant-btn {
  outline: 1px dashed var(--color-paper);
  outline-offset: -1px;
}`

/**
 * Board E3 — the five contexts. Geometry never changes; the context decides
 * materials, density and interactivity, through the controls API.
 */
export const Contexts: Story = () => {
  const [status, setStatus] = useState<EntityStatus>('intact')
  return (
    <div
      style={{
        display: 'grid',
        gap: '24px',
        gridTemplateColumns: 'repeat(auto-fill, minmax(20rem, 1fr))',
        padding: '16px',
      }}
    >
      <div style={panel}>
        <Caption>Reference · large · full</Caption>
        <ReferenceEntityCard data={system} />
      </div>
      <div style={panel}>
        <Caption>Live sheet · medium · full</Caption>
        <ReferenceEntityCard
          data={system}
          size="medium"
          status={status}
          onStatusClick={() =>
            setStatus((s) =>
              s === 'intact' ? 'damaged' : s === 'damaged' ? 'destroyed' : 'intact'
            )
          }
          controls={[
            {
              key: 'remove',
              label: 'Remove',
              ariaLabel: 'Remove Salvaging Drill',
              variant: 'danger',
              onClick: () => {},
            },
          ]}
        />
      </div>
      <div style={panel}>
        <Caption>Dashboard · medium · full — flat, each band's pennant is the button</Caption>
        <DashboardCard />
      </div>
      <div style={panel}>
        <Caption>Dashboard · the pennants' 44px hit areas, outlined — no deck button</Caption>
        <style>{HIT_AREA_OUTLINE}</style>
        <div className="story-hit-areas">
          <DashboardCard />
        </div>
      </div>
      <div style={panel}>
        <Caption>Listing · medium · head — one line, one click</Caption>
        <ReferenceEntityCard data={system} size="medium" extent="head" onCardClick={() => {}} />
        <ReferenceEntityCard data={chassis} size="medium" extent="head" onCardClick={() => {}} />
        <Caption>in prose: the shortform</Caption>
        <ReferenceEntityCard data={system} size="small" extent="head" />
      </div>
      {/* The whole row. The Peek is portaled over the page, so it would sit
          on the Listing rows and the in-prose pill above: the cell lays the
          same plate out IN FLOW, under a Mention that still opens the real
          Peek on hover (the catalog mounts the page's PeekHost). */}
      <div style={{ ...panel, gridColumn: '1 / -1' }}>
        <Caption>Peek · the compact card on its plate — lifted, terminal and flat</Caption>
        <p style={{ fontSize: '14px', margin: 0 }}>
          …then mount the <Mention entityRef={toEntityModel(system).ref}>Salvaging Drill</Mention>{' '}
          and roll.
        </p>
        <div style={{ ...PEEK_PLATE, maxWidth: 'min(500px, 100%)', paddingBottom: '4px' }}>
          <PeekCard entity={system} />
        </div>
      </div>
    </div>
  )
}

/**
 * The user-made flag (ruleset §3.9) at every size × extent: a
 * dashed frame, a dashed User-made stamp, a dashed footer rule and a dashed
 * pill, and a footer that credits the maker ("Made by alxjrvs") in place of the
 * page citation. One simple entity, one cell per row, so each device can be
 * checked.
 */
export const UserMade: Story = () => (
  <Matrix
    entity={system}
    label="Salvaging Drill · user-made"
    userMade
    madeBy="alxjrvs"
    oneCellPerRow
  />
)

export const UserMadeLargeFull = cell(system, 'large', 'full', true)
export const UserMadeLargeHead = cell(system, 'large', 'head', true)
export const UserMadeLargeCatalog = cell(system, 'large', 'catalog', true)
export const UserMadeMediumFull = cell(system, 'medium', 'full', true)
export const UserMadeMediumHead = cell(system, 'medium', 'head', true)
export const UserMadeMediumCatalog = cell(system, 'medium', 'catalog', true)
export const UserMadeSmallFull = cell(system, 'small', 'full', true)
export const UserMadeSmallHead = cell(system, 'small', 'head', true)
export const UserMadeSmallCatalog = cell(system, 'small', 'catalog', true)

// The board-07 chassis: art, a chassis ability and five patterns.
const gopher = pick(SalvageUnionReference.Chassis.all(), (c) => c.name === 'Gopher', 'chassis')

/** Pattern rows link out on the SRD; here every row opens nowhere. */
const storyPatternHref = () => '#patterns'

/**
 * PAGE — the card as an SRD entity page's body (`presentation="page"`, boards
 * 07 and 08). No frame, header or footer: the page's chapter band and
 * foot band carry the title and the citation. The line art is the hero; beside
 * it the chassis ability, the prose and the book's stat column; the patterns
 * run full width as link rows. An ability has no art, so it reads as one
 * column. Narrow the viewport for the phone order: art, stats, prose, ability.
 */
export const PagePresentation: Story = () => (
  <PatternHrefProvider value={storyPatternHref}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '48px', maxWidth: '75rem' }}>
      <div>
        <Caption>chassis — Gopher</Caption>
        <ReferenceEntityCard data={gopher} presentation="page" />
      </div>
      <div>
        <Caption>pattern — the Gopher's first, on its own page</Caption>
        <ReferenceEntityCard data={gopher} pattern={gopher.patterns?.[0]} presentation="page" />
      </div>
      <div>
        <Caption>ability — no art, one reading column</Caption>
        <ReferenceEntityCard data={ability} presentation="page" />
      </div>
    </div>
  </PatternHrefProvider>
)
