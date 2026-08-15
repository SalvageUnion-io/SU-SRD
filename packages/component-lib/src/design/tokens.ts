/**
 * The typed token scale — the TypeScript half of the design system's source of
 * record.
 *
 * Layer 1 of the Tailwind removal (#798, epic #802). Every value here is
 * **ported verbatim** from `src/styles/theme.css`, which is still the live
 * source while Tailwind is in the build. Nothing is re-designed, re-toned or
 * rounded: this file is a re-shaping of what already ships, so the migration
 * layers that follow can move a call site off a utility class without also
 * changing what it looks like.
 *
 * Three properties are deliberate:
 *
 *   - **Plain `as const` objects, no dependency.** Not a theme provider, not a
 *     context, not a function. A token is a value, and a value can be read from
 *     a style object, a test, a canvas, a PDF generator, or a Node script that
 *     has no DOM at all. Reaching for `var(--su-*)` here would have made the
 *     scale depend on the stylesheet being loaded, which is the one thing a
 *     token scale must not require.
 *   - **Literals, not aliases of each other's CSS variables.** The same values
 *     are emitted as `--su-*` custom properties by `src/styles/index.css`, for
 *     the half of the system a style object cannot express (see that file, and
 *     the split rule in this package's CLAUDE.md). Two files holding one set of
 *     numbers is a drift risk, so `tokens.parity.test.ts` asserts they agree —
 *     that test is what makes the duplication safe.
 *   - **Names match theme.css.** `--color-ink-75` is `color.ink75`, `--text-label-lg`
 *     is `fontSize.labelLg`, `--bw-chrome` is `borderWidth.chrome`. A camelCase
 *     key maps to its kebab-case custom property mechanically (`inkDeep` →
 *     `ink-deep`, `wkBg2` → `wk-bg-2`, `tl1` → `tl-1`), which is what lets the
 *     parity test compare the two files without a hand-maintained mapping.
 */

/**
 * Type faces. TWO, no aliases: Barlow for body and values, Barlow Semi
 * Condensed for the all-caps chrome (stamps, labels, eyebrows).
 */
export const font = {
  body: "'Barlow', system-ui, -apple-system, sans-serif",
  cond: "'Barlow Semi Condensed', 'Barlow', system-ui, -apple-system, sans-serif",
} as const

