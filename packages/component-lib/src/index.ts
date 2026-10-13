// SRD catalog — the catalog categories and their tile colours, as ITUN's
// Dashboard SRD Explorer renders them. (srd's own index is its chapters,
// `apps/srd/src/lib/chapters.ts`.)
export { buildCatalogSections } from './catalog/catalogSections'
// Changelog view; its build-time git reader is the `./changelog/git` subpath
export { Changelog } from './changelog/Changelog'
// Avatar — a person's picture in a circle, falling back to their initial
export { Avatar } from './components/atoms/Avatar'
export type { BadgeTone } from './components/atoms/Badge'
// Chrome primitives (ITUN design handoff — design-spec §2)
// Badge — the unified stamp-chip family. No named presets: the quiet keyword
// chip is `surface="quiet"`, the status badge is StatusBadge (domain vocabulary),
// and a pill is `Badge surface="outline"`/`"tone"`.
export { Badge } from './components/atoms/Badge'
// BandTitle — the paper-on-tone title inside a Card's header band. NOT a
// stamp: it fills its track and truncates, where a stamp sizes to its text.
export { BandTitle } from './components/atoms/BandTitle'
export { Button } from './components/atoms/Button'
export { buttonVariants } from './components/atoms/buttonVariants'
export { CatalogTile } from './components/atoms/CatalogTile'
// ChapterBand — the page title notched into a band in the chapter's colour
export { ChapterBand } from './components/atoms/ChapterBand'
export { Checkbox, Radio } from './components/atoms/Checkbox'
// Conditions — the entity-condition chip row. Public because ITUN's sheet
// editors (ConditionsEditor, NpcFactsEditor) compose it.
export { Conditions } from './components/atoms/Conditions'
// ConditionChip is deliberately NOT exported: it is an internal sub-part of
// Conditions (its only consumer), demonstrated via that component's story.
export { CountStepper } from './components/atoms/CountStepper'
export type { ChapterTone } from './components/atoms/chapterBandColor'
export { CHAPTER_BAND_COLOR } from './components/atoms/chapterBandColor'
export { Field, Input, Select } from './components/atoms/Field'
// FieldError — the one single-message validation line (role="alert", danger tone)
export { FieldError } from './components/atoms/FieldError'
// Skeletons
export { Ghost } from './components/atoms/Ghost'
// Glyph — the hand-drawn UI glyph set (the sheet's edit/add/remove marks)
export { Glyph } from './components/atoms/glyphs'
// Only `heatDangerFrom` survives — `heatLevel`/`HeatLevel`/`HEAT_HIGH_RATIO`
// were measured to zero consumers and deleted.
export { heatDangerFrom } from './components/atoms/heatLevel'
export { InlineEditField } from './components/atoms/InlineEditField'
// The one link look (ruleset §3.1): rust is painted only by Button and by
// InlineRef, so a prose link in either app is an InlineRef.
export { InlineRef } from './components/atoms/InlineRef'
export { Textarea } from './components/atoms/inputs'
/**
 * The focus vocabulary. Exported because the APPS need it, not only the lib:
 * srd and itun each had their own hand-rolled focus treatment (a pilot outline,
 * a rust outline) purely because the canonical rungs stopped at the package
 * boundary. A design system the consuming apps cannot import is one they will
 * re-invent.
 */
