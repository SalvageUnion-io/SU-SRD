// Types

// Re-exported (not re-implemented) from salvageunion-reference so consumers
// already importing the rest of the catalog surface from component-lib keep a
// single import site. One implementation lives in the package.
export { isSchemaName } from 'salvageunion-reference'
export { getCatalogBg, getCatalogLabel } from './catalog/catalogColors'
export type { CatalogSection } from './catalog/catalogHelpers'
// SRD catalog — the landing-page category sections, their tile colours, and the
// schema-name guard. Shared so srd's landing page/top nav and the Dashboard's
// SRD Explorer render one catalog rather than two hand-listed ones.
export { buildCatalogSections } from './catalog/catalogSections'
export { Changelog } from './changelog/Changelog'
// Changelog (shared markdown parser + presentational view)
export { mergeChangelogs, parseChangelog } from './changelog/parseChangelog'
// Base typography
export { Text } from './components/base/Text'
export type { BadgeTone } from './components/chrome/Badge'
// Chrome primitives (ITUN design handoff — design-spec §2)
// Badge — the unified stamp-chip family. No named presets: the quiet keyword
// chip is `surface="quiet"`, the status badge is StatusBadge (domain vocabulary).
// (use `Badge surface="outline"`/`"tone"` directly for the former Pill).
export { Badge } from './components/chrome/Badge'
// BandTitle — the paper-on-tone title inside a Card's header band. NOT a
// stamp: it fills its track and truncates, where a stamp sizes to its text.
export { BandTitle } from './components/chrome/BandTitle'
export { Banner } from './components/chrome/Banner'
export { Button } from './components/chrome/Button'
export { buttonVariants } from './components/chrome/buttonVariants'
// Callout — accent-framed note (stamp header + accent-bar body); list-items,
// "When Damaged" effects, and similar accented notes compose on it.
export { Callout } from './components/chrome/Callout'
export { Checkbox, Radio } from './components/chrome/Checkbox'
// ConditionChip is deliberately NOT exported: it is an internal sub-part of
// Conditions (its only consumer), demonstrated via that component's story.
export { CountStepper } from './components/chrome/CountStepper'
// EmptyState — dashed stamp-headline empty slot (ruleset §"Empty state")
export { EmptyState } from './components/chrome/EmptyState'
export { Field, Input, Select } from './components/chrome/Field'
// FieldError — the one single-message validation line (role="alert", danger tone)
export { FieldError } from './components/chrome/FieldError'
// Icon glyphs — currentColor, 1em, CSP-safe (ruleset §5, atom 11)
export { Glyph } from './components/chrome/glyphs'
export { InlineEditField } from './components/chrome/InlineEditField'
/**
 * The focus vocabulary. Exported because the APPS need it, not only the lib:
 * srd and itun each had their own hand-rolled focus treatment (a pilot outline,
 * a rust outline) purely because the canonical rungs stopped at the package
 * boundary. A design system the consuming apps cannot import is one they will
 * re-invent.
 */
