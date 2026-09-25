import type { ComponentType, ReactNode } from 'react'
import type {
  SURefEntity,
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectDamage,
  SURefObjectPattern,
  SURefObjectTrait,
} from 'salvageunion-reference'
import type { CardFootMeta } from '../../shared/Card'
import type { CardExtent, CardSize } from '../../shared/displayMode'
import type { EntityStatus } from '../../shared/entityStatus'
import type { StatItem } from '../../shared/statsBarTypes'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'

/**
 * What a card can render: the plain reference union PLUS the meta union —
 * actions, ability-tree requirements and crawler tech levels are meta-only,
 * and nested recursion (folded/grid/titanic actions, chassis abilities) feeds
 * them straight back through the card.
 */
export type ReferenceCardEntity = SURefEntity | SURefMetaEntity

export type ReferenceEntityCardProps = {
  data: ReferenceCardEntity
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
  /** ASIDE LEAD — opt in when this card's `afterExtraContent` is a SECTION of
   * its own (the class pages' ability trees) rather than trailing body content.
   * The artwork and flavour prose become a centred lead row and the trailing
   * section spans the full width beneath, instead of wrapping the illustration.
   *
   * Explicit, NOT inferred from `afterExtraContent`: that slot is generic, and
   * its other producer is a pattern's Systems/Modules loadout
   * (`useChassisPatternConfig`). A pattern card renders with the CHASSIS as its
   * `data`, so it inherits the chassis artwork and would otherwise satisfy an
   * inferred gate — flipping every ITUN mech-wizard pattern card on an
   * artwork-bearing chassis to a layout meant only for class pages. Only the
   * class consumers set this. */
  asideLead?: boolean
  afterChoicesContent?: ReactNode
  footerOverride?: ReactNode
  /** Write-layer: inline `[label value]` meta pairs (cost / SV) folded into the
   * identity footer's right side, before the source/page. */
  footMeta?: CardFootMeta[]
  /** Overrides the header's top-right flavor slot. */
  rightContent?: ReactNode
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
  /**
   * Suppress the entity's (or its folded action's) roll table. Needed where the
   * whole card is itself a control — the Dashboard's Actions deck wraps each
   * tile in a `role="button"` — since even the collapsible table carries its own
   * Show/Roll buttons, which may not nest inside a button and whose clicks would
   * bubble into the card's own handler.
   */
  rollTable?: boolean
  damagedEffect?: boolean
  choices?: boolean
  stats?: boolean
  content?: boolean
  footer?: boolean
}

/** The action-shaped fields the card reads when `schemaName === 'actions'`. */
export type ActionFields = {
  range?: string[]
  damage?: SURefObjectDamage
  traits?: SURefObjectTrait[]
  activationCost?: string | number
  actionType?: string
  actionSource?: SURefEnumSchemaName | 'actions'
}

/**
 * The card's own recursive body, handed to the section components that render
 * nested cards (guide steps, pattern loadouts, choice listings, …).
 *
 * Passed in rather than imported: every one of those sections lives in its own
 * module, and the card imports all of them, so importing the card back would
 * make each a circular dependency. The card passes itself.
 */
export type NestedCard = ComponentType<ReferenceEntityCardProps>
