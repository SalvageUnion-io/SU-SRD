import type { ComponentType, ReactNode } from 'react'
import type {
  RefEntity,
  RefEnumSchemaName,
  RefMetaEntity,
  RefObjectAnyPattern,
  RefObjectDamage,
  RefObjectTrait,
} from 'salvageunion-reference'
import type { Size } from '../../../styles/sizing'
import type { EntityStatus } from '../../atoms/entityStatus'
import type { CardExtent } from '../../containers/displayMode'
import type { StatItem } from '../../containers/statsBarTypes'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'
import type { Down } from './cardChrome'

/** Inline foot meta entry (design-spec §2.1 `.ec__metafoot`), e.g. AP COST · 1 */
export type CardFootMeta = { label: string; value: ReactNode }

/**
 * What a card can render: the plain reference union PLUS the meta union —
 * actions, ability-tree requirements and crawler tech levels are meta-only,
 * and nested recursion (folded/grid/titanic actions, chassis abilities) feeds
 * them straight back through the card.
 */
export type ReferenceCardEntity = RefEntity | RefMetaEntity

export type ReferenceEntityCardProps = {
  data: ReferenceCardEntity
  size?: Size
  /** How much of the entity renders — orthogonal to `size`, so a `mini` card
   * can still show its whole content. */
  extent?: CardExtent
  /** Nesting level — 0 = full/solo, ≥1 = nested (compact, no footer, smaller
   * header, one step down per level). Threaded through the recursion. */
  depth?: number
  /** A parent-provided stampseal leading the header's labels (before the entity's own
   * type stamp), in a distinct tone — lets a group brand its nested cards
   * (e.g. GRANTS) without a separator row. */
  parentSeal?: { label: string; tone: string }
  /** Set the nested card's prose at the regular reading size (14px) instead of
   * the compact one. Every action card on a page uses it. */
  readable?: boolean
  /** CHASSIS TWO-RENDERINGS: when set (with a chassis `data`), the card renders
   * the PATTERN view — pattern name as the title, the pattern's systems/modules
   * loadout as nested cards (at `extent="head"` the pattern is its Mini). */
  pattern?: RefObjectAnyPattern
  /**
   * PAGE — the card IS the page (boards 07, 08): an SRD entity page. The card
   * draws no frame, header or footer, because the page's `ChapterBand`
   * carries the title and stamps and its `ChapterFoot` the citation (both
   * resolved by `resolveEntityPageMeta`). The body lays out as a page: the line
   * art as the hero, the chassis ability, the prose and the book's stat column
   * beside it, and everything the entity carries beneath. Only a top-level
   * card takes it; nested cards stay cards, except that an action a Page carries
   * takes it to set its chips at the page's rung.
   */
  presentation?: 'card' | 'page'
  /**
   * PAGE only: the hero in place of the entity's own art — a saved pattern's
   * page shows its maker's photo, and lets its maker change it.
   */
  hero?: ReactNode
  /**
   * BUILDER PICK — a chassis (or its pattern) card shows the chassis ability
   * as a page does, nested in the pick as a contentful Mini (N3, E19: The
   * app's mech-builder pick cards, where choosing needs it). It shows
   * even under `hide.actions`, which a picker
   * sets. Off everywhere else; nested cards never inherit it.
   */
  showChassisAbility?: boolean
  /**
   * Prose the HOST already prints, as `proseKey`s — a nested child hides any
   * paragraph that would repeat it (board E2). Threaded by the host.
   */
  shownProse?: string[]
  /**
   * USER-MADE (ruleset §3.9): something a player made that could pass
   * for the book — a mech pattern, an NPC. A dashed ink frame, a dashed
   * HOMEBREW stamp in the header's labels, a dashed footer rule and a dashed pill, at
   * every size and extent. Canon-built units (pilots, mechs, crawlers) never
   * set it.
   */
  userMade?: boolean
  /**
   * USER-MADE credit (ruleset §3.9): who made it. With `userMade` the footer
   * reads just "Made by [madeBy]" in place of the book citation — a player's
   * pattern is not on any page of the book, and the chassis it is built on
   * must not lend it one. Without it the credit reads "Made by a player".
   * Ignored without `userMade`.
   */
  madeBy?: string
  /**
   * Replaces the type stamp in the header's labels and the type label in the identity
   * footer — "NPC · from Veteran", "Crawler crew · Med Bay". For a user-made
   * thing that says what it was built from; a canon entity's type is its own.
   */
  kicker?: string
  /**
   * The light speckle on the header (ruleset §3.5) — on by default. `false`
   * turns it off for this card and every card nested in it: a peek and the
   * Mediator's SRD explorer stay flat.
   */
  texture?: boolean
  /** The SUMMONING (parent) entity's display name — threaded so a nested
   * ACTION whose dataset name carries the ` (Host)`
   * disambiguation suffix (e.g. "Refine (Nanite Sifter)") drops it when the
   * host card already establishes that context. Display-only; the data keeps
   * the full unique name. */
  hostName?: string
  /** The parent is damaged or destroyed — threaded down so every nested card
   * in the subtree is down as its parent is (see `Down`). */
  hostDown?: Down
  /** The owning chassis's name — threaded down so `[(CHASSIS)]` tokens in nested
   * ability/drone/pattern content resolve to the chassis name. */
  chassisName?: string
  /** A DRONE card's systems/modules loadout, resolved by the parent (chassis
   * uses the drone's own loadout; a pattern uses its pattern-specific config).
   * Rendered as listings INSIDE this drone card, never at the parent level. */
  droneLoadout?: { systems: RefEntity[]; modules: RefEntity[] }

  // ─── WRITE LAYER (all additive — absent ⇒ read-only is byte-identical) ───
  /** Render guards that SUBTRACT already-rendered sections. */
  hide?: ReferenceEntityCardHideConfig
  /** The condition: damaged or destroyed greys the whole tone (header band
   * flat grey; sub-header + footer + frame the darker grey shade) and reads
   * as the `StatusBadge` in the head's state slot (C8). A control with
   * `status` is the one that steps it. */
  status?: EntityStatus
  /** Whole-card opacity-50 (an unavailable/inactive item). */
  disabled?: boolean
  /** Draw select mode's ink ring (`SELECTED_RING`) — non-layout-shifting. */
  selected?: boolean
  /** The word on the ink seal a `selected` Card wears on its head band's
   * right (hard rule R15): "Selected" by default. A Mini (`extent="head"`) is
   * ring only, never sealed. */
  selectionSeal?: string
  /** A rust "Suggested" stamp leading the sub-header — a recommended pick. */
  suggested?: boolean
  /** Off: select mode's one dim (`SELECT_DIM`, hard rule R15) — an option the
   * picker cannot take, demotes, or has not chosen. */
  selectable?: boolean
  /** Whole-card click → role=button + hover-enlarge + focus ring. */
  onCardClick?: () => void
  /** Enable the hover-enlarge/role=button affordance without a click handler. */
  cardClickable?: boolean
  /**
   * Selection a11y for a whole-card toggle (picker cells). When set alongside
   * `selected` + a card click, the interactive wrapper announces the selection
   * state natively: `'toggle'` → `role="button"` + `aria-pressed`, `'radio'` →
   * a `RadioCard` (`role="radio"` + `aria-checked`; put it in a
   * `RadioCardGroup`, or MasonryColumns' `radio`, for the arrow keys).
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
  /** Parent entity for choice-cap resolution (`cardinality.max.scalesWith`, e.g. techLevel) —
   * when a host (mech/pilot) supplies the scaling field instead of the entity.
   * Its `techLevel` also drives `perTechLevel` datavalue scaling (e.g. Custom
   * Sniper Rifle damage) — the crawler level in the app. */
  scalingParent?: Record<string, unknown>
  /** Extra content on the accent field after the body box, before the footer
   * (e.g. a crawler bay's crew inset). */
  expand?: ReactNode
  /** The state a card's own folding sections start in (a crawler bay's Bay
   * Info and When Damaged), when they fold. On the reference nothing folds
   * (owner, round 4: "None should be collapsible in reference cards"), so
   * the default is no fold; inside a Peek nothing folds either. */
  sectionFold?: 'open' | 'closed'

  // ─── SLOT OVERRIDES (generic extension seams — additive) ───
  titleOverride?: string
  statsOverride?: StatItem[]
  subtitleExtra?: ReactNode
  afterExtraContent?: ReactNode
  /** ASIDE LEAD — opt in when this card's `afterExtraContent` is a SECTION of
   * its own (the class pages' ability trees) rather than trailing body content.
   * The artwork and flavour prose become a centred lead row and the trailing
   * section spans the full width beneath, instead of wrapping the illustration.
   *
   * Explicit, NOT inferred from `afterExtraContent`: that slot is generic, and
   * its other producer is a pattern's Systems/Modules loadout
   * (`PatternLoadout`). A pattern card renders with the CHASSIS as its
   * `data`, so it inherits the chassis artwork and would otherwise satisfy an
   * inferred gate — flipping every app mech-wizard pattern card on an
   * artwork-bearing chassis to a layout meant only for class pages. Only the
   * class consumers set this. */
  asideLead?: boolean
  /** Write-layer: inline `[label value]` meta pairs (cost / SV) folded into the
   * identity footer's right side, before the source/page. */
  footMeta?: CardFootMeta[]
  className?: string
  /**
   * The title's element: `h1` for the entity an item page names, `h2` for a
   * card stacked on a page with no band above it (`stackedTitleLevel`), `h3`
   * for a card nested in a page's section (`nestedTitleLevel`), else `span`.
   */
  titleAs?: CardTitleTag
}

