import type { DesignWidth } from 'gates/lib/designViewports'
import { at } from './_base'

/**
 * `designRoutes`, every context the layout gates see (hard rule R0), and how a
 * gate's findings meet the debt it has recorded (`againstBaseline`). Pure, and
 * no Playwright: `e2e/__tests__/designRoutes.test.ts` holds it without a
 * browser, and `_designRoutes.ts` walks it in one.
 */

/** The contexts of ruleset §1, the Listing and the Peek apart from the Page. */
export type DesignContext =
  | 'reference'
  | 'listing'
  | 'peek'
  | 'sheet'
  | 'wizard'
  | 'manage'
  | 'play'

/**
 * Every route family a layout gate must see, with its context. A family is one
 * page shape: a new shape is a family here and an entry in `designRoutes`, or
 * `designRoutes.test.ts` fails.
 */
export const DESIGN_FAMILIES = {
  'reference-page': 'reference',
  'reference-index': 'reference',
  listing: 'listing',
  peek: 'peek',
  'sheet-pilot-read': 'sheet',
  'sheet-pilot-edit': 'sheet',
  'sheet-mech-read': 'sheet',
  'sheet-mech-edit': 'sheet',
  'sheet-crawler-read': 'sheet',
  'sheet-crawler-edit': 'sheet',
  'sheet-npc-read': 'sheet',
  'sheet-npc-edit': 'sheet',
  'wizard-pilot': 'wizard',
  'wizard-mech': 'wizard',
  'wizard-crawler': 'wizard',
  'training-bay': 'manage',
  'play-hub': 'manage',
  'game-page': 'manage',
  invite: 'manage',
  'starter-set': 'manage',
  'play-player': 'play',
  'play-solo': 'play',
  'play-mediator': 'play',
} as const satisfies Record<string, DesignContext>

export type DesignFamily = keyof typeof DESIGN_FAMILIES

/**
 * The families held at one width only, and why. Every other family has an
 * entry at both (`designRoutes.test.ts`).
 */
export const ONE_WIDTH: Partial<Record<DesignFamily, { width: DesignWidth; why: string }>> = {
  peek: {
    width: 'page',
    why: "a Peek opens from the Union bar's search, which a phone folds into its menu",
  },
}

export type DesignRoute = {
  family: DesignFamily
  /**
   * What the browser opens: an SRD path as it is (`/chassis/mazona/`), an app
   * route through `at()`, or `:key`, a path the seed made (`:pilot`,
   * `SEED_KEYS` in `gates/lib/seedAccount.ts`).
   */
  path: string
  widths: readonly DesignWidth[]
  /** The Live Sheet's Edit: press its Read | Edit once it is up (every kind has one, R11). */
  edit?: true
  /** Open this Peek from the Union bar's search, and scan with it open. */
  peek?: { schema: string; name: string }
}

const BOTH: readonly DesignWidth[] = ['page', 'phone']

/**
 * The one route list the layout gates run over (hard rule R0,
 * `design-walk.e2e.ts`): Reference, Listing, Peek, each Live Sheet in Read
 * and Edit, the three wizards, Manage and Play, at phone and page widths,
 * signed in. The account is the one seed (`gates/lib/seedAccount.ts`), as
 * `tools/gallery.ts --signed-in` and `bun run dev:backend` seed it.
 */
