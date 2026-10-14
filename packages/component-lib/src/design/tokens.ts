/**
 * The typed token scale — the TypeScript mirror of `src/styles/theme.css`, the
 * one token set. How tokens and stylesheet classes divide the work is in
 * `.claude/rules/styling.md`.
 *
 *   - **Plain `as const` literals, no `var()`.** A token is a value, readable
 *     from a style object, a test or a Node script with no DOM, so the scale
 *     works with no stylesheet loaded. `tokens.parity.test.ts` asserts these
 *     literals agree with `theme.css`.
 *   - **Names match theme.css.** A camelCase key maps to its kebab-case custom
 *     property mechanically (`ink75` → `--color-ink-75`, `displayLg` →
 *     `--text-display-lg`, `wkBg2` → `wk-bg-2`, `tl1` → `tl-1`), which is what
 *     lets the parity test compare the two files without a mapping table.
 */

/**
 * Type faces. TWO, no aliases: Barlow for body and values, Barlow Semi
 * Condensed for the all-caps chrome (stamps, labels, eyebrows).
 */
export const font = {
  body: "'Barlow', 'Barlow Fallback', system-ui, -apple-system, sans-serif",
  cond: "'Barlow Semi Condensed', 'Barlow Semi Condensed Fallback', 'Barlow', system-ui, -apple-system, sans-serif",
} as const

/**
 * The spacing rhythm, keyed by its own pixel value.
 *
 * Keyed by pixels rather than by an invented `xs`/`sm`/`lg` vocabulary:
 * `space[8]` is 8px.
 */
export const space = {
  0: '0px',
  2: '2px',
  4: '4px',
  6: '6px',
  8: '8px',
  10: '10px',
  12: '12px',
  14: '14px',
  16: '16px',
  20: '20px',
  24: '24px',
  28: '28px',
  32: '32px',
  40: '40px',
  48: '48px',
  64: '64px',
} as const

/**
 * The type ladder.
 *
 * The first block is the SEMANTIC ladder (ruleset §4.2) — the one to reach for,
 * named by role rather than by size, and shared by every surface:
 *
 *   badge     11px     THE FLOOR — caps labels, stamps, badges, pills, unit
 *                      suffixes, compact caps values
 *   note      11.5px   small body copy in rails and insets
 *   caption   13px     hints, empty states, subtitles
 *   lede      15px     emphasized inline values, inset titles
 *   readout   17px     …then the display end, at a ~1.2 ratio:
 *   title     22px
 *   display   26px
 *   displayLg 31px
 *   hero      38px
 *   chapter   64px     the ChapterBand's notched page title (≥ sm)
 *
 * Nothing sits under 11px (ruleset §4.6): the four rungs that once did (8, 9,
 * 10 and 10.5px) were retired into `badge`, and `bun run check styling`
 * (tokens/type-floor) rejects any smaller size, by name or by literal.
 *
 * The second block is the INHERITED rungs: the stock `text-xs` … `text-3xl`
 * rungs at their rem values (theme.css declares them), so they scale with the
 * reader's font size.
 *
 * They overlap the semantic ladder (14 sits between caption and lede; 24 and 30
 * sit either side of title and displayLg), and that overlap is real debt: two
 * spellings for one intent is the drift this system's own ruleset is written to
 * prevent. Reconciling them is a DESIGN pass with visible consequences at every
 * one of those call sites, not a mechanical port, so it is flagged here rather
 * than smuggled into a foundation layer. **Prefer the semantic rung; reach for
 * an inherited one only when migrating a call site that already used it.**
 */
export const fontSize = {
  // — semantic ladder (ruleset §4.2) —
  badge: '11px',
  note: '11.5px',
  caption: '13px',
  lede: '15px',
  readout: '17px',
  title: '22px',
  display: '26px',
  displayLg: '31px',
  hero: '38px',
  /** The ChapterBand's notched title at desktop width (phones take `hero`). */
  chapter: '64px',
  // — inherited rungs (rem, in live use; see the note above) —
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
} as const

/** Font weights in use. Barlow ships the whole range; these are the rungs used. */
export const weight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const

/**
 * The caps tracking ladder (ruleset §4.2). `capsTight` (0.04em) is the
 * canonical stamp/label tracking; `eyebrow` (0.22em) is the brand caption only.
 */