/** The element a card's title renders as: an item page's `h1`, a nested card's `h2`/`h3` on a page. */
export type CardTitleTag = 'span' | 'h1' | 'h2' | 'h3'

/** Write-layer: which already-rendered sections to suppress (additive guards). */
export type ReferenceEntityCardHideConfig = {
  actions?: boolean
  patterns?: boolean
  /**
   * Suppress the entity's (or its folded action's) roll table. Needed where the
   * whole card is itself a control — a list that wraps each
   * tile in a `role="button"` — since even the hidden table carries its own
   * Show/Roll buttons, which may not nest inside a button and whose clicks would
   * bubble into the card's own handler.
   */
  rollTable?: boolean
  damagedEffect?: boolean
  choices?: boolean
  content?: boolean
  /** Suppress the entity's artwork (a preview that has none to show). */
  image?: boolean
  /**
   * Suppress the classification pill right of the title (`[Bay | Standard]`,
   * `[Class | Base]`), where the context already says it: a bay on a crawler
   * sheet, drawn as the SRD's bay Page draws it, wears none.
   */
  axisMarkers?: boolean
  /** Suppress the nested groups (its drones, their Systems and Modules, a bay's When Damaged). */
  nested?: boolean
}

/** The action-shaped fields the card reads when `schemaName === 'actions'`. */
export type ActionFields = {
  range?: string[]
  damage?: RefObjectDamage
  traits?: RefObjectTrait[]
  activationCost?: string | number
  actionType?: string
  actionSource?: RefEnumSchemaName | 'actions'
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
