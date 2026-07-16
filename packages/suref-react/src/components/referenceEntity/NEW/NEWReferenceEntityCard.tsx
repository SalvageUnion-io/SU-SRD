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
  resolveGrantedEntities,
} from 'salvageunion-reference'
import { cn } from '../../../utils/cn'
import { Slab } from '../../chrome/Slab'
import { Stamp } from '../../chrome/Stamp'
import { STAMP_SEAM } from '../../chrome/stampSeam'
import { ActivationCostBox } from '../../shared/ActivationCostBox'
import { CardImage } from '../../shared/CardImage'
import { StatDisplay } from '../../shared/StatDisplay'
import type { StatItem } from '../../shared/statsBarTypes'
import { BlockContentRendererView } from '../BlockContentRendererView'
import { accentDeepColor, borderColorFromHeaderBg } from '../referenceEntityHelpers'
import { buildReferenceEntityStats } from '../ReferenceEntityDisplay/referenceEntityStatsConfig'
import { NEWCardHeader } from './NEWCardHeader'
import { NEWIdentityFooter } from './NEWIdentityFooter'
import { NEWSubHeader } from './NEWSubHeader'
import type { NEWSubHeaderCell } from './NEWSubHeader'
import {
  abbreviateStat,
  ghostActionTone,
  resolveAxisMarkers,
  resolveCardTone,
  resolveEyebrow,
  titleSizeClass,
} from './newCardTone'
import type { NEWReferenceEntityCardSize } from './newCardTone'
import {
  resolveChassisDrone,
  resolveDroneOwnLoadout,
  resolveNestedEntities,
  resolvePatternDrone,
  resolvePatternGroups,
} from './resolveNestedEntities'

export type { NEWReferenceEntityCardSize } from './newCardTone'

/** Beyond this nesting depth a card renders header-only (no body expansion) —
 * bounds runaway recursion (deep chassis → systems → actions, or grant cycles). */
const MAX_DEPTH = 3

/** A titanic action (bio-titan "Titanic Actions") — gets its own full-width row. */
function isTitanicAction(action: { name?: string }): boolean {
  return /titanic action/i.test(action.name ?? '')
}

