import { color, space } from '../../design/tokens'
import { textBand } from '../referenceEntity/referenceEntityHelpers'

/**
 * The words and sizes of an `OgCard`: its props, the canvas, and
 * what its unfurl says beside the image — `og:title` (the name),
 * `og:description` (the kicker and byline, never the body) and `theme-color`
 * (the band's tone). A module of its own so a page's `<head>` can read them
 * without the component, and so `OgCard.tsx` exports only the component.
 */

/** The canvas: the size every unfurl draws a "large" card at. */
export const OG_CARD_WIDTH = 1200
export const OG_CARD_HEIGHT = 630

/**
 * The previews' one grid, shared by `OgCard` and `BrandCard` so every link
 * preview sets its text on the same edges. `OG_GUTTER` is the outer edge,
 * in from the frame: the notch's side, the small lines (chips, cite, kicker,
 * quote) and, on the right, the address. `OG_NOTCH_INSET` is the inner edge:
 * the notched title, that far inside the notch (`ChapterBand`'s og title
 * padding, `--space-24`).
 */
export const OG_GUTTER = `calc(${space[48]} + ${space[8]})`
export const OG_NOTCH_INSET = space[24]

/**
 * One chip, label first, as the page's horizontal `Stat` draws it: `TL | 1`,
 * a bare "Turn Action", a trait `[Burn | 2]`.
 */
export type OgCardStat = { label: string; value?: string }

type OgCardBase = {
  /**
   * The kind, "Chassis", "Pilot · Engineer": the `og:description`'s lead, and
   * printed on the foot line before a built thing's byline (never on a
   * reference entity's foot, E9), never above the title (E20).
   */
  kicker: string
  /** The notched title: the thing's name. */
  title: string
  /**
   * The address the foot prints. The app prints host and path; the SRD prints the
   * bare path (`/chassis/scrapper`), since its wordmark already names the host
   * (see `ogReferenceAddressFits`).
   */
  address: string
}

export type OgCardProps =
  | (OgCardBase & {
      kind: 'thing'
      /** The band colour: the entity's tone, any CSS colour. */
      tone: string
      /** Its chips in E17's order: action type, facts (TL first), traits. */
      stats: OgCardStat[]
      /** The cost as the book's pointy box prints it, last: "2 EP". */
      cost?: string
      /** The page cite, every printing on one line: "Workshop Manual · p.104 // … · p.12". */
      cite?: string
    })
  | (OgCardBase & {
      kind: 'do'
      /** An ability's tier tone (any CSS colour); without one, the ink band. */
      tone?: string
      /** The book's tier numeral, for an ability: left of the name on the band. */
      tier?: string
      /** Its chips in the stat order (E17): stats, action type and facets, traits. */
      stats: OgCardStat[]
      /** The cost as the book's pointy box prints it, last: "2 AP". */
      cost?: string
      /** The rules text, clamped to two lines. */
      rules?: string
      cite?: string
    })
  | (OgCardBase & {
      kind: 'sheet'
      tone: string
      stats: OgCardStat[]
      /** "Rosa's pilot · Reclamation of the Wastes". */
      byline: string
    })
  | (OgCardBase & {
      kind: 'userMade'
      tone: string
      stats: OgCardStat[]
      /** The maker's name; the byline reads "Made by [user]" and nothing else. */
      madeBy: string
      /**
       * Whether the notch prints the name in curly quotes. A pattern is quoted
       * ("TOW RIG", board PV1); an NPC is a person and reads bare. Default true.
       */
      quoted?: boolean
    })
  | (OgCardBase & {
      kind: 'invite'
      tone: string
      /** "Mediated by alxjrvs. …" — what the invite tells its bearer, no more. */
      summary: string
      /** "Link expires 15 Oct · the Mediator lets you in". */
      terms?: string
    })
  | { kind: 'private'; address: string }

export type OgCardKind = OgCardProps['kind']

/** The kinds the SRD renders; every other kind is the app's. */
export const REFERENCE_KINDS: ReadonlySet<OgCardKind> = new Set(['thing', 'do'])

