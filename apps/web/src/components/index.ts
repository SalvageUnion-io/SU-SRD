/**
 * The styling foundation: tokens, style objects and one
 * stylesheet (ADR-046). Namespaced rather than spread flat into this
 * barrel, because the token names are deliberately generic (`color`, `space`,
 * `radius`) and read correctly only when qualified: `tokens.color.ink`.
 *
 * `tokens` is the values. The other two halves are `styles/index.css`
 * (the stateful half — `:hover`, `:focus-visible`, `:disabled`, `@media` —
 * which a style object cannot express at all) and `styles/sizing.ts`. The split
 * rule is in `.claude/rules/styling.md`; read it before migrating a component.
 *
 * There is no shared style-object set: a component that needs a style object
 * gets it beside its consumer, not in a speculative shared module.
 */
export * as tokens from '../design/tokens'
// Utilities — the ONE cn(): joins class names, dropping falsy entries.
export { cn } from '../lib/cn'
// The one dice source (Randsum): a named Salvage Union table rolls through
// @randsum/salvageunion, every other die through @randsum/roller.
export type { TableDie } from '../lib/dice'
export { dieForTable, rollD20, rollForTable } from '../lib/dice'
// THE show/hide fold: open state plus the toggle's aria-expanded / aria-controls.
export { useDisclosure } from '../lib/useDisclosure'
// The one viewport media-query hook (a breakpoint read in JS, not CSS).
export { useMediaQuery } from '../lib/useMediaQuery'
/** `CSSProperties` that also admits `--custom-property` keys (see styles/cssVars). */
export type { CSSVarStyle } from '../styles/cssVars'
export { ActivationCost } from './atoms/ActivationCost'
export type { BadgeTone } from './atoms/Badge'
// Badge — the unified stamp-chip family: the quiet keyword chip is
// `surface="quiet"`, the status badge is StatusBadge (domain vocabulary), and a
// pill is `Badge surface="outline"`/`"tone"`.
export { Badge } from './atoms/Badge'
// BreadcrumbTrail — a page's trail, for the Union bar or a page's band (`ChapterBandTrail`)
export { BreadcrumbTrail } from './atoms/BreadcrumbTrail'
export { Button } from './atoms/Button'
export { buttonVariants } from './atoms/buttonVariants'
// ChapterBand — the page title notched into a band in the chapter's colour
export { ChapterBand } from './atoms/ChapterBand'
export { ChapterBandTrail } from './atoms/ChapterBandTrail'
export { Checkbox } from './atoms/Checkbox'
// CloseButton — the one ×: every dialog, drawer and sheet closes on it.
export { ChipButton } from './atoms/ChipButton'
export { CloseButton } from './atoms/CloseButton'
// Conditions — the entity-condition chip row. Public because the app's sheet
// chip-well editor (`ChipListEditor`) composes it.
export { Conditions } from './atoms/Conditions'
// Copied — a copy control's own Check swap and polite status (chrome K5).
export { CopiedIcon, CopiedStatus } from './atoms/Copied'
// capsLabel — the one caps recipe (R14): a label in caps asks it for its class.
export type { CapsLabelProps } from './atoms/capsLabel'
export { capsLabel } from './atoms/capsLabel'
export type { ChapterTone } from './atoms/chapterBandColor'
export { CHAPTER_BAND_COLOR } from './atoms/chapterBandColor'
export { Eyebrow } from './atoms/Eyebrow'
export { Field, Select } from './atoms/Field'
// FieldError — the one single-message validation line (role="alert", danger tone)
export { FieldError } from './atoms/FieldError'
// Skeletons
export { Ghost } from './atoms/Ghost'
export { heatDangerFrom } from './atoms/heatLevel'
// The one link look (ruleset §3.1): rust is painted only by Button and by
// InlineRef, so a prose link in either app is an InlineRef.
export { InlineRef } from './atoms/InlineRef'
export { Input, Textarea } from './atoms/inputs'
// The focus vocabulary — exported so the apps' focus treatment uses these
// rungs rather than their own.
export { FOCUS_RING } from './atoms/interaction'
// KofiButton — the Ko-fi support widget, with a plain link until its script loads
export { KofiButton } from './atoms/KofiButton'
export { useModKeyHint } from './atoms/modKeyHint'
export { NextLabel } from './atoms/NextLabel'
// slotPips — a slot count as a line of pips, for a wizard's tracker tab.
export { slotPips } from './atoms/pipRows'
export { linesFromBreakdown, summarizeBreakdown } from './atoms/provenanceLines'
export { Radio } from './atoms/Radio'
export { SearchField } from './atoms/SearchField'
export { Segmented, SegmentedOption } from './atoms/Segmented'
// SkipLink — the one skip-to-content link, first in every document (K9).
export { SkipLink } from './atoms/SkipLink'
export type { SlabCount } from './atoms/Slab'
export { Slab } from './atoms/Slab'
// Cargo / inventory — dashed addressable slot cells (ruleset §5, atom 10)
export { SlotGrid } from './atoms/SlotGrid'
// Speckle — the light speckle on a colour band or ink ground (ruleset §3.5.1).
export { Speckle } from './atoms/Speckle'
export type { StatState } from './atoms/Stat'
export { Stat } from './atoms/Stat'
export { StatColumn } from './atoms/StatColumn'
export type { ProvenanceLine } from './atoms/StatProvenance'
export { StatusBadge } from './atoms/StatusBadge'
export { Switch } from './atoms/Switch'
export { Tab, TabList, TabPanel, Tabs } from './atoms/Tabs'
// Base typography
export { Text } from './atoms/Text'
export { Toggle } from './atoms/Toggle'
export { ToggleCard } from './atoms/ToggleCard'
// ToneStrip — the 8px colour band that opens a section from above (§3.10).
export { ToneStrip } from './atoms/ToneStrip'
export { TrackStep } from './atoms/TrackStep'
export { useCopied } from './atoms/useCopied'
// USER_MADE_HATCH — the hatch a user-made page wears on its colour bands
// (ruleset §3.9): ChapterBand's `userMade`, and the page's hatched foot.
export { USER_MADE_HATCH } from './atoms/userMadeHatch'
// Stat trackers (The app design handoff — design-spec §2.7)
export { VitalGauge } from './atoms/VitalGauge'
// AbilityTrack — an ability tree on its track (tier numerals, a Legendary
// tree's "or"): the SRD's class page and abilities Tree, the app's pilot sheet.
export { AbilityTrack } from './compositions/AbilityTrack'
// AccountMenu — who is signed in, at the Union bar's end, on both tools.
export { AccountMenu } from './compositions/AccountMenu'
export { AppBar } from './compositions/AppBar'
// Deliberately its own module rather than the card-image component's file,
// which stays internal.
// The reference site's item pages need this string for their `rel=preload`: it must match the
// `sizes` on the <img> exactly, or the preload selects a different candidate
// and the page fetches two files instead of one.
export { assetSrcSetFor } from './compositions/assetSrcSet'
// BrandCard — the site's own 1200 × 630 link preview, the Discord banner's face.
export { BrandCard } from './compositions/BrandCard'
// The searcher picker's modal width — for a bare ModalShell wrapping an
// EntitySearcher (The app's SheetPickerModal applies it itself).
// ContentsChapter — a chapter of the Contents: the SRD home's index, the Mediator's Reference
export type { ContentsRow } from './compositions/ContentsChapter'
export { ContentsChapter } from './compositions/ContentsChapter'
export { heroImageSizes } from './compositions/cardImageSizes'
// digestRollTable — a banded d20 table as rows, highest first (the book's order);
// digestColumnsTable — a two-roll columns table (Callsign) as its columns
export type {
  DigestedColumnsColumn,
  RollTableType,
} from './compositions/digestRollTable'
export {
  digestColumnsTable,
  digestRollTable,
  withNothingHappens,
} from './compositions/digestRollTable'
export { EntitySearcher } from './compositions/EntitySearcher'
export type { FooterFoot } from './compositions/Footer'
export { Footer } from './compositions/Footer'
export type { NavDrawerCategory, NavDrawerItem } from './compositions/NavDrawer'
export { NavDrawer } from './compositions/NavDrawer'
// OgCard — the 1200 × 630 link preview, built from ChapterBand and
// the Union bar's foot; `ogCardForEntity` is a reference entity's card.
export { OgCard } from './compositions/OgCard'
export { ogCardForEntity } from './compositions/ogCardForEntity'
export type { OgCardProps, OgCardStat } from './compositions/ogCardText'
export {
  OG_CARD_HEIGHT,
  OG_CARD_WIDTH,
  ogCardDescription,
  ogCardThemeColor,
  ogCardTitle,
  ogReferenceAddressFits,
} from './compositions/ogCardText'
// PickDialog — the one pick dialog (ruleset §6.6): Compacts in select mode, one radio group.
export { PickDialog } from './compositions/PickDialog'
// RollTableInstrument — THE roll table (EDL E14): a card's, a guide step's and
// the SRD roll-table page's bands and the app's Play tables, banded in the
// surface tone
export { RollTableInstrument } from './compositions/RollTableInstrument'
// SearchListbox — the one list a search's results hang in (Minis or Compacts, `form`).
export { SearchListbox } from './compositions/SearchListbox'
// StartHere — the one onboarding block, on the SRD's home and the app's front door
export type { StartHereStep } from './compositions/StartHere'
export { StartHere } from './compositions/StartHere'
export type { TreeTrack } from './compositions/treeTrack'
export { trackForTree } from './compositions/treeTrack'
export type { SearchComboboxResult } from './compositions/useSearchCombobox'
export { useSearchCombobox } from './compositions/useSearchCombobox'
// AdderBox — the dashed "+ add" intake under a list; AdderField labels a field in it.
export { AdderBox, AdderField } from './containers/AdderBox'
export { Banner } from './containers/Banner'
// Box — the house container: the Compact's square frame around a paper body (ruleset §4.3).
export { Box } from './containers/Box'
// Callout — the unlabelled note: the bare Box framed in its accent (ruleset §5.2).
export { Callout } from './containers/Callout'
// Stack, Cluster and Grid — the layout primitives: a column, a wrapping row,
// and as many equal columns as fit, each a space step apart (`gap`).
export { Cluster } from './containers/Cluster'
// ConfirmDialog — the one "are you sure?": an alert dialog on ModalShell with a
// pending state, an inline failure line, and focus on Cancel for destructive confirms.
export { ConfirmDialog } from './containers/ConfirmDialog'
// DialogActions — a dialog's buttons, right-aligned and wrapping.
export { DialogActions } from './containers/DialogActions'
// EmptyState — dashed stamp-headline empty slot (ruleset §"Empty state")
export { EmptyState } from './containers/EmptyState'
// FeedLine — one entry in a feed (a roll, an alert, a proposal, a change) in
// a FeedList; FeedTime writes its time in the format that feed reads in.
export { FeedLine, FeedList, FeedTime } from './containers/FeedLine'
export { Grid } from './containers/Grid'
// HeaderMenu — a dropdown menu (Base UI's menu button): the Union bar's account
// and Games menus, and the "⋯" overflow on a row.
export type { HeaderMenuItem } from './containers/HeaderMenu'
export { HeaderMenu } from './containers/HeaderMenu'
// loadingCopy — the one "Loading <thing>…" wording Pending, Skeleton and RoutePending share (R22)
export { loadingCopy } from './containers/loadingCopy'
export { MasonryColumns } from './containers/MasonryColumns'
// MiniGrid — contentful Minis as a masonry grid by the room it has (a sheet's
// abilities, actions, systems and modules; a pattern's loadout)
export { MiniGrid } from './containers/MiniGrid'
export { ModalShell } from './containers/ModalShell'
// PageShell — the full-bleed <main> landmark for a top-level app screen
export { PageShell } from './containers/PageShell'
// Pending — the one "Loading X…" line (role="status"), for data that resolves inside a screen
export { Pending } from './containers/Pending'
// PopoverPanel — a trigger and the small non-modal panel of controls it opens
// (Base UI Popover); the app's sheet "⋯" overflow
export { PopoverPanel } from './containers/PopoverPanel'
// RadioCardGroup — the radiogroup around an exactly-one picker's cards (Base UI
// RadioGroup): one tab stop, arrow keys between the cards
export { RadioCardGroup } from './containers/RadioCardGroup'
// RecoveryPanel — the shared error-recovery card (title / message / primary
// action) behind the reference site's island error boundary and the app's root error component.
export { RecoveryPanel } from './containers/RecoveryPanel'
export { RosterSkeleton } from './containers/RosterSkeleton'
export { Skeleton, SkeletonFrame } from './containers/Skeleton'
export { SlabSection } from './containers/SlabSection'
export { Stack } from './containers/Stack'
/** The `statsOverride` element type — public because the prop that takes it is. */
export type { StatItem } from './containers/statsBarTypes'
// TitledBox — the house `Box` (square frame, paper body) with the cut-out head:
// dialogs, wizard briefs, notices, a sheet's panels; RecoveryPanel is its
// named variant.
export { TitledBox } from './containers/TitledBox'
// ToasterMount — the document's one Toaster (R20); `toast` raises an act's notice
export { ToasterMount, toast } from './containers/Toaster'
export type { AnnouncedRoll } from './containers/toastRoll'
export { toastRoll } from './containers/toastRoll'
// THE ENTITY MODULE'S FACE (`entity/index.ts`, R7): the forms' shared parts,
// never taken by their paths.
// - `Chips`: every chip strip, in the class order (C2a), a host's own strip
//   (a Play unit box's relation chips, C11) included.
// - `Art`: a Compact's art window in its head, a `TitledBox`'s `art` (a sheet's chassis callout).
// - `Head`: a Compact's band, cut out, the name on a paper tab and the
//   chips right of it; a page's own cut-out card (the changelog, a class's
//   paths) heads with it.
// - `TagItem`, `Tag`, `Tags`, `relation`, `traitTags`: one trait or relation as a
//   chip (an SRD page's band sets its entity's traits with them; a sheet's
//   `CLASS | Engineer` is one relation `Tag`, which opens and Peeks it).
// - `mentionRef`: the glossary entry a `[[Name]]` names, a trait or a keyword.
export type { TagItem } from './entity'
export {
  Art,
  Chips,
  Head,
  KindLabel,
  mentionRef,
  relation,
  Tag,
  Tags,
  traitTags,
} from './entity'
// THE ENTITY DISPLAY LANGUAGE (docs/design-system/entity-display-language.md):
// `<Entity form mode>` draws a game entity from its model; the surface supplies
// how refs resolve, texture and the user-made treatment once.
export { Entity } from './entity/Entity'
export { EntitySurfaceProvider } from './entity/EntitySurface'
export type {
  EntityExternalLinkBuilder,
  EntitySurfaceValue,
} from './entity/entitySurfaceContext'
// MENTION and PEEK (E4, E16): an entity named in prose, and the page's one
// host for the read-only card a mention or a trait tag shows on hover, focus
// or long-press.
export { Mention } from './entity/forms/Mention'
// MiniGroup — an entity's contentful Mini and the Minis that belong to it
// in one subtle border (a crawler bay and its crew), no nesting
export { MiniGroup } from './entity/forms/MiniGroup'
export type { LinkedUnit } from './entity/LinkedUnits'
export { LinkedUnits } from './entity/LinkedUnits'
// Select mode's one dim (hard rule R15): a pick an app draws by hand dims with it.
export { SELECT_DIM } from './entity/modes/selectedRing'
export type { NameRefCandidate, NameRefIndex, NameRefMatch } from './entity/nameRefs'
export { findNameRefs } from './entity/nameRefs'
export type { PeekLoader } from './entity/Peek'
export { PeekHost } from './entity/Peek'
export type { PageRefCandidate, PageRefIndex } from './entity/pageRefs'
export { findPageRefs } from './entity/pageRefs'
export { embeddedPeekAddress } from './entity/peekContext'
export type { EntityFormModel, EntityMode } from './entity/types'
// MarkdownSection — a repo-root markdown file (one heading, paragraphs and
// links) as a section; InlineMarkdown — one line of it, links only
export { InlineMarkdown } from './markdownSection/InlineMarkdown'
export { MarkdownSection } from './markdownSection/MarkdownSection'
export { Content } from './referenceEntity/Content'
// BayInfo — a crawler bay's own rules under a folding Slab, its first section.
export { BayInfo } from './referenceEntity/card/BayInfo'
// EntityChoices — an entity's choices under its Mini, for a host that draws it as one.
export { EntityChoices } from './referenceEntity/card/EntityChoices'
// The band line a Page carries right of its title (EDL E20): the SRD's entity
// pages and the app's detail dialog.
export { EntityPageStamps } from './referenceEntity/card/EntityPageStamps'
// EntityRollMini — an entity's own roll table as a Mini, under the entity's Mini (E14).
export { EntityRollMini } from './referenceEntity/card/EntityRollMini'
// What an entity PAGE's chapter band and foot band say (`presentation="page"`)
export type { EntityPageMeta } from './referenceEntity/card/entityPage'
export { resolveEntityPageMeta } from './referenceEntity/card/entityPage'
export type { HomebrewCredit } from './referenceEntity/card/HomebrewCreditChip'
// HomebrewStamp — the dashed HOMEBREW stamp (ruleset §3.9) every player-made
// thing wears: a card's labels, a Compact's marks, a saved pattern's page.
export { HomebrewStamp } from './referenceEntity/card/HomebrewStamp'
// The stored-tag test for the book's starting builds, for a page band that
// wears the stamp (`EntityPageStamps`) outside the card.
export { isLegalStartingPatternOf } from './referenceEntity/card/legalStartingPattern'
export { ActionMinis } from './referenceEntity/card/NestedCards'
// A chassis page's pattern, listed: a player's pattern too, in Edit while they save it.
export { PatternListing } from './referenceEntity/card/PatternListRow'
// Entity display system
export { ReferenceEntityCard } from './referenceEntity/card/ReferenceEntityCard'
export type { CardFootMeta } from './referenceEntity/card/referenceEntityCardTypes'
// WhenDamaged — a crawler bay's WHEN DAMAGED block, one renderer on the Page, the card and the live sheet (R18).
export { WhenDamaged } from './referenceEntity/card/WhenDamaged'
export { damagedEffectOf } from './referenceEntity/card/whenDamaged.model'
// Interactive choice cards (granted-equipment choices)
export type { ChoiceSelections } from './referenceEntity/choiceCard/choiceSelectionHelpers'
// EntityDetailDialog — an entity's Page in a dialog: the app's open-in-place reading.
export { EntityDetailDialog } from './referenceEntity/EntityDetailDialog'
// Entity controls: the live preset (navigateControl).
export { quotePatternName } from './referenceEntity/pattern/quotePatternName'
export { navigateControl } from './referenceEntity/referenceEntityControls'
export type { ReferenceEntityControl } from './referenceEntity/referenceEntityControlTypes'
export { useDetailModal } from './referenceEntity/useDetailModal'
// TraitProse — prose whose trait and entity names resolve as it renders, one per row.
export { TraitProse } from './TraitProse'
