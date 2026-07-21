import type { ReactNode } from 'react'
import type {
  SURefEntity,
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectBonusPerTechLevel,
  SURefObjectChoice,
  SURefObjectContentBlock,
  SURefObjectDamage,
  SURefObjectPattern,
  SURefObjectTrait,
} from 'salvageunion-reference'
import {
  extractVisibleActions,
  getAssetUrl,
  getBooklet,
  getChassisAbilities,
  getChoices,
  getPageReference,
  getReferenceEntityName,
  getSource,
  getTechLevel,
  getTraits,
  isAbility,
  parseContentBlockString,
  resolveActivationCurrency,
  resolveChoiceView,
  resolveDataValueForTechLevel,
  resolveGrantedEntities,
} from 'salvageunion-reference'
import { isSchemaOnlyCatalogChoice } from 'salvageunion-reference/rules'
import { cn } from '../../../utils/cn'
import type { EntityStatus } from '../../shared/entityStatus'
import { type CardExtent, type CardSize, resolveCardDisplay } from '../../shared/displayMode'
import { FOCUS_RING, activateOnKey } from '../../chrome/interaction'
import { Slab } from '../../chrome/Slab'
import { Badge } from '../../chrome/Badge'
import { CountStepper } from '../../chrome/CountStepper'
import { STAMP_SEAM } from '../../chrome/stampSeam'
import { ActivationCost } from '../../shared/ActivationCost'
import { CardImage } from '../../shared/CardImage'
import { CardControlRail } from '../../shared/CardControlRail'
import { foldStatusControl } from '../../shared/foldStatusControl'
import type { CardFootMeta } from '../../shared/DisplayCard'
import { Stat } from '../../shared/Stat'
import type { StatItem } from '../../shared/statsBarTypes'
import { Content } from '../Content'
import { ChoiceGroups } from '../choiceCard/ChoiceGroups'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { getChoiceSourceKind } from '../choiceCard/choiceSelectionHelpers'
import type { ReferenceEntityControl } from '../ReferenceEntityDisplay/referenceEntityControlTypes'
import { accentDeepColor, accentSurface, borderColorFromHeaderBg } from '../referenceEntityHelpers'
import { buildReferenceEntityStats } from '../ReferenceEntityDisplay/referenceEntityStatsConfig'
import { CatalogChoiceListing } from './CatalogChoiceListing'
import { anchorBonusMarker, anchorChoiceMarkers } from './choiceAnchoring'
import { firstParagraphText } from './firstParagraphText'
import { EntityCardHeader } from './EntityCardHeader'
import { EntityCardIdentityFooter } from './EntityCardIdentityFooter'
import { EntityCardSubHeader } from './EntityCardSubHeader'
import type { EntityCardSubHeaderCell } from './EntityCardSubHeader'
import { resolveFoldedAction } from './resolveFoldedAction'
import { stripHostParenthetical } from './stripHostParenthetical'
import {
  ghostActionTone,
  resolveAxisMarkers,
  resolveCardTone,
  resolveEyebrow,
  titleSizeClass,
} from './entityCardTone'
import type { AxisMarker } from './entityCardTone'
import {
  resolveChassisDrone,
  resolveDroneOwnLoadout,
  resolveNestedEntities,
  resolvePatternDrone,
  resolvePatternGroups,
} from './resolveNestedEntities'

/** Beyond this nesting depth a card renders header-only (no body expansion) —
 * bounds runaway recursion (deep chassis → systems → actions, or grant cycles). */
const MAX_DEPTH = 3

/** A titanic action (bio-titan "Titanic Actions") — gets its own full-width row. */
function isTitanicAction(action: { name?: string }): boolean {
  return /titanic action/i.test(action.name ?? '')
}

/** FLAT-mode wrapper: when the body has a left ANCHOR (image / floated NPC),
 * each nested card wraps in a `flow-root` block so it flows beside the float,
 * then full width once past it; non-flat renders the card bare (its own key on
 * the card). ONE helper so the five flat/non-flat call sites can't drift. */
function wrapFlat(flat: boolean, key: string | undefined, card: ReactNode): ReactNode {
  if (!flat) return card
  return (
    <div key={key} className="mb-1.5 flow-root">
      {card}
    </div>
  )
}

export type ReferenceEntityCardProps = {
  data: SURefEntity
  size?: CardSize
  /** How much of the entity renders — orthogonal to `size`, so a `small` card
   * can still show its whole content. */
  extent?: CardExtent
  /** Nesting level — 0 = full/solo, ≥1 = nested (compact, no footer, smaller
   * header, one step down per level). Threaded through the recursion. */
  depth?: number
  /** A parent-provided stampseal prepended to the seam (before the entity's own
   * type stamp), in a distinct tone — lets a group brand its nested cards
   * (e.g. GRANTS) without a separator row. */
  parentSeal?: { label: string; tone: string }
  /** CHASSIS TWO-RENDERINGS: when set (with a chassis `data`), the card renders
   * the PATTERN view — pattern name as the title, the pattern's systems/modules
   * loadout as nested cards (a `size="medium" extent="head"` pattern shows name + description). */
  pattern?: SURefObjectPattern
  /** The SUMMONING (parent) entity's tone as a resolvable CSS colour — threaded
   * onto a nested ACTION card, whose bands are this tone GHOSTED. */
  hostTone?: string
  /** The SUMMONING (parent) entity's display name — threaded alongside
   * `hostTone` so a nested ACTION whose dataset name carries the ` (Host)`
   * disambiguation suffix (e.g. "Refine (Nanite Sifter)") drops it when the
   * host card already establishes that context. Display-only; the data keeps
   * the full unique name. */
  hostName?: string
  /** The parent is damaged/destroyed — threaded down so every nested card in the
   * subtree gets the same grey treatment as the damaged parent. */
  hostDown?: boolean
  /** The owning chassis's name — threaded down so `[(CHASSIS)]` tokens in nested
   * ability/drone/pattern content resolve to the chassis name. */
  chassisName?: string
  /** A DRONE card's systems/modules loadout, resolved by the parent (chassis
   * uses the drone's own loadout; a pattern uses its pattern-specific config).
   * Rendered as listings INSIDE this drone card, never at the parent level. */
  droneLoadout?: { systems: SURefEntity[]; modules: SURefEntity[] }

  // ─── WRITE LAYER (all additive — absent ⇒ read-only is byte-identical) ───
  /** Render guards that SUBTRACT already-rendered sections. */
  hide?: ReferenceEntityCardHideConfig
  /** Intact/Damaged/Destroyed chip in the header stat axis beside the title.
   * A damaged/destroyed status also greys the whole tone (header band flat
   * grey; sub-header + footer + frame the darker grey shade). */
  status?: EntityStatus
  /** Cycle handler (Intact → Damaged → Destroyed) — makes the chip a button. */
  onStatusClick?: () => void
  /** Whole-card opacity-50 (an unavailable/inactive item). */
  disabled?: boolean
  /** Draw the canonical rust selection border (SELECTION_RING) — non-layout-shifting. */
  selected?: boolean
  /** When `selected`, stamp this label as an `ok`-tone "chosen" seal riding the
   * top-right frame (e.g. "Equipped ✓"). Picker-cell affordance. */
  selectionSeal?: string
  /** A rust "Suggested" stamp leading the sub-header — a recommended pick. */
  suggested?: boolean
  /** MULTI-SELECT: the chosen quantity. With `onCountChange` present the card
   * renders a "Chosen" seal + `[− n +]` `CountStepper` overlay (mutually
   * exclusive with the single-select `selectionSeal`), and `count >= 1` reads as
   * selected (rust ring) unless `selected` is set explicitly. */
  count?: number
  /** MULTI-SELECT: emit the next chosen quantity (already clamped by the caller).
   * Its presence turns the card into a duplicate-allowed multi-select cell. */
  onCountChange?: (next: number) => void
  /** When off in a picker: dim + desaturate (opacity-50 saturate-50). */
  selectable?: boolean
  /** Whole-card click → role=button + hover-enlarge + focus ring. */
  onCardClick?: () => void
  /** Enable the hover-enlarge/role=button affordance without a click handler. */
  cardClickable?: boolean
  /**
   * Selection a11y for a whole-card toggle (picker cells). When set alongside
   * `selected` + a card click, the interactive wrapper announces the selection
   * state natively: `'toggle'` → `role="button"` + `aria-pressed`, `'radio'` →
   * `role="radio"` + `aria-checked` (pair with a `role="radiogroup"` parent).
   * Navigation/add cards leave it unset and stay a plain `role="button"`.
   */
  selectionRole?: 'toggle' | 'radio'
  /** Accessible name for the interactive wrapper (e.g. the entity name), so a
   * whole-card toggle reads as its title instead of its full text content. */
  cardClickLabel?: string
  /** Top-right overlay controls (reuse ControlButtons shapes/variants). */
  controls?: ReferenceEntityControl[]
  /** Controlled interactive-choice state (renders `ChoiceGroups` in the body). */
  selections?: ChoiceSelections
  /** Selection-change handler — its presence flips choices to editable body cards. */
  onSelectionChange?: (selections: ChoiceSelections) => void
  /** Parent entity for choice-cap resolution (`scalesWithField`, e.g. techLevel) —
   * when a host (mech/pilot) supplies the scaling field instead of the entity.
   * Its `techLevel` also drives `perTechLevel` datavalue scaling (e.g. Custom
   * Sniper Rifle damage) — the crawler level in ITUN. */
  scalingParent?: Record<string, unknown>
  /** Extra content on the accent field after the body box, before the footer
   * (legacy `expand` — e.g. a crawler bay's crew inset). */
  expand?: ReactNode

  // ─── SLOT OVERRIDES (generic extension seams — additive) ───
  titleOverride?: string
  titleSlot?: ReactNode
  statsOverride?: StatItem[]
  primaryStatsOnly?: boolean
  subtitleExtra?: ReactNode
  abilitiesSection?: ReactNode
  afterExtraContent?: ReactNode
  afterChoicesContent?: ReactNode
  footerOverride?: ReactNode
  /** Write-layer: inline `[label value]` meta pairs (cost / SV) folded into the
   * identity footer's right side, before the source/page. */
  footMeta?: CardFootMeta[]
  /** Overrides the header's top-right flavor slot. */
  rightContent?: ReactNode
  /** Callout stamp above the frame. */
  label?: string
  className?: string
  /** Extra className on the card root (legacy `cardStyle`, e.g. the
   * removable-card treatment). `className` alone covers the same case. */
  cardStyle?: { className?: string }
  /** SEO: render the title as an `h1` (item pages) instead of the default `span`. */
  titleAs?: 'span' | 'h1'
}