/**
 * The band's colour for a card — the entity's tone, an ability's tier tone
 * (as its page band and Discord stripe wear it), the ink of any other thing
 * you do, or the ink-deep of a private card. Also the page's `theme-color`, so
 * Discord's side bar matches the band: see `ogCardThemeColor`. An ability's
 * numeral sits on the band, so a tone that carries no text paints its deeper band
 * (ruleset §3.8), as an entity card's header does: crawler pink → the
 * crawler band.
 */
export function bandColor(props: OgCardProps): string {
  if (props.kind === 'private' || (props.kind === 'do' && !props.tone)) return color.inkDeep
  const tone = props.tone ?? color.inkDeep
  return textBand(tone) ?? tone
}

/**
 * The card's `theme-color`: the band's colour as a literal. A `var(--color-x)`
 * tone resolves to its token, since a `<meta>` cannot read a custom property.
 */
export function ogCardThemeColor(props: OgCardProps): string {
  const band = bandColor(props)
  const variable = band.match(/^var\(--color-([a-z0-9-]+)\)$/)
  if (!variable) return band
  const key = (variable[1] ?? '').replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
  return (color as Record<string, string>)[key] ?? band
}

/** The cards that preview a reference entity's page: their foot is its foot band. */
const ENTITY_FOOT: ReadonlySet<OgCardProps['kind']> = new Set(['thing', 'do'])

/**
 * The card's foot, set as an entity page's footer is: on the right the cite,
 * the byline or "Made by [user]", and the kind in caps on the left but on a
 * reference entity's card, whose foot, like its page's, names no kind (ruleset
 * Source 2, E9).
 */
export function footOf(props: OgCardProps): { kind?: string; byline?: string } {
  const byline = bylineOf(props)
  const kind = props.kind === 'private' || ENTITY_FOOT.has(props.kind) ? undefined : props.kicker
  return { ...(kind ? { kind } : {}), ...(byline ? { byline } : {}) }
}

function joinLine(parts: (string | undefined)[]): string {
  return parts.filter((part) => part && part.length > 0).join(' · ')
}

/** What the card says of where it comes from: the cite, the byline, or "Made by [user]". */
function bylineOf(props: OgCardProps): string | undefined {
  switch (props.kind) {
    case 'thing':
    case 'do':
      return props.cite
    case 'sheet':
      return props.byline
    case 'userMade':
      return `Made by ${props.madeBy}`
    case 'invite':
      return props.terms
    case 'private':
      return PRIVATE_LINE
  }
}

/** The `og:title`: the thing's name, or "Private". */
export function ogCardTitle(props: OgCardProps): string {
  return props.kind === 'private' ? PRIVATE_TITLE : props.title
}

/**
 * The `og:description`: the kicker and the byline, never the body (issue
 * 1280). An invite's summary is its byline: it is what the invite says.
 */
export function ogCardDescription(props: OgCardProps): string {
  if (props.kind === 'private') return PRIVATE_LINE
  const byline = props.kind === 'invite' ? props.summary : bylineOf(props)
  return joinLine([props.kicker, byline])
}

const PRIVATE_TITLE = 'Private'
const PRIVATE_LINE = "Its owner hasn't shared this."

/** The string the notch prints: the name, in curly quotes for a quoted user-made card. */
export function ogCardPrintedTitle(props: OgCardProps): string {
  const title = ogCardTitle(props)
  return props.kind === 'userMade' && props.quoted !== false ? `\u201C${title}\u201D` : title
}

/** The notch's room for text, in px: the card less its gutters and the notch's padding. */
const NOTCH_ROOM = 1028
/** The display size, and the source floor (34px at 1200 is 11px at 400). */
const TITLE_MAX = 120
const TITLE_MIN = 34
/**
 * Barlow Semi Condensed caps advance 0.55 to 0.7em a character (W, M, O wide;
 * I, J narrow). 0.62 is the smallest step that held every SRD name, bare and
 * quoted, inside the notch when measured in the real face (0.52 let 11 spill),
 * while keeping all but a handful at their widest fit. The notch also
 * ellipsizes, so a wrong guess costs a smaller title, never a second line.
 */