/**
 * The spacing rhythm, keyed by its own pixel value.
 *
 * Keyed by pixels rather than by an invented `xs`/`sm`/`lg` vocabulary on
 * purpose: the repo has no such vocabulary today (spacing came from Tailwind's
 * numeric scale, where the rung number is a quarter of the pixel value), and
 * inventing one in a port would mean every migrated call site had to be
 * re-judged rather than translated. `space[8]` is 8px, and `p-2` — Tailwind's
 * name for 8px — translates to it without a lookup table.
 *
 * The rungs are the ones actually in use across the three UI workspaces, so a
 * migrated call site always has an exact landing spot and never rounds.
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
  96: '96px',
} as const

/**
 * The type ladder.
 *
 * The first block is the SEMANTIC ladder (ruleset §4.2) — the one to reach for,
 * named by role rather than by size, and shared by every surface:
 *
 *   nano      8px      smallest markers — TL glyphs, unit suffixes
 *   micro     9px      dense caps meta labels
 *   label     10px     standard uppercase font-cond field/section label
 *   labelLg   10.5px   stamp / rail caps label
 *   badge     11px     badges, pills, compact caps values
 *   note      11.5px   small body copy in rails and insets
 *   caption   13px     hints, empty states, subtitles
 *   lede      15px     emphasized inline values, inset titles
 *   readout   17px     …then the display end, at a ~1.2 ratio:
 *   title     22px
 *   display   26px
 *   displayLg 31px
 *   hero      38px
 *
 * The second block is the INHERITED rungs, and they are here for an honest
 * reason rather than a tidy one. They are Tailwind's built-in `text-xs` …
 * `text-3xl`, which ~340 call sites across the three workspaces use today.
 * They vanish the moment Tailwind leaves the build, so a scale that omitted
 * them would silently re-size a third of the app's type during migration —
 * exactly the class of regression the epic exists to avoid.
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
  nano: '8px',
  micro: '9px',
  label: '10px',
  labelLg: '10.5px',
  badge: '11px',
  note: '11.5px',
  caption: '13px',
  lede: '15px',
  readout: '17px',
  title: '22px',
  display: '26px',
  displayLg: '31px',
  hero: '38px',
  // — inherited rungs (Tailwind built-ins in live use; see the note above) —
  xs: '12px',
  sm: '14px',
  base: '16px',
  lg: '18px',
  xl: '20px',
  xl2: '24px',
  xl3: '30px',
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
 * Tailwind's own `rounded` / `rounded-md` / `rounded-xl` rungs are deliberately
 * NOT carried across, unlike the inherited type rungs above. The radius ladder
 * is a *closed* role vocabulary with a guard behind it (`check:tokens`,
 * `arbitrary-radius`), so their ~40 call sites are drift the ladder already
 * has a word for — 4px is `card`, 6px is exactly `panel`. Migrating them means
 * naming the role, which is the point of the ladder.
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
  tl3: 'rgb(68, 135, 162)',
  tl4: 'rgb(48, 107, 128)',
  tl5: 'rgb(30, 83, 100)',
  tl6: 'rgb(6, 52, 65)',
  // Non-numeric equipment tiers (Core Book p.3): Bio + Nanite.
  tlB: 'rgb(86, 156, 104)',
  tlN: 'rgb(146, 109, 184)',

  // — Entity colours: hue encodes ontology (ruleset §3/§4.1) —
  pilot: 'rgb(239, 137, 79)',
  pilotLight: 'rgb(245, 193, 163)',
  mech: 'rgb(122, 151, 138)',
  mechDark: 'rgb(92, 121, 108)',
  crawler: 'rgb(206, 88, 152)',
  /** The world/opposition schemas — creatures, bio-titans, factions, npcs,
   *  meld, squads. NOT the action rust, despite the tone. */
  adversary: 'rgb(140, 75, 56)',

  // — Guide tones that are not one of the five ontology domains. A guide's band
  //   colour is authored per-guide; most reuse an ontology hue, and these two
  //   cover the guides that are about none of them — the salvage/condition
  //   procedures, and the hazard-stripe band. —
  guideSalvage: 'rgb(90, 157, 181)',
  guideHazard: 'rgb(184, 76, 76)',

  // — Class ability-tier ramp. Advanced and Legendary reuse pilot/crawler, so
  //   only Core needs its own token. —
  tierCore: 'rgb(168, 89, 71)',
  tierCorePale: 'rgb(210, 160, 140)',

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
   *  which a true-neutral grey does not against warm paper. */
  ink85: 'rgb(40 32 25 / 0.85)',
  ink75: 'rgb(40 32 25 / 0.75)',
  ink50: 'rgb(40 32 25 / 0.5)',
  ink40: 'rgb(40 32 25 / 0.4)',
  ink30: 'rgb(40 32 25 / 0.3)',
  ink20: 'rgb(40 32 25 / 0.2)',
  ink12: 'rgb(40 32 25 / 0.12)',
  ink8: 'rgb(40 32 25 / 0.08)',

  /** The ONE light surface (ruleset §4.1) — a near-white warm paper. Pure
   *  white is retired from the UI; the only survivor is the print sheet. */
  paper: 'rgb(251, 250, 247)',
  /** Paper as a FOREGROUND — text and hairlines printed onto a tone or a dark
   *  ground. Paper as a background is always the flat `paper`. */
  paper60: 'rgb(251 250 247 / 0.6)',
  paper30: 'rgb(251 250 247 / 0.3)',

  /** THE single action colour. */
  rust: 'rgb(168, 82, 34)',
  rustHi: 'rgb(138, 64, 25)',
  /** The one sanctioned cream — RollTable banding, and nowhere else. */
  bandCream: 'rgb(243, 237, 226)',

  // — Workshop (light) ground: the step off-paper that makes a card read as a
  //   panel —
  wkBg: 'rgb(230, 240, 245)',
  wkBg2: 'rgb(215, 230, 238)',
  /** The muted secondary-text tone, toned to clear WCAG AA on all three
   *  grounds it lands on (paper 5.78:1 · wkBg 5.22:1 · wkBg2 4.73:1). */
  wkMuted: 'rgb(90, 100, 109)',
  /** NON-TEXT ONLY — 2.03:1 on paper. A hairline/divider tone. */
  wkFaint: 'rgb(167, 180, 189)',
  /** Advisory/info rule. */
  wkLine: 'rgb(143, 195, 216)',
  /** Game-state accent. */
  wkAccent: 'rgb(125, 206, 235)',

  // — Attention fills that are neither an ontology hue nor a status overlay —
  caution: 'rgb(215, 195, 125)',
  inert: 'rgb(192, 192, 192)',

  // — Cargo (storage) accent triplet —
  cargo: 'rgb(156, 122, 62)',
  cargoDeep: 'rgb(111, 85, 39)',
  cargoPale: 'rgb(239, 230, 212)',

  // — Sheet "deep" tones that are literals rather than aliases —
  sheetMechDeep: 'rgb(47, 67, 56)',
  sheetCrawlerDeep: 'rgb(126, 42, 91)',
  /** A LITERAL, not an alias of `tl5`, which holds the same value but means
   *  TECH LEVEL — aliasing it would tie the Game ontology to tech-level
   *  semantics. */
  sheetGameDeep: 'rgb(30, 83, 100)',
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
  sheetPilotDeep: base.rust,
  sheetMech: base.mech,
  sheetCrawler: base.crawler,
  /** The shared-table ontology (ADR-030). Blue, so a Game row never reads as
   *  the crawler row next to it. */
  sheetGame: base.wkAccent,
} as const