export const tracking = {
  capsTight: '0.04em',
  capsSnug: '0.06em',
  caps: '0.08em',
  capsWide: '0.12em',
  eyebrow: '0.22em',
} as const

/**
 * The ONE radius vocabulary (ruleset §4.4). Pick by ROLE, not by which number
 * is nearest:
 *
 *   pip    tracker pips
 *   badge  the stamp-chip family
 *   card   cards, inputs, buttons
 *   panel  app-chrome panels & pick cards
 *   none   stamps are square
 *   full   pills and circles
 *
 * The radius ladder is a *closed* role vocabulary: 4px is `card`, 6px is
 * exactly `panel`. A new radius names its role here rather than a raw value.
 */
export const radius = {
  pip: '1px',
  badge: '2px',
  card: '3px',
  panel: '6px',
  none: '0px',
  full: '9999px',
} as const

/**
 * Border weights, one meaning each (design-spec §1.3 / ruleset §4.3):
 *
 *   hairline  1px    plain rules
 *   chrome    1.5px  buttons, inputs, panels, rows, pips
 *   pill      2px    pills / status badges / dividers
 *   rail      2.5px  rail cards & Hold frames
 *   entity    3px    entity cards + hero header
 */
export const borderWidth = {
  hairline: '1px',
  chrome: '1.5px',
  pill: '2px',
  rail: '2.5px',
  /** The entity card's frame one size down: 3 → 2 → 1.5px (ruleset §4.3). */
  entityCompact: '2px',
  entity: '3px',
} as const

/**
 * The base colour values. Not exported directly — `color` below re-exports
 * these alongside the semantic aliases that point at them, so an alias stays an
 * alias (retone `rollSuccess` and `statusOk` follows) instead of being a second
 * literal of the same number. That aliasing is why the shadow `su-*` family had
 * to be deleted from theme.css, and it is preserved here rather than flattened.
 */