/** Write-layer: which already-rendered sections to suppress (additive guards). */
export type ReferenceEntityCardHideConfig = {
  actions?: boolean
  patterns?: boolean
  damagedEffect?: boolean
  choices?: boolean
  stats?: boolean
  content?: boolean
  footer?: boolean
}

/** The action-shaped fields the card reads when `schemaName === 'actions'`. */
type ActionFields = {
  range?: string[]
  damage?: SURefObjectDamage
  traits?: SURefObjectTrait[]
  activationCost?: string | number
  actionType?: string
  actionSource?: SURefEnumSchemaName | 'actions'
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1)
}

/** Entity/action traits → sub-header cells: "Explosive (1)" → label "Explosive"
 * value "1"; "Immobile" → label only. */
function traitCells(traits: SURefObjectTrait[]): EntityCardSubHeaderCell[] {
  return traits.map((trait) => ({
    key: `trait-${trait.type}`,
    label: capitalize(trait.type),
    value: trait.amount != null ? String(trait.amount) : undefined,
  }))
}

/** Normalize an action type into its display label: "Turn" → "Turn Action";
 * "Passive"/"Reaction"/anything already containing "action" stays as-is. */
function formatActionType(type: string): string {
  const lower = type.toLowerCase()
  if (lower.includes('action') || lower === 'passive' || lower === 'reaction') return type
  return `${type} Action`
}

/** An action's classification + range / damage / traits as sub-header cells. The
 * action TYPE leads (a label-only cell), then range/damage/traits. The EP/AP
 * cost is the sub-header's `leading` node, rendered before all of these. */
function actionCells(action: ActionFields): EntityCardSubHeaderCell[] {
  const cells: EntityCardSubHeaderCell[] = []
  if (action.actionType) {
    cells.push({ key: 'action-type', label: formatActionType(action.actionType) })
  }
  if (action.range && action.range.length > 0) {
    cells.push({ key: 'range', label: 'Range', value: action.range.join(' / ') })
  }
  if (action.damage) {
    cells.push({
      key: 'damage',
      label: 'Damage',
      value: `${action.damage.amount}${action.damage.damageType ?? ''}`,
    })
  }
  if (action.traits) cells.push(...traitCells(action.traits))
  return cells
}

/** `bonusPerTechLevel` fields → "+N" vertical stat boxes (zeros/absent dropped).
 * The label splits top/bottom around the value: [field, TOP word, BOTTOM word]
 * (e.g. "Structure" / "Points"), the same two-line treatment as "Tech" / "Level". */
const BONUS_LABELS: [keyof SURefObjectBonusPerTechLevel, string, string][] = [
  ['structurePoints', 'Structure', 'Points'],
  ['energyPoints', 'Energy', 'Points'],
  ['heatCapacity', 'Heat', 'Capacity'],
  ['systemSlots', 'System', 'Slots'],
  ['moduleSlots', 'Module', 'Slots'],
  ['cargoCapacity', 'Cargo', 'Capacity'],
  ['salvageValue', 'Salvage', 'Value'],
]

type BonusCell = { key: string; label: string; bottomLabel: string; value: string }

function bonusCells(bonus: SURefObjectBonusPerTechLevel): BonusCell[] {
  return BONUS_LABELS.flatMap(([field, top, bottom]) => {
    const amount = bonus[field]
    return typeof amount === 'number' && amount !== 0
      ? [{ key: `bonus-${field}`, label: top, bottomLabel: bottom, value: `+${amount}` }]
      : []
  })
}

/**
 * ReferenceEntityCard — the ONE card that renders ENTITIES, ACTIONS, and
 * NPCs, driven by two parameters:
 *
 * - **TONE** (what it is): domain hue for entities, tech-level blue for gear,
 *   navy for actors/NPCs, and RUST for actions. Header band = the tone;
 *   sub-header + footer = a darker shade.
 * - **DEPTH** (nesting level): 0 = full/solo (large name-tab, footer, full
 *   body); ≥1 = nested (compact, no footer, header font steps down one rung per
 *   level, body shows nested groups).
 *
 * Every card has the same bands: seam (type stamp + axis pills) · header (black
 * name-tab + stats/AP axis) · sub-header (Stat cells only) · body ·
 * footer (depth 0 only). Nested groups (Grants/Systems/Modules/Drones/NPCs/
 * Actions) each render a `Slab` separator + a 2-up grid of depth+1 cards;
 * actions are rust, always compact, AP via `ActivationCost`.
 */
