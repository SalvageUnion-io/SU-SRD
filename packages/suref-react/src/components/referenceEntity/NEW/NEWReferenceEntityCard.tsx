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
  SalvageUnionReference,
  extractVisibleActions,
  getAssetUrl,
  getBooklet,
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
import { resolveNestedEntities, resolvePatternGroups } from './resolveNestedEntities'

export type { NEWReferenceEntityCardSize } from './newCardTone'

/** Beyond this nesting depth a card renders header-only (no body expansion) —
 * bounds runaway recursion (deep chassis → systems → actions, or grant cycles). */
const MAX_DEPTH = 3

/** The distinct tone the parent-provided "GRANTS" stampseal wears — a bright
 * game-blue, deliberately off the domain/rust tones so a grant reads at a glance. */
const GRANT_SEAL_TONE = 'var(--color-su-blue-game)'

/** The distinct tone the CHASSIS-name stampseal wears on a PATTERN card — a
 * brick brown, off the grant-blue/rust so a pattern's parent chassis reads at
 * a glance. */
const CHASSIS_SEAL_TONE = 'var(--color-su-brick)'

/** A titanic action (bio-titan "Titanic Actions") — gets its own full-width row. */
function isTitanicAction(action: { name?: string }): boolean {
  return /titanic action/i.test(action.name ?? '')
}