type NEWReferenceEntityCardProps = {
  data: SURefEntity
  size?: NEWReferenceEntityCardSize
  /** Nesting level — 0 = full/solo, ≥1 = nested (compact, no footer, smaller
   * header, one step down per level). Threaded through the recursion. */
  depth?: number
  /** A parent-provided stampseal prepended to the seam (before the entity's own
   * type stamp), in a distinct tone — lets a group brand its nested cards
   * (e.g. GRANTS) without a separator row. */
  parentSeal?: { label: string; tone: string }
  /** CHASSIS TWO-RENDERINGS: when set (with a chassis `data`), the card renders
   * the PATTERN view — pattern name as the title, the pattern's systems/modules
   * loadout as nested cards (a `size="listing"` pattern shows name + description). */
  pattern?: SURefObjectPattern
  /** The SUMMONING (parent) entity's tone as a resolvable CSS colour — threaded
   * onto a nested ACTION card, whose bands are this tone GHOSTED. */
  hostTone?: string
  /** The owning chassis's name — threaded down so `[(CHASSIS)]` tokens in nested
   * ability/drone/pattern content resolve to the chassis name. */
  chassisName?: string
  /** A DRONE card's systems/modules loadout, resolved by the parent (chassis
   * uses the drone's own loadout; a pattern uses its pattern-specific config).
   * Rendered as listings INSIDE this drone card, never at the parent level. */
  droneLoadout?: { systems: SURefEntity[]; modules: SURefEntity[] }
  className?: string
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
function traitCells(traits: SURefObjectTrait[]): NEWSubHeaderCell[] {
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
function actionCells(action: ActionFields): NEWSubHeaderCell[] {
  const cells: NEWSubHeaderCell[] = []
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

/** `bonusPerTechLevel` fields → "+N" cells (zeros/absent dropped). Labels are
 * size-aware: [field, FULL label (non-compact), ABBR label (compact)]. */
const BONUS_LABELS: [keyof SURefObjectBonusPerTechLevel, string, string][] = [
  ['structurePoints', 'Structure Points', 'SP'],
  ['energyPoints', 'Energy Points', 'EP'],
  ['heatCapacity', 'Heat Capacity', 'Heat'],
  ['systemSlots', 'System Slots', 'Sys'],
  ['moduleSlots', 'Module Slots', 'Mod'],
  ['cargoCapacity', 'Cargo Capacity', 'Cargo'],
  ['salvageValue', 'Salvage Value', 'SV'],
]

function bonusCells(bonus: SURefObjectBonusPerTechLevel, compact: boolean): NEWSubHeaderCell[] {
  return BONUS_LABELS.flatMap(([field, full, abbr]) => {
    const amount = bonus[field]
    return typeof amount === 'number' && amount !== 0
      ? [{ key: `bonus-${field}`, label: compact ? abbr : full, value: `+${amount}` }]
      : []
  })
}

/** First paragraph of a content array as plain text — the pattern-listing hint. */
function firstParagraphText(content: SURefObjectContentBlock[] | undefined): string | undefined {
  const paragraph = content?.find((block) => block?.type === 'paragraph')
  return paragraph ? parseContentBlockString(paragraph) : undefined
}

/** Read-only choice prompt: freeform → an empty "—" slot; a roll-table choice →
 * "roll or choose"; anything else → "choose". Never an input. */
function choicePrompt(choice: SURefObjectChoice): string {
  if (choice.choiceType === 'freeform') return '—'
  if (choice.rollTable) return 'roll or choose'
  return 'choose'
}

/**
 * NEWReferenceEntityCard — the ONE card that renders ENTITIES, ACTIONS, and
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
 * name-tab + stats/AP axis) · sub-header (StatDisplay cells only) · body ·
 * footer (depth 0 only). Nested groups (Grants/Systems/Modules/Drones/NPCs/
 * Actions) each render a `Slab` separator + a 2-up grid of depth+1 cards;
 * actions are rust, always compact, AP via `ActivationCostBox`.
 */
export function NEWReferenceEntityCard({
  data,
  size: sizeProp = 'full',
  depth: depthProp = 0,
  parentSeal,
  pattern,
  hostTone,
  chassisName,
  droneLoadout,
  className,
}: NEWReferenceEntityCardProps) {
  // `SalvageUnionReference.*.all()` entities carry a runtime `schemaName`
  // discriminant that isn't reflected in the static `SURefEntity` union type —
  // the same cast-at-the-boundary pattern used throughout the display system.
  const entity = data as SURefMetaEntity
  const schemaName = (
    'schemaName' in entity && typeof entity.schemaName === 'string' ? entity.schemaName : undefined
  ) as SURefEnumSchemaName | 'actions' | undefined

  if (!schemaName) {
    console.warn('NEWReferenceEntityCard: data does not have a schemaName property', data)
    return null
  }

  const isAction = schemaName === 'actions'
  // Actions are ALWAYS nested (never solo on their own SRD page), so an action
  // can only render compact or compact-listing — never full. Coerce a full-size
  // action to compact (min depth 1) so the full-size path can't be reached.
  const size: NEWReferenceEntityCardSize = isAction && sizeProp === 'full' ? 'compact' : sizeProp
  const depth = isAction ? Math.max(depthProp, 1) : depthProp
  // A NESTED NPC (one summoned by a parent that threaded `hostTone` down) is
  // dimmed the same way actions are — it ghosts the PARENT's tone, not its own
  // navy. A standalone/top-level NPC (no host tone) keeps its navy domain tone.
  const isNestedNpc = schemaName === 'npcs' && hostTone != null
  const isGhosted = isAction || isNestedNpc
  const compact = depth > 0 || size !== 'full'
  const tone = resolveCardTone(schemaName, entity)
  // ACTIONS and NESTED NPCs inherit the summoning (parent) entity's tone,
  // GHOSTED (D8): the header + sub-header bands + 3px frame use the ghosted host
  // tone; the body stays paper/ink. A standalone action (no host) falls back to
  // a neutral base.
  const ghost = isGhosted ? ghostActionTone(hostTone ?? 'var(--color-su-black)') : undefined
  const darkTone = ghost
    ? ghost.sub
    : (accentDeepColor(tone.bg, tone.bgColor) ?? 'var(--color-su-black)')
  const frameColor = ghost
    ? ghost.frame
    : (borderColorFromHeaderBg(tone.bg, tone.bgColor) ?? 'var(--color-su-black)')
  // This entity's own tone base — threaded to its nested action cards as their host.
  const ownToneBase = borderColorFromHeaderBg(tone.bg, tone.bgColor) ?? 'var(--color-su-black)'
  const techLevel = getTechLevel(entity)
  const entityName = getReferenceEntityName(entity) ?? ('name' in entity ? String(entity.name) : '')
  const titleClass = titleSizeClass(size === 'listing' ? Math.max(depth, 1) : depth)
  // ARTWORK — `getAssetUrl` yields the entity's `.webp` when `hasArtwork`; the
  // chassis art also stands in for its full PATTERN view (but not the tight
  // pattern-summary list rows).
  const assetUrl = getAssetUrl(entity)

  // PATTERN view — the pattern is the subject; the chassis (`entity`) supplies
  // stats / tone / source. Patterns carry NO stampseal. A `size="listing"`
  // pattern is a LIST ROW: name-tab left, description on the header right.
  const isPattern = !!pattern
  const isPatternListing = isPattern && size === 'listing'
  const name = isPattern ? pattern.name : entityName
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
  const axisMarkers = isAction || isPattern ? [] : resolveAxisMarkers(entity)

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
  const foldedAction = foldableActions.length === 1 ? foldableActions[0] : undefined
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
      {depth > 0 && seamType && <Stamp size="sm">{seamType}</Stamp>}
      {axisMarkers.map((marker) => (
        <StatDisplay
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
          compact: false,
          primaryOnly: size === 'listing',
          schemaName: schemaName as SURefEnumSchemaName,
          techLevel,
        })
  // TECH LEVEL is a header headline stat (value box), NOT a seam pill — a
  // size-aware label ("Tech Level" full / "TL" compact), placed first in the
  // top-right cluster. `buildReferenceEntityStats` doesn't emit it, so add it.
  const isListing = size === 'listing'
  const techLevelStat: StatItem | undefined =
    !isAction && !isPatternListing && techLevel != null
      ? {
          key: 'tech-level',
          // Display-mode ladder: a LISTING renders stats in COMPACT mode → the
          // abbreviation "TL"; a vertical value box → two-line "Tech" / "Level".
          label: isListing ? 'TL' : 'Tech',
          bottomLabel: isListing ? undefined : 'Level',
          value: String(techLevel),
        }
      : undefined
  const headerStats: StatItem[] = [
    ...(techLevelStat ? [techLevelStat] : []),
    // Compact abbreviates (SP, Cargo, …). Non-compact keeps full labels, but the
    // slotsRequired stat reads "Slots" at BOTH sizes — drop its "Required" bottom
    // label (compact does this via `abbreviateStat`; do it here for non-compact).
    ...(isListing
      ? rawHeaderStats.map(abbreviateStat)
      : rawHeaderStats.map((stat) =>
          stat.label === 'Slots' ? { ...stat, bottomLabel: undefined } : stat
        )),
  ]

  const costSource = action ?? foldedActionFields
  const costNode: ReactNode =
    costSource?.activationCost != null ? (
      <ActivationCostBox
        cost={costSource.activationCost}
        currency={resolveActivationCurrency(costSource.actionSource)}
        compact
      />
    ) : undefined

  // SUB-HEADER cells — action range/damage/traits, else entity traits + the
  // read-only choice slots (moved out of the body into the sub-header).
  const choiceCells: NEWSubHeaderCell[] = (getChoices(entity) ?? []).map((choice) => ({
    key: `choice-${choice.id}`,
    label: choice.name,
    value: choicePrompt(choice),
  }))
  // A folded single action surfaces its type/range/damage/traits into the
  // sub-header; entity traits/choices follow, deduped so a shared trait (e.g.
  // "Explosive") isn't listed twice.
  const foldedActionCells = foldedActionFields ? actionCells(foldedActionFields) : []
  const entityCells = [...traitCells(getTraits(entity) ?? []), ...choiceCells]
  const dedupedEntityCells = entityCells.filter(
    (cell) => !foldedActionCells.some((folded) => folded.key === cell.key)
  )
  const cells: NEWSubHeaderCell[] =
    isAction && action ? actionCells(action) : [...foldedActionCells, ...dedupedEntityCells]

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
        // The ghosted action header is light → ink text; entity tones → paper.
        isAction ? 'text-ink' : 'text-paper',
        compact ? 'text-sm' : 'text-base'
      )}
    >
      {hintText}
    </span>
  ) : undefined

  // ACTIONS wear the GHOSTED host tone on their HEADER band; their body stays
  // paper/ink like an entity, only the bands are off-colour. Entities use their
  // own medium tone on the header.
  const headerBg = isGhosted ? undefined : tone.bg
  const headerBgColor = ghost ? ghost.header : tone.bgColor

  const header = (
    <NEWCardHeader
      title={name}
      bg={headerBg}
      bgColor={headerBgColor}
      titleClass={titleClass}
      stats={headerStats}
      rightContent={flavorNode}
      listing={size === 'listing'}
      compact={compact}
    />
  )

  // Frame lives on the INNER clipping element (3px tone, radius + clip on one
  // element — the mockup `.ec`). The OUTER div is overflow-visible only so the
  // seam escapes the clip.
  if (size === 'listing') {
    return (
      <div className={cn('relative flex flex-col overflow-visible', className)}>
        {seam}
        <div
          className="flex flex-1 flex-col overflow-hidden rounded-card bg-paper"
          style={{ border: `3px solid ${frameColor}` }}
        >
          {header}
        </div>
      </div>
    )
  }

  // BODY — content + nested groups. Granting abilities collapse: the ability's
  // own content AND actions are suppressed (they belong to the granted entity);
  // its description shows as header flavor, then the Grants nested cards.
  const grantedCount = resolveGrantedEntities(entity as SURefEntity).length
  const isGrantingAbility = isAbility(entity) && grantedCount > 0
  const content = 'content' in entity ? entity.content : undefined
  const showContent = !isGrantingAbility && !isTitanicMeta && !!content && content.length > 0
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
  const canExpand = !isAction && depth < MAX_DEPTH
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
    !isPattern && 'patterns' in entity && Array.isArray(entity.patterns)
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
  const showBodyContent =
    isPattern || isTitanicMeta
      ? !!bodyContent && bodyContent.length > 0
      : showContent && !!bodyContent && bodyContent.length > 0
  // TITANIC actions always get their own full-width row (never the masonry).
  const titanicActions = allActions.filter(isTitanicAction)
  const normalActions = allActions.filter((a) => !isTitanicAction(a))
  // SINGLE-ACTION FOLD (see `foldedAction` above): its content inlines into the
  // body; its stats already merged into the sub-header. 2+ → an actions grid.
  const foldSingleAction = !!foldedAction
  const foldedActionContent = foldedAction?.content ?? undefined
  const gridActions = foldSingleAction ? [] : normalActions

  // Leaf data — bonus-per-tech-level stat increases (choices now live in the
  // sub-header, so no "Choices" body section).
  const bonusPerTechLevel =
    'bonusPerTechLevel' in entity && entity.bonusPerTechLevel
      ? (entity.bonusPerTechLevel as SURefObjectBonusPerTechLevel)
      : undefined
  const bonusCellList = bonusPerTechLevel ? bonusCells(bonusPerTechLevel, compact) : []

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
    if (flat) {
      return entities.map((nested, index) => (
        <div key={cardKey(nested, index)} className="mb-1.5 flow-root">
          <NEWReferenceEntityCard
            size="compact"
            depth={depth + 1}
            data={nested}
            parentSeal={seal}
            hostTone={childHostTone}
            chassisName={resolvedChassisName}
          />
        </div>
      ))
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
                <NEWReferenceEntityCard
                  size="compact"
                  depth={depth + 1}
                  data={nested}
                  parentSeal={seal}
                  hostTone={childHostTone}
                  chassisName={resolvedChassisName}
                />
              </div>
            ))}
          </div>
        )}
        {orphan && (
          <NEWReferenceEntityCard
            key={cardKey(orphan, entities.length - 1)}
            size="compact"
            depth={depth + 1}
            data={orphan}
            parentSeal={seal}
            hostTone={childHostTone}
            chassisName={resolvedChassisName}
          />
        )}
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
        className="shrink-0 bg-su-black px-1 py-0.5 font-cond text-xs font-bold uppercase tracking-caps-tight text-paper"
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
        flat ? (
          <div key={cardKey(item, index)} className="mb-1.5 flow-root">
            <NEWReferenceEntityCard size="listing" depth={depth + 1} data={item} />
          </div>
        ) : (
          <NEWReferenceEntityCard
            key={cardKey(item, index)}
            size="listing"
            depth={depth + 1}
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
          <NEWReferenceEntityCard
            key={cardKey(npc, index)}
            size="compact"
            depth={depth + 1}
            data={npc}
            hostTone={ownToneBase}
            chassisName={resolvedChassisName}
          />
        ))}
      </div>
    ) : undefined

  return (
    <div className={cn('relative flex flex-col overflow-visible', className)}>
      {seam}
      <div
        className="flex flex-1 flex-col overflow-hidden rounded-card bg-paper"
        style={{ border: `3px solid ${frameColor}` }}
      >
        {header}
        {/* EP/AP cost leads the action sub-header row; the bonus-per-tech-level
            group (Badge + "+N" cells) wraps together after the trait cells. */}
        <NEWSubHeader
          bgColor={darkTone}
          cells={cells}
          leading={costNode}
          group={
            bonusCellList.length > 0
              ? { label: 'Bonus per Tech Level', cells: bonusCellList }
              : undefined
          }
          compact={compact}
        />
        <div
          className={cn(
            // Non-flat body: a MIN height with content vertically centered, so a
            // short body (e.g. an action's one-line description) sits centered in
            // the band instead of top-aligned with a gap below; taller content
            // grows normally. (Flat/anchor bodies use flow-root for the float.)
            flat ? 'flow-root' : 'flex min-h-[2.5rem] flex-1 flex-col justify-center gap-1.5',
            compact ? 'p-2' : 'p-3'
          )}
        >
          {anchorNode}
          {/* Content blocks get a clear gap below (mb-3) before the nested-card
              sections, so nested cards never crowd the parent's description. */}
          {showBodyContent && bodyContent && (
            <div className="[&:not(:last-child)]:mb-3">
              <BlockContentRendererView
                content={bodyContent}
                compact={compact}
                chassisName={resolvedChassisName}
                fontSize={compact ? 'text-xs' : 'text-sm'}
                headerBg={tone.bg}
                headerBgColor={tone.bgColor}
              />
            </div>
          )}
          {foldedActionContent && foldedActionContent.length > 0 && (
            <div className="flex flex-col gap-1.5 [&:not(:last-child)]:mb-3">
              {/* The folded action keeps its NAME as a centered section heading
                  ONLY when it differs from the entity — a same-named action (e.g.
                  Grenade's own "Grenade" action) would be redundant noise. */}
              {foldedAction?.name &&
                foldedAction.name !== entityName &&
                renderSectionHeading(foldedAction.name)}
              <BlockContentRendererView
                content={foldedActionContent}
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
          {damagedEffect && damagedBands && (
            <div
              className="overflow-hidden rounded-card"
              style={{ border: `3px solid ${damagedBands.frame}` }}
            >
              <div
                className="flex items-center px-3 py-1.5"
                style={{ backgroundColor: damagedBands.header }}
              >
                <span
                  className="block bg-su-black px-1 py-0.5 font-cond text-xs font-bold uppercase tracking-caps-tight text-paper"
                  style={{ lineHeight: 1 }}
                >
                  When Damaged
                </span>
              </div>
              <p className="bg-paper p-2 text-xs leading-snug text-ink">{damagedEffect}</p>
            </div>
          )}

          {/* CHASSIS ABILITY — a "Chassis Ability" stampseal on each card. */}
          {chassisAbilityEntities.length > 0 &&
            renderNested(
              chassisAbilityEntities,
              { label: 'Chassis Ability', tone: darkTone },
              ownToneBase,
              flat
            )}

          {/* DRONE — the compact drone card; its systems + modules render INSIDE
              the drone card (via the `droneLoadout` prop), NOT here. */}
          {droneInfo &&
            (flat ? (
              <div className="mb-1.5 flow-root">
                <NEWReferenceEntityCard
                  size="compact"
                  depth={depth + 1}
                  data={droneInfo.drone}
                  chassisName={resolvedChassisName}
                  droneLoadout={{ systems: droneInfo.systems, modules: droneInfo.modules }}
                />
              </div>
            ) : (
              <NEWReferenceEntityCard
                size="compact"
                depth={depth + 1}
                data={droneInfo.drone}
                chassisName={resolvedChassisName}
                droneLoadout={{ systems: droneInfo.systems, modules: droneInfo.modules }}
              />
            ))}

          {/* THIS card's OWN drone loadout (when it is a drone) — systems +
              modules as listings, nested inside the drone card's own body. */}
          {droneSystems.length > 0 && renderListingGroup('Systems', droneSystems, flat)}
          {droneModules.length > 0 && renderListingGroup('Modules', droneModules, flat)}

          {/* PATTERN view → loadout groups. BASIC chassis / entities → nested groups. */}
          {inFlowGroups.map((group) => renderNestedGroup(group.label, group.entities, flat))}

          {gridActions.length > 0 &&
            renderGroup(
              'Actions',
              gridActions as unknown as SURefEntity[],
              { hostTone: ownToneBase },
              flat
            )}

          {/* Titanic actions — a full-width row of their own, never masonry. */}
          {titanicActions.map((action, index) =>
            flat ? (
              <div
                key={cardKey(action as unknown as SURefEntity, index)}
                className="mb-1.5 flow-root"
              >
                <NEWReferenceEntityCard
                  size="compact"
                  depth={depth + 1}
                  data={action as unknown as SURefEntity}
                  hostTone={ownToneBase}
                  chassisName={resolvedChassisName}
                />
              </div>
            ) : (
              <NEWReferenceEntityCard
                key={cardKey(action as unknown as SURefEntity, index)}
                size="compact"
                depth={depth + 1}
                data={action as unknown as SURefEntity}
                hostTone={ownToneBase}
                chassisName={resolvedChassisName}
              />
            )
          )}

          {/* BASIC CHASSIS → a LIST of its patterns as LISTING rows. */}
          {patternList.length > 0 && (
            <div className={flat ? 'mb-1.5' : 'flex flex-col gap-1.5'}>
              <Slab variant="dashed" label="Patterns" />
              <div className={flat ? undefined : 'flex flex-col gap-1.5'}>
                {patternList.map((pat) =>
                  flat ? (
                    <div key={pat.name} className="mb-1.5 flow-root">
                      <NEWReferenceEntityCard
                        data={data}
                        pattern={pat}
                        size="listing"
                        depth={depth + 1}
                      />
                    </div>
                  ) : (
                    <NEWReferenceEntityCard
                      key={pat.name}
                      data={data}
                      pattern={pat}
                      size="listing"
                      depth={depth + 1}
                    />
                  )
                )}
              </div>
            </div>
          )}
        </div>
        {depth === 0 && (
          <NEWIdentityFooter
            bgColor={darkTone}
            typeLabel={footerType}
            source={getSource(entity)}
            booklet={getBooklet(entity)}
            page={getPageReference(entity)}
            compact={compact}
          />
        )}
      </div>
    </div>
  )
}
