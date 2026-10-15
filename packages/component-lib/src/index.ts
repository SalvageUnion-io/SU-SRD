// SRD catalog — the catalog categories and their tile colours, as the Cantina's
// Dashboard SRD Explorer renders them. (srd's own index is its chapters,
// `apps/srd/src/lib/chapters.ts`.)
export { buildCatalogSections } from './catalog/catalogSections'
export { ActivationCost } from './components/atoms/ActivationCost'
export type { BadgeTone } from './components/atoms/Badge'
// Chrome primitives (The Cantina design handoff — design-spec §2)
// Badge — the unified stamp-chip family: the quiet keyword chip is
// `surface="quiet"`, the status badge is StatusBadge (domain vocabulary), and a
// pill is `Badge surface="outline"`/`"tone"`.
export { Badge } from './components/atoms/Badge'
// BandTitle — the paper-on-tone title inside a Card's header band. NOT a
// stamp: it fills its track and truncates, where a stamp sizes to its text.
export { BandTitle } from './components/atoms/BandTitle'
export { Button } from './components/atoms/Button'
export { buttonVariants } from './components/atoms/buttonVariants'
export { CatalogTile } from './components/atoms/CatalogTile'
// ChapterBand — the page title notched into a band in the chapter's colour
export { ChapterBand } from './components/atoms/ChapterBand'
// Conditions — the entity-condition chip row. Public because the Cantina's sheet
// editors (ConditionsEditor, NpcFactsEditor) compose it.
export { Conditions } from './components/atoms/Conditions'
export { CountStepper } from './components/atoms/CountStepper'
export type { ChapterTone } from './components/atoms/chapterBandColor'
export { CHAPTER_BAND_COLOR } from './components/atoms/chapterBandColor'
export { Field, Select } from './components/atoms/Field'
// FieldError — the one single-message validation line (role="alert", danger tone)
export { FieldError } from './components/atoms/FieldError'
// Skeletons
export { Ghost } from './components/atoms/Ghost'
// Glyph — the hand-drawn UI glyph set (the sheet's edit/add/remove marks)
export { Glyph } from './components/atoms/glyphs'
export { heatDangerFrom } from './components/atoms/heatLevel'
export { InlineEditField } from './components/atoms/InlineEditField'
// The one link look (ruleset §3.1): rust is painted only by Button and by
// InlineRef, so a prose link in either app is an InlineRef.
export { InlineRef } from './components/atoms/InlineRef'
export { Input, Textarea } from './components/atoms/inputs'
// The focus vocabulary — exported so the apps' focus treatment uses these
// rungs rather than their own.
export {
  FOCUS_RING,
  INPUT_FOCUS,
} from './components/atoms/interaction'
// KofiButton — the Ko-fi support widget, with a plain link until its script loads
export { KofiButton } from './components/atoms/KofiButton'
export { ModeDoor } from './components/atoms/ModeDoor'
export { useModKeyHint } from './components/atoms/modKeyHint'
export { PageHeading } from './components/atoms/PageHeading'
export { Panel } from './components/atoms/Panel'
export { linesFromBreakdown, summarizeBreakdown } from './components/atoms/provenanceLines'
export { Radio } from './components/atoms/Radio'
export { SearchField, SearchFieldTrigger } from './components/atoms/SearchField'
export { Segmented, SegmentedOption } from './components/atoms/Segmented'
export type { SlabCount } from './components/atoms/Slab'
export { Slab } from './components/atoms/Slab'
// Cargo / inventory — dashed addressable slot cells (ruleset §5, atom 10)
export { SlotGrid } from './components/atoms/SlotGrid'
export { SRDLink } from './components/atoms/SRDLink'
export type { StatState, StatTone } from './components/atoms/Stat'
export { Stat } from './components/atoms/Stat'
export { StatColumn } from './components/atoms/StatColumn'
export type { ProvenanceLine } from './components/atoms/StatProvenance'
export { Tab, TabList, TabPanel, Tabs, Toggle } from './components/atoms/Tabs'
// Base typography
export { Text } from './components/atoms/Text'
// USER_MADE_HATCH — the hatch a user-made page wears on its colour bands
// (ruleset §3.9): ChapterBand's `userMade`, and the page's hatched foot.
export { USER_MADE_HATCH } from './components/atoms/userMadeHatch'
// Stat trackers (The Cantina design handoff — design-spec §2.7)
export type { VitalGaugeBreakdown } from './components/atoms/VitalGauge'
export { VitalGauge } from './components/atoms/VitalGauge'
// AbilityTrack — an ability tree on its track (tier numerals, a Legendary
// tree's "or"): the SRD's class page and abilities Tree, the Cantina's pilot sheet.
export { AbilityTrack } from './components/compositions/AbilityTrack'
// AccountMenu — who is signed in, at the Union bar's end, on both tools.
export { AccountMenu } from './components/compositions/AccountMenu'
export { AppBar } from './components/compositions/AppBar'
// Deliberately its own module rather than the card-image component's file,
// which stays internal.
// srd's item pages need this string for their `rel=preload`: it must match the
// `sizes` on the <img> exactly, or the preload selects a different candidate
// and the page fetches two files instead of one.
export { assetSrcSetFor } from './components/compositions/assetSrcSet'
// BrandCard — the site's own 1200 × 630 link preview, the Discord banner's face.
export { BrandCard } from './components/compositions/BrandCard'
// ControlButtons — the control strip Card's rail renders; public because
// The Cantina's Dashboard display panel lays out entity controls with it directly.
export { ControlButtons } from './components/compositions/ControlButtons'
export { heroImageSizes } from './components/compositions/cardImageSizes'
// digestRollTable — a banded d20 table as rows, highest first (the book's order);
// digestColumnsTable — a two-roll columns table (Callsign) as its columns
export type {
  DigestedColumnsColumn,
  RollTableType,
} from './components/compositions/digestRollTable'
export { digestColumnsTable, digestRollTable } from './components/compositions/digestRollTable'
export { EntitySearcher } from './components/compositions/EntitySearcher'
export type { FooterFoot } from './components/compositions/Footer'
export { Footer } from './components/compositions/Footer'
export type { NavDrawerCategory, NavDrawerItem } from './components/compositions/NavDrawer'
export { NavDrawer } from './components/compositions/NavDrawer'
// OgCard — the 1200 × 630 link preview, built from ChapterBand and
// the Union bar's foot; `ogCardForEntity` is a reference entity's card.
export { OgCard } from './components/compositions/OgCard'
export { ogCardForEntity } from './components/compositions/ogCardForEntity'
export type { OgCardProps, OgCardStat } from './components/compositions/ogCardText'
export {
  OG_CARD_HEIGHT,
  OG_CARD_WIDTH,
  ogCardDescription,
  ogCardThemeColor,
  ogCardTitle,
  ogReferenceAddressFits,
} from './components/compositions/ogCardText'
// The searcher picker's modal width — for a bare ModalShell wrapping a
// multi-select EntitySearcher (The Cantina's SheetPickerModal applies it itself).
export { PICKER_MODAL_WIDTH } from './components/compositions/pickerModalWidth'
// RollTableInstrument — THE roll table (EDL E14): a card's, a guide step's and
// the SRD roll-table page's bands and the Cantina's Dashboard tables, banded in the
// surface tone; `titleSelect` makes its title a table picker's trigger
export type { RollTableTitleSelect } from './components/compositions/RollTableInstrument'
export { RollTableInstrument } from './components/compositions/RollTableInstrument'
// StartHere — the one onboarding block, on the SRD's home and the Cantina's front door
export { StartHere } from './components/compositions/StartHere'
export { StatusBadge } from './components/compositions/StatusBadge'
export type { TreeTrack } from './components/compositions/treeTrack'
export { trackForTree } from './components/compositions/treeTrack'
export type { SearchComboboxResult } from './components/compositions/useSearchCombobox'
export { useSearchCombobox } from './components/compositions/useSearchCombobox'
export { Banner } from './components/containers/Banner'
// Callout — accent-framed note (stamp header + accent-bar body); list-items,
// "When Damaged" effects, and similar accented notes compose on it.
export { Callout } from './components/containers/Callout'
export type { CardFootMeta } from './components/containers/Card'
// Shared components
export { Card } from './components/containers/Card'
// ConfirmDialog — the one "are you sure?": an alert dialog on ModalShell with a
// pending state, an inline failure line, and focus on Cancel for destructive confirms.
export { ConfirmDialog } from './components/containers/ConfirmDialog'
// EmptyState — dashed stamp-headline empty slot (ruleset §"Empty state")
export { EmptyState } from './components/containers/EmptyState'
// HeaderMenu — a dropdown menu (Base UI's menu button): the Union bar's account
// and Games menus, and the "⋯" overflow on a row.
export type { HeaderMenuItem } from './components/containers/HeaderMenu'
export { HeaderMenu } from './components/containers/HeaderMenu'
export { Inset } from './components/containers/Inset'
export { MasonryColumns } from './components/containers/MasonryColumns'
export { ModalShell } from './components/containers/ModalShell'
// PageShell — the full-bleed <main> landmark for a top-level app screen
export { PageShell } from './components/containers/PageShell'
// PopoverPanel — a trigger and the small non-modal panel of controls it opens
// (Base UI Popover); the Cantina's sheet "⋯" overflow
export { PopoverPanel } from './components/containers/PopoverPanel'
// RadioCardGroup — the radiogroup around an exactly-one picker's cards (Base UI
// RadioGroup): one tab stop, arrow keys between the cards
export { RadioCardGroup } from './components/containers/RadioCardGroup'
// RecoveryPanel — the shared error-recovery card (title / message / primary
// action) behind srd's island error boundary and cantina's root error component.
export { RecoveryPanel } from './components/containers/RecoveryPanel'
export { RosterSkeleton } from './components/containers/RosterSkeleton'
export { Sel } from './components/containers/Sel'
export { SheetSectionCard } from './components/containers/SheetSectionCard'
export { SheetSectionSlab } from './components/containers/SheetSectionSlab'
export { Skeleton } from './components/containers/Skeleton'
/** The `statsOverride` element type — public because the prop that takes it is. */
export type { StatItem } from './components/containers/statsBarTypes'
// UI primitives
export { Toaster, toast } from './components/containers/Toaster'
export type { AnnouncedRoll } from './components/containers/toastRoll'
export { toastRoll } from './components/containers/toastRoll'
export { Content } from './components/referenceEntity/Content'
// The band line a Page carries right of its title (EDL E20): the SRD's entity
// pages and the Cantina's detail dialog.
export { EntityPageStamps } from './components/referenceEntity/card/EntityPageStamps'
// What an entity PAGE's chapter band and foot band say (`presentation="page"`)
export type { EntityPageMeta } from './components/referenceEntity/card/entityPage'
export { resolveEntityPageMeta } from './components/referenceEntity/card/entityPage'
// The stored-tag test for the book's starting builds, for a page band that
// wears the stamp (`EntityPageStamps`) outside the card.
export { isLegalStartingPatternOf } from './components/referenceEntity/card/legalStartingPattern'
// Entity display system
export { ReferenceEntityCard } from './components/referenceEntity/card/ReferenceEntityCard'
export type { ReferenceCardEntity } from './components/referenceEntity/card/referenceEntityCardTypes'
// UserMadeStamp — the dashed User-made stamp (ruleset §3.9). The card wears it
// in its head's labels; a full user-made page leads its title with it.
export { UserMadeStamp } from './components/referenceEntity/card/UserMadeStamp'
// Interactive choice cards (granted-equipment choices)
export type { ChoiceSelections } from './components/referenceEntity/choiceCard/choiceSelectionHelpers'
export type {
  EntityExternalLinkBuilder,
  EntityHrefBuilder,
} from './components/referenceEntity/entityHrefContext'
export {
  EntityDetailLinkProvider,
  EntityExternalLinkProvider,
  EntityHrefProvider,
  PatternHrefProvider,
} from './components/referenceEntity/entityHrefContext'
// Entity controls: the live presets (navigateControl, foldControl — built on useDisclosure).
export { foldControl } from './components/referenceEntity/foldControl'
export { quotePatternName } from './components/referenceEntity/pattern/quotePatternName'
export { navigateControl } from './components/referenceEntity/referenceEntityControls'
export type { ReferenceEntityControl } from './components/referenceEntity/referenceEntityControlTypes'
export { useDetailModal } from './components/referenceEntity/useDetailModal'
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
export * as tokens from './design/tokens'
// THE ENTITY DISPLAY LANGUAGE (docs/design-system/entity-display-language.md):
// `<Entity form mode>` draws a game entity from its model; the surface supplies
// how refs resolve, texture and the user-made treatment once.
export { Entity } from './entity/Entity'
export { EntitySurfaceProvider } from './entity/EntitySurface'
export type { EntitySurfaceValue } from './entity/entitySurfaceContext'
// MENTION and PEEK (E4, E16): an entity named in prose, and the page's one
// host for the read-only card a mention or a trait tag shows on hover, focus
// or long-press.
export { Mention } from './entity/forms/Mention'
export { InfoCutout } from './entity/InfoCutout'
export type { PeekLoader } from './entity/Peek'
export { PeekHost } from './entity/Peek'
export type { PageRefCandidate, PageRefIndex } from './entity/pageRefs'
export { findPageRefs } from './entity/pageRefs'
// A fact whose value is an entity (`CLASS | Engineer`): the chip opens and Peeks it.
export { EntityStat } from './entity/parts/EntityStat'
// A Row's band, cut out (`notch`): the name on a paper tab, chips right of it.
// A page's own cut-out card (the changelog, a class's paths) heads with it.
export { Head } from './entity/parts/Head'
export { KindLabel } from './entity/parts/KindLabel'
// One trait as a chip: an SRD page's band sets its entity's traits with it.
export type { TagItem } from './entity/parts/tagItems'
// The glossary entry a `[[Name]]` names: a trait, else a keyword.
export { mentionRef } from './entity/parts/tagItems'
export { embeddedPeekAddress } from './entity/peekContext'
export type { EntityMode, EntityRowModel } from './entity/types'
// MarkdownSection — a repo-root markdown file (one heading, paragraphs and
// links) as a section; InlineMarkdown — one line of it, links only
export { InlineMarkdown } from './markdownSection/InlineMarkdown'
export { MarkdownSection } from './markdownSection/MarkdownSection'
/** `CSSProperties` that also admits `--custom-property` keys (see styles/cssVars). */
export type { CSSVarStyle } from './styles/cssVars'
// Utilities — the ONE cn(): joins class names, dropping falsy entries.
export { cn } from './utils/cn'
// The one dice source (Randsum): a named Salvage Union table rolls through
// @randsum/salvageunion, every other die through @randsum/roller.
export type { TableDie } from './utils/dice'
export { dieForTable, rollD20, rollForTable } from './utils/dice'
// Prose with its `[[Trait]]` references drawn as Mentions (The Cantina's `DashboardRollTable`).
export { useParseTraitReferences } from './utils/parseTraitReferences'
// The one place a schema id becomes a human label ('crawler-bays' →
// 'Crawler Bays'), so the combobox, the /search page and the catalog can't
// spell the same schema differently.
export { schemaPluralLabel } from './utils/schemaLabels'
// THE show/hide fold: open state plus the toggle's aria-expanded / aria-controls.
export { useDisclosure } from './utils/useDisclosure'
// The one viewport media-query hook (a breakpoint read in JS, not CSS).
export { useMediaQuery } from './utils/useMediaQuery'
