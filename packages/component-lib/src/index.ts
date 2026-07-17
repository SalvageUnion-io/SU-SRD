// Types
export type { DataValue } from './types/common'
export type { PatternOverrideData } from './components/referenceEntity/ReferenceEntityDisplay/referenceEntityDisplayTypes'
export type { ReferenceEntityControl } from './components/referenceEntity/ReferenceEntityDisplay/referenceEntityControlTypes'
export type { DisplayCardTab, CardFootMeta } from './components/shared/DisplayCard'
export type { EntityDisplayMode } from './components/shared/displayMode'
export { resolveDisplayMode } from './components/shared/displayMode'
export type { StatItem } from './components/shared/statsBarTypes'
export type { StatConfig } from './components/referenceEntity/ReferenceEntityDisplay/referenceEntityStatsConfig'
export { ENTITY_STATS_CONFIG } from './components/referenceEntity/ReferenceEntityDisplay/referenceEntityStatsConfig'

// Base typography
export { Text } from './components/base/Text'

// UI primitives
export { Toaster, toast } from './components/ui/toaster'

// Entity display system
export { ReferenceEntityDisplay } from './components/referenceEntity/card/referenceEntityDisplayShim'
export { EntityTooltip } from './components/referenceEntity/EntityTooltip'
export { SectionSeparator } from './components/referenceEntity/ReferenceEntityDisplay/SectionSeparator'
export {
  EntityHrefProvider,
  useEntityHref,
  EntityDetailLinkProvider,
  useEntityDetailLink,
  EntityExternalLinkProvider,
  useEntityExternalLink,
} from './components/referenceEntity/ReferenceEntityDisplay/entityHrefContext'
export type {
  EntityHrefBuilder,
  EntityExternalLinkBuilder,
} from './components/referenceEntity/ReferenceEntityDisplay/entityHrefContext'
export { ReferenceEntityChassisAbilitiesContent } from './components/referenceEntity/ReferenceEntityDisplay/ReferenceEntityChassisAbilitiesContent'
export { ClassAbilityTree } from './components/referenceEntity/ClassAbilityTree'
export { entityHostTone } from './components/referenceEntity/card/entityCardTone'
export { getReferenceEntitySpacing } from './components/referenceEntity/ReferenceEntityDisplay/referenceEntityDisplayTypes'

// Entity controls
export {
  addControl,
  deleteControl,
  navigateControl,
} from './components/referenceEntity/ReferenceEntityDisplay/referenceEntityControls'
export { useDetailModal } from './components/referenceEntity/ReferenceEntityDisplay/useDetailModal'
export { useChassisPatternConfig } from './components/referenceEntity/ReferenceEntityDisplay/useChassisPatternConfig'
export { getClassSelections } from './components/referenceEntity/ReferenceEntityDisplay/classSelectionUtils'

// Shared components
export { CardImage } from './components/shared/CardImage'
export { DualColumnLayout } from './components/shared/DualColumnLayout'
export { DisplayCard } from './components/shared/DisplayCard'
export { useSearchCombobox } from './components/shared/useSearchCombobox'
export type {
  SearchComboboxResult,
  UseSearchComboboxOptions,
} from './components/shared/useSearchCombobox'
export { Footer } from './components/shared/Footer'
export { AppBar } from './components/shared/AppBar'
export type { AppBarNavItem } from './components/shared/AppBar'
export { CatalogTile } from './components/shared/CatalogTile'
export { StaticEntityContent } from './components/shared/StaticEntityContent'
export { SearchField } from './components/shared/SearchField'
export { NavDrawer } from './components/shared/NavDrawer'
export type { NavDrawerItem, NavDrawerCategory } from './components/shared/NavDrawer'
export { Banner } from './components/chrome/Banner'
export type { BannerWarning, BannerSeverity } from './components/chrome/Banner'
export { WizShell, WizTracker } from './components/shared/WizShell'
export type { WizKind } from './components/shared/WizShell'
export { KofiButton } from './components/shared/KofiButton'
export type { KofiButtonProps } from './components/shared/KofiButton'
export { Stat } from './components/shared/Stat'
export type { StatTone, StatState } from './components/shared/Stat'
export { RollTable } from './components/shared/RollTable'
export { FilterChip } from './components/shared/FilterChip'
export { FilterRow } from './components/shared/FilterRow'
export { MasonryColumns } from './components/shared/MasonryColumns'
export { ModalShell } from './components/shared/ModalShell'
export { EntitySearcher } from './components/shared/EntitySearcher'
export { SelCard } from './components/shared/SelCard'
export { SelMasonry } from './components/shared/SelMasonry'
export { CatalogChoiceModal } from './components/referenceEntity/choiceCard/CatalogChoiceModal'
export { ControlButtons } from './components/shared/ControlButtons'
export { CardHeader } from './components/shared/CardHeader'
export {
  TECH_LEVEL_STYLES,
  TECH_LEVEL_BG,
  techLevelLabel,
} from './components/shared/techLevelStyles'