function ReferenceEntityCardInner({
  data,
  size: sizeProp = 'large',
  extent = 'full',
  depth: depthProp = 0,
  parentSeal,
  pattern,
  hostTone,
  hostName,
  hostDown,
  chassisName,
  droneLoadout,
  hide: hideProp,
  status,
  onStatusClick,
  disabled,
  selected: selectedProp,
  selectionSeal,
  suggested,
  count,
  onCountChange,
  selectable,
  onCardClick,
  cardClickable,
  selectionRole,
  cardClickLabel,
  controls,
  selections,
  onSelectionChange,
  titleOverride,
  titleSlot,
  statsOverride,
  primaryStatsOnly,
  subtitleExtra,
  abilitiesSection,
  afterExtraContent,
  afterChoicesContent,
  footerOverride,
  footMeta,
  rightContent: rightContentProp,
  label,
  className,
  cardStyle,
  titleAs,
  scalingParent,
  expand,
}: ReferenceEntityCardProps) {
  // MULTI-SELECT: a card driven by `onCountChange` reads as selected whenever its
  // chosen quantity is ≥ 1, unless `selected` is set explicitly. Single-select
  // cards keep passing `selected` directly (unchanged).
  const countValue = count ?? 0
  const isMultiSelect = !!onCountChange
  const selected = selectedProp ?? (isMultiSelect ? countValue >= 1 : undefined)

  // `SalvageUnionReference.*.all()` entities carry a runtime `schemaName`
  // discriminant that isn't reflected in the static `SURefEntity` union type —
  // the same cast-at-the-boundary pattern used throughout the display system.
  const entity = data as SURefMetaEntity
  const schemaName = (
    'schemaName' in entity && typeof entity.schemaName === 'string' ? entity.schemaName : undefined
  ) as SURefEnumSchemaName | 'actions' | undefined

  if (!schemaName) {
    console.warn('ReferenceEntityCard: data does not have a schemaName property', data)
    return null
  }

  const isAction = schemaName === 'actions'
  // Actions are ALWAYS nested (never solo on their own SRD page), so an action
  // can only render compact or compact-listing — never full. Coerce a full-size
  // action to compact (min depth 1) so the full-size path can't be reached.
  const size: CardSize = isAction && sizeProp === 'large' ? 'medium' : sizeProp
  const depth = isAction ? Math.max(depthProp, 1) : depthProp
  // A NESTED NPC (one summoned by a parent that threaded `hostTone` down) is
  // dimmed the same way actions are — it ghosts the PARENT's tone, not its own
  // navy. A standalone/top-level NPC (no host tone) keeps its navy domain tone.
  const isNestedNpc = schemaName === 'npcs' && hostTone != null
  const isGhosted = isAction || isNestedNpc
  const compact = depth > 0 || size !== 'large'
  // CATALOG — the SRD index tile. Compact, artwork + description ONLY. Every
  // nested element is suppressed here rather than at each call-site, so a
  // listing page reads uniformly no matter what the entity happens to carry
  // (a chassis's patterns, an ability's grants, a crawler bay's roll table).
  // Nested ENTITIES/actions are cut via `canExpand` below; these flags cut the
  // in-body sections, layering over whatever the consumer passed.
  const isCatalog = extent === 'catalog'
  const hide: ReferenceEntityCardHideConfig | undefined = isCatalog
    ? { ...hideProp, actions: true, choices: true, patterns: true }
    : hideProp
  const tone = resolveCardTone(schemaName, entity)
  // ACTIONS and NESTED NPCs inherit the summoning (parent) entity's tone,
  // GHOSTED (D8): the header + sub-header bands + 3px frame use the ghosted host
  // tone; the body stays paper/ink. A standalone action (no host) falls back to
  // a neutral base.
  // DAMAGED/DESTROYED (write layer): grey the whole tone. The header goes flat
  // grey (ink half-mixed into paper — the same warm material at distance);
  // sub-header + footer + frame use the darker grey shade.
  const isDown = status === 'damaged' || status === 'destroyed' || !!hostDown
  const GREY_HEADER = 'color-mix(in srgb, var(--color-ink) 50%, var(--color-paper))'
  const GREY_DEEP = accentDeepColor(undefined, GREY_HEADER) ?? 'var(--color-ink)'
  const ghost = isGhosted ? ghostActionTone(hostTone ?? 'var(--color-ink)') : undefined
  // The ONE foreground for the header BAND. A solid-tone card — a real ENTITY or
  // a PATTERN — always reads WHITE (paper). Everything else goes by CONTRAST
  // against its actual band: the light-faded ghosted actions/NPCs and the
  // damaged-grey state all carry light bands, so contrast resolves to ink. Every
  // on-band text element (the title, the flavor hint) uses this.
  const onBandText = isDown || isGhosted ? 'text-ink' : 'text-paper'
  const darkTone = isDown
    ? GREY_DEEP
    : ghost
      ? ghost.sub
      : (accentDeepColor(tone.bg, tone.bgColor) ?? 'var(--color-ink)')
  const frameColor = isDown
    ? GREY_DEEP
    : ghost
      ? ghost.frame
      : (borderColorFromHeaderBg(tone.bg, tone.bgColor) ?? 'var(--color-ink)')
  // This entity's own tone base — threaded to its nested action cards as their host.
  const ownToneBase = borderColorFromHeaderBg(tone.bg, tone.bgColor) ?? 'var(--color-ink)'
  const techLevel = getTechLevel(entity)
  // EFFECTIVE TECH LEVEL — the value that scales this entity: the Modification
  // choice cap (`scalesWithField: techLevel`) AND any `perTechLevel` datavalue
  // (e.g. Custom Sniper Rifle damage). The host `scalingParent.techLevel`
  // (controlled from without — the crawler level in ITUN) wins over the entity's
  // own base TL. Floors at the base TL — a granted item is never below its own
  // tech level.
  // The "modified stats" colour — a choice-touched or TL-scaled cell gets a rust
  // border (and, for traits, a rust label ground).
  const MODIFIED = 'var(--color-rust)'
  const baseTechLevel = typeof techLevel === 'number' ? techLevel : undefined
  const scalingTechLevel =
    typeof scalingParent?.techLevel === 'number' ? (scalingParent.techLevel as number) : undefined
  const resolvedTechLevel = scalingTechLevel ?? baseTechLevel
  const effTechLevel =
    resolvedTechLevel !== undefined && baseTechLevel !== undefined
      ? Math.max(baseTechLevel, resolvedTechLevel)
      : resolvedTechLevel
  const entityChoices = getChoices(entity) ?? []
  // A `perTechLevel` map (datavalue label → per-level increment) from the entity's
  // OWN datavalues, so a scaled value is highlighted as "modified" (rust).
  const perTechLevelByLabel = new Map<string, number>()
  // A datavalue that scales per Tech Level (e.g. Custom Sniper/Missile Damage
  // "+1 SP per Tech Level") is ALSO a Bonus-per-Tech-Level box (label / +N / unit).
  const dataValueBonuses: BonusCell[] = []
  for (const block of 'content' in entity
    ? ((entity.content ?? []) as SURefObjectContentBlock[])
    : []) {
    if (Array.isArray(block.value)) {
      for (const dv of block.value) {
        if (typeof dv.perTechLevel === 'number' && dv.label != null) {
          const label = String(dv.label)
          perTechLevelByLabel.set(label.toLowerCase(), dv.perTechLevel)
          dataValueBonuses.push({
            key: `dvbonus-${label.toLowerCase()}`,
            label,
            bottomLabel: typeof dv.unit === 'string' ? dv.unit : '',
            value: `+${dv.perTechLevel}`,
          })
        }
      }
    }
  }
  const isTechScalable =
    perTechLevelByLabel.size > 0 ||
    entityChoices.some((c) => typeof c.constraints?.scalesWithField === 'string')
  // The header TL cell shows the EFFECTIVE level (base, or bumped by the
  // external `scalingParent` control).
  const techLevelDisplay = isTechScalable ? (effTechLevel ?? techLevel) : techLevel
  const techLevelModified =
    isTechScalable &&
    baseTechLevel !== undefined &&
    effTechLevel !== undefined &&
    effTechLevel > baseTechLevel
  const entityName = getReferenceEntityName(entity) ?? ('name' in entity ? String(entity.name) : '')
  // Title size steps down with depth; a solo COMPACT/LISTING card (depth 0) floors
  // to rung 1 (text-xl, not the full text-5xl) so "compact" actually compacts the
  // title. `full` keeps the depth-driven size (srd renders full → unaffected).
  // `small` steps the title down one further rung than `medium` — the size
  // axis, not the extent, is what drives the type ladder.
  const titleClass = titleSizeClass(
    size === 'large' ? depth : Math.max(depth, size === 'small' ? 2 : 1)
  )
  // ARTWORK — `getAssetUrl` yields the entity's `.webp` when `hasArtwork`; the
  // chassis art also stands in for its full PATTERN view (but not the tight
  // pattern-summary list rows).
  //
  // A MINI catalog tile drops the artwork entirely: the catalog extent is
  // artwork + description, and at the small size the image would crowd out the
  // description it exists to caption, leaving a tile that is all picture and no
  // label. Every other size keeps it.
  const isMiniCatalog = isCatalog && size === 'small'
  const assetUrl = isMiniCatalog ? undefined : getAssetUrl(entity)

  // PATTERN view — the pattern is the subject; the chassis (`entity`) supplies
  // stats / tone / source. Patterns carry NO stampseal. A `size="medium" extent="head"`
  // pattern is a LIST ROW: name-tab left, description on the header right.
  const isPattern = !!pattern
  const isPatternListing = isPattern && extent === 'head'
  // A pattern's title is its name in QUOTES — `"SURVEYOR"`. The word "Pattern"
  // is no longer carried in the data (chassis.json), so nothing to strip here.
  // A nested ACTION drops its ` (Host)` disambiguation suffix when the host is
  // this card's own context (display only — `entityName` keeps the full name).
  const name =
    titleOverride ??
    (isPattern
      ? `"${pattern.name}"`
      : isAction
        ? stripHostParenthetical(entityName, hostName)
        : entityName)
  const effectiveSeal = parentSeal
  // `[(CHASSIS)]` content tokens resolve to the owning chassis name — this card's
  // own name when it IS a chassis, else the name threaded down from the parent.
  const resolvedChassisName = chassisName ?? (schemaName === 'chassis' ? entityName : undefined)

  // SEAM — type stamp + axis pills. Actions show their action type; a pattern
  // reads "Pattern"; entities show the schema type + classification pills.
  const action = isAction ? (entity as ActionFields) : undefined
  // The "Titanic Actions" entry is a meta-descriptor for the titanic-action
  // SYSTEM, not a regular action — it suppresses the "Action" seam stamp and
  // shows its rules text as a header hint (not in the body).
  const isTitanicMeta = isAction && isTitanicAction(entity as { name?: string })
  // Actions AND patterns carry NO seam type stamp — an action's classification
  // lives in the sub-header row (see actionCells); patterns just show the name.
  // Entities show their schema type. On FULL cards the type moves to the footer
  // (see below), so the seam only shows it on NESTED cards.
  const seamType = isPattern || isAction ? undefined : resolveEyebrow(schemaName).type
  // The entity TYPE for the depth-0 footer (patterns read "Pattern"; actions
  // never render a depth-0 footer).
  const footerType = isAction ? undefined : isPattern ? 'Pattern' : resolveEyebrow(schemaName).type
  // A PATTERN names its owning chassis as a horizontal stat stampseal in the
  // seam — `[Chassis | Little Sestra]` — rather than a bare stampseal, so it
  // reads as the same `[label | value]` pill vocabulary as every other axis.
  // (On a pattern card the `entity` IS the chassis, so `resolvedChassisName`
  // is that chassis's own name.)
  const axisMarkers: AxisMarker[] = isAction
    ? []
    : isPattern
      ? resolvedChassisName
        ? [{ label: 'Chassis', value: resolvedChassisName }]
        : []
      : resolveAxisMarkers(entity)

  // The lone non-titanic action that FOLDS into this entity's body: its content
  // goes in the body, and its sub-header STATS (type/range/damage/cost) merge
  // into THIS entity's sub-header (so a single-action item like Grenade doesn't
  // lose "Turn Action · Range · Damage" the way inlining content alone would).
  const foldableActions =
    !isAction &&
    !isPattern &&
    depth < MAX_DEPTH &&
    !(isAbility(entity) && resolveGrantedEntities(entity as SURefEntity).length > 0)
      ? (extractVisibleActions(entity) ?? []).filter((a) => !isTitanicAction(a))
      : []
  // Fold the SELF-action (same-named) regardless of the entity's action count;
  // otherwise a lone action still folds its facets. Siblings render as their own
  // cards below (gridActions). See resolveFoldedAction for the full rule.
  const foldedAction = resolveFoldedAction(foldableActions, entityName)
  const foldedActionFields = foldedAction ? (foldedAction as unknown as ActionFields) : undefined

  const seam = (
    <div className={cn(STAMP_SEAM, 'left-[15px] flex items-center gap-1.5')}>
      {effectiveSeal && (
        <span
          className="inline-block w-fit border border-ink px-1 py-0.5 font-cond text-badge font-bold uppercase leading-none tracking-caps-tight text-paper"
          style={{ backgroundColor: effectiveSeal.tone, lineHeight: 1 }}
        >
          {effectiveSeal.label}
        </span>
      )}
      {/* Type stamp on NESTED cards only — full cards show the type in the footer. */}
      {depth > 0 && seamType && (
        <Badge shape="stamp" size="mini">
          {seamType}
        </Badge>
      )}
      {axisMarkers.map((marker) => (
        <Stat
          key={marker.label}
          orientation="horizontal"
          label={marker.label}
          value={marker.value}
          xs
        />
      ))}
    </div>
  )

  // HEADER axis — entities/patterns cluster their (chassis) stats; actions put
  // AP in the header; a pattern SUMMARY row shows none.
  // Stat LABELS are size-aware. Build with FULL labels (Structure / Points),
  // then abbreviate (SP, Cargo, …) ONLY on a compact/nested/listing card; a
  // non-compact card keeps the full labels (may wrap two lines, which is fine).
  const rawHeaderStats: StatItem[] =
    isAction || isPatternListing
      ? []
      : buildReferenceEntityStats(entity, {
          compact,
          primaryOnly: !!primaryStatsOnly || extent === 'head',
          schemaName: schemaName as SURefEnumSchemaName,
          techLevel,
        })
  // TECH LEVEL is a header headline stat (value box), NOT a seam pill — a
  // size-aware label ("Tech Level" full / "TL" compact), placed first in the
  // top-right cluster. `buildReferenceEntityStats` doesn't emit it, so add it.
  const techLevelStat: StatItem | undefined =
    !isAction && !isPatternListing && techLevel != null
      ? {
          key: 'tech-level',
          // Compact (horizontal) renders "Tech"; the full-size vertical value box
          // renders two-line "Tech" / "Level".
          label: 'Tech',
          bottomLabel: compact ? undefined : 'Level',
          value: String(techLevelDisplay),
          // A TL-scalable item shows the EFFECTIVE level; a rust `modified`
          // border when above base (controlled from without via `scalingParent`).
          ...(techLevelModified ? { state: 'modified' as const } : {}),
        }
      : undefined
  const headerStats: StatItem[] = [
    ...(techLevelStat ? [techLevelStat] : []),
    // ATOM MODEL: compact = horizontal cells + SHORTFORM labels (SP, TL, Cargo, …).
    // Non-compact = the vertical value box with FULL two-line labels — the
    // slotsRequired stat reads "Slots" / "Required".
    ...rawHeaderStats,
  ]

  const costSource = action ?? foldedActionFields
  const costNode: ReactNode =
    costSource?.activationCost != null ? (
      <ActivationCost
        cost={costSource.activationCost}
        currency={resolveActivationCurrency(costSource.actionSource)}
        compact={compact}
      />
    ) : undefined

  // SUGGESTED — a rust stamp that LEADS the sub-header row (before the cost box),
  // marking a recommended pick. Rust ground, paper text (the on-ink stamp's bg
  // overridden to rust via tailwind-merge).
  const suggestedNode: ReactNode = suggested ? (
    <Badge shape="stamp" size="mini" className="bg-rust text-paper">
      Suggested
    </Badge>
  ) : undefined
  // Compose the sub-header leading: the Suggested stamp first, then any cost box.
  const subHeaderLeading: ReactNode = suggestedNode ? (
    <>
      {suggestedNode}
      {costNode}
    </>
  ) : (
    costNode
  )

  // ABILITY flavor — the short description hint, shown WHITE in the header's
  // top-right (abilities have no numeric vitals, so the axis is free for it).
  const description =
    isAbility(entity) && typeof entity.description === 'string' ? entity.description : undefined
  // TITANIC: the intro paragraph becomes the top-right hint; the REMAINING
  // content blocks (the options list) render in the body.
  const titanicContent =
    isTitanicMeta && 'content' in entity
      ? (entity.content as SURefObjectContentBlock[] | undefined)
      : undefined
  const titanicIntro = titanicContent?.[0]
  const titanicIntroIsParagraph = titanicIntro?.type === 'paragraph'
  const titanicHintText =
    titanicIntro && titanicIntroIsParagraph ? parseContentBlockString(titanicIntro) : undefined
  const titanicBodyContent = titanicContent
    ? titanicIntroIsParagraph
      ? titanicContent.slice(1)
      : titanicContent
    : undefined
  const patternListingHint = isPatternListing ? firstParagraphText(pattern.content) : undefined
  const hintText = description ?? (titanicHintText || undefined) ?? patternListingHint
  const flavorNode: ReactNode = hintText ? (
    <span
      className={cn(
        // Fill the header's right side and wrap across the band (no narrow cap),
        // so the description occupies the space instead of leaving a big gap.
        'min-w-0 flex-1 text-right font-body italic leading-snug',
        // Same band-driven foreground as the title (entities/patterns white; the
        // light-faded ghosted/damaged bands go to ink by contrast).
        onBandText,
        compact ? 'text-sm' : 'text-base'
      )}
    >
      {hintText}
    </span>
  ) : undefined

  // ACTIONS wear the GHOSTED host tone on their HEADER band; their body stays
  // paper/ink like an entity, only the bands are off-colour. Entities use their
  // own medium tone on the header.
  const headerBg = isDown || isGhosted ? undefined : tone.bg
  const headerBgColor = isDown ? GREY_HEADER : ghost ? ghost.header : tone.bgColor

  // WRITE LAYER header composition (all additive):
  // - statsOverride replaces the built stats (e.g. editable sheet stats); hide
  //   suppresses them.
  // - status chip leads the right cluster; rightContent overrides the flavor.
  const effectiveHeaderStats: StatItem[] = hide?.stats ? [] : (statsOverride ?? headerStats)
  const effectiveRightContent: ReactNode = rightContentProp ?? flavorNode
  // Consumer-supplied select/alter interactivity lives in the controls bar. The
  // condition toggle (Intact/Damaged/Destroyed) is NOT here — it rides the
  // top-right frame as its own stamp-seal (`statusSealNode` below).
  const overlayControls: ReferenceEntityControl[] | undefined = controls
  const titleTextClass = onBandText
  const header = (
    <EntityCardHeader
      title={name}
      titleSlot={titleSlot}
      titleAs={titleAs}
      bg={headerBg}
      bgColor={headerBgColor}
      titleClass={titleClass}
      titleTextClass={titleTextClass}
      stats={effectiveHeaderStats}
      rightContent={effectiveRightContent}
      listing={extent === 'head'}
      compact={compact}
    />
  )

  // WRITE LAYER — whole-card affordances shared by the listing + full returns.
  // All of these collapse to nothing when their props are absent, so the
  // rendered wrapper is byte-identical to read-only.
  const resolvedCardClick = onCardClick ?? controls?.find((c) => c.cardClick)?.onClick
  const isHoverable = !!resolvedCardClick || !!cardClickable
  const outerClassName = cn(
    'relative flex flex-col overflow-visible',
    disabled && 'opacity-50',
    selectable === false && 'opacity-50 saturate-50',
    isHoverable &&
      'cursor-pointer transition-all duration-200 md:hover:z-10 md:hover:-translate-y-0.5 md:hover:scale-[1.02]',
    resolvedCardClick && FOCUS_RING,
    className,
    cardStyle?.className
  )
  // Base a11y for a clickable card. A selection toggle (selectionRole set)
  // additionally announces its state: radio → role=radio + aria-checked, toggle
  // → aria-pressed. `cardClickLabel` gives the wrapper an accessible name (the
  // entity title) instead of its full text content. Navigation/add cards leave
  // both unset and stay a plain role=button, byte-identical to before.
  const outerInteraction = resolvedCardClick
    ? {
        role: selectionRole === 'radio' ? ('radio' as const) : ('button' as const),
        tabIndex: 0,
        onClick: resolvedCardClick,
        onKeyDown: activateOnKey(resolvedCardClick),
        ...(cardClickLabel ? { 'aria-label': cardClickLabel } : {}),
        ...(selectionRole && selected !== undefined
          ? selectionRole === 'radio'
            ? { 'aria-checked': selected }
            : { 'aria-pressed': selected }
          : {}),
      }
    : {}
  // Selection state — the canonical rust SELECTION_RING (chrome/interaction.ts),
  // the same 3px rust border the wizard Sel/PickCard draw. A non-layout-shifting
  // box-shadow that reads as a border, sitting just outside the 3px tone frame.
  const frameStyle = selected
    ? { border: `3px solid ${frameColor}`, boxShadow: '0 0 0 3px var(--color-rust)' }
    : { border: `3px solid ${frameColor}` }
  // Condition — routed into the shared rail as a status CONTROL rather than a
  // bespoke seal, via the same `foldStatusControl` the DisplayCard shell uses,
  // so the badge (and the fold rule) has one implementation across both card
  // layers. The prop stays public (it is purely presentational).
  const railControls = foldStatusControl(overlayControls, status, {
    onClick: onStatusClick,
    subject: entityName,
  })
  // Label callout — a stamp straddling the top-left frame.
  const labelCallout = label ? (
    <div className={cn('absolute left-3 z-30', compact ? 'top-0 -translate-y-1/2' : '-mt-2')}>
      <Badge shape="stamp" size="mini">
        {label}
      </Badge>
    </div>
  ) : null
  // Selection seal — an `ok`-tone "chosen" stamp riding the top-right frame when
  // selected (the picker-cell affordance formerly overlaid by SelCard).
  const selectionSealNode =
    selected && selectionSeal ? (
      <Badge surface="tone" tone="ok" className="pointer-events-none">{`${selectionSeal} ✓`}</Badge>
    ) : null
  // MULTI-SELECT seal — a "Chosen" stamp + `[− n +]` CountStepper riding the
  // top-right frame, the duplicate-allowed counterpart to the single-select
  // seal. Shown whenever the card is a multi-select cell (`onCountChange` set);
  // the "Chosen" stamp only lights once at least one copy is picked.
  const countSealNode = isMultiSelect ? (
    <div className="flex items-center gap-1.5">
      {countValue >= 1 && (
        <Badge surface="tone" tone="ok">
          Chosen
        </Badge>
      )}
      <CountStepper
        subject={cardClickLabel ?? name}
        count={countValue}
        onChange={(next) => onCountChange?.(next)}
      />
    </div>
  ) : null
  // The top-right rail now lives at the DisplayCard layer (`CardControlRail`) —
  // this card inherits it. Selection and multi-select seals ride in as `seals`
  // because they carry bespoke tone styling the control variants don't cover;
  // the status and action cells come through `controls`.
  const topRightRail = (
    <CardControlRail
      controls={railControls}
      compact={compact}
      seals={[selectionSealNode, countSealNode]}
    />
  )

  // BADGE — the SHORTFORM token: a single tone-filled pill with the type stamp,
  // the name, and the classification tail (TL for gear/chassis, Ability Tree ·
  // Level for abilities). Reuses the same interaction/frame plumbing as every
  // other size but collapses the whole card to one line. Actions render it too:
  // their type reads "Action" and, carrying no TL/tree, they show no tail.
  if (size === 'small' && extent === 'head') {
    // ONE shell for both shortforms: the tone-filled pill (accent surface, 3px
    // frame, whole-card interaction plumbing) with the truncating NAME leading.
    // The name colour matches the header title everywhere else (onBandText):
    // white on the tone band, ink only on the light ghosted/greyed bands. Only
    // the tail cells differ between the action and entity forms.
    const badgeAccent = accentSurface(headerBg, headerBgColor)
    const badgeShell = (tail: ReactNode) => (
      <div className={outerClassName} {...outerInteraction}>
        <div
          className={cn(
            'inline-flex max-w-full items-center gap-2 self-start overflow-hidden rounded-card px-2 py-1',
            badgeAccent.className
          )}
          style={{ ...badgeAccent.style, ...frameStyle }}
        >
          <span
            className={cn(
              'min-w-0 truncate font-cond text-sm font-bold uppercase leading-none tracking-caps-tight',
              onBandText
            )}
          >
            {name}
          </span>
          {tail}
        </div>
      </div>
    )
    // Action shortform tail: Cost · type · Damage · range (each when present) —
    // the NAME leads (left-aligned so a stack of action badges reads down a name
    // column), then the AP/EP cost pennant, the action type as a stamp, then
    // Damage / Range as [label|value] Stat cells (if relevant).
    if (isAction && action) {
      const typeLabel = action.actionType ? formatActionType(action.actionType) : undefined
      const damageValue = action.damage
        ? `${action.damage.amount}${action.damage.damageType ?? ''}`
        : undefined
      const rangeValue =
        action.range && action.range.length > 0 ? action.range.join(' / ') : undefined
      return badgeShell(
        <>
          {costNode}
          {typeLabel && (
            <Badge shape="stamp" size="mini">
              {typeLabel}
            </Badge>
          )}
          {damageValue && (
            <Stat key="damage" orientation="horizontal" label="Damage" value={damageValue} xs />
          )}
          {rangeValue && (
            <Stat key="range" orientation="horizontal" label="Range" value={rangeValue} xs />
          )}
        </>
      )
    }
    // Entity shortform tail — the classification as Stat cells (matching the
    // sub-header's axis markers): abilities show [Ability Tree | …] [Level | n];
    // a TL-bearing entity shows [TL | n]; everything else shows nothing.
    const badgeStats: StatItem[] =
      axisMarkers.length > 0
        ? axisMarkers.map((m) => ({ key: m.label, label: m.label, value: m.value }))
        : techLevel != null
          ? [{ key: 'tech-level', label: 'TL', value: String(techLevel) }]
          : []
    return badgeShell(
      badgeStats.map((s) => (
        <Stat key={s.key} orientation="horizontal" label={s.label} value={s.value} xs />
      ))
    )
  }

  // Frame lives on the INNER clipping element (3px tone, radius + clip on one
  // element — the mockup `.ec`). The OUTER div is overflow-visible only so the
  // seam escapes the clip.
  if (extent === 'head') {
    return (
      <div className={outerClassName} {...outerInteraction}>
        {seam}
        {labelCallout}
        {topRightRail}
        <div
          className="flex flex-1 flex-col overflow-hidden rounded-card bg-paper"
          style={frameStyle}
        >
          {header}
        </div>
      </div>
    )
  }

  // SUB-HEADER cells — action range/damage/traits, then entity traits, then any
  // FREEFORM (simple text input) choices.
  //
  // CHOICE PLACEMENT splits by kind:
  // EVERYTHING INLINE (choice-plan Stage 7): every choice renders in the BODY,
  // at its prose, in both modes — no choice is ever hoisted to the sub-header.
  // The old "Choose | <name>" freeform sub-header cell is retired; the sub-header
  // keeps only the general facet hoist (type/range/damage/traits). `hide.choices`
  // still suppresses choices entirely.
  const editableChoices = !!onSelectionChange
  // A folded single action surfaces its type/range/damage/traits into the
  // sub-header; entity traits follow, deduped so a shared trait (e.g.
  // "Explosive") isn't listed twice.
  const foldedActionCells = foldedActionFields ? actionCells(foldedActionFields) : []
  const entityCells = traitCells(getTraits(entity) ?? [])
  const dedupedEntityCells = entityCells.filter(
    (cell) => !foldedActionCells.some((folded) => folded.key === cell.key)
  )
  const baseCells: EntityCardSubHeaderCell[] =
    isAction && action ? actionCells(action) : [...foldedActionCells, ...dedupedEntityCells]
  // dvSourceContent — the content whose `datavalues` block (Damage/Range) feeds
  // the resolver's base stats (a self-action's content for a self-action entity).
  const entityContentForDv = 'content' in entity ? entity.content : undefined
  const dvSourceContent =
    (foldedAction && foldedAction.name === entityName
      ? foldedAction.content
      : entityContentForDv) ?? entityContentForDv

  // MODIFIED-STATS LANGUAGE + DATAVALUES BUBBLE. `resolveChoiceView` applies the
  // selected choice effects to the entity's base datavalues + traits; diffing it
  // against the base (no selections) tells us what a choice CHANGED. Anything a
  // choice touched gets a RUST cell BORDER (the "modified" colour) — a choice-ADDED
  // trait (picking "Ballistic" → the Ballistic trait) and any datavalue an effect
  // UPGRADED (Damage 2→3, Range → Far; the value itself updates too). With no
  // selections this is just the base view — so Damage/Range still bubble normally.
  const resolvable = {
    content: dvSourceContent,
    traits: getTraits(entity) ?? [],
    choices: entityChoices,
  }
  const resolvedView = resolveChoiceView(resolvable, selections ?? {})
  const baseView = resolveChoiceView(resolvable, {})
  const baseTraitKeys = new Set(baseView.traits.map((t) => String(t.type).toLowerCase()))
  const addedTraitCells: EntityCardSubHeaderCell[] = traitCells(
    resolvedView.traits.filter((t) => !baseTraitKeys.has(String(t.type).toLowerCase()))
  ).map((c) => ({ ...c, borderColor: MODIFIED }))
  const fmtDv = (dv: { value?: unknown; unit?: string }): string => {
    const v = dv.value == null ? '' : String(dv.value)
    return dv.unit ? `${v}${dv.unit}` : v
  }
  const baseDvMap = new Map(
    baseView.datavalues
      .filter((d) => d.label != null)
      .map((d) => [String(d.label).toLowerCase(), fmtDv(d)])
  )
  const existingLabels = new Set(baseCells.map((c) => String(c.label).toLowerCase()))
  const datavalueCells: EntityCardSubHeaderCell[] = resolvedView.datavalues
    .filter((d) => d.label != null && !existingLabels.has(String(d.label).toLowerCase()))
    .map((d) => {
      // TL scaling rides ON TOP of any choice effect already applied by
      // `resolveChoiceView`: the resolved value is the effective TL1 value, and
      // `perTechLevel` adds per tech level above the first. A scaled value is
      // "modified" (rust border), same language as a choice-touched stat.
      const perTechLevel = perTechLevelByLabel.get(String(d.label).toLowerCase())
      const scaled =
        perTechLevel !== undefined
          ? resolveDataValueForTechLevel(
              { label: d.label, value: d.value, unit: d.unit, perTechLevel },
              effTechLevel
            )
          : { value: d.value, scaled: false }
      const val = fmtDv({ value: scaled.value, unit: d.unit })
      const changed = baseDvMap.get(String(d.label).toLowerCase()) !== val || scaled.scaled
      return {
        key: `dv-${d.label}`,
        label: String(d.label),
        value: val,
        ...(changed ? { borderColor: MODIFIED } : {}),
      }
    })
  const cells: EntityCardSubHeaderCell[] = [...baseCells, ...addedTraitCells, ...datavalueCells]

  // BODY — content + nested groups. Granting abilities collapse: the ability's
  // own content AND actions are suppressed (they belong to the granted entity);
  // its description shows as header flavor, then the Grants nested cards.
  const grantedCount = resolveGrantedEntities(entity as SURefEntity).length
  // A granting ability normally collapses its own prose in favour of the granted
  // entity cards. A catalog tile suppresses those cards, so it must NOT collapse
  // — otherwise the tile renders with no description at all.
  const isGrantingAbility = !isCatalog && isAbility(entity) && grantedCount > 0
  const content = 'content' in entity ? entity.content : undefined
  // The crawler-bay damaged-effect string also appears as the last content
  // paragraph; it renders in the "WHEN DAMAGED" callout, so it's filtered out of
  // the body prose below to avoid duplication.
  const damagedEffect =
    'damagedEffect' in entity && typeof entity.damagedEffect === 'string'
      ? entity.damagedEffect
      : undefined
  // A granted/nested entity's SHORT-FORM lead sentence is already shown by the
  // containing ability, so suppress the `lead` block in the grant context.
  const isGrantContext = parentSeal?.label === 'Grants'

  // Only entities expand (actions are leaves, pattern views show their loadout);
  // bounded by MAX_DEPTH.
  // A catalog tile never expands — no nested entities, chassis abilities or
  // actions, whatever the entity carries.
  const canExpand = !isAction && !isCatalog && depth < MAX_DEPTH
  const canExpandEntity = canExpand && !isPattern
  const nestedGroups = canExpandEntity ? resolveNestedEntities(entity) : []
  // Chassis abilities are name refs into the ACTIONS schema (resolved by
  // `getChassisAbilities`), NOT the pilot-abilities schema — the earlier lookup
  // missed them entirely. Cast to SURefEntity[] for the recursive card.
  // Chassis abilities render for both the basic chassis AND the pattern view
  // (a pattern's `entity` IS its chassis), so gate on `canExpand`, not
  // `canExpandEntity` (which excludes patterns).
  const chassisAbilityEntities = (canExpand
    ? (getChassisAbilities(entity) ?? [])
    : []) as unknown as SURefEntity[]
  const allActions =
    canExpandEntity && !isGrantingAbility ? (extractVisibleActions(entity) ?? []) : []

  // PATTERN view: the chosen pattern's systems/modules/drones loadout (unless a
  // summary row). BASIC chassis: the list of patterns (name + brief desc rows).
  // In the body, a pattern is always the FULL view (listing returned early above).
  const patternGroups =
    isPattern && pattern
      ? resolvePatternGroups(pattern).filter((group) => group.label !== 'Drones')
      : []
  const patternList: SURefObjectPattern[] =
    !isPattern && !isCatalog && 'patterns' in entity && Array.isArray(entity.patterns)
      ? (entity.patterns as SURefObjectPattern[])
      : []
  // Artwork is shown on full + nested cards (CardImage handles the compact size).
  const showImage = !!assetUrl
  // Body prose — the pattern's own flavor in a pattern view, else the entity's —
  // with duplicated blocks filtered out (damaged-effect paragraph, grant lead).
  const rawBodyContent =
    isPattern && pattern ? pattern.content : isTitanicMeta ? titanicBodyContent : content
  const bodyContent = rawBodyContent?.filter((block) => {
    if (
      damagedEffect &&
      block?.type === 'paragraph' &&
      typeof block.value === 'string' &&
      block.value === damagedEffect
    )
      return false
    if (isGrantContext && (block as { lead?: boolean }).lead === true) return false
    return true
  })
  // TITANIC actions always get their own full-width row (never the masonry).
  const titanicActions = allActions.filter(isTitanicAction)
  const normalActions = allActions.filter((a) => !isTitanicAction(a))
  // SINGLE-ACTION FOLD (see `foldedAction` above): its content inlines into the
  // body; its stats already merged into the sub-header. 2+ → an actions grid.
  const foldSingleAction = !!foldedAction
  const foldedActionContent = foldedAction?.content ?? undefined
  // Every action EXCEPT the folded self-action renders as its own grid card — so
  // a multi-action entity keeps its siblings (was `[]`, which dropped them once
  // the length-1 gate was removed).
  const gridActions = foldedAction
    ? normalActions.filter((a) => a.name !== foldedAction.name)
    : normalActions

  // A SELF-action (a single folded action named like the entity — e.g. Custom
  // Sniper Rifle's own action) carries the entity's real prose AND its choice
  // markers interwoven. Render ITS content as the body so the choices interleave
  // there; the entity's own thin content duplicates it (dropped), and the action
  // is NOT rendered a second time below.
  // CONCATENATE, don't replace: the fold merges the entity's own prose with the
  // self-action's prose (identity, then behaviour). Blocks whose text the
  // self-action already contains are dropped so the ~13 equipment whose entity
  // content duplicates the action's don't double-render, while complementary
  // content (unique identity prose, e.g. Water Purification / Hydraulic Shunter)
  // and a self-action-only description (e.g. Grappling Harpoon, whose entity
  // content is empty) are both preserved.
  const isSelfAction = foldSingleAction && foldedAction?.name === entityName
  const blockPlainText = (b: SURefObjectContentBlock): string =>
    b && b.type !== 'choice' && typeof (b as { value?: unknown }).value === 'string'
      ? String((b as { value: string }).value)
      : ''
  const entityBodyBlocks = (bodyContent ?? []).filter((b) => b?.type !== 'datavalues')
  const selfActionBlocks =
    isSelfAction && foldedActionContent
      ? foldedActionContent.filter((b) => b?.type !== 'datavalues')
      : []
  const selfActionText = selfActionBlocks.map(blockPlainText).join('\n')
  const dedupedEntityBlocks = selfActionBlocks.length
    ? entityBodyBlocks.filter((b) => {
        const t = blockPlainText(b).trim()
        return t.length === 0 || !selfActionText.includes(t.slice(0, 40))
      })
    : entityBodyBlocks
  const bodyBlocks = [...dedupedEntityBlocks, ...selfActionBlocks] as SURefObjectContentBlock[]
  const showBody =
    isPattern || isTitanicMeta ? bodyBlocks.length > 0 : !isGrantingAbility && bodyBlocks.length > 0

  // A read-only choice that renders NOTHING (a simple text input with no chosen
  // value — Name / Motto in the SRD) must not emit its wrapper region either, or
  // it leaves an empty margin gap in the prose. Only text choices go empty;
  // table/options/catalog always render a reference.
  const choiceRendersNothing = (choice: SURefObjectChoice): boolean => {
    if (editableChoices) return false
    return getChoiceSourceKind(choice) === 'text' && !selections?.[choice.id]?.[0]
  }

  // BONUS PER TECH LEVEL — its own distinct rendering, anchored INLINE at the
  // prose that describes it (choice-plan): the green "Bonus per Tech Level" label
  // + the "+N" deltas. Damage rides HORIZONTAL (as everywhere), other stats are
  // vertical value boxes. Built here so the interleave walk can anchor it.
  const bonusPerTechLevel =
    'bonusPerTechLevel' in entity && entity.bonusPerTechLevel
      ? (entity.bonusPerTechLevel as SURefObjectBonusPerTechLevel)
      : undefined
  const bonusCellList: BonusCell[] = [
    ...(bonusPerTechLevel ? bonusCells(bonusPerTechLevel) : []),
    ...dataValueBonuses,
  ]
  const bonusNode: ReactNode =
    bonusCellList.length > 0 && !hide?.stats ? (
      <div key="bonus-per-tech" className="flex flex-col gap-1.5 [&:not(:last-child)]:mb-3">
        <Stat
          orientation="horizontal"
          label="Bonus per Tech Level"
          bgColor="var(--color-status-ok)"
          textColor="var(--color-paper)"
          compact={compact}
        />
        <div className="flex flex-wrap items-start gap-1.5">
          {bonusCellList.map((cell) =>
            cell.label.toLowerCase() === 'damage' ? (
              // Damage is always horizontal (label | +N SP), matching every other
              // Damage cell; the unit rides into the value.
              <Stat
                key={cell.key}
                orientation="horizontal"
                label={cell.label}
                value={`${cell.value}${cell.bottomLabel ? ` ${cell.bottomLabel}` : ''}`}
                compact={compact}
              />
            ) : (
              <Stat
                key={cell.key}
                label={cell.label}
                bottomLabel={cell.bottomLabel}
                value={cell.value}
                compact={compact}
              />
            )
          )}
        </div>
      </div>
    ) : null

  // WRITE LAYER — editable choices interleave with content by a plain in-order
  // walk of `bodyContent`: a `{type:'choice'}` marker renders that choice's
  // ChoiceGroups (rust-bordered) exactly where it sits in the data. Choices with
  // no marker render at the natural END position (trailing fallback). Read-only
  // (no `onSelectionChange`) never enters this branch.
  const renderChoiceRegion = (choice: SURefObjectChoice): ReactNode => {
    // SCHEMA-ONLY catalog ("pick any X from the collection", e.g. the Armament
    // Bay's Weapons System) → an expandable entity listing, capped to the
    // effective tech level. The collection is resolved lazily inside the
    // listing (on expand), so this branch touches no cross-schema data. A
    // shortlist catalog (Ballistic / Energy) and every other kind fall through
    // to ChoiceGroups.
    if (isSchemaOnlyCatalogChoice(choice)) {
      return (
        <div key={`choice-region-${choice.id}`} className="[&:not(:last-child)]:mb-3">
          <CatalogChoiceListing
            choice={choice}
            techLevel={typeof effTechLevel === 'number' ? effTechLevel : undefined}
            selections={selections}
            onSelectionChange={editableChoices ? onSelectionChange : undefined}
            renderEntity={(resolved, key) => (
              <ReferenceEntityCardInner
                key={key}
                size="medium"
                extent="head"
                depth={depth + 1}
                data={resolved}
                hostTone={ownToneBase}
                chassisName={resolvedChassisName}
              />
            )}
          />
        </div>
      )
    }
    return (
      <div key={`choice-region-${choice.id}`} className="[&:not(:last-child)]:mb-3">
        <ChoiceGroups
          choices={[choice]}
          parent={effTechLevel !== undefined ? { techLevel: effTechLevel } : scalingParent}
          selections={selections}
          onSelectionChange={onSelectionChange}
          readOnly={!editableChoices}
          compact={compact}
          toneColor={tone.bgColor}
        />
      </div>
    )
  }

  // AUTO-ANCHOR unmarked choices to the prose that introduces them, then the
  // bonus-per-tech-level marker to ITS prose — the pure splice walks live in
  // choiceAnchoring.ts; a choice/bonus that matches nothing falls to the
  // trailing position below.
  const anchoredBlocks: SURefObjectContentBlock[] = [...bodyBlocks]
  if (!hide?.choices) anchorChoiceMarkers(anchoredBlocks, entityChoices)
  const bonusAnchored = bonusNode ? anchorBonusMarker(anchoredBlocks) : false

  // The interleave walk runs in BOTH modes — read-only renders the same choice
  // cards, static (readable); editable makes them selectable.
  const bodyNodes: ReactNode[] = []
  {
    const choiceById = new Map(entityChoices.map((c) => [c.id, c] as const))
    const rendered = new Set<string>()
    let buffer: SURefObjectContentBlock[] = []
    let seg = 0
    const flush = () => {
      if (buffer.length > 0 && !hide?.content && showBody) {
        bodyNodes.push(
          <div key={`seg-${seg}`} className="[&:not(:last-child)]:mb-3">
            <Content
              body={buffer}
              compact={compact}
              chassisName={resolvedChassisName}
              fontSize={compact ? 'text-xs' : 'text-sm'}
              headerBg={tone.bg}
              headerBgColor={tone.bgColor}
            />
          </div>
        )
      }
      buffer = []
      seg += 1
    }
    for (const block of anchoredBlocks) {
      if (block?.type === 'choice') {
        const choice = block.choiceId ? choiceById.get(block.choiceId) : undefined
        if (choice && !hide?.choices && !rendered.has(choice.id) && !choiceRendersNothing(choice)) {
          flush()
          bodyNodes.push(renderChoiceRegion(choice))
          rendered.add(choice.id)
        }
        continue // markers never contribute body text
      }
      if ((block as { type?: string })?.type === 'bonus') {
        flush()
        if (bonusNode) bodyNodes.push(bonusNode)
        continue
      }
      buffer.push(block)
    }
    flush()
    if (!hide?.choices) {
      for (const choice of entityChoices) {
        if (!rendered.has(choice.id) && !choiceRendersNothing(choice))
          bodyNodes.push(renderChoiceRegion(choice))
      }
    }
    // Bonus box that wasn't anchored to any prose → trailing position.
    if (bonusNode && !bonusAnchored) bodyNodes.push(bonusNode)
  }

  // (The BONUS-PER-TECH-LEVEL box is built + anchored earlier, in the body walk.)

  // CRAWLER BAY damaged effect → a red-ghosted, action-card-style callout (the
  // string is filtered out of the body prose above). RED token: `--color-status-bad`.
  const damagedBands = damagedEffect ? ghostActionTone('var(--color-status-bad)') : undefined

  // DRONE — a chassis controls a drone (named by a chassis ability); a pattern
  // specifies one. Rendered as a compact drone card + its systems/modules listings,
  // just below the chassis ability and above patterns/systems/modules.
  const droneInfo =
    canExpand && !isAction
      ? isPattern && pattern
        ? resolvePatternDrone(pattern)
        : schemaName === 'chassis'
          ? resolveChassisDrone(entity)
          : undefined
      : undefined

  // THIS card's own drone loadout (when it IS a drone): the parent-provided
  // `droneLoadout`, else the drone's own systems/modules. Rendered as listings
  // INSIDE this card's body — never leaked to the parent (chassis) body.
  const ownDroneLoadout =
    droneLoadout ??
    (schemaName === 'drones' && canExpand ? resolveDroneOwnLoadout(entity) : undefined)
  const droneSystems = ownDroneLoadout?.systems ?? []
  const droneModules = ownDroneLoadout?.modules ?? []

  const cardKey = (nested: SURefEntity, index: number): string =>
    `${'id' in nested && typeof nested.id === 'string' ? nested.id : 'nested'}-${index}`

  // Nested cards. FLAT mode (there's a left ANCHOR — image or NPC) renders each
  // card as a `flow-root` block so it flows beside the floated anchor, then full
  // width once past it. Non-flat renders the 2-col masonry.
  const renderNested = (
    entities: SURefEntity[],
    seal?: { label: string; tone: string },
    childHostTone?: string,
    flat = false
  ): ReactNode => {
    // The ONE nested-card construction all three layouts share.
    const card = (nested: SURefEntity, index: number): ReactNode => (
      <ReferenceEntityCardInner
        key={cardKey(nested, index)}
        size="medium"
        depth={depth + 1}
        hostDown={isDown}
        data={nested}
        parentSeal={seal}
        hostTone={childHostTone}
        hostName={entityName}
        chassisName={resolvedChassisName}
      />
    )
    if (flat) {
      return entities.map((nested, index) =>
        wrapFlat(true, cardKey(nested, index), card(nested, index))
      )
    }
    // COMPACT parent → nested entities stack as a SINGLE column (one per row): a
    // compact card is narrow, so a 2-up masonry cramps its nested cards. Full
    // cards keep the 2-col masonry below.
    if (compact) {
      return (
        <div className="flex flex-col gap-1.5">
          {entities.map((nested, index) => card(nested, index))}
        </div>
      )
    }
    const isOdd = entities.length % 2 === 1
    const columnCards = isOdd ? entities.slice(0, -1) : entities
    const orphan = isOdd ? entities[entities.length - 1] : undefined
    return (
      <>
        {columnCards.length > 0 && (
          <div className="columns-1 gap-1.5 sm:columns-2">
            {columnCards.map((nested, index) => (
              <div key={cardKey(nested, index)} className="mb-1.5 break-inside-avoid">
                {card(nested, index)}
              </div>
            ))}
          </div>
        )}
        {orphan && card(orphan, entities.length - 1)}
      </>
    )
  }

  // Grants → NO Slab, a "GRANTS" stampseal on each nested card. NPCs → NO Slab.
  // Everything else (Systems/Modules/Drones) keeps its dashed Slab separator.
  const renderGroup = (
    label: string,
    entities: SURefEntity[],
    opts?: { slab?: boolean; seal?: { label: string; tone: string }; hostTone?: string },
    flat = false
  ): ReactNode => (
    <div key={label} className={flat ? 'mb-1.5' : 'flex flex-col gap-1.5'}>
      {opts?.slab !== false && <Slab variant="dashed" label={label} />}
      {renderNested(entities, opts?.seal, opts?.hostTone, flat)}
    </div>
  )

  const renderNestedGroup = (label: string, entities: SURefEntity[], flat = false): ReactNode => {
    if (label === 'Grants')
      return renderGroup(
        label,
        entities,
        { slab: false, seal: { label: 'Grants', tone: darkTone } },
        flat
      )
    if (label === 'NPCs')
      return renderGroup(label, entities, { slab: false, hostTone: ownToneBase }, flat)
    return renderGroup(label, entities, undefined, flat)
  }

  // A named content sub-section heading (e.g. a folded action's name): a
  // CENTERED black pseudoheader label flanked by dashed separator lines — the
  // OLD card's section-heading treatment, so a folded action keeps its name.
  const renderSectionHeading = (label: string): ReactNode => (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="h-0 flex-1 border-t border-dashed border-ink/40" />
      <span
        className="shrink-0 bg-ink px-1 py-0.5 font-cond text-xs font-bold uppercase tracking-caps-tight text-paper"
        style={{ lineHeight: 1 }}
      >
        {label}
      </span>
      <span aria-hidden="true" className="h-0 flex-1 border-t border-dashed border-ink/40" />
    </div>
  )

  // A dashed-Slab group of LISTING rows (drone systems / modules) — flat-aware.
  const renderListingGroup = (label: string, entities: SURefEntity[], flat = false): ReactNode => (
    <div key={label} className={flat ? 'mb-1.5' : 'flex flex-col gap-1'}>
      <Slab variant="dashed" label={label} />
      {entities.map((item, index) =>
        wrapFlat(
          flat,
          cardKey(item, index),
          <ReferenceEntityCardInner
            key={cardKey(item, index)}
            size="medium"
            extent="head"
            depth={depth + 1}
            hostDown={isDown}
            data={item}
          />
        )
      )}
    </div>
  )

  // LEFT ANCHOR — the artwork image if present, else a prominent nested NPC.
  // Content (flavor + nested groups/actions) flows to the RIGHT of / below the
  // anchor, filling the whitespace. Responsive: stacks full-width on narrow.
  const npcGroup =
    !showImage && !isPattern ? nestedGroups.find((group) => group.label === 'NPCs') : undefined
  const anchorNpcEntities = npcGroup?.entities ?? []
  const hasAnchor = showImage || anchorNpcEntities.length > 0
  const flat = hasAnchor
  const inFlowGroups = (isPattern ? patternGroups : nestedGroups).filter(
    (group) => group !== npcGroup
  )

  const anchorNode: ReactNode =
    showImage && assetUrl ? (
      <CardImage url={assetUrl} alt={`${entityName} illustration`} compact={compact} />
    ) : anchorNpcEntities.length > 0 ? (
      <div className="mb-1.5 w-full shrink-0 md:float-right md:w-1/2 md:max-w-full md:pl-3">
        {anchorNpcEntities.map((npc, index) => (
          <ReferenceEntityCardInner
            key={cardKey(npc, index)}
            size="medium"
            depth={depth + 1}
            hostDown={isDown}
            data={npc}
            hostTone={ownToneBase}
            hostName={entityName}
            chassisName={resolvedChassisName}
            // Thread the write-layer so the NPC's crew choices (Name / Motto /
            // Keepsake) render as real inputs in editable mode — they share the
            // parent's id-keyed selections map (distinct choice ids, no clash).
            selections={selections}
            onSelectionChange={onSelectionChange}
            // The parent's visibility config governs its identity NPC too — a bay
            // that hides choices (rendering the NPC's crew facts as external
            // IdentityFields) must not also surface those same choices here.
            hide={hide}
          />
        ))}
      </div>
    ) : undefined

  return (
    <div className={outerClassName} {...outerInteraction}>
      {seam}
      {labelCallout}
      {topRightRail}
      <div
        className="flex flex-1 flex-col overflow-hidden rounded-card bg-paper"
        style={frameStyle}
      >
        {header}
        {/* SLOT: subtitleExtra — an extra line under the header (absent ⇒ nothing). */}
        {subtitleExtra && (
          <div className={cn(compact ? 'px-2 pt-1' : 'px-3 pt-1.5')}>{subtitleExtra}</div>
        )}
        {/* EP/AP cost leads the action sub-header row; the bonus-per-tech-level
            group (Badge + "+N" cells) wraps together after the trait cells. */}
        <EntityCardSubHeader
          bgColor={darkTone}
          cells={cells}
          leading={subHeaderLeading}
          compact={compact}
          onBandText={onBandText}
        />
        <div
          className={cn(
            // Non-flat body: a MIN height with content vertically centered, so a
            // short body (e.g. an action's one-line description) sits centered in
            // the band instead of top-aligned with a gap below; taller content
            // grows normally. (Flat/anchor bodies use flow-root for the float.)
            flat ? 'flow-root' : 'flex min-h-[2.5rem] flex-1 flex-col justify-center gap-1.5',
            compact ? 'p-2' : 'p-3',
            // A damaged/destroyed entity dims its body content too (not just the
            // greyed header), so the whole card reads as de-emphasised.
            isDown && 'opacity-60'
          )}
        >
          {anchorNode}
          {/* The interleave walk builds the WHOLE body — content segments (via
              Content) with choice cards dropped in at their
              markers — in both read-only and editable. Content gets a clear gap
              (mb-3) before nested-card sections. */}
          {bodyNodes.length > 0 && <>{bodyNodes}</>}
          {/* A SELF-action's content already renders AS the body above; only a
              differently-named folded action renders here (with its name heading). */}
          {!isSelfAction &&
            !hide?.content &&
            !hide?.actions &&
            foldedActionContent &&
            foldedActionContent.length > 0 && (
              <div className="flex flex-col gap-1.5 [&:not(:last-child)]:mb-3">
                {/* The folded action keeps its NAME as a centered section heading
                  ONLY when it differs from the entity — a same-named action (e.g.
                  Grenade's own "Grenade" action) would be redundant noise. */}
                {foldedAction?.name &&
                  foldedAction.name !== entityName &&
                  renderSectionHeading(stripHostParenthetical(foldedAction.name, entityName))}
                <Content
                  body={foldedActionContent}
                  compact={compact}
                  chassisName={resolvedChassisName}
                  fontSize={compact ? 'text-xs' : 'text-sm'}
                  headerBg={tone.bg}
                  headerBgColor={tone.bgColor}
                />
              </div>
            )}

          {/* CRAWLER BAY "WHEN DAMAGED" callout — action-card style (ghosted
              bands + black name-tab + paper body), tinted from the RED danger
              token so it clearly signals the damaged effect. */}
          {!hide?.damagedEffect && damagedEffect && damagedBands && (
            <div
              className="overflow-hidden rounded-card"
              style={{ border: `3px solid ${damagedBands.frame}` }}
            >
              <div
                className="flex items-center px-3 py-1.5"
                style={{ backgroundColor: damagedBands.header }}
              >
                <span
                  className="block bg-ink px-1 py-0.5 font-cond text-xs font-bold uppercase tracking-caps-tight text-paper"
                  style={{ lineHeight: 1 }}
                >
                  When Damaged
                </span>
              </div>
              <p className="bg-paper p-2 text-xs leading-snug text-ink">{damagedEffect}</p>
            </div>
          )}

          {/* SLOT: afterChoicesContent — appended just below the choices. */}
          {afterChoicesContent}

          {/* CHASSIS ABILITY — a "Chassis Ability" stampseal on each card. The
              `abilitiesSection` slot fully replaces this block when provided. */}
          {abilitiesSection ??
            (chassisAbilityEntities.length > 0 &&
              renderNested(
                chassisAbilityEntities,
                { label: 'Chassis Ability', tone: darkTone },
                ownToneBase,
                flat
              ))}

          {/* DRONE — the compact drone card; its systems + modules render INSIDE
              the drone card (via the `droneLoadout` prop), NOT here. */}
          {droneInfo &&
            wrapFlat(
              flat,
              undefined,
              <ReferenceEntityCardInner
                size="medium"
                depth={depth + 1}
                hostDown={isDown}
                data={droneInfo.drone}
                chassisName={resolvedChassisName}
                droneLoadout={{ systems: droneInfo.systems, modules: droneInfo.modules }}
              />
            )}

          {/* THIS card's OWN drone loadout (when it is a drone) — systems +
              modules as listings, nested inside the drone card's own body. */}
          {droneSystems.length > 0 && renderListingGroup('Systems', droneSystems, flat)}
          {droneModules.length > 0 && renderListingGroup('Modules', droneModules, flat)}

          {/* PATTERN view → loadout groups. BASIC chassis / entities → nested groups. */}
          {(!isPattern || !hide?.patterns) &&
            inFlowGroups.map((group) => renderNestedGroup(group.label, group.entities, flat))}

          {!hide?.actions &&
            gridActions.length > 0 &&
            renderGroup(
              'Actions',
              gridActions as unknown as SURefEntity[],
              // No "Actions" Slab — the action cards render on their own.
              { hostTone: ownToneBase, slab: false },
              flat
            )}

          {/* Titanic actions — a full-width row of their own, never masonry. */}
          {!hide?.actions &&
            titanicActions.map((action, index) =>
              wrapFlat(
                flat,
                cardKey(action as unknown as SURefEntity, index),
                <ReferenceEntityCardInner
                  key={cardKey(action as unknown as SURefEntity, index)}
                  size="medium"
                  depth={depth + 1}
                  hostDown={isDown}
                  data={action as unknown as SURefEntity}
                  hostTone={ownToneBase}
                  hostName={entityName}
                  chassisName={resolvedChassisName}
                />
              )
            )}

          {/* BASIC CHASSIS → a LIST of its patterns as LISTING rows. */}
          {!hide?.patterns && patternList.length > 0 && (
            <div className={flat ? 'mb-1.5' : 'flex flex-col gap-1.5'}>
              <Slab variant="dashed" label="Patterns" />
              <div className={flat ? undefined : 'flex flex-col gap-1.5'}>
                {patternList.map((pat) =>
                  wrapFlat(
                    flat,
                    pat.name,
                    <ReferenceEntityCardInner
                      key={pat.name}
                      data={data}
                      pattern={pat}
                      size="medium"
                      extent="head"
                      depth={depth + 1}
                      hostDown={isDown}
                    />
                  )
                )}
              </div>
            </div>
          )}

          {/* SLOT: afterExtraContent — trailing body content (absent ⇒ nothing). */}
          {afterExtraContent}
        </div>
        {/* SLOT: expand — on the accent field after the body box, before the
            footer (legacy `expand`, e.g. a crawler bay's crew inset). */}
        {expand && <div className={compact ? 'px-2 pb-2' : 'px-3 pb-3'}>{expand}</div>}
        {/* FOOTER — `footerOverride` replaces the identity footer; `hide.footer`
            suppresses it entirely. Absent ⇒ the depth-0 identity footer, unchanged. */}
        {hide?.footer
          ? null
          : (footerOverride ??
            (depth === 0 && (
              <EntityCardIdentityFooter
                bgColor={darkTone}
                typeLabel={footerType}
                source={getSource(entity)}
                booklet={getBooklet(entity)}
                page={getPageReference(entity)}
                footMeta={footMeta}
                compact={compact}
              />
            )))}
      </div>
    </div>
  )
}

/** Public wrapper props: the canonical card props plus the ergonomic display
 * sugar and a nullable `data`. */
export type ReferenceEntityCardWrapperProps = Omit<
  ReferenceEntityCardProps,
  'data' | 'size' | 'extent'
> & {
  data: SURefEntity | undefined
  size?: CardSize
  extent?: CardExtent
}

/**
 * `ReferenceEntityCard` — the public entry point for rendering a reference
 * entity. Accepts the ergonomic display sugar (`compact` / `listing` resolve
 * onto the `size` / `extent` axes; a nullable `data` renders nothing; a
 * damaged/destroyed `status` greys the whole tone) and renders the canonical
 * card. This replaced the former `ReferenceEntityCard` compat shim; the
 * recursive card body is `ReferenceEntityCardInner`.
 */
export function ReferenceEntityCard({
  data,
  size,
  extent,
  ...rest
}: ReferenceEntityCardWrapperProps): ReactNode {
  if (!data) return null

  // The size / extent / compact / listing reconciliation is the DisplayCard
  // layer's rule — inherited, not restated here.
  const display = resolveCardDisplay({ size, extent })

  return (
    <ReferenceEntityCardInner data={data} size={display.size} extent={display.extent} {...rest} />
  )
}
