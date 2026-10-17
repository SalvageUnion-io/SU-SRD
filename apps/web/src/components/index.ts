// SRD catalog — the catalog categories and their tile colours, as the Cantina's
// Dashboard SRD Explorer renders them. (srd's own index is its chapters,
// `apps/web/src/lib/chapters.ts`.)

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
// Prose with its `[[Trait]]` references drawn as Mentions (The Cantina's `DashboardRollTable`).
export { useParseTraitReferences } from '../lib/parseTraitReferences'
// The one place a schema id becomes a human label ('crawler-bays' →
// 'Crawler Bays'), so the combobox, the /search page and the catalog can't
// spell the same schema differently.
export { schemaPluralLabel } from '../lib/schemaLabels'
// THE show/hide fold: open state plus the toggle's aria-expanded / aria-controls.
export { useDisclosure } from '../lib/useDisclosure'
// The one viewport media-query hook (a breakpoint read in JS, not CSS).
export { useMediaQuery } from '../lib/useMediaQuery'
/** `CSSProperties` that also admits `--custom-property` keys (see styles/cssVars). */
export type { CSSVarStyle } from '../styles/cssVars'
export { ActivationCost } from './atoms/ActivationCost'
export type { BadgeTone } from './atoms/Badge'
// Chrome primitives (The Cantina design handoff — design-spec §2)
// Badge — the unified stamp-chip family: the quiet keyword chip is
// `surface="quiet"`, the status badge is StatusBadge (domain vocabulary), and a
// pill is `Badge surface="outline"`/`"tone"`.
export { Badge } from './atoms/Badge'
// BandTitle — the paper-on-tone title inside a Card's header band. NOT a
// stamp: it fills its track and truncates, where a stamp sizes to its text.
export { BandTitle } from './atoms/BandTitle'
// BreadcrumbTrail — a page's trail, for the Union bar or a page's band (`ChapterBandTrail`)
export { BreadcrumbTrail } from './atoms/BreadcrumbTrail'
export { Button } from './atoms/Button'
export { buttonVariants } from './atoms/buttonVariants'
export { CatalogTile } from './atoms/CatalogTile'
// ChapterBand — the page title notched into a band in the chapter's colour
export { ChapterBand } from './atoms/ChapterBand'
export { ChapterBandTrail } from './atoms/ChapterBandTrail'
// Conditions — the entity-condition chip row. Public because the Cantina's sheet
// editors (ConditionsEditor, NpcFactsEditor) compose it.
export { Conditions } from './atoms/Conditions'
export { CountStepper } from './atoms/CountStepper'
export type { ChapterTone } from './atoms/chapterBandColor'
export { CHAPTER_BAND_COLOR } from './atoms/chapterBandColor'
export { Field, Select } from './atoms/Field'
// FieldError — the one single-message validation line (role="alert", danger tone)
export { FieldError } from './atoms/FieldError'
// Skeletons
export { Ghost } from './atoms/Ghost'
// Glyph — the hand-drawn UI glyph set (the sheet's edit/add/remove marks)
export { Glyph } from './atoms/glyphs'
export { heatDangerFrom } from './atoms/heatLevel'
export { InlineEditField } from './atoms/InlineEditField'
// The one link look (ruleset §3.1): rust is painted only by Button and by
// InlineRef, so a prose link in either app is an InlineRef.
export { InlineRef } from './atoms/InlineRef'
export { Input, Textarea } from './atoms/inputs'
// The focus vocabulary — exported so the apps' focus treatment uses these
// rungs rather than their own.
export {
  FOCUS_RING,
  INPUT_FOCUS,
} from './atoms/interaction'
// KofiButton — the Ko-fi support widget, with a plain link until its script loads
export { KofiButton } from './atoms/KofiButton'
export { ModeDoor } from './atoms/ModeDoor'
export { useModKeyHint } from './atoms/modKeyHint'
export { PageHeading } from './atoms/PageHeading'
export { Panel } from './atoms/Panel'
export { linesFromBreakdown, summarizeBreakdown } from './atoms/provenanceLines'
export { Radio } from './atoms/Radio'
export { SearchField } from './atoms/SearchField'
export { Segmented, SegmentedOption } from './atoms/Segmented'
export type { SlabCount } from './atoms/Slab'
export { Slab } from './atoms/Slab'
// Cargo / inventory — dashed addressable slot cells (ruleset §5, atom 10)
export { SlotGrid } from './atoms/SlotGrid'
export { SRDLink } from './atoms/SRDLink'
export type { StatState, StatTone } from './atoms/Stat'
export { Stat } from './atoms/Stat'
export { StatColumn } from './atoms/StatColumn'
export type { ProvenanceLine } from './atoms/StatProvenance'
export { Tab, TabList, TabPanel, Tabs, Toggle } from './atoms/Tabs'
// Base typography
export { Text } from './atoms/Text'
// USER_MADE_HATCH — the hatch a user-made page wears on its colour bands
// (ruleset §3.9): ChapterBand's `userMade`, and the page's hatched foot.
export { USER_MADE_HATCH } from './atoms/userMadeHatch'
// Stat trackers (The Cantina design handoff — design-spec §2.7)
export type { VitalGaugeBreakdown } from './atoms/VitalGauge'
export { VitalGauge } from './atoms/VitalGauge'
export { buildCatalogSections } from './catalog/catalogSections'
// AbilityTrack — an ability tree on its track (tier numerals, a Legendary
// tree's "or"): the SRD's class page and abilities Tree, the Cantina's pilot sheet.
export { AbilityTrack } from './compositions/AbilityTrack'
// AccountMenu — who is signed in, at the Union bar's end, on both tools.
export { AccountMenu } from './compositions/AccountMenu'
export { AppBar } from './compositions/AppBar'
// Deliberately its own module rather than the card-image component's file,
// which stays internal.
// srd's item pages need this string for their `rel=preload`: it must match the
// `sizes` on the <img> exactly, or the preload selects a different candidate
// and the page fetches two files instead of one.
export { assetSrcSetFor } from './compositions/assetSrcSet'
// BrandCard — the site's own 1200 × 630 link preview, the Discord banner's face.
export { BrandCard } from './compositions/BrandCard'
// ControlButtons — the control strip Card's rail renders; public because
// The Cantina's Dashboard display panel lays out entity controls with it directly.
export { ControlButtons } from './compositions/ControlButtons'
export { heroImageSizes } from './compositions/cardImageSizes'
// digestRollTable — a banded d20 table as rows, highest first (the book's order);
// digestColumnsTable — a two-roll columns table (Callsign) as its columns
export type {
  DigestedColumnsColumn,
  RollTableType,
} from './compositions/digestRollTable'
export { digestColumnsTable, digestRollTable } from './compositions/digestRollTable'
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
// The searcher picker's modal width — for a bare ModalShell wrapping a
// multi-select EntitySearcher (The Cantina's SheetPickerModal applies it itself).
export { PICKER_MODAL_WIDTH } from './compositions/pickerModalWidth'
// RollTableInstrument — THE roll table (EDL E14): a card's, a guide step's and
// the SRD roll-table page's bands and the Cantina's Dashboard tables, banded in the
// surface tone; `titleSelect` makes its title a table picker's trigger
export type { RollTableTitleSelect } from './compositions/RollTableInstrument'
export { RollTableInstrument } from './compositions/RollTableInstrument'
// StartHere — the one onboarding block, on the SRD's home and the Cantina's front door
export { StartHere } from './compositions/StartHere'
export { StatusBadge } from './compositions/StatusBadge'
export type { TreeTrack } from './compositions/treeTrack'
export { trackForTree } from './compositions/treeTrack'
export type { SearchComboboxResult } from './compositions/useSearchCombobox'
export { useSearchCombobox } from './compositions/useSearchCombobox'
export { Banner } from './containers/Banner'
// Callout — accent-framed note (stamp header + accent-bar body); list-items,
// "When Damaged" effects, and similar accented notes compose on it.
export { Callout } from './containers/Callout'
export type { CardFootMeta } from './containers/Card'
// Shared components
export { Card } from './containers/Card'
// ConfirmDialog — the one "are you sure?": an alert dialog on ModalShell with a
// pending state, an inline failure line, and focus on Cancel for destructive confirms.
export { ConfirmDialog } from './containers/ConfirmDialog'
// EmptyState — dashed stamp-headline empty slot (ruleset §"Empty state")
export { EmptyState } from './containers/EmptyState'
// HeaderMenu — a dropdown menu (Base UI's menu button): the Union bar's account
// and Games menus, and the "⋯" overflow on a row.
export type { HeaderMenuItem } from './containers/HeaderMenu'
export { HeaderMenu } from './containers/HeaderMenu'
export { Inset } from './containers/Inset'
export { MasonryColumns } from './containers/MasonryColumns'
export { ModalShell } from './containers/ModalShell'
// PageShell — the full-bleed <main> landmark for a top-level app screen
export { PageShell } from './containers/PageShell'
// PopoverPanel — a trigger and the small non-modal panel of controls it opens
// (Base UI Popover); the Cantina's sheet "⋯" overflow
export { PopoverPanel } from './containers/PopoverPanel'
// RadioCardGroup — the radiogroup around an exactly-one picker's cards (Base UI
// RadioGroup): one tab stop, arrow keys between the cards
export { RadioCardGroup } from './containers/RadioCardGroup'
// RecoveryPanel — the shared error-recovery card (title / message / primary
// action) behind srd's island error boundary and cantina's root error component.
export { RecoveryPanel } from './containers/RecoveryPanel'
export { RosterSkeleton } from './containers/RosterSkeleton'
export { Sel } from './containers/Sel'
export { SheetSectionCard } from './containers/SheetSectionCard'
export { SheetSectionSlab } from './containers/SheetSectionSlab'
export { Skeleton } from './containers/Skeleton'
/** The `statsOverride` element type — public because the prop that takes it is. */
export type { StatItem } from './containers/statsBarTypes'
// TitledBox — the house `Box` (square frame, paper body) with the cut-out head:
// dialogs, wizard briefs, notices; Callout, Inset, InfoCutout and RecoveryPanel
// are its named variants.
export { TitledBox } from './containers/TitledBox'
// UI primitives
export { Toaster, toast } from './containers/Toaster'
export type { AnnouncedRoll } from './containers/toastRoll'
export { toastRoll } from './containers/toastRoll'
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
export { Content } from './referenceEntity/Content'
// DamagedEffectCallout — a crawler bay's WHEN DAMAGED box, on the SRD card and the live sheet.
export { DamagedEffectCallout } from './referenceEntity/card/DamagedEffectCallout'
// The band line a Page carries right of its title (EDL E20): the SRD's entity
// pages and the Cantina's detail dialog.
export { EntityPageStamps } from './referenceEntity/card/EntityPageStamps'
// What an entity PAGE's chapter band and foot band say (`presentation="page"`)
export type { EntityPageMeta } from './referenceEntity/card/entityPage'
export { resolveEntityPageMeta } from './referenceEntity/card/entityPage'
// The stored-tag test for the book's starting builds, for a page band that
// wears the stamp (`EntityPageStamps`) outside the card.
export { isLegalStartingPatternOf } from './referenceEntity/card/legalStartingPattern'
// Entity display system
export { ReferenceEntityCard } from './referenceEntity/card/ReferenceEntityCard'
export type { ReferenceCardEntity } from './referenceEntity/card/referenceEntityCardTypes'
// UserMadeStamp — the dashed User-made stamp (ruleset §3.9). The card wears it
// in its head's labels; a full user-made page leads its title with it.
export { UserMadeStamp } from './referenceEntity/card/UserMadeStamp'
// Interactive choice cards (granted-equipment choices)
export type { ChoiceSelections } from './referenceEntity/choiceCard/choiceSelectionHelpers'
export type {
  EntityExternalLinkBuilder,
  EntityHrefBuilder,
} from './referenceEntity/entityHrefContext'
export {
  EntityDetailLinkProvider,
  EntityExternalLinkProvider,
  EntityHrefProvider,
  PatternHrefProvider,
} from './referenceEntity/entityHrefContext'
// Entity controls: the live presets (navigateControl, foldControl — built on useDisclosure).
export { foldControl } from './referenceEntity/foldControl'
export { quotePatternName } from './referenceEntity/pattern/quotePatternName'
export { navigateControl } from './referenceEntity/referenceEntityControls'
export type { ReferenceEntityControl } from './referenceEntity/referenceEntityControlTypes'
export { useDetailModal } from './referenceEntity/useDetailModal'
