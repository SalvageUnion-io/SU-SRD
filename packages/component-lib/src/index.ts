// Types
export type { ReferenceEntityControl } from './components/referenceEntity/referenceEntityControlTypes'
export type { CardFootMeta } from './components/shared/Card'

// Base typography
export { Text } from './components/base/Text'

// UI primitives
export { Toaster, toast } from './components/ui/toaster'

// Entity display system
export { ReferenceEntityCard } from './components/referenceEntity/card/ReferenceEntityCard'
export {
  EntityHrefProvider,
  EntityDetailLinkProvider,
  EntityExternalLinkProvider,
  PatternHrefProvider,
} from './components/referenceEntity/entityHrefContext'
export type {
  EntityHrefBuilder,
  EntityExternalLinkBuilder,
  PatternHrefBuilder,
} from './components/referenceEntity/entityHrefContext'
export { ClassAbilityTree } from './components/referenceEntity/ClassAbilityTree'
export {
  entityHostTone,
  resolveSchemaDomain,
} from './components/referenceEntity/card/entityCardTone'
export type { CardDomain } from './components/referenceEntity/card/entityCardTone'

// Entity controls — `navigateControl` is the only live preset. `addControl`,
// `deleteControl` and `selectControl` were measured to zero production call
// sites and deleted; consumers build controls directly.
export { navigateControl } from './components/referenceEntity/referenceEntityControls'
export { useDetailModal } from './components/referenceEntity/useDetailModal'
export { useChassisPatternConfig } from './components/referenceEntity/pattern/useChassisPatternConfig'
export { getClassSelections } from './components/referenceEntity/classSelectionUtils'

// Shared components
export { Card } from './components/shared/Card'
export { useSearchCombobox } from './components/shared/useSearchCombobox'
export type { SearchComboboxResult } from './components/shared/useSearchCombobox'
export { Footer } from './components/shared/Footer'
export { AppBar } from './components/shared/AppBar'
export type { AppBarNavItem } from './components/shared/AppBar'
export { CatalogTile } from './components/shared/CatalogTile'
export { StaticEntityContent } from './components/shared/StaticEntityContent'
export { SearchField } from './components/shared/SearchField'
export { MobileSearchDialog } from './components/shared/MobileSearchDialog'
export { SRDLink } from './components/shared/SRDLink'
export { NavDrawer } from './components/shared/NavDrawer'
export type { NavDrawerItem } from './components/shared/NavDrawer'
export { Banner } from './components/chrome/Banner'
export { WizShell, WizTracker } from './components/shared/WizShell'
export { KofiButton } from './components/shared/KofiButton'
export { Stat } from './components/shared/Stat'
export type { StatTone, StatState } from './components/shared/Stat'
export { FilterRow } from './components/shared/FilterRow'
export { MasonryColumns } from './components/shared/MasonryColumns'
export { ModalShell } from './components/shared/ModalShell'
export { EntitySearcher } from './components/shared/EntitySearcher'
export { EntityGrid, EntityGridRow } from './components/shared/EntityGrid'
export { EntityRow } from './components/shared/EntityRow'
export { TECH_LEVEL_STYLES, techLevelLabel } from './components/shared/techLevelStyles'

// Skeletons
export { Skeleton } from './components/skeleton/Skeleton'

// Interactive choice cards (granted-equipment choices)
export type { ChoiceSelections } from './components/referenceEntity/choiceCard/choiceSelectionHelpers'

