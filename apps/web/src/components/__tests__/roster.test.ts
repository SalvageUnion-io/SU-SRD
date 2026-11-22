import { describe, expect, test } from 'bun:test'
import * as appOnly from '../app'
import * as islands from '../index'

/** Both barrels: the islands' (`index.ts`) and what only the app draws (`app.ts`). */
const barrel = { ...islands, ...appOnly }

/**
 * The roster gate: `components/index.ts` and `components/app.ts` export exactly what a law
 * names, so a new parallel primitive cannot land without amending the law
 * first. Each value export sits under the law that sanctions it; types are
 * erased and not counted.
 *
 * To add an export: name it in its law (ruleset §5 or §6, hard-rules' chrome K-roles,
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
    'StatColumn', // §5.4 Wells at the book's scale (§3.7)
    'VitalGauge', // §5.5 Gauge
    'Button', // §5.6 Btn
    'buttonVariants', // §5.6 Btn's recipe
    'Slab', // §5.7 Slab
    'SlabLookProvider', // §5.7 Slab: its look, set once a surface
    'useSlabLook', // §5.7 Slab: its look, read
    'SlabSection', // §6.4 Section
    'RollTableInstrument', // §5.8 RollTable
    'StatusBadge', // §5.9 Condition
    'SlotGrid', // §5.10 SlotGrid
    'slotPips', // §4.5 a slot count as pips, a wizard's tracker tab
    'ActivationCost', // §6.1 the cost's pointed box, the one standout
    'ChipButton', // §6.1 Badge: a chip that is its own control (R16)
    'Ledger', // §5.12 Ledger: a compared or picked list's table (L9)
    'TechLevel', // L4 a row's one rank stamp, the Tech Level swatch
    'Facts', // §3.7 a list of labelled values
    'Prose', // §3.7's words at length: a sheet's long text, folded
    'Strip', // §1.2 a Live Sheet's masthead
    'StripFigure', // §1.2 the masthead's fixed figures
    'STRIP_ART', // §1.2 the masthead's art plate
    'RuleBreakMark', // R71 the one mark of a build past its rules, by its count
  ],
  /** the chrome laws (K1–K11) and hard rule R16. */
  chrome: [
    'PictureRadio', // R16 a picture plate that is a radio
    // K5 notices
    'ToasterMount',
    'toast',
    'ACTION_TOAST_MS', // K5 a toast with an action stays 20s
    'MOST_ACTION_TOASTS', // K5 three action toasts at most
    'toastRoll',
    'holdToastsOnTop', // K5 a screen whose foot is controls (a search) holds its toasts at the top
    'holdPlayToasts', // K5 Play's toasts: one at a time, bottom left, above the tabs (r6 A3)
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
    'SkipLink',
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
    // §3.12 caps: the one recipe a label in caps asks
    'capsLabel',
    // The shell: the Union bar, its drawer and foot, the chapter band (ruleset Source 2, §3.11)
    'AppBar',
    'AccountMenu',
    'NavDrawer',
    'Footer',
    'ChapterBand',
    'CHAPTER_BAND_COLOR',
    'CiteLine', // Source 2 the foot's citations, a bold `//` between
    'ToneStrip',
    'Speckle', // §3.5.1 the speckle on a band or an ink ground
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
    'NeighbourRow', // a Page's neighbours: the foot's cut-outs (EDL form 5)
    'MiniGroup', // a Mini and the Minis that belong to it, one border (no nesting, E6)
    'Mention',
    'PeekHost',
    'EntitySurfaceProvider',
    'SELECT_DIM',
    'ReferenceEntityCard',
    'Content',
    'EntityDetailDialog', // the Page in a dialog (the app's open-in-place reading)
    'ActionMinis',
    'PatternListing',
    'EntityCardIdentityFooter', // Source 2: the foot band and its cite cut-out
    'EntityPageStamps',
    'resolveEntityPageMeta',
    'isLegalStartingPatternOf',
    'WhenDamaged',
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
    'abilityTreeNeighbours',
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
    'CardImage', // an entity's art plate, the home page's hero
    'PhoneVitals', // a phone sheet's and Play's pinned vitals block
    'PhoneVitalsGlance', // the same block at a glance row's size: Play's pinned cells
    'FrontPitch', // the home page's pitch
    'EntitySearcher',
    'SearchListbox',
    'useSearchCombobox',
    'StartHere',
    'StatMeanings', // a sheet's stat labels open what the number means (r4 E21)
    'StatMeaning', // one such label alone: the mech wizard's chassis legend (r6 F3)
    'ScrapSplit', // a build's Scrap in a narrow cell, broken between Tech Levels (r6 E4)
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
      'a new export: name it in its law (ruleset §5/§6, the chrome K laws, the EDL) or as a composition, then add it to ROSTER'
    ).toEqual([])
  })

  test('every rostered name is still exported', () => {
    const exported = new Set(Object.keys(barrel))
    const gone = rostered.filter((name) => !exported.has(name)).sort()
    expect(gone, 'a retired export: delete it from ROSTER').toEqual([])
  })
})