export {
  FOCUS_RING,
  FOCUS_RING_ON_TONE,
  INPUT_FOCUS,
} from './components/atoms/interaction'
export { KvRow } from './components/atoms/KvRow'
export { ModeDoor } from './components/atoms/ModeDoor'
export { PageHeading } from './components/atoms/PageHeading'
export { Panel } from './components/atoms/Panel'
export { linesFromBreakdown, summarizeBreakdown } from './components/atoms/provenanceLines'
export { SearchField, SearchFieldTrigger } from './components/atoms/SearchField'
export { Sel } from './components/atoms/Sel'
export { Slab } from './components/atoms/Slab'
// Cargo / inventory — dashed addressable slot cells (ruleset §5, atom 10)
export { SlotGrid } from './components/atoms/SlotGrid'
export { SRDLink } from './components/atoms/SRDLink'
export type { StatState, StatTone } from './components/atoms/Stat'
export { Stat } from './components/atoms/Stat'
export { StatColumn } from './components/atoms/StatColumn'
export type { ProvenanceLine } from './components/atoms/StatProvenance'
// STAMP_SEAM — the border-riding stamp placement, as a class string (ruleset §5)
export { STAMP_SEAM } from './components/atoms/stampSeam'
export { Tab, TabList, TabPanel, Tabs } from './components/atoms/Tabs'
// Base typography
export { Text } from './components/atoms/Text'
// USER_MADE_HATCH — the hatch a user-made page wears on its colour bands
// (ruleset §3.9): ChapterBand's `userMade`, and the page's hatched foot.
export { USER_MADE_HATCH } from './components/atoms/userMadeHatch'
// Stat trackers (ITUN design handoff — design-spec §2.7)
export type { VitalGaugeBreakdown } from './components/atoms/VitalGauge'
export { VitalGauge } from './components/atoms/VitalGauge'
export { AppBar } from './components/compositions/AppBar'
// Deliberately its own module rather than the card-image component's file.
// `story-coverage.test.ts` decides what is public by regex-matching each
// component NAME against this barrel's text, so exporting from that file — or
// even naming it here in prose — marks it public and demands a story for a
// component that is intentionally internal.
// srd's item pages need this string for their `rel=preload`: it must match the
// `sizes` on the <img> exactly, or the preload selects a different candidate
// and the page fetches two files instead of one.
export { assetSrcSetFor } from './components/compositions/assetSrcSet'
// Colophon (renders the repo-root ABOUT_JRVS.md + LLM_STATEMENT.md on both about pages)
export { Colophon } from './components/compositions/Colophon'
// ControlButtons — the control strip Card's rail renders; public because
// ITUN's Dashboard display panel lays out entity controls with it directly.
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
// HouseRules (the house-rule registry, listed on both about pages)
export { HouseRules } from './components/compositions/HouseRules'
export type { NavDrawerCategory, NavDrawerItem } from './components/compositions/NavDrawer'
export { NavDrawer } from './components/compositions/NavDrawer'
// OgCard — the 1200 × 630 link preview (issue 1280), built from ChapterBand and
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
// multi-select EntitySearcher (ITUN's SheetPickerModal applies it itself).
export { PICKER_MODAL_WIDTH } from './components/compositions/pickerModalWidth'
// RollTableInstrument — THE roll table (EDL E14): a card's, a guide step's and
// the SRD roll-table page's bands, banded in the surface tone
export { RollTableInstrument } from './components/compositions/RollTableInstrument'
// StepButton is deliberately NOT exported: it is an internal atom composed by
// CountStepper (its only consumer), demonstrated via its own co-located story.
// Every hand-assembled '-'/value/'+' cluster in the apps now renders through
// Stat's stepper anatomy instead, so nothing outside this package needs it.
export { StatusBadge } from './components/compositions/StatusBadge'
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
export { Inset } from './components/containers/Inset'
export { MasonryColumns } from './components/containers/MasonryColumns'
export { ModalShell } from './components/containers/ModalShell'
// PageShell — the full-bleed <main> landmark for a top-level app screen
export { PageShell } from './components/containers/PageShell'
// PopoverPanel — a trigger and the small non-modal panel of controls it opens
// (Base UI Popover); ITUN's sheet "⋯" overflow
export { PopoverPanel } from './components/containers/PopoverPanel'
// RadioCardGroup — the radiogroup around an exactly-one picker's cards (Base UI
// RadioGroup): one tab stop, arrow keys between the cards
export { RadioCardGroup } from './components/containers/RadioCardGroup'
// RecoveryPanel — the shared error-recovery card (title / message / primary
// action) behind srd's island error boundary and itun's root error component.
export { RecoveryPanel } from './components/containers/RecoveryPanel'
export { RosterSkeleton } from './components/containers/RosterSkeleton'
export { SheetSectionCard } from './components/containers/SheetSectionCard'
export { SheetSectionSlab } from './components/containers/SheetSectionSlab'
export { Skeleton } from './components/containers/Skeleton'
/** The `statsOverride` element type — public because the prop that takes it is. */
export type { StatItem } from './components/containers/statsBarTypes'
// UI primitives
export { Toaster, toast } from './components/containers/Toaster'
export { Content } from './components/referenceEntity/Content'
export { entityGuideToneColor } from './components/referenceEntity/card/entityCardTone'
// What an entity PAGE's chapter band and foot band say (`presentation="page"`)
export type { EntityPageMeta } from './components/referenceEntity/card/entityPage'
export { resolveEntityPageMeta } from './components/referenceEntity/card/entityPage'
// Entity display system
export { ReferenceEntityCard } from './components/referenceEntity/card/ReferenceEntityCard'
export type { ReferenceCardEntity } from './components/referenceEntity/card/referenceEntityCardTypes'
// The card's Intact / Damaged / Destroyed tri-state, for a live sheet that sets
// an item's condition beside its shortform pill rather than on a card's top rail.
export { StatusTriState } from './components/referenceEntity/card/StatusRail'
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
export { quotePatternName } from './components/referenceEntity/pattern/quotePatternName'
export { useChassisPatternConfig } from './components/referenceEntity/pattern/useChassisPatternConfig'
// Entity controls — `navigateControl` is the only live preset. `addControl`,
// `deleteControl` and `selectControl` were measured to zero production call
// sites and deleted; consumers build controls directly.
export { navigateControl } from './components/referenceEntity/referenceEntityControls'
export type { ReferenceEntityControl } from './components/referenceEntity/referenceEntityControlTypes'
export { useDetailModal } from './components/referenceEntity/useDetailModal'
/**
 * The styling foundation (#798, epic #802): tokens, style objects and one
 * stylesheet (ADR-046). Namespaced rather than spread flat into this
 * barrel, because the token names are deliberately generic (`color`, `space`,
 * `radius`) and read correctly only when qualified: `tokens.color.ink`.
 *
 * `tokens` is the values. The other two halves of L1 are `styles/index.css`
 * (the stateful half — `:hover`, `:focus-visible`, `:disabled`, `@media` —
 * which a style object cannot express at all) and `styles/sizing.ts`. The split
 * rule is in this package's CLAUDE.md; read it before migrating a component.
 *
 * `design/styles.ts` was the third half and is gone — see this commit. When L2
 * (#799) migrates a component, reintroduce the object it needs at that point,
 * with its consumer, rather than restoring the speculative set.
 */