/** Resolve a chassis's `chassisAbilities` (name refs) to their ability entities. */
function resolveChassisAbilityEntities(entity: SURefMetaEntity): SURefEntity[] {
  if (!('chassisAbilities' in entity) || !Array.isArray(entity.chassisAbilities)) return []
  const out: SURefEntity[] = []
  for (const ref of entity.chassisAbilities as unknown[]) {
    if (typeof ref !== 'string') continue
    const found = SalvageUnionReference.findIn('abilities', (a) => a.name === ref)
    if (found) out.push(found)
  }
  return out
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
   * the PATTERN view — pattern name as the title, the chassis name as a seam
   * stampseal, and the pattern's systems/modules loadout as nested cards. */
  pattern?: SURefObjectPattern
  /** Pattern LIST row: a compact summary (name + brief description only) — no
   * loadout, no chassis seal. Used by the basic chassis's pattern list. */
  patternSummary?: boolean
  /** The SUMMONING (parent) entity's tone as a resolvable CSS colour — threaded
   * onto a nested ACTION card, whose bands are this tone GHOSTED. */
  hostTone?: string
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

/** `bonusPerTechLevel` fields → short-labelled "+N" cells (zeros/absent dropped). */
const BONUS_LABELS: [keyof SURefObjectBonusPerTechLevel, string][] = [
  ['structurePoints', 'SP'],
  ['energyPoints', 'EP'],
  ['heatCapacity', 'Heat'],
  ['systemSlots', 'Sys'],
  ['moduleSlots', 'Mod'],
  ['cargoCapacity', 'Cargo'],
  ['salvageValue', 'SV'],
]

function bonusCells(bonus: SURefObjectBonusPerTechLevel): NEWSubHeaderCell[] {
  return BONUS_LABELS.flatMap(([field, label]) => {
    const amount = bonus[field]
    return typeof amount === 'number' && amount !== 0
      ? [{ key: `bonus-${field}`, label, value: `+${amount}` }]
      : []
  })
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
  size = 'full',
  depth = 0,
  parentSeal,
  pattern,
  patternSummary = false,
  hostTone,
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
  const compact = depth > 0 || size !== 'full'
  const tone = resolveCardTone(schemaName, entity)
  // ACTIONS inherit the summoning (parent) entity's tone, GHOSTED (D8): the
  // header + sub-header bands + 3px frame use the ghosted host tone; the body
  // stays paper/ink. A standalone action (no host) falls back to a neutral base.
  const ghost = isAction ? ghostActionTone(hostTone ?? 'var(--color-su-black)') : undefined
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
  // stats / tone / source. The chassis name rides the seam as a stampseal
  // (except in a summary list row, where it would be redundant).
  const isPattern = !!pattern
  const name = isPattern ? pattern.name : entityName
  const effectiveSeal =
    isPattern && !patternSummary ? { label: entityName, tone: CHASSIS_SEAL_TONE } : parentSeal

  // SEAM — type stamp + axis pills. Actions show their action type; a pattern
  // reads "Pattern"; entities show the schema type + classification pills.
  const action = isAction ? (entity as ActionFields) : undefined
  // The "Titanic Actions" entry is a meta-descriptor for the titanic-action
  // SYSTEM, not a regular action — it suppresses the "Action" seam stamp and
  // shows its rules text as a header hint (not in the body).
  const isTitanicMeta = isAction && isTitanicAction(entity as { name?: string })
  // Actions carry NO seam type stamp — their classification lives in the
  // sub-header row (see actionCells). Patterns read "Pattern"; entities show
  // their schema type.
  const seamType = isPattern ? 'Pattern' : isAction ? undefined : resolveEyebrow(schemaName).type
  const axisMarkers = isAction || isPattern ? [] : resolveAxisMarkers(entity)

  const seam = (
    <div className={cn(STAMP_SEAM, 'left-3 flex items-center gap-1.5')}>
      {effectiveSeal && (
        <span
          className="inline-block w-fit border border-ink px-1 py-0.5 font-cond text-badge font-bold uppercase leading-none tracking-caps-tight text-paper"
          style={{ backgroundColor: effectiveSeal.tone, lineHeight: 1 }}
        >
          {effectiveSeal.label}
        </span>
      )}
      {seamType && <Stamp size="sm">{seamType}</Stamp>}
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
  const headerStats: StatItem[] =
    isAction || patternSummary
      ? []
      : (size === 'listing'
          ? buildReferenceEntityStats(entity, {
              compact,
              primaryOnly: true,
              schemaName: schemaName as SURefEnumSchemaName,
              techLevel,
            })
          : buildReferenceEntityStats(entity, {
              compact,
              schemaName: schemaName as SURefEnumSchemaName,
              techLevel,
            })
        ).map(abbreviateStat)

  const costNode: ReactNode =
    isAction && action?.activationCost != null ? (
      <ActivationCostBox
        cost={action.activationCost}
        currency={resolveActivationCurrency(action.actionSource)}
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
  const cells: NEWSubHeaderCell[] =
    isAction && action
      ? actionCells(action)
      : [...traitCells(getTraits(entity) ?? []), ...choiceCells]

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
  const hintText = description ?? (titanicHintText || undefined)
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
  const headerBg = isAction ? undefined : tone.bg
  const headerBgColor = ghost ? ghost.header : tone.bgColor

  const header = (
    <NEWCardHeader
      title={name}
      bg={headerBg}
      bgColor={headerBgColor}
      titleClass={titleClass}
      stats={headerStats}
      rightContent={flavorNode}
      compact={compact}
    />
  )

  // Frame lives on the INNER clipping element (3px tone, radius + clip on one
  // element — the mockup `.ec`). The OUTER div is overflow-visible only so the
  // seam escapes the clip.
  if (size === 'listing') {
    return (
      <div className={cn('relative overflow-visible', className)}>
        {seam}
        <div
          className="overflow-hidden rounded-card bg-paper"
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

  // Only entities expand (actions are leaves, pattern views show their loadout);
  // bounded by MAX_DEPTH.
  const canExpand = !isAction && depth < MAX_DEPTH
  const canExpandEntity = canExpand && !isPattern
  const nestedGroups = canExpandEntity ? resolveNestedEntities(entity) : []
  const chassisAbilityEntities = canExpandEntity ? resolveChassisAbilityEntities(entity) : []
  const allActions =
    canExpandEntity && !isGrantingAbility ? (extractVisibleActions(entity) ?? []) : []

  // PATTERN view: the chosen pattern's systems/modules/drones loadout (unless a
  // summary row). BASIC chassis: the list of patterns (name + brief desc rows).
  const patternGroups = isPattern && pattern && !patternSummary ? resolvePatternGroups(pattern) : []
  const patternList: SURefObjectPattern[] =
    !isPattern && 'patterns' in entity && Array.isArray(entity.patterns)
      ? (entity.patterns as SURefObjectPattern[])
      : []
  // Artwork is shown on full + nested cards (CardImage handles the compact
  // size), but omitted on the tight pattern-summary list rows.
  const showImage = !!assetUrl && !patternSummary
  // Body prose — the pattern's own flavor in a pattern view, else the entity's.
  const bodyContent =
    isPattern && pattern ? pattern.content : isTitanicMeta ? titanicBodyContent : content
  const showBodyContent =
    isPattern || isTitanicMeta
      ? !!bodyContent && bodyContent.length > 0
      : showContent && !!content && content.length > 0
  // TITANIC actions always get their own full-width row (never the masonry).
  const titanicActions = allActions.filter(isTitanicAction)
  const normalActions = allActions.filter((a) => !isTitanicAction(a))
  // SINGLE-ACTION FOLD: a lone (non-titanic) action is the entity's own effect —
  // inline its content into the body (no action card, no "Actions" Slab). 2+ → grid.
  const foldSingleAction = normalActions.length === 1
  const foldedActionContent = foldSingleAction
    ? (normalActions[0]?.content ?? undefined)
    : undefined
  const gridActions = foldSingleAction ? [] : normalActions

  // Leaf data — bonus-per-tech-level stat increases (choices now live in the
  // sub-header, so no "Choices" body section).
  const bonusPerTechLevel =
    'bonusPerTechLevel' in entity && entity.bonusPerTechLevel
      ? (entity.bonusPerTechLevel as SURefObjectBonusPerTechLevel)
      : undefined
  const bonusCellList = bonusPerTechLevel ? bonusCells(bonusPerTechLevel) : []

  const cardKey = (nested: SURefEntity, index: number): string =>
    `${'id' in nested && typeof nested.id === 'string' ? nested.id : 'nested'}-${index}`

  // Nested cards pack into a 2-column masonry (heights balance across the two
  // columns); a lone card — or the trailing orphan of an odd count — spans the
  // full width so no half-row is left empty. 1 column on narrow widths.
  const renderNested = (
    entities: SURefEntity[],
    seal?: { label: string; tone: string },
    childHostTone?: string
  ): ReactNode => {
    const isOdd = entities.length % 2 === 1
    const columnCards = isOdd ? entities.slice(0, -1) : entities
    const orphan = isOdd ? entities[entities.length - 1] : undefined
    return (
      <>
        {columnCards.length > 0 && (
          <div className="columns-1 gap-2 sm:columns-2">
            {columnCards.map((nested, index) => (
              <div key={cardKey(nested, index)} className="mb-2 break-inside-avoid">
                <NEWReferenceEntityCard
                  size="compact"
                  depth={depth + 1}
                  data={nested}
                  parentSeal={seal}
                  hostTone={childHostTone}
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
          />
        )}
      </>
    )
  }

  // Grants → NO Slab, a "GRANTS" stampseal on each nested card. NPCs → NO Slab.
  // Everything else (Systems/Modules/Drones) keeps its Slab separator.
  const renderGroup = (
    label: string,
    entities: SURefEntity[],
    opts?: { slab?: boolean; seal?: { label: string; tone: string }; hostTone?: string }
  ): ReactNode => (
    <div key={label} className="flex flex-col gap-2">
      {opts?.slab !== false && <Slab variant="solid" label={label} count={entities.length} />}
      {renderNested(entities, opts?.seal, opts?.hostTone)}
    </div>
  )

  const renderNestedGroup = (label: string, entities: SURefEntity[]): ReactNode => {
    if (label === 'Grants')
      return renderGroup(label, entities, {
        slab: false,
        seal: { label: 'Grants', tone: GRANT_SEAL_TONE },
      })
    if (label === 'NPCs') return renderGroup(label, entities, { slab: false })
    return renderGroup(label, entities)
  }

  return (
    <div className={cn('relative overflow-visible', className)}>
      {seam}
      <div
        className="overflow-hidden rounded-card bg-paper"
        style={{ border: `3px solid ${frameColor}` }}
      >
        {header}
        {/* EP/AP cost leads the action sub-header row, before Range/Damage/Traits. */}
        <NEWSubHeader bgColor={darkTone} cells={cells} leading={costNode} compact={compact} />
        <div className={cn('flex flex-col gap-2', compact ? 'p-2' : 'p-3.5')}>
          {/* TOP MATTER — the artwork (floated left) + prose. This wrapper is a
              flex item, so it establishes its own formatting context: the
              floated CardImage is contained here and the prose wraps beside it,
              while the structured sections below stay full-width. */}
          {(showImage ||
            (showBodyContent && bodyContent) ||
            (foldedActionContent && foldedActionContent.length > 0)) && (
            <div>
              {showImage && assetUrl && (
                <CardImage url={assetUrl} alt={`${entityName} illustration`} compact={compact} />
              )}
              {showBodyContent && bodyContent && (
                <BlockContentRendererView
                  content={bodyContent}
                  compact={compact}
                  fontSize={compact ? 'text-xs' : 'text-sm'}
                  headerBg={tone.bg}
                  headerBgColor={tone.bgColor}
                />
              )}
              {foldedActionContent && foldedActionContent.length > 0 && (
                <BlockContentRendererView
                  content={foldedActionContent}
                  compact={compact}
                  fontSize={compact ? 'text-xs' : 'text-sm'}
                  headerBg={tone.bg}
                  headerBgColor={tone.bgColor}
                />
              )}
            </div>
          )}

          {/* CHASSIS ABILITIES render directly below the description/content. */}
          {chassisAbilityEntities.map((ability, index) => (
            <NEWReferenceEntityCard
              key={cardKey(ability, index)}
              size="compact"
              depth={depth + 1}
              data={ability}
            />
          ))}

          {bonusCellList.length > 0 && (
            <div className="flex flex-col gap-2">
              <Slab variant="solid" label="Bonus per Tech Level" />
              <div className="flex flex-wrap items-center gap-1.5">
                {bonusCellList.map((cell) => (
                  <StatDisplay
                    key={cell.key}
                    orientation="horizontal"
                    label={cell.label}
                    value={cell.value}
                    xs={compact}
                    compact={!compact}
                  />
                ))}
              </div>
            </div>
          )}

          {/* PATTERN view → its systems/modules/drones loadout. BASIC chassis /
              other entities → their own nested groups. */}
          {(isPattern ? patternGroups : nestedGroups).map((group) =>
            renderNestedGroup(group.label, group.entities)
          )}

          {gridActions.length > 0 &&
            renderGroup('Actions', gridActions as unknown as SURefEntity[], {
              hostTone: ownToneBase,
            })}

          {/* Titanic actions — a full-width row of their own, never masonry. */}
          {titanicActions.map((action, index) => (
            <NEWReferenceEntityCard
              key={cardKey(action as unknown as SURefEntity, index)}
              size="compact"
              depth={depth + 1}
              data={action as unknown as SURefEntity}
              hostTone={ownToneBase}
            />
          ))}

          {/* BASIC CHASSIS → a LIST of its patterns (name + brief desc summary
              rows), each a compact PATTERN card with no loadout. */}
          {patternList.length > 0 && (
            <div className="flex flex-col gap-2">
              <Slab variant="solid" label="Patterns" count={patternList.length} />
              <div className="flex flex-col gap-2">
                {patternList.map((pat) => (
                  <NEWReferenceEntityCard
                    key={pat.name}
                    data={data}
                    pattern={pat}
                    patternSummary
                    size="compact"
                    depth={depth + 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        {depth === 0 && (
          <NEWIdentityFooter
            bgColor={darkTone}
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
