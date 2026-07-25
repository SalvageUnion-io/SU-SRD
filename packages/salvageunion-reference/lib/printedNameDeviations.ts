/**
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
export type Deviation = {
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

export const DEVIATIONS: Deviation[] = [
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