// Chrome primitives (ITUN design handoff — design-spec §2)
// Badge — the unified stamp-chip family. No named presets: the quiet keyword
// chip is `surface="quiet"`, the status badge is StatusBadge (domain vocabulary).
// (use `Badge surface="outline"`/`"tone"` directly for the former Pill).
export { Badge } from './components/chrome/Badge'
export type { BadgeTone } from './components/chrome/Badge'
export { Button } from './components/chrome/Button'
export { buttonVariants } from './components/chrome/buttonVariants'
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
  FOCUS_WITHIN,
  INPUT_FOCUS,
  DISABLED,
} from './components/chrome/interaction'
// EmptyState — dashed stamp-headline empty slot (ruleset §"Empty state")
export { EmptyState } from './components/chrome/EmptyState'
// FieldError — the one single-message validation line (role="alert", danger tone)
export { FieldError } from './components/chrome/FieldError'
// Callout — accent-framed note (stamp header + accent-bar body); list-items,
// "When Damaged" effects, and similar accented notes compose on it.
export { Callout } from './components/chrome/Callout'
// RecoveryPanel — the shared error-recovery card (title / message / primary
// action) behind srd's island error boundary and itun's root error component.
export { RecoveryPanel } from './components/shared/RecoveryPanel'
// Icon glyphs — currentColor, 1em, CSP-safe (ruleset §5, atom 11)
export { Glyph } from './components/chrome/glyphs'

// Utilities — the ONE cn(): its tailwind-merge config knows the custom
// text/tracking/border-width utilities (consumers must not re-wrap twMerge
// with the default config, which drops them as unknown "colors").
export { cn } from './utils/cn'
export { Field, Input, Select, Textarea } from './components/chrome/Field'
export { Checkbox, Radio } from './components/chrome/Checkbox'
export { Toggle } from './components/chrome/Toggle'
export { Sel } from './components/chrome/Sel'
export { KvRow } from './components/chrome/KvRow'
export { ModeDoor } from './components/chrome/ModeDoor'
export { InlineEditField } from './components/chrome/InlineEditField'

// Dashboard ("Pit HUD") layout shell — legacy-tier (bespoke dark-world CSS,
// not yet on the canon tokens). The scale-to-fit canvas that owns the `.pc-root`
// token scope; ITUN fills it with the store-wired grid + instruments.
export { DashboardCanvas } from './components/dashboard/DashboardCanvas'
export { DashboardGrid } from './components/dashboard/DashboardGrid'
export { RailBar } from './components/dashboard/RailBar'
export { DialConfig } from './components/dashboard/DialConfig'
export { Dial } from './components/dashboard/Dial'
export type { DialItem, DialGauge } from './components/dashboard/Dial'
export { DowntimeWizard } from './components/dashboard/DowntimeWizard'
export { ActiveItemBand, StorageBay } from './components/dashboard/ActiveItemBand'
export type { ActiveItemBandView, BandButton } from './components/dashboard/ActiveItemBand'
export { DisplayPanel } from './components/dashboard/DisplayPanel'
export type { DisplayContent } from './components/dashboard/DisplayPanel'
export { ActionsDeck } from './components/dashboard/ActionsDeck'
export type { ActionsDeckView, DeckGroup } from './components/dashboard/ActionsDeck'
export { CountStepper } from './components/chrome/CountStepper'
export { Panel, Row } from './components/chrome/Panel'
export { Slab } from './components/chrome/Slab'
export { SectionHeader } from './components/chrome/SectionHeader'
export { PageHeading } from './components/chrome/PageHeading'
// ConditionChip is deliberately NOT exported: it is an internal sub-part of
// Conditions (its only consumer), demonstrated via that component's story.
export { Conditions } from './components/chrome/Conditions'
// StepButton is deliberately NOT exported: it is an internal atom composed by
// CountStepper (its only consumer), demonstrated via its own co-located story.
// Every hand-assembled '-'/value/'+' cluster in the apps now renders through
// Stat's stepper anatomy instead, so nothing outside this package needs it.
export { StatusBadge } from './components/chrome/StatusBadge'
export type { EntityStatus } from './components/shared/entityStatus'

// Changelog (shared markdown parser + presentational view)
export { parseChangelog, mergeChangelogs } from './changelog/parseChangelog'
export { Changelog } from './changelog/Changelog'

