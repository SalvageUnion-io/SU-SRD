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
 * The two widths every family is held at. `page` is a desktop window, and for
 * Play its canvas at the design size (`_play.ts`'s `CANVAS`, 1280 × 800), where
 * a measured px is a drawn px. `phone` is a phone, and for Play its phone form,
 * every tab of it.
 */
export type DesignWidth = 'phone' | 'page'

export const DESIGN_VIEWPORTS: Record<DesignWidth, { width: number; height: number }> = {
  page: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
}

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

/** The paths the seed makes (`seedDesignAccount`, `_designRoutes.ts`), named in a route as `:key`. */
export const DESIGN_SEED_KEYS = [
  'pilot',
  'mech',
  'crawler',
  'npc',
  'game',
  'invite',
  'playPlayer',
  'playSolo',
  'playMediator',
] as const

export type DesignSeedKey = (typeof DESIGN_SEED_KEYS)[number]

export type DesignRoute = {
  family: DesignFamily
  /**
   * What the browser opens: an SRD path as it is (`/chassis/mazona/`), an app
   * route through `at()`, or `:key`, a path the seed made (`:pilot`).
   */
  path: string
  widths: readonly DesignWidth[]
  /** The Live Sheet's Edit: press its Read | Edit once it is up (every kind has one, R11). */
  edit?: true
  /** Open this Peek from the Union bar's search, and scan with it open. */
  peek?: { schema: string; name: string }
}

/** A Game's own page, in Play (`/play/games/$gameId`, ADR-052 §5): the one place to repoint it. */
export function gamePageRoute(gameId: string): string {
  return `/play/games/${gameId}`
}

const BOTH: readonly DesignWidth[] = ['page', 'phone']

/**
 * The one route list the layout gates run over (hard rule R0:
 * `chip-strips.e2e.ts`, `nesting-depth.e2e.ts`, `sibling-heights.e2e.ts`):
 * Reference, Listing, Peek, each Live Sheet in Read and Edit, the three
 * wizards, Manage and Play, at phone and page widths, signed in. The account
 * is seeded as `tools/gallery.ts --signed-in` seeds it (`seedDesignAccount`).
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