// Skeletons
export { CardSkeleton } from './components/skeleton/CardSkeleton'
export { Skeleton } from './components/skeleton/Skeleton'
export type { SkeletonMode } from './components/skeleton/Skeleton'

export { Content } from './components/referenceEntity/Content'
export {
  borderColorFromHeaderBg,
  calculateBackgroundColor,
  getSourceBorderColor,
} from './components/referenceEntity/referenceEntityHelpers'
export {
  extractReferenceEntityDetails,
  getActivationCurrency,
} from './lib/referenceEntityDataExtraction'

// Interactive choice cards (granted-equipment choices)
export { ChoiceGroups } from './components/referenceEntity/choiceCard/ChoiceGroups'
export type { ChoiceCardOption } from './components/referenceEntity/choiceCard/choiceSelectionHelpers'
export {
  isFreeTextChoice,
  isMultiSelectChoice,
  getChoiceCardOptions,
  resolveMultiSelectCap,
  toggleSelection,
} from './components/referenceEntity/choiceCard/choiceSelectionHelpers'
export type { ChoiceSelections } from './components/referenceEntity/choiceCard/choiceSelectionHelpers'

// Chrome primitives (ITUN design handoff — design-spec §2)
// Badge — the unified stamp-chip family; Tag/Pill/Chip are its presets (ruleset §6)
export { Badge } from './components/chrome/Badge'
export type { BadgeTone, BadgeSurface } from './components/chrome/Badge'
export { Btn } from './components/chrome/Btn'
export { btnVariants } from './components/chrome/btnVariants'
// EmptyState — dashed stamp-headline empty slot (ruleset §"Empty state")
export { EmptyState } from './components/chrome/EmptyState'
// Callout — accent-framed note (stamp header + accent-bar body); list-items,
// "When Damaged" effects, and similar accented notes compose on it.
export { Callout } from './components/chrome/Callout'
// InlineRef — in-prose entity reference (resolved=rust / unresolved=ink)
export { InlineRef } from './components/chrome/InlineRef'
// Stamp — the one ink label/header atom (ruleset §5) + the StampSeam placement
export type { StampSize, StampSurface } from './components/chrome/Badge'
export { STAMP_SEAM } from './components/chrome/stampSeam'
// Icon glyphs — currentColor, 1em, CSP-safe (ruleset §5, atom 11)
export { Glyph } from './components/chrome/glyphs'
export type { GlyphName } from './components/chrome/glyphs'

// Utilities — the ONE cn(): its tailwind-merge config knows the custom
// text/tracking/border-width utilities (consumers must not re-wrap twMerge
// with the default config, which drops them as unknown "colors").
export { cn } from './utils/cn'
export { Field, Input } from './components/chrome/Field'
export { Pill, Chip } from './components/chrome/Pill'
export type { PillTone } from './components/chrome/Pill'
export { PickCard } from './components/chrome/PickCard'
export { Sel } from './components/chrome/Sel'
export { OptRow } from './components/chrome/OptRow'
export { Stepper } from './components/chrome/Stepper'
export { Panel, Row, Empty } from './components/chrome/Panel'
export { Slab } from './components/chrome/Slab'
export { Conditions, ConditionChip } from './components/chrome/Conditions'
export { StepBtn, MiniBtn } from './components/chrome/SmallButtons'
export { TreeSep } from './components/chrome/TreeSep'
export { StatusBadge } from './components/chrome/StatusBadge'
export type { EntityStatus } from './components/chrome/StatusBadge'

// Changelog (shared markdown parser + presentational view)
export { parseChangelog, mergeChangelogs } from './changelog/parseChangelog'
export type { ChangelogEntry } from './changelog/parseChangelog'
export { ChangelogView } from './changelog/ChangelogView'

// Stat trackers (ITUN design handoff — design-spec §2.7)
export { VitalGauge } from './components/stat/VitalGauge'
export type { VitalGaugeProps } from './components/stat/VitalGauge'
export { ConditionSwatch } from './components/stat/ConditionSwatch'
export type { ConditionSwatchState } from './components/stat/ConditionSwatch'
export { UsedPip } from './components/stat/UsedPip'
export { BayStatus } from './components/stat/BayStatus'
export { statBlockRows, statBlockRowStarts, pipClickValue } from './components/stat/pipRows'
export { heatLevel, heatDangerFrom, HEAT_HIGH_RATIO } from './components/stat/heatLevel'
export type { HeatLevel } from './components/stat/heatLevel'

// Cargo / inventory — dashed addressable slot cells (ruleset §5, atom 10)
export { SlotGrid } from './components/shared/SlotGrid'