const TITLE_ADVANCE = 0.62

/**
 * The notch's font size for the string it prints (quotes included, see
 * `ogCardPrintedTitle`): 120px when it fits, stepping down so it stays on one
 * line, never under the 34px source floor. A name still too long at the floor
 * is ellipsized by the notch (`.su-chapter-band[data-scale='og']`).
 */
export function ogTitleSize(printed: string, chipsWidth = 0): number {
  const room = chipsWidth > 0 ? NOTCH_ROOM - chipsWidth - CHIPS_GAP : NOTCH_ROOM
  const fit = Math.floor(room / (TITLE_ADVANCE * Math.max(printed.length, 1)))
  return Math.max(TITLE_MIN, Math.min(TITLE_MAX, fit))
}

/** The gap between the notch and the chips beside it, in px. */
const CHIPS_GAP = 24
/** The chips' gap between cells and between rows, in px (`.su-og-chips`). */
export const OG_CHIP_GAP = 14
/** A chip's height at the preview's 36px plate, in px. */
const CHIP_HEIGHT = 58
/**
 * The most rows of chips the band stacks over the notch's foot: what a
 * `thing` card's band, which takes the card down to its foot, holds.
 */
const CHIP_ROWS_MAX = 5
/** The band's height with no chips, or chips that fit beside the notch, in px. */
const OG_BAND_HEIGHT = 230
/** The band's room over its top chip row, in px. */
const BAND_HEADROOM = 24
/**
 * A chip's width in px, measured in the real face at the preview's 36px
 * plate: about 21px a character, plus the two cells' padding for a
 * `label | value` chip or one cell's for a bare label. The cost's pointy box
 * is 44px and carries its point; the User-made stamp is 36px and dashed.
 */
function chipWidth(chip: OgCardChip): number {
  return Math.ceil(CHIP_SLACK * chipAdvance(chip))
}

/** The estimate's margin: a wide-lettered chip measures up to 4% over it. */
const CHIP_SLACK = 1.05

function chipAdvance(chip: OgCardChip): number {
  switch (chip.kind) {
    case 'stat':
      return 21 * (chip.label.length + (chip.value?.length ?? 0)) + (chip.value ? 54 : 32)
    case 'cost':
      return 27 * chip.text.length + 64
    case 'stamp':
      return 22 * chip.text.length + 40
  }
}

/** One chip, for sizing the chip group beside the title. */
export type OgCardChip =
  | { kind: 'stat'; label: string; value?: string | undefined }
  | { kind: 'cost'; text: string }
  | { kind: 'stamp'; text: string }

/** How many rows `widths` packs into at `width`, left to right. */
function rowsAt(widths: number[], width: number): number {
  let rows = 1
  let line = 0
  for (const w of widths) {
    const next = line === 0 ? w : line + OG_CHIP_GAP + w
    if (next > width && line > 0) {
      rows += 1
      line = w
    } else line = next
  }
  return rows
}

/** The narrowest width, in px, that packs `widths` into `rows` rows. */
function widthFor(widths: number[], rows: number): number {
  const total = widths.reduce((sum, w) => sum + w, 0) + OG_CHIP_GAP * (widths.length - 1)
  let width = Math.max(...widths)
  while (width < total && rowsAt(widths, width) > rows) width += 4
  return Math.min(width, total)
}

/**
 * Where the chips go: `beside` the title (centred on its capitals,
 * `ogChipsLift`), or `below` it, on
 * the page ground under the notch, when a name too long to share its line
 * would otherwise be cut (nothing goes above the title, EDL E20). Their
 * width, the band's height and the title's size.
 */
export type OgCardLayout = {
  chips: 'beside' | 'below'
  chipsWidth: number
  bandHeight: number
  titleSize: number
}