export * as tokens from './design/tokens'
// THE ENTITY DISPLAY LANGUAGE (docs/design-system/entity-display-language.md):
// `<Entity form mode>` draws a game entity from its model; the surface supplies
// how refs resolve, texture and the user-made treatment once.
export { Entity } from './entity/Entity'
export { EntitySurfaceProvider } from './entity/EntitySurface'
export type { AnnouncedRoll, EntitySurfaceValue } from './entity/entitySurfaceContext'
// MENTION and PEEK (E4, E16): an entity named in prose, and the page's one
// host for the read-only card a mention or a trait tag shows on hover, focus
// or long-press.
export { Mention } from './entity/forms/Mention'
export type { PeekLoader } from './entity/Peek'
export { PeekHost } from './entity/Peek'
export type { PageRefCandidate, PageRefIndex } from './entity/pageRefs'
export { findPageRefs } from './entity/pageRefs'
export { TECH_LEVEL_SCHEMAS } from './entity/parts/plate'
export type { EntityRowModel } from './entity/types'
/** `CSSProperties` that also admits `--custom-property` keys (see styles/cssVars). */
export type { CSSVarStyle } from './styles/cssVars'
// Utilities — the ONE cn(): joins class names, dropping falsy entries.
export { cn } from './utils/cn'
// The one dice source (Randsum): a named Salvage Union table rolls through
// @randsum/salvageunion, every other die through @randsum/roller.
export type { TableDie } from './utils/dice'
export { dieForTable, rollD20, rollForTable } from './utils/dice'
// Prose with its `[[Trait]]` references drawn as Mentions (ITUN's RollTable).
export { useParseTraitReferences } from './utils/parseTraitReferences'
// The one place a schema id becomes a human label ('crawler-bays' →
// 'Crawler Bays'), so the combobox, the /search page and the catalog can't
// spell the same schema differently.
export { schemaPluralLabel } from './utils/schemaLabels'
