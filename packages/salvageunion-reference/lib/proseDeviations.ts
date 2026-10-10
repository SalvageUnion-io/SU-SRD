/**
 * The prose-deviation allowlist: every way the dataset's text is allowed to
 * differ from the rulebook it transcribes.
 *
 * The package rule is that descriptions and effects are verbatim. This file is
 * the complete list of exceptions, and the only place one may be added.
 * `tools/check-rules-fidelity.ts` compares every prose string with the books
 * and reads this file to tell a deliberate difference from drift; the verdict
 * it reaches for each string is recorded in `fidelity.lock.json`, which the
 * CI gate `tools/check-fidelity-lock.ts` holds the data to. A difference this
 * file does not explain is recorded as `unverified`, never silently accepted.
 *
 * Two kinds of entry:
 *
 *   - RULES (`PROSE_RULES`, `BOOK_TYPOS`) cover a pattern, not a string: a
 *     markup convention, a suffix we add, a class of text we write ourselves.
 *     A rule is cheap to apply and dangerous to widen; each one says what it
 *     admits and why.
 *   - NAMES (`NAME_DEVIATIONS`) are individual rulings on one entity's name,
 *     each enforced by `proseDeviations.test.ts` so the choice cannot be
 *     "corrected" away.
 *
 * Adding an entry is a claim you have checked the book. Include the page.
 */

/** Why a string may differ from the book, as recorded in `fidelity.lock.json`. */
export type ProseRuleId = keyof typeof PROSE_RULES

export type ProseRule = {
  /** `deviation`: book text, deliberately changed. `authored`: text we wrote. */
  verdict: 'deviation' | 'authored'
  why: string
}

export const PROSE_RULES = {
  'owner-suffix': {
    verdict: 'deviation',
    why: 'A name the book prints for more than one thing carries its owner in parentheses so each has its own slug: an action shared by several owners ("Servo-Lasso (Free Hill Coalition Squad)", "Constricting Coils (Apophis)"), or a record two books print under the same name ("Salvage Cache Table (We Were Here First!)"). The book prints the bare name; the name without the suffix must match.',
  },
  'chassis-placeholder': {
    verdict: 'deviation',
    why: 'A Chassis Ability written once for every chassis that has it says "[(CHASSIS)]" (or "[[CHASSIS]]") where the book names the chassis ("the Colossus"). The placeholder must stand for the owning chassis\'s name, or a generic "this Mech"/"it", and the rest must match.',
  },
  'trait-markup': {
    verdict: 'deviation',
    why: '"[[Hacking]]" links a Trait; the book prints the plain word. The text with the brackets removed must match.',
  },
  'xref-dropped': {
    verdict: 'deviation',
    why: 'A book cross-reference ("see p. 34") points at a page of the book, which the dataset does not have; the reference is dropped and every other word kept.',
  },
  'stat-line': {
    verdict: 'deviation',
    why: 'The book sets an item\'s stat line ("Turn Action // Range: Medium // 2 AP // Hacking") inside its text; the dataset holds those values as structured fields, so the only book words missing from the prose are stat words.',
  },
  'book-typo': {
    verdict: 'deviation',
    why: 'The book misprints a word and the dataset spells it correctly. Each correction is listed in BOOK_TYPOS; nothing else differs.',
  },
  'printed-name': {
    verdict: 'deviation',
    why: 'A name ruling in NAME_DEVIATIONS.',
  },
  boilerplate: {
    verdict: 'authored',
    why: 'A string repeated verbatim across three or more records ("Choose one.", an NPC\'s stock label) that the book does not print: structure the dataset needs, not transcribed text.',
  },
  structural: {
    verdict: 'authored',
    why: "NPC blocks, choices, options and guide steps are assembled by the dataset from the book's tables and procedures; where such a string matches no book text it is ours. Prose outside those fields never falls under this rule.",
  },
} as const satisfies Record<string, ProseRule>

/** Owner suffix on a name: "Name (Owner)". Group 1 is the printed name. */
export const OWNER_SUFFIX = /^(.*\S) \(([^)]+)\)$/

/** Where the book names the chassis, the dataset writes one of these. */
export const CHASSIS_PLACEHOLDERS = ['[(CHASSIS)]', '[[CHASSIS]]']
/** Generic stand-ins the book uses where the dataset says "[(CHASSIS)]". */
export const CHASSIS_STAND_INS = ['the Mech', 'this Mech', 'your Mech', 'it'] as const
export const TRAIT_MARKUP = /\[\[([^\]]+)\]\]/g

/** A string repeated this many times, matching no book text, is boilerplate. */
export const BOILERPLATE_MIN_REPEATS = 3

/** Fields whose strings the dataset assembles itself (the `structural` rule). */
export const STRUCTURAL_FIELDS = ['choices', 'npc', 'options', 'steps'] as const

export type BookTypo = {
  /** The word as the book prints it. */
  printed: string
  /** The dataset's spelling. */
  corrected: string
  source: string
  page: number
}

/**
 * Words the book misprints that the dataset corrects. Matched as single words,
 * case-insensitively, and only as the sole difference in a string.
 */
export const BOOK_TYPOS: BookTypo[] = [
  { printed: 'recieve', corrected: 'receive', source: 'Salvage Union Workshop Manual', page: 47 },
  { printed: 'Chooose', corrected: 'choose', source: 'Salvage Union Workshop Manual', page: 47 },
  { printed: 'you', corrected: 'your', source: 'Salvage Union Workshop Manual', page: 39 },
  { printed: 'succesful', corrected: 'successful', source: 'Rainmaker', page: 77 },
  { printed: 'Aphosis', corrected: 'Apophis', source: 'Rainmaker', page: 81 },
]