export const designRoutes: readonly DesignRoute[] = [
  // Reference: an SRD Page and an index.
  { family: 'reference-page', path: '/chassis/mazona/', widths: BOTH },
  { family: 'reference-index', path: '/systems/', widths: BOTH },
  // Listing: search-result Compacts, the 404's guesses for a missed address.
  { family: 'listing', path: '/drill/', widths: BOTH },
  // Peek: a chassis, from the bar's search over an index.
  {
    family: 'peek',
    path: '/chassis/',
    widths: ['page'],
    peek: { schema: 'chassis', name: 'Big Brother' },
  },
  // Live Sheet, Read and Edit, each kind.
  { family: 'sheet-pilot-read', path: ':pilot', widths: BOTH },
  { family: 'sheet-pilot-edit', path: ':pilot', widths: BOTH, edit: true },
  { family: 'sheet-mech-read', path: ':mech', widths: BOTH },
  { family: 'sheet-mech-edit', path: ':mech', widths: BOTH, edit: true },
  { family: 'sheet-crawler-read', path: ':crawler', widths: BOTH },
  { family: 'sheet-crawler-edit', path: ':crawler', widths: BOTH, edit: true },
  { family: 'sheet-npc-read', path: ':npc', widths: BOTH },
  { family: 'sheet-npc-edit', path: ':npc', widths: BOTH, edit: true },
  // The wizards: the Guided or Blank chooser, then the guided wizard's first step.
  { family: 'wizard-pilot', path: at('/pilots/new'), widths: BOTH },
  { family: 'wizard-pilot', path: at('/pilots/new?mode=guided'), widths: BOTH },
  { family: 'wizard-mech', path: at('/mechs/new'), widths: BOTH },
  { family: 'wizard-mech', path: at('/mechs/new?mode=guided'), widths: BOTH },
  { family: 'wizard-crawler', path: at('/crawlers/new'), widths: BOTH },
  { family: 'wizard-crawler', path: at('/crawlers/new?mode=guided'), widths: BOTH },
  // Manage: the Training Bay, the Play hub, a Game's page, the invite screen.
  { family: 'training-bay', path: at('/'), widths: BOTH },
  { family: 'play-hub', path: at('/play/'), widths: BOTH },
  { family: 'game-page', path: ':game', widths: BOTH },
  { family: 'invite', path: ':invite', widths: BOTH },
  { family: 'starter-set', path: at('/starter'), widths: BOTH },
  // Play: a player in a Game, solo, the Mediator; on a phone, every tab.
  { family: 'play-player', path: ':playPlayer', widths: BOTH },
  { family: 'play-solo', path: ':playSolo', widths: BOTH },
  { family: 'play-mediator', path: ':playMediator', widths: BOTH },
]

/**
 * What a reference corpus page is picked for, by the gate that must find it
 * there: a gate that reads one thing walks the pages that draw it, and fails
 * on a page that draws none, so it never passes by reading nothing.
 *
 * - `contentful-mini`: a contentful Mini (N3) of each kind a sheet or a Page
 *   draws: a crawler's type ability, bays and crew, a pilot's abilities and
 *   equipment, a mech's chassis ability, systems and modules, a pattern's
 *   loadout, a class's ability track (`token-cutout.e2e.ts`).
 * - `stat-column`: a `StatColumn` grid: two chassis and a pattern (`CardPage`'s
 *   column) and the mech sheet's hero, its compact column (`stat-fill.e2e.ts`).
 * - `search`: a search field on its own line: an SRD listing's rail
 *   (`search-width.e2e.ts`).
 * - `rhythm`: a Page of each length and layout: short and long SRD Pages, a
 *   class page (`ClassAbilityTree`), a guide (`GuideSteps`) (`page-rhythm.e2e.ts`).
 * - `seam`: a border-riding stamp: a guide step's "Note" (`GuideSteps`), the one
 *   outside `designRoutes` since a field's label is the Eyebrow over its
 *   control (R16) (`design-walk.e2e.ts`'s value cells).
 */
export type CorpusTrait = 'contentful-mini' | 'stat-column' | 'search' | 'rhythm' | 'seam'

/** One signed-out page of the reference corpus: its family, its path, what it is picked for. */
export type CorpusPage = {
  family: DesignFamily
  path: string
  traits?: readonly CorpusTrait[]
}

const STARTER_SHEETS = [
  'pilot/starter-pilot-bonesaw',
  'pilot/starter-pilot-driftwood',
  'pilot/starter-pilot-hotdog',
  'pilot/starter-pilot-judge',
  'pilot/starter-pilot-nobody',
  'pilot/starter-pilot-pickle',
  'pilot/starter-pilot-razor',
  'mech/starter-mech-bobcat',
  'mech/starter-mech-mazona',
  'mech/starter-mech-mule',
  'mech/starter-mech-scrapper',
  'mech/starter-mech-spectrum',
  'mech/starter-mech-thresher',
  'crawler/starter-crawler-tenacity',
] as const

/** Traits a Starter Set sheet carries, by sheet; the rest carry none. */
const STARTER_TRAITS: Partial<Record<(typeof STARTER_SHEETS)[number], readonly CorpusTrait[]>> = {
  'pilot/starter-pilot-bonesaw': ['contentful-mini'],
  'mech/starter-mech-mazona': ['stat-column'],
  'mech/starter-mech-mule': ['contentful-mini'],
  'crawler/starter-crawler-tenacity': ['contentful-mini'],
}

const page = (path: string, ...traits: CorpusTrait[]): CorpusPage => ({
  family: 'reference-page',
  path,
  ...(traits.length ? { traits } : {}),
})
const index = (path: string, ...traits: CorpusTrait[]): CorpusPage => ({
  family: 'reference-index',
  path,
  ...(traits.length ? { traits } : {}),
})