export {
  FOCUS_RING,
  INPUT_FOCUS,
} from './components/chrome/interaction'
export { KvRow } from './components/chrome/KvRow'
export { ModeDoor } from './components/chrome/ModeDoor'
export { PageHeading } from './components/chrome/PageHeading'
// PageShell — the full-bleed <main> landmark for a top-level app screen
export { PageShell } from './components/chrome/PageShell'
export { Panel, Row } from './components/chrome/Panel'
export { SectionHeader } from './components/chrome/SectionHeader'
export { Sel } from './components/chrome/Sel'
export { Slab } from './components/chrome/Slab'
// StepButton is deliberately NOT exported: it is an internal atom composed by
// CountStepper (its only consumer), demonstrated via its own co-located story.
// Every hand-assembled '-'/value/'+' cluster in the apps now renders through
// Stat's stepper anatomy instead, so nothing outside this package needs it.
export { StatusBadge } from './components/chrome/StatusBadge'
export type { ActionsDeckView, DeckRow } from './components/dashboard/ActionsDeck'
export { ActionsDeck } from './components/dashboard/ActionsDeck'
export type { ActiveItemBandView, BandButton } from './components/dashboard/ActiveItemBand'
export { ActiveItemBand, StorageBay } from './components/dashboard/ActiveItemBand'
// Dashboard ("Pit HUD") layout shell — legacy-tier (bespoke dark-world CSS,
// not yet on the canon tokens). The scale-to-fit canvas that owns the `.pc-root`
// token scope; ITUN fills it with the store-wired grid + instruments.
export { DashboardCanvas } from './components/dashboard/DashboardCanvas'
export { DashboardGrid } from './components/dashboard/DashboardGrid'
export type { DialItem } from './components/dashboard/Dial'
export { Dial } from './components/dashboard/Dial'
export { DialConfig } from './components/dashboard/DialConfig'
export type { DisplayContent } from './components/dashboard/DisplayPanel'
export { DisplayPanel } from './components/dashboard/DisplayPanel'
export { DowntimeWizard } from './components/dashboard/DowntimeWizard'
export { RailBar } from './components/dashboard/RailBar'
export { ClassAbilityTree } from './components/referenceEntity/ClassAbilityTree'
export { Content } from './components/referenceEntity/Content'
export { entityHostTone } from './components/referenceEntity/card/entityCardTone'
// Entity display system
export { ReferenceEntityCard } from './components/referenceEntity/card/ReferenceEntityCard'
// Interactive choice cards (granted-equipment choices)
export type { ChoiceSelections } from './components/referenceEntity/choiceCard/choiceSelectionHelpers'
export { getClassSelections } from './components/referenceEntity/classSelectionUtils'
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
export { useChassisPatternConfig } from './components/referenceEntity/pattern/useChassisPatternConfig'
// Entity controls — `navigateControl` is the only live preset. `addControl`,
// `deleteControl` and `selectControl` were measured to zero production call
// sites and deleted; consumers build controls directly.
export { navigateControl } from './components/referenceEntity/referenceEntityControls'
export type { ReferenceEntityControl } from './components/referenceEntity/referenceEntityControlTypes'
export { useDetailModal } from './components/referenceEntity/useDetailModal'
export { AboutScreen } from './components/shared/AboutScreen'
export type { AppBarNavItem } from './components/shared/AppBar'
export { AppBar } from './components/shared/AppBar'
export { AppHeader } from './components/shared/AppHeader'
// Deliberately its own module rather than the card-image component's file.
// `story-coverage.test.ts` decides what is public by regex-matching each
// component NAME against this barrel's text, so exporting from that file — or
// even naming it here in prose — marks it public and demands a story for a
// component that is intentionally internal.
// srd's item pages need this string for their `rel=preload`: it must match the
// `sizes` on the <img> exactly, or the preload selects a different candidate
// and the page fetches two files instead of one.
export { assetSrcSetFor } from './components/shared/assetSrcSet'
export type { CardFootMeta } from './components/shared/Card'
// Shared components
export { Card } from './components/shared/Card'
export { CatalogTile } from './components/shared/CatalogTile'
// Colophon (renders the repo-root ABOUT_JRVS.md + LLM_STATEMENT.md on both about pages)
export { Colophon } from './components/shared/Colophon'
export { cardImageSizes } from './components/shared/cardImageSizes'
export { EntityGridRow } from './components/shared/EntityGrid'
export type { EntityRowStat } from './components/shared/EntityRow'
export { EntityRow } from './components/shared/EntityRow'
export { EntitySearcher } from './components/shared/EntitySearcher'
export { FilterRow } from './components/shared/FilterRow'
export { Footer } from './components/shared/Footer'
export { MasonryColumns } from './components/shared/MasonryColumns'
export { MobileSearchDialog } from './components/shared/MobileSearchDialog'
export { ModalShell } from './components/shared/ModalShell'
export type { NavDrawerItem } from './components/shared/NavDrawer'
export { NavDrawer } from './components/shared/NavDrawer'
export { OffRulesEscape } from './components/shared/OffRulesEscape'
// RecoveryPanel — the shared error-recovery card (title / message / primary
// action) behind srd's island error boundary and itun's root error component.
export { RecoveryPanel } from './components/shared/RecoveryPanel'
export { RosterSkeleton } from './components/shared/RosterSkeleton'
export type { StepRule } from './components/shared/RuleBrief'
export { RuleBrief } from './components/shared/RuleBrief'
export { SearchField } from './components/shared/SearchField'
// Live-sheet section chrome — the unified EDIT LANGUAGE primitives (section
// Edit/Add toggles, the one shared picker modal, per-card remove) lifted out of
// ITUN so the sheet containers come from the design system like their cards do.
export {
  CardRemoveButton,
  SectionManageButton,
  SheetPickerModal,
} from './components/shared/SheetSection'
// Promoted app compositions (legacy-tier — poster/sheet chrome lifted from ITUN)
export { SheetSectionSlab } from './components/shared/SheetSectionSlab'
// Cargo / inventory — dashed addressable slot cells (ruleset §5, atom 10)
export { SlotGrid } from './components/shared/SlotGrid'
export { SRDLink } from './components/shared/SRDLink'
export type { StatState, StatTone } from './components/shared/Stat'
export { Stat } from './components/shared/Stat'
export { StaticEntityContent } from './components/shared/StaticEntityContent'
/** The `statsOverride` element type — public because the prop that takes it is. */
export type { StatItem } from './components/shared/statsBarTypes'
export { TECH_LEVEL_STYLES, techLevelLabel } from './components/shared/techLevelStyles'
export type { SearchComboboxResult } from './components/shared/useSearchCombobox'
export { useSearchCombobox } from './components/shared/useSearchCombobox'
export { WizShell, WizTracker } from './components/shared/WizShell'
export { ConditionsEditor } from './components/sheet/ConditionsEditor'
export type { EconLozItem } from './components/sheet/CrawlerEcon'
export { CrawlerEconFrame } from './components/sheet/CrawlerEcon'
export { NpcInset } from './components/sheet/NpcInset'
export { SheetActionsMenu } from './components/sheet/SheetActionsMenu'
export type { ChassisStatItem } from './components/sheet/SheetHero'
// Live-sheet presentation lifted out of ITUN (pure presentation — the app keeps
// only the store-wired containers that feed these).
export { SheetHero } from './components/sheet/SheetHero'
export { SheetSkeleton } from './components/sheet/SheetSkeleton'
export { SnapshotQr } from './components/sheet/SnapshotQr'
export { SHEET_ICONBTN_CLASS } from './components/sheet/sheetChrome'
// Skeletons
export { Skeleton } from './components/skeleton/Skeleton'
// Only `heatDangerFrom` survives — `heatLevel`/`HeatLevel`/`HEAT_HIGH_RATIO`
// were measured to zero consumers and deleted.
export { heatDangerFrom } from './components/stat/heatLevel'
export { linesFromBreakdown, summarizeBreakdown } from './components/stat/provenanceLines'
export type { ProvenanceLine } from './components/stat/StatProvenance'
// Stat trackers (ITUN design handoff — design-spec §2.7)
export { VitalGauge } from './components/stat/VitalGauge'
// UI primitives
export { Toaster, toast } from './components/ui/toaster'
export { BackgroundStep } from './components/wizard/BackgroundStep'
export { CallsignStep } from './components/wizard/CallsignStep'
export { ClassAbilityStep } from './components/wizard/ClassAbilityStep'
export { CrawlerStatsStep } from './components/wizard/CrawlerStatsStep'
// Wizard step presentation lifted out of ITUN — pure option/detail rendering;
// the app supplies the selections and the persistence.
export { CrawlerTypeSelectStep } from './components/wizard/CrawlerTypeStep'
export { selectableClasses } from './components/wizard/classOptions'
export { EquipmentStep } from './components/wizard/EquipmentStep'
export { FlavorStep } from './components/wizard/FlavorStep'
export { GainScrapStep } from './components/wizard/GainScrapStep'
export { MechFlavorStep } from './components/wizard/MechFlavorStep'
export type { RollTableDeps } from './components/wizard/rollTableHelpers'
// Wizard roll-table + class-option helpers (moved with their components).
export { rollForPilotField } from './components/wizard/rollTableHelpers'
export { SystemsList } from './components/wizard/SystemsList'
/**
 * The styling foundation (#798, epic #802) — the target pattern Tailwind is
 * being removed in favour of. Namespaced rather than spread flat into this
 * barrel, because the token names are deliberately generic (`color`, `space`,
 * `radius`) and read correctly only when qualified: `tokens.color.rust`.
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
// Utilities — the ONE cn(): its tailwind-merge config knows the custom
// text/tracking/border-width utilities (consumers must not re-wrap twMerge
// with the default config, which drops them as unknown "colors").
export { cn } from './utils/cn'
// The one place a schema id becomes a human label ('crawler-bays' →
// 'Crawler Bays'), so the combobox, the /search page and the catalog can't
// spell the same schema differently.
export { schemaPluralLabel } from './utils/schemaLabels'