/**
 * ## Printed names
 *
 * Entities whose dataset `name` deliberately differs from the heading printed
 * in the rulebook.
 *
 * These are NOT errors. Each one is a considered choice — usually because the
 * book itself uses two names for the same thing (an entry heading plus a
 * different form in its contents list, pattern loadouts, or summary tables) and
 * the dataset picked the form that reads better in a list, or that a public URL
 * already depends on.
 *
 * The problem this file solves is that the choice is invisible in the data. A
 * future contributor re-deriving names from the PDFs sees `Video Projection
 * Array` against a printed heading of `Projection Array`, reads it as a typo,
 * "corrects" it — and silently breaks `/schema/modules/item/video-projection-
 * array`, a URL that is canon.
 *
 * A documentary `alias` field on the records themselves was considered and
 * rejected: a field written but read by nothing is exactly the `indexable`
 * flag's failure mode (set on 39 records, consumed by no code, impossible to
 * tell whether it is load-bearing), and knip cannot see a dead data field the
 * way it sees a dead export. Encoding the decision as a test instead gives it
 * teeth — renaming one of these to its printed form fails the build, with a
 * message pointing at the reason — and it cannot rot into decoration.
 *
 * Search does not need this list: it already resolves both forms, because the
 * dataset and printed names overlap enough to match on substring.
 *
 * Adding an entry is a claim you have checked the book. Include the page.
 */
export type NameDeviation = {
  /** The `SalvageUnionReference` accessor the entity lives under. */
  schema: 'Modules' | 'Systems' | 'Equipment' | 'CrawlerBays'
  /** The name in the dataset — the canonical one, which slugs and URLs use. */
  name: string
  /** The heading as printed in the book. */
  printedAs: string
  /** Printed page carrying that heading. */
  page: number
  why: string
}

export const NAME_DEVIATIONS: NameDeviation[] = [
  {
    schema: 'Modules',
    name: 'Video Projection Array',
    printedAs: 'Projection Array',
    page: 196,
    why: 'The book uses both: the entry heading and index say "Projection Array", while the module contents list and the summary tables say "Video Projection Array". The dataset form is canon because /schema/modules/item/video-projection-array is a public URL.',
  },
  {
    schema: 'Modules',
    name: 'Adv. Weapon Link',
    printedAs: 'Advanced Weapon Link',
    page: 198,
    why: 'The book abbreviates to "Adv." in chassis pattern loadouts (e.g. p. 109) and spells it out in the entry heading. Abbreviated here to distinguish it at a glance from the plain "Weapon Link" (p. 193).',
  },
  {
    schema: 'Modules',
    name: 'Adv. Reactor Safety Protocols',
    printedAs: 'Advanced Reactor Safety Protocols',
    page: 202,
    why: 'Same "Adv." abbreviation, distinguishing it from "Reactor Safety Protocols" (p. 197).',
  },
  {
    schema: 'Modules',
    name: 'He₂ Coolant Flush',
    printedAs: 'He2 Coolant Flush',
    page: 205,
    why: 'Typographic only: the dataset uses a Unicode subscript two, the book sets a plain "2".',
  },
  {
    schema: 'Systems',
    name: 'Adv. Fabrication Arm',
    printedAs: 'Advanced Fabrication Arm',
    page: 177,
    why: 'Same "Adv." abbreviation, distinguishing it from "Fabrication Arm" (p. 174).',
  },
  {
    schema: 'Systems',
    name: 'Sandblaster',
    printedAs: 'Sand Blaster',
    page: 168,
    why: 'The book sets the heading as two words in small caps ("SAND BLASTER"); the dataset closes it up.',
  },
  {
    schema: 'Equipment',
    name: 'Adv. Epoxy Applicator',
    printedAs: 'Advanced Epoxy Applicator',
    page: 84,
    why: 'Same "Adv." abbreviation, distinguishing it from the Handheld Epoxy Canister (p. 83) and Integrated Epoxy Printer (p. 110).',
  },
  {
    schema: 'CrawlerBays',
    name: 'VR Tubes',
    printedAs: 'Mech Simulator',
    page: 57,
    why: 'RAINMAKER prints this as location "[19] Mech Simulator" in an adventure map, and the bay text is near-verbatim from it. The dataset renames it because it exists here as an installable Crawler Bay rather than a room: "Mech Simulator" reads as a place, "VR Tubes" as equipment. The book\'s own name is unusable anyway — an adventure location and a Crawler Bay are different kinds of thing.',
  },
  {
    schema: 'Modules',
    name: 'Electro-Magnetic Self-Destruct',
    printedAs: 'EM Self-Destruct',
    page: 203,
    why: 'The heading abbreviates and the entry\'s own first sentence spells it out ("the Electro-Magnetic Self-Destruct was intended to counter..."), so both names are the book\'s. The dataset takes the expanded one because "EM" is opaque in a list where nothing else is abbreviated.',
  },
  {
    schema: 'Equipment',
    name: 'Portable Comms Unit',
    printedAs: 'Portable Communications Unit',
    page: 81,
    why: 'The book uses both: the entry heading on p. 81 spells it out, while the equipment summary tables and every NPC gear list say "Portable Comms Unit". The dataset follows the tables — the short form is what a player reads on a sheet, and the dataset carries a matching "Portable Comms Unit (NPC)" action.',
  },
]