/**
 * The signed-out pages the page-level gates walk beside `designRoutes` (hard
 * rule R0's one route list, signed out): the outliers among the SRD's Pages
 * and indexes (long names, many chips, deep nesting, every kind of entity
 * once), the guides and roll tables, and the app's signed-out screens: the
 * Training Bay, the Starter Set and every one of its sheets, the Play hub.
 * A gate walks it whole, or the pages with the trait it reads
 * (`corpusRoutes`), at the widths it names.
 */
export const REFERENCE_CORPUS: readonly CorpusPage[] = [
  index('/'),
  index('/chassis/', 'search'),
  index('/systems/', 'search'),
  index('/modules/'),
  index('/abilities/', 'search'),
  index('/creatures/'),
  page('/chassis/mazona/', 'stat-column', 'rhythm'),
  page('/chassis/mazona/pattern/buzzard/', 'stat-column', 'rhythm'),
  page('/chassis/big-brother/', 'stat-column', 'rhythm'),
  page('/chassis/big-brother/pattern/drontek/'),
  page('/chassis/mule/', 'contentful-mini'),
  page('/chassis/mule/pattern/crusher/', 'contentful-mini'),
  page('/systems/salvaging-drill/', 'rhythm'),
  page('/systems/50-cal-machine-gun/'),
  page('/modules/survey-scanner/'),
  page('/abilities/mass-field-maintenance/'),
  page('/classes/hacker/', 'contentful-mini', 'rhythm'),
  page('/classes/engineer/'),
  page('/bio-titans/tyrant/', 'rhythm'),
  page('/npcs/saboteur/', 'rhythm'),
  page('/drones/pest-drone/', 'rhythm'),
  page('/vehicles/fighting-box-wheel/'),
  page('/crawler-bays/armoury/', 'rhythm'),
  page('/creatures/irradiated-scorpion/'),
  page('/roll-tables/core-mechanic/'),
  page('/roll-tables/mechapult/'),
  page('/guides/create-a-pilot/', 'rhythm'),
  page('/guides/crawler-downtime/', 'seam'),
  { family: 'training-bay', path: at('/') },
  { family: 'starter-set', path: at('/starter') },
  ...STARTER_SHEETS.map(
    (sheet): CorpusPage => ({
      family: 'starter-set',
      path: at(`/starter/${sheet}`),
      ...(STARTER_TRAITS[sheet] ? { traits: STARTER_TRAITS[sheet] } : {}),
    })
  ),
  { family: 'play-hub', path: at('/play/') },
]

/**
 * The corpus as routes a walk opens (`walkDesignRoutes`): every page, or those
 * with `trait`, held at `page` and `phone` unless the walk names its widths.
 */
export function corpusRoutes(trait?: CorpusTrait): DesignRoute[] {
  return REFERENCE_CORPUS.filter((p) => !trait || p.traits?.includes(trait)).map((p) => ({
    family: p.family,
    path: p.path,
    widths: BOTH,
  }))
}

/** One finding a gate made, on one view, under one of the gate's rules. */
export type DesignFinding = { family: DesignFamily; rule: string; line: string }

/**
 * One recorded debt: a finding a gate already makes on a route family, under
 * one rule, kept so the gate is green while the debt is burned down. `match`
 * is a substring of the finding's line that names the thing at fault, never
 * its pixel measures (they differ between machines' fonts); `why` says what
 * is wrong and where it is to be fixed.
 */
export type DesignDebt = { family: DesignFamily; rule: string; match: string; why: string }

/**
 * Sort a gate's findings against its baseline: `fresh` fail the gate, `held`
 * are the baseline's, and `stale` are baseline entries nothing matched (paid
 * off: delete them).
 */
export function againstBaseline(
  findings: readonly DesignFinding[],
  baseline: readonly DesignDebt[]
): { fresh: DesignFinding[]; held: DesignFinding[]; stale: DesignDebt[] } {
  const used = new Set<DesignDebt>()
  const fresh: DesignFinding[] = []
  const held: DesignFinding[] = []
  for (const f of findings) {
    const debt = baseline.find(
      (d) => d.family === f.family && d.rule === f.rule && f.line.includes(d.match)
    )
    if (debt) {
      used.add(debt)
      held.push(f)
    } else fresh.push(f)
  }
  return { fresh, held, stale: baseline.filter((d) => !used.has(d)) }
}