// Colophon (renders the repo-root ABOUT_JRVS.md + LLM_STATEMENT.md on both about pages)
export { Colophon } from './components/shared/Colophon'

// Stat trackers (ITUN design handoff — design-spec §2.7)
export { VitalGauge } from './components/stat/VitalGauge'
export { BayStatus } from './components/stat/BayStatus'
// Only `heatDangerFrom` survives — `heatLevel`/`HeatLevel`/`HEAT_HIGH_RATIO`
// were measured to zero consumers and deleted.
export { heatDangerFrom } from './components/stat/heatLevel'

// Cargo / inventory — dashed addressable slot cells (ruleset §5, atom 10)
export { SlotGrid } from './components/shared/SlotGrid'

// Promoted app compositions (legacy-tier — poster/sheet chrome lifted from ITUN)
export { SheetSectionCard } from './components/shared/SheetSectionCard'
export { SheetSectionSlab } from './components/shared/SheetSectionSlab'

// Live-sheet presentation lifted out of ITUN (pure presentation — the app keeps
// only the store-wired containers that feed these).
export { SheetHero, ChassisStats } from './components/sheet/SheetHero'
export type { ChassisStatItem } from './components/sheet/SheetHero'
export { CrawlerEconFrame } from './components/sheet/CrawlerEcon'
export type { EconLozItem } from './components/sheet/CrawlerEcon'
export { ConditionsEditor } from './components/sheet/ConditionsEditor'

// Wizard step presentation lifted out of ITUN — pure option/detail rendering;
// the app supplies the selections and the persistence.
export {
  CrawlerTypeOptionList,
  CrawlerTypeDetail,
  CrawlerTypeSelectStep,
} from './components/wizard/CrawlerTypeStep'
export { CrawlerStatsStep } from './components/wizard/CrawlerStatsStep'
export { SystemsList } from './components/wizard/SystemsList'
export { EquipmentStep } from './components/wizard/EquipmentStep'
export { GainScrapStep } from './components/wizard/GainScrapStep'
export { FlavorStep } from './components/wizard/FlavorStep'
export { BackgroundStep } from './components/wizard/BackgroundStep'
export { CallsignStep } from './components/wizard/CallsignStep'
export { ClassOptionList, ClassDetail } from './components/wizard/ClassStep'
export { ClassAbilityStep } from './components/wizard/ClassAbilityStep'
export { AppHeader } from './components/shared/AppHeader'
export { AboutScreen } from './components/shared/AboutScreen'
export { SnapshotQr } from './components/sheet/SnapshotQr'
export { MechFlavorStep } from './components/wizard/MechFlavorStep'
// Wizard roll-table + class-option helpers (moved with their components).
export { rollForPilotField } from './components/wizard/rollTableHelpers'
export type { RollTableDeps } from './components/wizard/rollTableHelpers'
export { selectableClasses } from './components/wizard/classOptions'
export { RosterSkeleton } from './components/shared/RosterSkeleton'
export { SheetSkeleton } from './components/sheet/SheetSkeleton'
export { NpcInset } from './components/sheet/NpcInset'
export { SheetActionsMenu } from './components/sheet/SheetActionsMenu'
export { SHEET_ICONBTN_CLASS } from './components/sheet/sheetChrome'
// Live-sheet section chrome — the unified EDIT LANGUAGE primitives (section
// Edit/Add toggles, the one shared picker modal, per-card remove) lifted out of
// ITUN so the sheet containers come from the design system like their cards do.
export {
  SectionManageButton,
  SectionEditButton,
  SheetPickerModal,
  CardRemoveButton,
} from './components/shared/SheetSection'
export { cardRemoveControls } from './components/shared/editLanguage'
export { RuleBrief } from './components/shared/RuleBrief'
export type { StepRule } from './components/shared/RuleBrief'
export { OffRulesEscape } from './components/shared/OffRulesEscape'
