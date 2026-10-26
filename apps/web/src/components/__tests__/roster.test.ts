import { describe, expect, test } from 'bun:test'
import * as barrel from '../index'

/**
 * The roster gate: `components/index.ts` exports exactly what a law
 * names, so a new parallel primitive cannot land without amending the law
 * first. Each value export sits under the law that sanctions it; types are
 * erased and not counted.
 *
 * To add an export: name it in its law (ruleset §5 or §6, chrome.md's K-roles,
 * the EDL) or as a named composition, then list it here under that law. To
 * retire one: delete it from the barrel and from here.
 */
const ROSTER = {
  /** Ruleset §5, the irreducible set, and §6's merged homes (§6.1 the cost's box, §6.4 the section). */
  irreducible: [
    'Badge', // §5.1 Stamp, §5.3 Badge
    'Box', // §5.2 Frame
    'TitledBox', // §5.2 Frame, cut-out
    'Callout', // §5.2 a note
    'Stat', // §5.4 Well
    'StatColumn', // §5.4 Wells at the book's scale (R36)
    'VitalGauge', // §5.5 Gauge
    'Button', // §5.6 Btn
    'buttonVariants', // §5.6 Btn's recipe
    'Slab', // §5.7 Slab
    'SlabSection', // §6.4 Section
    'RollTableInstrument', // §5.8 RollTable
    'StatusBadge', // §5.9 Condition
    'SlotGrid', // §5.10 SlotGrid
    'ActivationCost', // §6.1 the cost's pointed box, the one standout
    'ChipButton', // §6.1 Badge: a chip that is its own control (R16)
  ],
  /** chrome.md's roles (K1–K11) and the chrome hard rules (R16, R20, R22, R24, R27, R29). */
  chrome: [
    // K5 notices
    'ToasterMount',
    'toast',
    'toastRoll',
    'Banner',
    'FieldError',
    'CopiedIcon',
    'CopiedStatus',
    'useCopied',
    // K6 loading
    'Pending',
    'Skeleton',
    'SkeletonFrame',
    'RosterSkeleton',
    'Ghost',
    'loadingCopy',
    // K7 dialogs
    'ModalShell',
    'ConfirmDialog',
    'DialogActions',
    'PickDialog',
    // K8 empty and error states
    'EmptyState',
    'RecoveryPanel',
    // K9 focus
    'FOCUS_RING',
    // K10 tabs, segmented, toggle
    'Tabs',
    'TabList',
    'Tab',
    'TabPanel',
    'Segmented',
    'SegmentedOption',
    'Switch', // K10: a standing setting drawn on or off
    'Toggle',
    'ToggleCard', // R16: an on/off whose face is a card (a choice's option)
    'TrackStep', // R16: a step on a numbered track (the wizard rail, the Downtime track)
    // R16 one component per chrome role
    'Field',
    'Select',
    'Input',
    'Textarea',
    'Checkbox',
    'Radio',
    'RadioCardGroup',
    'Eyebrow',
    'SearchField',
    'BreadcrumbTrail',
    'ChapterBandTrail',
    'CloseButton',
    'NextLabel',
    'InlineRef',
    'HeaderMenu',
    'PopoverPanel',
    'useModKeyHint',
    // The shell: the Union bar, its drawer and foot, the chapter band (ruleset Source 2, §3.11)
    'AppBar',
    'AccountMenu',
    'NavDrawer',
    'Footer',
    'ChapterBand',
    'CHAPTER_BAND_COLOR',
    'ToneStrip',
    'PageShell',
    'KofiButton',
    'Text',
    // Layout: a column, a wrapping row, equal columns, masonry
    'Stack',
    'Cluster',
    'Grid',
    'MasonryColumns',
    'MiniGrid', // EDL Mini, contentful (N3): a list of them as masonry
  ],
  /** The EDL's forms and modes, the entity module's face, and the Card and Page. */
  edl: [
    'Entity',
    'MiniGroup', // a Mini and the Minis that belong to it, one border (no nesting, E6)
    'Mention',
    'PeekHost',
    'EntitySurfaceProvider',
    'SELECT_DIM',
    'ReferenceEntityCard',
    'Content',
    'ActionMinis',
    'PatternListing',
    'EntityPageStamps',
    'resolveEntityPageMeta',
    'isLegalStartingPatternOf',
    'WhenDamaged',
    'BayInfo',
    'EntityRollMini',
    'EntityChoices',
    'LinkedUnits', // EDL: a linked unit is its header-only Mini, never a chip
    'damagedEffectOf',
    'Chips',
    'Art',
    'Head',
    'KindLabel',
    'Tag',
    'Tags',
    'traitTags',
    'relation',
    'mentionRef',
    'embeddedPeekAddress',
    'findPageRefs',
    'findNameRefs',
    'HomebrewStamp',
    'USER_MADE_HATCH',
    'quotePatternName',
    'navigateControl',
    'useDetailModal',
  ],
  /** Named compositions: product surfaces built from the above. */
  compositions: [
    'AbilityTrack',
    'BrandCard',
    'OgCard',
    'ogCardForEntity',
    'OG_CARD_HEIGHT',
    'OG_CARD_WIDTH',
    'ogCardDescription',
    'ogCardThemeColor',
    'ogCardTitle',
    'ogReferenceAddressFits',
    'ContentsChapter',
    'EntitySearcher',
    'SearchListbox',
    'useSearchCombobox',
    'StartHere',
    'MarkdownSection',
    'InlineMarkdown',
    'TraitProse',
    'Conditions',
    'AdderBox',
    'AdderField',
    'FeedLine',
    'FeedList',
    'FeedTime',
    'assetSrcSetFor',
    'heroImageSizes',
    'digestRollTable',
    'withNothingHappens',
    'digestColumnsTable',
    'trackForTree',
    'linesFromBreakdown',
    'summarizeBreakdown',
    'heatDangerFrom',
  ],
  /** The foundation: tokens, the one `cn`, the dice and the shared hooks. */
  foundation: [
    'tokens',
    'cn',
    'dieForTable',
    'rollD20',
    'rollForTable',
    'useDisclosure',
    'useMediaQuery',
  ],
} as const satisfies Record<string, readonly string[]>

const rostered = Object.values(ROSTER).flat()

describe('the components roster', () => {
  test('lists each export once', () => {
    const twice = rostered.filter((name, index) => rostered.indexOf(name) !== index)
    expect(twice).toEqual([])
  })

  test('every barrel export is one a law names', () => {
    const unnamed = Object.keys(barrel)
      .filter((name) => !rostered.includes(name as (typeof rostered)[number]))
      .sort()
    expect(
      unnamed,
      'a new export: name it in its law (ruleset §5/§6, chrome.md, the EDL) or as a composition, then add it to ROSTER'
    ).toEqual([])
  })

  test('every rostered name is still exported', () => {
    const exported = new Set(Object.keys(barrel))
    const gone = rostered.filter((name) => !exported.has(name)).sort()
    expect(gone, 'a retired export: delete it from ROSTER').toEqual([])
  })
})