const base = {
  // — Tech Level blues —
  tl1: 'rgb(115, 201, 230)',
  tl2: 'rgb(87, 169, 200)',
  /** One step lighter than the earlier TL3 (68, 135, 162), so ink clears 4.5:1 on it. */
  tl3: 'rgb(83, 145, 169)',
  tl4: 'rgb(48, 107, 128)',
  tl5: 'rgb(30, 83, 100)',
  tl6: 'rgb(6, 52, 65)',
  // Non-numeric equipment tiers (Core Book p.3): Bio + Nanite.
  tlB: 'rgb(86, 156, 104)',
  /** One step deeper than the earlier Nanite (146, 109, 184), so paper clears 4.5:1 on it. */
  tlN: 'rgb(134, 100, 169)',

  // — Entity colours: hue encodes ontology (ruleset §3/§4.1) —
  pilot: 'rgb(239, 137, 79)',
  pilotLight: 'rgb(245, 193, 163)',
  mech: 'rgb(122, 151, 138)',
  mechDark: 'rgb(92, 121, 108)',
  crawler: 'rgb(206, 88, 152)',
  /** The deeper crawler band that carries paper text (4.6:1) — crawler pink
   *  carries neither ink nor paper at 4.5:1 (ruleset §3.8). */
  crawlerBand: 'rgb(184, 74, 134)',
  /** The Denizens chapter band (navy), carrying paper text at 8.8:1. A band
   *  only: Denizens cards keep `adversary`. */
  denizenBand: 'rgb(47, 74, 102)',
  /** The world/opposition schemas — creatures, bio-titans, factions, npcs,
   *  meld, squads. NOT the action rust, despite the tone. */
  adversary: 'rgb(140, 75, 56)',

  // — Class ability-tier ramp (owner's call): Advanced and Hybrid rust.
  //   Core and Legendary reuse pilot/crawler. —
  tierHybrid: 'rgb(183, 65, 14)',

  /** Discord's own blurple: the SRD home page's "Roll on Discord" band only, a
   *  one-off exception to the tone palette (owner's call, 2026-10-14). */
  discord: 'rgb(88, 101, 242)',

  // — Roll result tiers: the canonical warm state ramp, shared with the bot —
  rollCascade: 'rgb(176, 67, 43)',
  rollFailure: 'rgb(192, 122, 47)',
  rollTough: 'rgb(193, 154, 62)',
  rollSuccess: 'rgb(111, 138, 74)',
  rollNailed: 'rgb(75, 134, 160)',

  // — Ink / paper / action —
  ink: 'rgb(40, 32, 25)',
  ink2: 'rgb(70, 61, 49)',
  /** The dark header ground. */
  inkDeep: 'rgb(27, 23, 18)',

  /** Ink at opacity — hairlines, placeholders, ghosts, disabled fills and
   *  shadows. Warm ink at opacity reads as the same material at distance,
   *  which a true-neutral grey does not against warm paper.
   *
   *  An `/NN` alpha with no rung here is never rounded to a neighbouring
   *  one: it ports as the `color-mix()` it was compiled to. */
  ink85: 'rgb(40 32 25 / 0.85)',
  ink75: 'rgb(40 32 25 / 0.75)',
  /** ModalShell's scrim edge. */
  ink60: 'rgb(40 32 25 / 0.6)',
  /** MechChassisStep's Custom-build card border. */
  ink55: 'rgb(40 32 25 / 0.55)',
  ink50: 'rgb(40 32 25 / 0.5)',
  ink40: 'rgb(40 32 25 / 0.4)',
  /** SheetSectionSlab's rule. */
  ink35: 'rgb(40 32 25 / 0.35)',
  ink30: 'rgb(40 32 25 / 0.3)',
  ink20: 'rgb(40 32 25 / 0.2)',
  ink15: 'rgb(40 32 25 / 0.15)',
  ink12: 'rgb(40 32 25 / 0.12)',
  ink10: 'rgb(40 32 25 / 0.1)',
  ink8: 'rgb(40 32 25 / 0.08)',
  /** The faintest rung on the ramp — RosterSkeleton's resting shimmer. */
  ink5: 'rgb(40 32 25 / 0.05)',

  /** The ONE light surface (ruleset §4.1) — a near-white warm paper. Pure
   *  white is retired from the UI; the only survivor is the print sheet. */
  paper: 'rgb(251, 250, 247)',
  /** Paper as a FOREGROUND — text and hairlines printed onto a tone or a dark
   *  ground. Paper as a background is always the flat `paper`. */
  paper60: 'rgb(251 250 247 / 0.6)',
  /** The de-emphasised rung ON a tone or dark ground — the inverse counterpart
   *  of `wkMuted`, which only clears AA on the light grounds: `Stat`'s
   *  `inverse` skin. */
  paper70: 'rgb(251 250 247 / 0.7)',
  paper30: 'rgb(251 250 247 / 0.3)',
  /** FilterRow's sticky backing — near-opaque paper over scrolling content. */
  paper85: 'rgb(251 250 247 / 0.85)',
  /** MobileSearchDialog's hairline on a tone. */
  paper15: 'rgb(251 250 247 / 0.15)',

  /** THE single action colour. */
  rust: 'rgb(168, 82, 34)',
  rustHi: 'rgb(138, 64, 25)',
  /** A 25% rust wash, for non-indicator use.
   *
   *  **It is not a focus ring**: it measures 1.42:1 against paper where WCAG
   *  2.4.11 / 1.4.11 require 3:1. Focus is the offset ring in
   *  `--focus-ring-shadow`; see the rationale above `.su-focus-ring` in
   *  `styles/index.css`. */
  rust25: 'rgb(168 82 34 / 0.25)',
  /** The one sanctioned cream — RollTable banding, and nowhere else. */
  bandCream: 'rgb(243, 237, 226)',

  // — Workshop (light) ground: the step off-paper that makes a card read as a
  //   panel —
  /** The page ground: the book's own paper (ruleset §4.1, board 03). */
  wkBg: 'rgb(239, 236, 230)',
  wkBg2: 'rgb(215, 230, 238)',
  /** The muted secondary-text tone — warm, like the paper — toned to clear
   *  WCAG AA on all three grounds it lands on (paper 5.73:1 · wkBg 5.07:1 ·
   *  wkBg2 4.68:1). */
  wkMuted: 'rgb(107, 98, 87)',
  /** NON-TEXT ONLY — 2.03:1 on paper. A hairline/divider tone. */
  wkFaint: 'rgb(167, 180, 189)',
  /** Advisory/info rule. */
  wkLine: 'rgb(143, 195, 216)',
  /** Game-state accent. */
  wkAccent: 'rgb(125, 206, 235)',

  // — Attention fills that are neither an ontology hue nor a status overlay —
  caution: 'rgb(215, 195, 125)',
  /** Banner's caution wash — the advisory fill behind its caution border. */
  caution25: 'rgb(215 195 125 / 0.25)',

  // — Cargo (storage) accent pair —
  cargo: 'rgb(156, 122, 62)',
  cargoPale: 'rgb(239, 230, 212)',

  // — Sheet "deep" tones that are literals rather than aliases —
  /** A LITERAL holding ink's value, never an alias of `rust`: rust means "do
   *  something" and nothing may alias it (ruleset §3.1). Board 03 rules that
   *  pilot-deep becomes ink. */
  sheetPilotDeep: 'rgb(40, 32, 25)',
  sheetMechDeep: 'rgb(47, 67, 56)',
  sheetCrawlerDeep: 'rgb(126, 42, 91)',
} as const