/**
 * The band's layout for a title and its chips, which ride the band beside
 * it as a show page's header chips do. It takes the fewest rows of chips that
 * leave the title within `STACK_GAIN` of its biggest size (stacking up to
 * five, the band growing to hold them), so a long name never shrinks far for
 * chips that could stack. A name that would still be cut keeps its whole
 * line, and the chips go under it, on the page ground.
 */
export function ogCardLayout(printed: string, chips: readonly OgCardChip[]): OgCardLayout {
  const alone = ogTitleSize(printed)
  if (chips.length === 0) {
    return { chips: 'beside', chipsWidth: 0, bandHeight: OG_BAND_HEIGHT, titleSize: alone }
  }
  const widths = chips.map(chipWidth)
  const layouts: OgCardLayout[] = []
  for (let rows = 1; rows <= Math.min(CHIP_ROWS_MAX, widths.length); rows++) {
    const chipsWidth = widthFor(widths, rows)
    const titleSize = ogTitleSize(printed, chipsWidth)
    const stack =
      BAND_HEADROOM + rows * CHIP_HEIGHT + (rows - 1) * OG_CHIP_GAP + ogChipsLift(titleSize)
    layouts.push({
      chips: 'beside',
      chipsWidth,
      bandHeight: Math.max(OG_BAND_HEIGHT, stack),
      titleSize,
    })
  }
  const biggest = Math.max(...layouts.map((layout) => layout.titleSize))
  const beside = layouts.find((layout) => layout.titleSize >= biggest * STACK_GAIN) as OgCardLayout
  if (!cutBeside(printed, beside.chipsWidth)) return beside
  return { chips: 'below', chipsWidth: 0, bandHeight: OG_BAND_HEIGHT, titleSize: alone }
}

/** Whether the title, beside chips `chipsWidth` wide, would be cut even at the floor. */
function cutBeside(printed: string, chipsWidth: number): boolean {
  const room = NOTCH_ROOM - chipsWidth - CHIPS_GAP
  return room / (TITLE_ADVANCE * Math.max(printed.length, 1)) < TITLE_MIN
}

/**
 * The notch's capitals' middle above the band's foot, as a share of the
 * title's size: its baseline (the face's descent less the half-leading of its
 * 0.92 line) plus half Barlow Semi Condensed's cap height.
 */
const NOTCH_MIDDLE = 0.076 + 0.352

/**
 * How far the chips beside the title sit off the band's foot, in px: their
 * last row centred on the middle of the title's capitals (EDL E17), never
 * below the foot for a title shorter than a chip.
 */
export function ogChipsLift(titleSize: number): number {
  return Math.max(0, Math.round(titleSize * NOTCH_MIDDLE - CHIP_HEIGHT / 2))
}

/**
 * Another row of chips must buy the title more than this share of its size:
 * a chip group reads best on as few rows as it can, so a title within this of
 * its biggest keeps the shallower stack.
 */
const STACK_GAIN = 0.75

/**
 * The reference foot's room for the address, in px: the card less its gutters,
 * the mark, the `PRODUCT.wordmark` and the gap, measured in the real
 * face. The app's area names are shorter and leave it more.
 */
const REFERENCE_ADDRESS_ROOM = 672
/** The foot's address size: the 34px source floor. */
const ADDRESS_SIZE = 34
/**
 * Barlow Semi Condensed semibold advances about 0.42em a character over SRD
 * paths (lowercase, digits, hyphens and slashes) when measured; 0.45 leaves
 * room for the wide letters (m, w).
 */
const ADDRESS_ADVANCE = 0.45

/**
 * Whether an address fits the reference foot on one line. The foot is a
 * readout of where the link goes, so it is never clipped: the SRD picks the
 * longest form of the page's path that fits (`apps/web/src/lib/ogCard.ts`).
 */
export function ogReferenceAddressFits(address: string): boolean {
  return address.length * ADDRESS_ADVANCE * ADDRESS_SIZE <= REFERENCE_ADDRESS_ROOM
}