/**
 * The closed colour set (ruleset §0/§4.1). One name per colour: there is no
 * second spelling of any value here, which is what makes a law like "rust =
 * action, only action" auditable by search.
 */
export const color = {
  ...base,

  // — Status (Intact / Damaged / Destroyed): aliases of the roll tiers —
  statusOk: base.rollSuccess,
  statusWarn: base.rollFailure,
  statusBad: base.rollCascade,

  // — Sheet tones (Header C live sheets): base + deep pairs —
  sheetPilot: base.pilot,
  sheetMech: base.mech,
  sheetCrawler: base.crawler,
  /** The shared-table ontology (ADR-030). Blue, so a Game row never reads as
   *  the crawler row next to it. */
  sheetGame: base.wkAccent,
} as const

/**
 * The light speckle (ruleset §3.5 "Texture", board 05c) — the printed book's
 * bands and banners are speckled, so ours are, generated in code.
 *
 * `texture` holds the overlay opacities, which a stylesheet can read too
 * (`--texture-*` in theme.css; `tokens.parity.test.ts` holds them equal). The
 * filter primitives in `speckle` below have no CSS consumer — they are SVG
 * filter attributes — so they live here alone.
 *
 * Grain, not shading: nothing interpolates between colours. Where it goes is
 * a law with a guard behind it (`tokens/texture-placement`): ink speckle on
 * colour bands and tone headers, paper flecks on ink grounds — never on
 * paper, buttons, fields, the Dashboard or tooltips.
 */
export const texture = {
  blotOpacity: '0.4',
  speckOpacity: '0.35',
  fleckOpacity: '0.55',
} as const

/**
 * The three speckle filters, by the ids the origin named them (`su-blot`,
 * `su-speck`, `su-fleck`). Each is `feTurbulence` noise thresholded to hard
 * specks by an `feColorMatrix` alpha row (`gain · noise + threshold`), then
 * composited onto a flat fill. The thresholds are board 05c's QUIETER set —
 * the "light speckle" chosen over the heavy one (−17.8 / −14.2 / −14.7).
 *
 * The two grains:
 *   - `ink`   — blot + speck, filled with `ink`: the speckle on a colour band
 *               or a tone header.
 *   - `paper` — fleck, filled with `wkBg` (the book's paper): the flecks on a
 *               dark ground — the Union bar, an ink banner, a unit stamp.
 */
export const speckle = {
  filters: {
    blot: {
      id: 'su-blot',
      baseFrequency: '0.32',
      numOctaves: 2,
      seed: 3,
      gain: 26,
      threshold: -20.4,
    },
    speck: {
      id: 'su-speck',
      baseFrequency: '0.85',
      numOctaves: 2,
      seed: 10,
      gain: 22,
      threshold: -16.9,
    },
    fleck: {
      id: 'su-fleck',
      baseFrequency: '0.5 0.9',
      numOctaves: 2,
      seed: 22,
      gain: 22,
      threshold: -17.3,
    },
  },
  grains: {
    ink: [
      { filter: 'blot', fill: color.ink, opacity: texture.blotOpacity },
      { filter: 'speck', fill: color.ink, opacity: texture.speckOpacity },
    ],
    paper: [{ filter: 'fleck', fill: color.wkBg, opacity: texture.fleckOpacity }],
  },
} as const
